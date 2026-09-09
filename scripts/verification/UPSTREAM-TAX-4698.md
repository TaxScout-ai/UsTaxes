# TAX-4698 — selective upstream integration and TY2025 regressions

Local development only. Continues the existing UsTaxes engine at
`3fdf7e8bc47a45a782ef786d37d68ee092b6e836`; TaxScout's admitted domain and
production integration are unchanged. This is not an IRS approval record.

## Upstream decision

- Fork origin/main: `8eeeef6fc9b491b52b3ade8e4d95643e880971cf`.
- Upstream master inspected: `6698f5fc801ff1e9500a3612a2a2f23a76c26562`.
- Common ancestor: `0c542932ba0402b19c6f469ee25f6841930f3d08`.
- Divergence before this task: 17 local-only / 69 upstream-only commits.
- Adopted/adapted `13d27874fa1e5b961ad1545655fd22abda0501e5`: numeric
  parser and original regression tests (Michael Mendy). Additionally reject
  partial decimals and infinities. Numeric UI strings are consumed completely.
- Adapted `ad67cf6bc0f45a21c640d4607786e61971f61042`: Schedule 1-A line 38
  belongs to page 2. Our mapping uses all 54 actual IRS PDF field names.
- Upstream Schedule SE's code-A-only line 2 also helped identify a fork
  regression: gross box 14 B/C must not be added to regular-method earnings.
- Did not replace the fork wholesale. Upstream's TY2025 forms, data contract,
  PDF filler and desktop dependency migration differ substantially. Wholesale
  replacement would discard our additional implementations and verified fixes.
- Upstream PDF combining changes overlap the existing candidate's stronger
  AcroForm-preserving implementation. Desktop/Tauri/dependency upgrades are not
  part of this calculation change. This is not a dependency security audit.

## Schedule 1-A contract and changes

The existing `Information.schedule1AData` remains the entry point. There is no
parallel tax calculator. Exact cents, ratios and line rounding reuse `rounding.ts`.
The same F1040 object supplies the HTTP result, 1040 line 13b and PDF packet.

- Tips/overtime phaseout divisions round down; car-loan division rounds up.
- Senior reduction is 6%, rounded on line 34 before line 35. Each spouse has
  a separate $6,000 maximum. DOB cutoff is before January 2, 1961; age at death
  and specific SSN facts are checked. Standard-deduction age logic uses the
  same calendar-day boundary instead of the server's local midnight.
- Per-employer tips use a sum of individual maxima, not a maximum of totals.
  Business tips are limited independently to each business's supplied adjusted
  net income. Unbounded legacy self-employed-tip totals are refused.
- Territorial MAGI exclusions require explicit amounts, including zero.
  Form 2555 lines 45/50 are read from the existing attachment. Multiple Forms
  2555 are refused because this F1040 only instantiates the first one.
- Legacy `primaryBornBefore1962` / `spouseBornBefore1962` are rejected for 2025.
  `people.primary/spouse` provide `ssnValidForEmployment`,
  `ssnIssuedByReturnDeadline`, and `dateOfDeath` (explicit null if living).
  Positive tips/overtime identify their recipients. MFS cannot claim those
  deductions. Invalid SSN facts do not produce a senior deduction.
- Car-interest inputs are already allocated line 22 columns (ii)/(iii); do not
  subtract column (ii) twice. Two distinct VINs fit the template. More require
  a supplemental statement and return `unsupported`, not a truncated packet.
- Both HTTP routes return 422 with `needs_facts`, `invalid_input` or
  `unsupported` for the corresponding Schedule 1-A failure.
- The official template, instructions and source hashes are committed. Inactive
  sections and unused vehicle rows remain blank. Previously line 13b was
  omitted from the 1040 PDF altogether. Age/blindness checkboxes are now filled.

These are **prepared, qualified worksheet inputs**. The module does not establish
occupation eligibility, FLSA overtime qualification, vehicle/loan eligibility,
SSN validity against SSA, or the correctness of supplied business allocations.
It does not prepare the underlying Form 4563 or all source worksheets. Those
capabilities require an admission/integration review before real filing. This
change does not admit Schedule 1-A returns through TaxScout's canonical gate.

## K-1 regression discovered by the wider tests

An original randomized test found code A = 0, code C = $433.14, and $61 of SE tax.
The engine added gross B/C to net A. Both gross columns are now excluded from the
regular method, with direct F1040 regressions for zero, positive and negative
net earnings. Authorities: IRS 2025 i1065sk1, box 14, and i1040sse Part II.

The old property `total tax <= total income` was also invalid: additional taxes
can remain due despite other income losses. Its bound now covers regular income
tax after nonrefundable credits, excluding AMT. Dedicated K-1 goldens ensure this
change does not hide the actual gross-versus-net bug. No property is skipped.

This does not certify optional SE elections, farm/nonfarm allocation within a
partnership, separate spouse SE computations, or every legacy monetary worksheet.
Those remain outside the admitted TaxScout domain. In particular, the complete
legacy engine has not been converted to exact monetary arithmetic by this patch.

## Reproduce

Use this checkout's own npm dependencies and regenerate the existing schema:

```sh
npm ci
node_modules/.bin/ts-node --compiler-options '{"module":"commonjs"}' scripts/setup.ts
node_modules/.bin/tsc --project tsconfig.server.json --noEmit
CI=true TZ=America/New_York node_modules/.bin/craco test --watch=false --maxWorkers=4 src/forms/Y2025/tests src/core/tests
TZ=America/New_York FORMS_DIR="$PWD/public/forms" TS_NODE_PROJECT=tsconfig.server.json node -r ts-node/register -r tsconfig-paths/register scripts/verification/schedule1a-http-pdf.ts /tmp/new-schedule1a-report
```

Use a Python environment with the pinned `scripts/verification/requirements.txt`:

```sh
python scripts/verification/schedule1a-read-pdf.py /tmp/new-schedule1a-report
python scripts/verification/authority/regenerate.py --check
TS_NODE_PROJECT=tsconfig.server.json node -r ts-node/register/transpile-only -r tsconfig-paths/register scripts/verification/table-sweep.ts --output /tmp/new-tax-table-report.json
```

The Schedule 1-A harness refuses to overwrite a directory, verifies source hashes,
uses real loopback HTTP routes and checks all template names. The Python reader
checks numeric cells, VINs, blank inactive sections, age/blindness checkboxes and
two-page attachment preservation independently of pdf-lib.

Run the existing TaxScout `tax-candidate:benchmark --engine-dir <this-checkout>
--output <new-directory>` and its independent PDF readback as described in
TaxScout's TAX-4679 report. The 1,018-case corpus and 400,005 line-16 sweep measure
those specified domains; they are not a percentage of accuracy across all forms.
