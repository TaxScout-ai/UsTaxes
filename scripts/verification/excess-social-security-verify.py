"""Run local payroll HTTP/PDF replay and independent Decimal/PyMuPDF verification."""
from pathlib import Path
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python scripts/verification/excess-social-security-verify.py /absolute/new/evidence-directory')
output = Path(sys.argv[1]).resolve()
if output == root or root in output.parents:
    raise SystemExit('Use an evidence directory outside the source checkout')
output.mkdir()
steps = [
    ('schema', ['node_modules/.bin/ts-node', '--compiler-options', '{"module":"commonjs"}', 'scripts/setup.ts']),
    ('http', ['node_modules/.bin/ts-node', '-P', 'tsconfig.server.json', '-r', 'tsconfig-paths/register', 'scripts/verification/excess-social-security-http.ts', str(output / 'http')]),
    ('pdf', [sys.executable, 'scripts/verification/excess-social-security-read-pdf.py', str(output / 'http')]),
]
for name, args in steps:
    with (output / (name + '.log')).open('w') as log:
        result = subprocess.run(args, cwd=root, stdout=log, stderr=subprocess.STDOUT, timeout=600)
    if result.returncode:
        raise SystemExit(f'{name} failed: {output / (name + ".log")}')
    print(name + ': PASS', flush=True)
