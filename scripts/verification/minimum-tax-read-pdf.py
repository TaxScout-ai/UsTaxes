"""Verify HTTP output using Decimal oracle + actual PDF widgets via PyMuPDF.

Recomputes expected 8801 lines from captured source facts. Does not use engine
namedFields(), PDF library, worksheet code, or expected field maps from the API.
"""
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import sys
import pymupdf

root = Path(sys.argv[1])
spec = importlib.util.spec_from_file_location('oracle', Path(__file__).with_name('minimum-tax-oracle.py'))
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)
report = json.loads((root / 'minimum-tax-results.json').read_text())
checks = 0
pdf_count = 0
goldens = {case['id']: case for case in oracle.cases()}
for case in report['results']:
    request = json.loads((root / (case['id'] + '.request.json')).read_text())
    data = request['information']['form8801']
    if case['id'] in goldens and data != goldens[case['id']]['data']:
        raise ValueError('Request differs from independently regenerated golden: ' + case['id'])
    expected, gains = oracle.compute(data)
    result = json.loads((root / (case['id'] + '.response.json')).read_text())
    expected1040 = {'1a': 75250, '15': 59500, '16': 8010, '20': expected['25'] or None, '24': 8010 - expected['25'], '25a': 9100, '35a': 1090 + expected['25']}
    for line, value in expected1040.items():
        if result['returnLines']['lines'][line] != value:
            raise ValueError((case['id'], 'HTTP line', line, value))
        checks += 1
    if not case.get('file'): continue
    pdf_count += 1
    with pymupdf.open(root / case['file']) as pdf:
        widgets = [(w.field_name, w.field_value) for page in pdf for w in (page.widgets() or [])]
        forms = ['f1040'] + [tag for tag in case['forms'] if tag != 'f1040']
        def actual(tag, leaf):
            prefix = '' if tag == 'f1040' else f'attachment_{forms.index(tag)}_'
            matches = [v for name, v in widgets if (name.startswith(prefix) if prefix else not name.startswith('attachment_')) and name.endswith('.' + leaf + '[0]')]
            if len(matches) != 1: raise ValueError((case['id'], tag, leaf, 'Ambiguous/missing PDF field', len(matches)))
            return matches[0]
        def check(tag, leaf, value):
            global checks
            found = actual(tag, leaf)
            if value is None:
                if found not in ('', None): raise ValueError((case['id'], tag, leaf, found, 'expected blank'))
            elif str(found) != str(value): raise ValueError((case['id'], tag, leaf, found, value))
            checks += 1
        for line, leaf in {'1a':'f1_47','15':'f2_06','16':'f2_08','20':'f2_12','24':'f2_16','25a':'f2_17','35a':'f2_31'}.items(): check('f1040', leaf, expected1040[line])
        if expected['21'] <= 0:
            if 'f8801' in forms: raise ValueError('Nonpositive line 21 attached')
            continue
        for line in range(1, 27):
            value = expected[str(line)]
            if (expected['4'] == 0 and 5 <= line <= 14) or (expected['10'] == 0 and 11 <= line <= 14): value = None
            if line == 3: value = abs(value)  # preprinted parentheses on the source form
            check('f8801', f'f1_{line + 2}' if line <= 15 else f'f2_{line - 15}', value)
        for line in range(27, 56): check('f8801', f'f3_{line - 26}' if line <= 42 else f'f4_{line - 42}', gains.get(str(line)))
        # Actual 2025 Form 6251 has 1a AND 1b; every subsequent field was shifted.
        # Current synthetic wage-only facts give AMTI 75250 below 88100 exemption.
        fields6251 = {3:15750, 4:59500, 5:15750, 26:75250, 27:88100, 28:0, 29:0, 30:None, 31:0, 32:8010, 33:0}
        for field, value in fields6251.items(): check('f6251', f'f1_{field}', value)
        for index in range(1, 30): check('f6251', f'f2_{index}', None)
        if data['priorYear']['foreignEarnedIncome']['applicable'] and expected['10']:
            text = '\n'.join(page.get_text() for page in pdf)
            if 'Foreign Earned Income Tax Worksheet' not in text: raise ValueError('Missing foreign worksheet')
            checks += 1
files = sorted(p for p in root.iterdir() if p.suffix in ('.json', '.pdf') and p.name != 'minimum-tax-pdf-verification.json')
summary = dict(status='PASS', httpCases=len(report['results']), pdfs=pdf_count,
               independentChecks=checks, irsApproval=False,
               files=[dict(path=p.name, sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in files])
with (root / 'minimum-tax-pdf-verification.json').open('x') as file: json.dump(summary, file, indent=2)
print(json.dumps({key: value for key, value in summary.items() if key != 'files'}))
