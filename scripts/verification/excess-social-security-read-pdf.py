"""Independent 2025 payroll oracle: Decimal source facts -> HTTP and PDF widgets.

Does not import engine code, expected JS fixtures, rate constants or field maps.
Scope: captured ordinary-wage Single/MFJ synthetic cases, no RRTA or other income.
Pub. 3 (2025), pp. 23-24; 1040 instructions, Schedule 3 line 11; printed Schedule
2 line 13. Pub. 3's worksheet still names Schedule 2 line 6: the actual 2025
form and W-2 code instructions place A/B/M/N amounts on line 13.
"""
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import sys
import pymupdf

D = Decimal
LIMIT = D('10918.20')
ZERO = D(0)


def dollars(value):
    return int(value.quantize(D('1'), rounding=ROUND_HALF_UP))


def money(value):
    amount = D(str(value))
    if not amount.is_finite() or amount < 0 or amount != amount.quantize(D('.01')):
        raise ValueError('Invalid source cents')
    return amount


def compute(request):
    info = request['information']
    status = info['taxPayer']['filingStatus']
    if request['taxYear'] != 'Y2025' or status not in ('S', 'MFJ'):
        raise ValueError('Outside independent payroll oracle scope')
    if info['f1099s'] or info.get('rrtaCompensation') or info.get('rrtaTax') or info.get('form8801'):
        raise ValueError('Not an ordinary W-2 payroll case')
    people = defaultdict(lambda: defaultdict(lambda: [ZERO, ZERO]))
    wages = withholding = medicare = uncollected = ZERO
    for w in info['w2s']:
        wages += money(w['income'])
        withholding += money(w['fedWithholding'])
        medicare += money(w['medicareIncome'])
        codes = w.get('box12') or {}
        uncollected += sum((money(codes.get(c, 0)) for c in 'ABMN'), ZERO)
        employer = w['employer']['EIN'].replace('-', '')
        person = w['personRole']
        if person not in ('PRIMARY', 'SPOUSE') or (status == 'S' and person != 'PRIMARY'):
            raise ValueError('Unexpected taxpayer role')
        people[person][employer][0] += money(w['ssWithholding'])
        people[person][employer][1] += sum((money(codes.get(c, 0)) for c in 'AM'), ZERO)
    credit = ZERO
    for employers in people.values():
        if len(employers) > 1:
            eligible = sum((min(tax, LIMIT) + other for tax, other in employers.values()), ZERO)
            credit += max(ZERO, eligible - LIMIT)
    ss = dollars(credit)
    # IRS TY2025 Tax Computation Worksheet/rates. These cases are all >= $100k;
    # the < $100k Tax Table is intentionally outside this oracle's scope.
    taxable = max(0, dollars(wages) - (15750 if status == 'S' else 31500))
    if taxable < 100000:
        raise ValueError('Use the independent Tax Table oracle for lower income')
    bounds = ([11925, 48475, 103350, 197300, 250525, 626350] if status == 'S'
              else [23850, 96950, 206700, 394600, 501050, 751600])
    rates = map(D, ['.10', '.12', '.22', '.24', '.32', '.35', '.37'])
    ordinary = ZERO
    low = 0
    for high, rate in zip(bounds + [taxable], rates):
        ordinary += max(ZERO, min(D(taxable), D(high)) - low) * rate
        low = high
    regular = dollars(ordinary)
    additional_medicare = dollars(max(ZERO, medicare - (200000 if status == 'S' else 250000)) * D('.009'))
    tax = regular + additional_medicare + dollars(uncollected)
    payments = dollars(withholding) + ss
    return dict(lines={'1a': dollars(wages), '15': taxable, '16': regular,
                       '23': additional_medicare + dollars(uncollected),
                       '24': tax, '25a': dollars(withholding), '31': ss or None,
                       '33': payments, '37': max(0, tax - payments)},
                ss=ss, uncollected=dollars(uncollected),
                additional=additional_medicare)


def main():
    root = Path(sys.argv[1])
    report = json.loads((root / 'payroll-results.json').read_text())
    if report['status'] != 'PASS' or len(report['results']) != 6 or len(report['refusals']) != 8:
        raise ValueError('Incomplete HTTP payroll replay')
    checks = 0
    for case in report['results']:
        request = json.loads((root / (case['id'] + '.request.json')).read_text())
        result = json.loads((root / (case['id'] + '.response.json')).read_text())
        expected = compute(request)
        for line, value in expected['lines'].items():
            found = result['returnLines']['lines'][line]
            if found != value:
                raise ValueError((case['id'], 'HTTP', line, found, value))
            checks += 1
        forms = ['f1040'] + [tag for tag in case['forms'] if tag != 'f1040']
        if ('f1040s3' in forms) != bool(expected['ss']):
            raise ValueError('Incorrect Schedule 3 applicability')
        checks += 1
        with pymupdf.open(root / (case['id'] + '.pdf')) as pdf:
            widgets = [(w.field_name, w.field_value) for page in pdf for w in (page.widgets() or [])]
            def check(tag, leaf, value):
                nonlocal checks
                prefix = '' if tag == 'f1040' else f'attachment_{forms.index(tag)}_'
                matches = [v for name, v in widgets
                           if (name.startswith(prefix) if prefix else not name.startswith('attachment_'))
                           and name.endswith('.' + leaf + '[0]')]
                if len(matches) != 1:
                    raise ValueError((case['id'], tag, leaf, 'Missing/ambiguous widget'))
                found = matches[0]
                if (value is None and found not in (None, '')) or (value is not None and str(found) != str(value)):
                    raise ValueError((case['id'], tag, leaf, found, value))
                checks += 1
            for line, leaf in {'1a': 'f1_47', '15': 'f2_06', '16': 'f2_08', '23': 'f2_15',
                               '24': 'f2_16', '25a': 'f2_17', '31': 'f2_27', '33': 'f2_29',
                               '37': 'f2_35'}.items():
                check('f1040', leaf, expected['lines'][line])
            if expected['ss']:
                check('f1040s3', 'f1_28', expected['ss'])
                check('f1040s3', 'f1_37', expected['ss'])
            if 'f1040s2' in forms:
                check('f1040s2', 'f1_18', 0)  # total 4137/8919 tax, not Schedule H
                check('f1040s2', 'f1_20', None)  # no household employment in these cases
                check('f1040s2', 'f1_22', expected['additional'] or None)
                check('f1040s2', 'f1_24', expected['uncollected'] or None)
                check('f1040s2', 'f2_24', expected['uncollected'] + expected['additional'])
    files = [dict(path=p.name, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
             for p in sorted(root.iterdir()) if p.suffix in ('.json', '.pdf')]
    summary = dict(status='PASS', httpCases=6, pdfs=6, independentChecks=checks,
                   refusalChecks=8, identity=report['identity'], irsApproval=False, files=files)
    with (root / 'payroll-independent-verification.json').open('x') as file:
        json.dump(summary, file, indent=2)
    print(json.dumps({k: v for k, v in summary.items() if k not in ('files', 'identity')}))


if __name__ == '__main__':
    main()
