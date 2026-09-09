# TY2025 candidate verification — TAX-4679

This branch is a local candidate. It does not establish deployed behavior, IRS
acceptance, AGPL compliance, or support for every return the legacy engine can
calculate. TaxScout's separate admission/replay layer limits the accepted domain.

Use this checkout's own dependencies (`npm ci`; do not share a mutable
`node_modules` with another worktree). No new runtime dependency is introduced.

```sh
node_modules/.bin/tsc --project tsconfig.server.json --noEmit
CI=true node_modules/.bin/craco test --watch=false --runInBand src/forms/Y2025/tests
python3 -m venv .verification-venv
.verification-venv/bin/pip install -r scripts/verification/requirements.txt
.verification-venv/bin/python scripts/verification/authority/regenerate.py --check
TS_NODE_PROJECT=tsconfig.server.json node -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/verification/table-sweep.ts --output /tmp/new-tax-table-report.json
```

`http-pdf.ts <new-output-dir> <oracle.gz> <source-manifest.json>` exercises the
actual two HTTP routes, real F1040 getters and generated PDFs for ten synthetic
cases. Set `FORMS_DIR` to this checkout's `public/forms` and use the same ts-node
registration as above. It returns nonzero on a calculation, HTTP, attachment or
PDF-generation failure. Then run `extract-pdf.py <output-dir>` with the venv;
the independent PyMuPDF reader returns nonzero on a mismatch.

`serve.ts` starts these actual routes on an ephemeral loopback port for TaxScout's
1,018-case Decimal benchmark and canonical-fact verification. It never listens on
a public interface. The production listener is not started by these commands.

The source PDF and its checksum are committed with the independently extracted
Tax Table. Regeneration validates the complete pinned PDF before replacing an
output; `--check` never writes. Formula logic is not used to generate the oracle.

Money inputs must have a finite, safe decimal-cent representation. W-2 amounts
are summed in integer cents and rounded at the return line. Tax Table lookup
semantics and high-income bracket constants are separately tested. These changes
do not convert every legacy worksheet to exact arithmetic.

PDF packets preserve each attachment's AcroForm tree and namespace; the 1040 is
first. Added official templates are listed in `public/forms/Y2025/template-sources.json`.
Template availability alone does not prove every form's positional mapping.

Form 8959 tests cover the per-W-2 filing trigger, status thresholds, separate
RRTA/SE handling and genuine additional withholding. Annual payroll-rounding
ambiguities remain outside TaxScout's admitted domain. Childless EIC age tests
use Publication 596's distinct January 1 birth-date rule; eligible EIC returns
remain outside that domain and are not certified by this branch.
