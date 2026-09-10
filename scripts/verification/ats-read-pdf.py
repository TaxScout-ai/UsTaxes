"""Read actual HTTP PDFs with independent PyMuPDF field access, no engine imports."""
import json
import hashlib
from pathlib import Path
import re
import sys
import pymupdf

root = Path(sys.argv[1])
report = json.loads((root / 'ats-results.json').read_text())
checks = 0
# Independent TY2025 Form 1040 binding from the genuine template.
form1040 = {'1a': 'f1_47', '15': 'f2_06', '16': 'f2_08', '19': 'f2_11', '20': 'f2_12', '23': 'f2_15', '24': 'f2_16', '25a': 'f2_17', '28': 'f2_24', '33': 'f2_29', '35a': 'f2_31', '37': 'f2_35'}
for case in report['results']:
    with pymupdf.open(root / case['file']) as pdf:
        widgets = [(w.field_name, w.field_value) for page in pdf for w in page.widgets()]
        forms = ['f1040'] + [tag for tag in case['forms'] if tag != 'f1040']
        def value(tag, name):
            index = forms.index(tag)
            prefix = '' if index == 0 else f'attachment_{index}_'
            subset = [(k, v) for k, v in widgets if (k.startswith(prefix) if prefix else not k.startswith('attachment_'))]
            matches = [v for k, v in subset if k == prefix + name or k.endswith('.' + name + '[0]') or k.endswith('.' + name)]
            if len(matches) != 1:
                raise ValueError((case['id'], tag, name, 'ambiguous/missing', len(matches)))
            return matches[0]
        for index in range(5):
            path = 'topmostSubform[0].Page1[0].' + (f'Checkbox_ReadOrder[0].c1_8[{index}]' if index < 3 else f'c1_8[{index - 3}]')
            selected = value('f1040', path) not in ('Off', '', None, False, 0)
            if selected != (index == 0):
                raise ValueError((case['id'], 'filing status', index, selected))
            checks += 1
        for line, expected in case['expected'].items():
            actual = value('f1040', form1040[line])
            if str(expected) != str(actual):
                raise ValueError((case['id'], '1040', line, actual, expected))
            checks += 1
        for tag, fields in case['cells'].items():
            for name, expected in fields.items():
                actual = value(tag, name)
                if isinstance(expected, bool):
                    actual = actual not in ('Off', '', None, False, 0)
                else:
                    actual = str(actual)
                    expected = str(expected)
                if actual != expected:
                    raise ValueError((case['id'], tag, name, actual, expected))
                checks += 1
        text = '\n'.join(p.get_text() for p in pdf)
        for required in case['statements']:
            if required not in text:
                raise ValueError((case['id'], 'missing statement', required))
            checks += 1
    print(case['id'], 'PASS')
files = ['ats-results.json'] + [name for case in report['results'] for name in [case['file'], case['id'] + '.request.json', case['id'] + '.response.json']]
bound_files = [{'path': name, 'sha256': hashlib.sha256((root / name).read_bytes()).hexdigest()} for name in sorted(files)]
summary = {'evidenceFiles': bound_files, 'status': 'PASS', 'pdfs': len(report['results']), 'independentFieldAndStatementChecks': checks, 'atsApproval': False}
output = root / 'ats-pdf-verification.json'
with output.open('x') as f:
    json.dump(summary, f, indent=2)
print(json.dumps(summary))
