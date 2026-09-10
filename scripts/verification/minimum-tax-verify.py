"""One local command: source pins/oracle -> schema -> HTTP -> independent PDF read.

Run with the Python interpreter containing requirements.txt (PyMuPDF).
Node dependencies must already be installed from package-lock.json.
Output must be a new directory outside the checkout. No network/IRS requests.
"""
from pathlib import Path
import json
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
if len(sys.argv) != 2:
    raise SystemExit('Usage: python scripts/verification/minimum-tax-verify.py /absolute/new/evidence-directory')
output = Path(sys.argv[1]).resolve()
if output == root or root in output.parents:
    raise SystemExit('Use an evidence directory outside the source checkout')
output.mkdir()
steps = [
    ('oracle', [sys.executable, 'scripts/verification/minimum-tax-oracle.py']),
    ('schema', ['node_modules/.bin/ts-node', '--compiler-options', '{"module":"commonjs"}', 'scripts/setup.ts']),
    ('http', ['node_modules/.bin/ts-node', '-P', 'tsconfig.server.json', '-r', 'tsconfig-paths/register', 'scripts/verification/minimum-tax-http-pdf.ts', str(output / 'http')]),
    ('pdf', [sys.executable, 'scripts/verification/minimum-tax-read-pdf.py', str(output / 'http')]),
]
for name, args in steps:
    with (output / (name + '.log')).open('w') as log:
        result = subprocess.run(args, cwd=root, stdout=log, stderr=subprocess.STDOUT, timeout=600)
    if result.returncode:
        raise SystemExit(f'{name} failed with {result.returncode}: {output / (name + ".log")}')
    print(name + ': PASS', flush=True)
verified = json.loads((output / 'http/minimum-tax-pdf-verification.json').read_text())
print(json.dumps({k: v for k, v in verified.items() if k != 'files'}))
