"""Independent PyMuPDF verification of actual HTTP PDFs against IRS goldens."""
import json
import re
import sys
from pathlib import Path
import pymupdf

root = Path(sys.argv[1])
report = json.loads((root / 'schedule1a-results.json').read_text())
fields_1040 = {'12e': 'f2_02', '13b': 'f2_04', '14': 'f2_05', '15': 'f2_06', '16': 'f2_08', '24': 'f2_16', '25a': 'f2_17', '33': 'f2_29', '35a': 'f2_31', '37': 'f2_35'}
checks = 0
for case in report['results']:
    with pymupdf.open(root / case['file']) as pdf:
        fields = [(w.field_name, w.field_value) for page in pdf for w in page.widgets()]
        def get(name, page, form):
            matches = [value for key, value in fields if form in key and f'.Page{page}[0].' in key and key.endswith('.' + name + '[0]')]
            if len(matches) != 1:
                raise ValueError(f"{case['id']}: expected exactly one {form}/{name}, got {len(matches)}")
            return matches[0]
        for line, name in fields_1040.items():
            actual = get(name, 2, 'topmostSubform')
            if not re.fullmatch(r'-?\d+', str(actual)):
                raise ValueError(f"{case['id']}: missing numeric 1040 {line}: {actual!r}")
            assert int(actual) == case['expected1040'][line], (case['id'], line, actual)
            checks += 1
        for name, expected in case['cells'].items():
            page = 1 if name.startswith('f1_') else 2
            actual = get(name, page, 'form1')
            assert actual == str(expected), (case['id'], name, actual, expected)
            checks += 1
        for name, expected in [('c2_5', case['senior']), ('c2_7', case['spouseSenior']), ('c2_6', case['blind']), ('c2_8', case['spouseBlind'])]:
            value = get(name, 2, 'topmostSubform')
            assert (value not in ('Off', '', None, False, 0)) == expected, (case['id'], name, value)
            checks += 1
        for i, vin in enumerate(case['vins']):
            assert get(f'f2_{i*3+1:02d}', 2, 'form1') == vin, (case['id'], vin)
            checks += 1
        ranges = {'tips': (1, range(10, 22)), 'overtime': (1, range(22, 32)), 'car': (2, range(1, 15)), 'senior': (2, range(15, 23))}
        for part in case['inactiveParts']:
            page, cells = ranges[part]
            for i in cells:
                assert get(f'f{page}_{i:02d}', page, 'form1') in ('', None), (case['id'], part, i)
                checks += 1
        # Both pages of the attachment must be in the packet, even with zero
        # numeric amounts on page 1 for a car/senior-only return.
        schedule_pages = [page.number for page in pdf if any('form1[0].Page' in w.field_name for w in page.widgets())]
        assert len(schedule_pages) == (2 if case['attached'] else 0), (case['id'], schedule_pages)
    print(case['id'], 'PASS')
summary = {'status': 'PASS', 'pdfs': len(report['results']), 'independentFieldChecks': checks}
(root / 'schedule1a-pdf-verification.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps(summary))
