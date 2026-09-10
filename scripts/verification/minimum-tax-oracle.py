"""Independent Decimal transcription of pinned IRS 2025 Form 8801.

No imports of engine code, rates, helpers, or expected engine output. These are
synthetic source-return worksheets, NOT IRS-assigned ATS scenarios. The prior
return's AMT exclusion adjustments and refigured foreign worksheets are inputs;
this oracle does not certify how those source facts were prepared.
Default checks the committed fixture; --write explicitly regenerates it.
"""
from decimal import Decimal as D, ROUND_HALF_UP
from pathlib import Path
import hashlib
import json
import sys

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'src/forms/Y2025/tests/fixtures/minimum-tax-goldens.json'

def whole(v):
    return int(D(str(v)).quantize(D(1), rounding=ROUND_HALF_UP))

def total(*values):
    return whole(sum((D(str(x)) for x in values), D(0)))

def percent(v, rate):
    return whole(D(str(v)) * D(str(rate)) / 100)

def ordinary(value, status):
    cap = 116300 if status == 'MFS' else 232600
    return percent(value, 26) if value <= cap else percent(value, 28) - cap // 50

def source(income=50000, status='S', **updates):
    p = dict(taxYear=2024, filingStatus=status, returnType='1040',
             form6251=dict(line1=income, line2e=0, line10=25000, line11=2000),
             form8801Line26=1000000, unallowedQualifiedElectricVehicleCredit=0,
             netUSRealPropertyGain=0, capitalGains=dict(method='ordinary'),
             foreignEarnedIncome=dict(applicable=False, form2555Lines45And50=0, relatedDisallowedDeductions=0),
             foreignTaxCreditOnExclusions=dict(method='none', amount=0))
    p.update(updates)
    return dict(priorYear=p, priorYearAMTI=total(p['form6251']['line1'], p['form6251']['line2e']),
                exclusionItems=0, mtcNOLDeduction=0,
                priorYearRegularTaxMinusCredits=p['form6251']['line10'],
                priorYearAMTCreditCarryforward=p['form8801Line26'])

def compute(data, current_tax=8010):
    p = data['priorYear']; status = p['filingStatus']; joint = status in ('MFJ', 'W')
    r = p['form6251']; lines = {}
    lines[1] = total(r['line1'], r['line2e'])
    lines[2] = whole(data['exclusionItems']); lines[3] = -whole(data['mtcNOLDeduction'])
    lines[4] = max(0, total(lines[1], lines[2], lines[3]))
    if status == 'MFS' and lines[4] > 875950:
        lines[4] += min(66650, percent(lines[4] - 875950, 25))
    lines[5] = 133300 if joint else 66650 if status == 'MFS' else 85700
    lines[6] = 1218700 if joint else 609350
    lines[7] = max(0, lines[4] - lines[6]); lines[8] = percent(lines[7], 25)
    lines[9] = max(0, lines[5] - lines[8])
    lines[10] = max(0, lines[4] - lines[9])
    if p['returnType'] == '1040-NR': lines[10] = max(lines[10], min(whole(p['netUSRealPropertyGain']), lines[4]))
    foreign = p['foreignEarnedIncome']; excluded = max(0, total(foreign['form2555Lines45And50'], -foreign['relatedDisallowedDeductions'])) if foreign['applicable'] else 0
    gross = lines[10] + excluded; g = p['capitalGains']
    gains = {}
    if lines[10] and g['method'] != 'ordinary':
        gains[27] = gross
        if g['method'] == 'qualified_dividends':
            gain = whole(g['netCapitalGain']); qd = whole(g['qualifiedDividends'])
            excess = max(0, gain + qd - lines[10]) if foreign['applicable'] else 0
            qd -= max(0, excess - gain); gain = max(0, gain - excess)
            gains[28] = qd + gain; gains[30] = gains[28]
            gains[35] = gains[42] = whole(g['ordinaryIncome'])
        else:
            refigure = g.get('foreignAMTRefigure', g)
            gains[28] = whole(refigure['preferentialGain'])
            gains[29] = whole(refigure['unrecaptured1250Gain'])
            gains[30] = min(gains[28] + gains[29], whole(refigure['netCapitalGain']))
            gains[35] = whole(g['ordinaryIncome']); gains[42] = whole(g['ordinaryIncomeFor20PercentLimit'])
        gains[31] = min(gross, gains[30]); gains[32] = gross - gains[31]
        gains[33] = ordinary(gains[32], status)
        gains[34] = 94050 if joint else 63000 if status == 'HOH' else 47025
        gains[36] = max(0, gains[34] - gains[35]); gains[37] = min(gross, gains[28])
        gains[38] = min(gains[36], gains[37]); gains[39] = gains[37] - gains[38]
        gains[40] = 583750 if joint else 291850 if status == 'MFS' else 551350 if status == 'HOH' else 518900
        gains[41] = gains[36]; gains[43] = gains[41] + gains[42]; gains[44] = max(0, gains[40] - gains[43])
        gains[45] = min(gains[39], gains[44]); gains[46] = percent(gains[45], 15)
        gains[47] = gains[38] + gains[45]
        if gains[47] != gross:
            gains[48] = gains[37] - gains[47]; gains[49] = percent(gains[48], 20)
            if gains.get(29, 0):
                gains[50] = gains[32] + gains[47] + gains[48]; gains[51] = gross - gains[50]; gains[52] = percent(gains[51], 25)
        gains[53] = sum(gains.get(i, 0) for i in (33, 46, 49, 52))
        gains[54] = ordinary(gross, status); gains[55] = min(gains[53], gains[54])
    lines[11] = (gains[55] if gains else ordinary(gross, status)) - ordinary(excluded, status) if lines[10] else 0
    lines[12] = whole(p['foreignTaxCreditOnExclusions']['amount']) if lines[10] else 0
    lines[13] = lines[11] - lines[12]; lines[14] = whole(r['line10'])
    lines[15] = max(0, lines[13] - lines[14]) if lines[10] else 0
    lines[16] = whole(r['line11']); lines[17] = lines[15]; lines[18] = lines[16] - lines[17]
    lines[19] = whole(p['form8801Line26']); lines[20] = whole(p['unallowedQualifiedElectricVehicleCredit'])
    lines[21] = lines[18] + lines[19] + lines[20]
    # All goldens use independently established Single / W-2 $75,250 current facts.
    # IRS 2025 Tax Table [59500,59550): $8,010; current AMTI is below its exemption.
    lines.update({22: current_tax, 23: 0, 24: current_tax, 25: max(0, min(lines[21], current_tax))})
    lines[26] = max(0, lines[21] - lines[25])
    return {str(k): v for k, v in sorted(lines.items())}, {str(k): v for k, v in sorted(gains.items())}

def cases():
    entries = []
    def add(name, data):
        lines, part3 = compute(data)
        entries.append(dict(id=name, data=data, lines=lines, part3=part3))
    amounts = [-1000, 0, 1, 66649, 66650, 66651, 85699, 85700, 85701, 133300,
               182949, 182950, 182951, 318299, 318300, 318301, 609349, 609350,
               609351, 709350, 875949, 875950, 875951, 952150, 1142550, 1218700, 1751900]
    for status in ('S', 'MFJ', 'MFS', 'HOH', 'W'):
        for amount in amounts: add(f'ordinary-{status}-{amount}', source(amount, status))
        for income in (150000, 200000, 800000):
            for ordinary_income in (0, 30000, 450000):
                g = dict(method='qualified_dividends', qualifiedDividends=60000, netCapitalGain=20000, ordinaryIncome=ordinary_income)
                add(f'qdcg-{status}-{income}-{ordinary_income}', source(income, status, capitalGains=g))
                g = dict(method='schedule_d', preferentialGain=50000, netCapitalGain=80000, ordinaryIncome=ordinary_income, ordinaryIncomeFor20PercentLimit=ordinary_income, unrecaptured1250Gain=20000)
                add(f'schedule-d-{status}-{income}-{ordinary_income}', source(income, status, capitalGains=g))
    for excluded in (100000, 180000, 250000):
        for income in (150000, 300000):
            f = dict(applicable=True, form2555Lines45And50=excluded, relatedDisallowedDeductions=5000)
            add(f'foreign-ordinary-{income}-{excluded}', source(income, foreignEarnedIncome=f))
            g = dict(method='qualified_dividends', qualifiedDividends=50000, netCapitalGain=100000, ordinaryIncome=30000)
            add(f'foreign-qdcg-{income}-{excluded}', source(income, foreignEarnedIncome=f, capitalGains=g))
    add('foreign-schedule-d-refigure', source(150000, foreignEarnedIncome=dict(applicable=True, form2555Lines45And50=180000, relatedDisallowedDeductions=0), capitalGains=dict(method='schedule_d', preferentialGain=100000, netCapitalGain=150000, ordinaryIncome=30000, ordinaryIncomeFor20PercentLimit=30000, unrecaptured1250Gain=20000, foreignAMTRefigure=dict(gainExcess=85700, preferentialGain=64300, netCapitalGain=64300, unrecaptured1250Gain=0, worksheetReference='synthetic-refigured-D'))))
    for method in ('election_without_1116', 'prepared_mtftce'):
        ftc = dict(method=method, amount=500)
        if method == 'prepared_mtftce': ftc['worksheetReference'] = 'synthetic-exclusion-1116'
        add('foreign-credit-' + method, source(200000, foreignTaxCreditOnExclusions=ftc))
    add('NR-floor', source(50000, returnType='1040-NR', netUSRealPropertyGain=40000))
    data = source(100000); data.update(exclusionItems=-10000, mtcNOLDeduction=20000); add('negative-exclusions-and-NOL', data)
    add('unused-electric-credit', source(50000, unallowedQualifiedElectricVehicleCredit=2500))
    return entries

def main():
    pins = json.loads((ROOT / 'scripts/verification/authority/minimum-tax-sources.json').read_text())
    for pin in pins:
        if hashlib.sha256((ROOT / pin['path']).read_bytes()).hexdigest() != pin['sha256']:
            raise ValueError('Authority hash mismatch: ' + pin['path'])
    payload = dict(authority='2025 Form 8801 and instructions; synthetic prior-return facts', sources=pins, cases=cases())
    encoded = json.dumps(payload, indent=2) + '\n'
    if sys.argv[1:] == ['--write']: OUTPUT.write_text(encoded)
    elif sys.argv[1:]: raise ValueError('Use no arguments (verify) or --write (regenerate)')
    elif json.loads(OUTPUT.read_text()) != payload: raise ValueError('Committed oracle differs from independent regeneration')
    print(json.dumps(dict(status='PASS', cases=len(payload['cases']), fixtureSha256=hashlib.sha256(OUTPUT.read_bytes()).hexdigest())))

if __name__ == '__main__': main()
