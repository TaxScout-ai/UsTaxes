# TAX-4688 — local TY2025 form-chain rehearsal

This candidate extends the existing UsTaxes F1040, HTTP routes and PDF packet.
It does not authorize filing, widen TaxScout's canonical admission, complete an
IRS-assigned test suite, or establish production deployment. The base is TAX-4698
`2d4c0c0f0de42dac2c3ebaa42dd2b767cf606da3`.

## Input contracts and calculation

`Information.scheduleH` supplies prepared payroll bases. Establish employee
exclusions, per-employee Social Security/FUTA caps, quarterly threshold and the
employer EIN before calculation. The module calculates FICA, FIT, FUTA Sections
A/B, late-contribution credit and 2025 California/Virgin Islands credit reductions.
It does not classify raw payroll, file standalone Schedule H or determine the
correct employer registration. State FUTA details are federal Schedule H inputs;
they do not implement state income-tax returns.

`Information.form5695.details` supplies qualified 2025 net costs, home identity,
explicit eligibility facts, item-level QMIDs/costs and capacity where needed.
Existing aggregate fields must reconcile exactly with those item lists. Missing
facts, malformed money, mismatched totals, shared-property allocation and prior-
year enabling-property allocations produce explicit refusals. QMIDs are checked
for syntax only, not against an IRS manufacturer registry. Cost qualification,
rebates, business-use allocation and the authenticity of evidence remain upstream
facts, not conclusions this calculator infers from invoice descriptions.

Line rounding reuses the candidate's exact-cent module. Part II energy credits
are limited before child/dependent and Part I credits. Schedule 3 keeps lines
5a/5b separate; Schedule 8812 uses its 2025 Worksheet A/B order and $2,200 child
credit / $1,700 ACTC limits. The social-tax worksheet uses half of SE Additional
Medicare tax and separately rounded withholding lines. Ordinary Schedule C gross
receipts are not counted a second time as statutory employee income.

Named PDF controls are resolved uniquely and type-checked. Unknown/ambiguous
names fail generation. Filing status uses the five actual 2025 controls; dependent
first/last names are separate. Line 27c is an EIC opt-out election, not an age test:
the current input has no such election and the output does not invent one.
Additional qualified-energy items and multirow Schedule H details get paginated
supporting statements; rates and identifiers are not rounded as dollar amounts.

## Scope and remaining gaps

The eight HTTP cases use deliberately synthetic identities and completed facts.
Scenario 1's source leaves additional door/AC QMID detail missing. The local
variation invents that detail explicitly; it is not an IRS-authorized adaptation.
Its $470 refund is independently derived from the printed form rules and Tax
Table, not a published IRS expected total. Original source blanks are not silently
filled. Review the TaxScout source-bound matrix before selecting an ATS case.

The legacy engine's dependent eligibility, RRTA contribution worksheet, optional
SE methods, K-1 farm/nonfarm allocations, Medicaid/combat-pay earned-income rules,
ACTC/EIC opt-out elections and every other form are not certified by these tests.
Those paths remain outside canonical admission. The credit-order tests establish
numerical behavior for their supplied qualifying-child facts, not complete legal
qualification of every dependent. All-zero and unsupported cases must still pass
the separate TaxScout fact/admission process before any future production use.
No states/business entity coverage is added by this change.

## Reproduce

Install this checkout's existing lockfile dependencies and generated schema:

```sh
npm ci
node_modules/.bin/ts-node --compiler-options '{"module":"commonjs"}' scripts/setup.ts
npm run server:build
CI=true node_modules/.bin/craco test --watch=false --runInBand src/forms/Y2025/tests
```

Install the existing Python dependencies from TaxScout's
`ai-chatbot/scripts/tax-candidate/requirements.txt` into a separate venv, then from
that TaxScout worktree run the single orchestration command:

```sh
/path/to/venv/bin/python ai-chatbot/scripts/tax-candidate/ats-rehearsal.py \
  --engine-dir /path/to/this/UsTaxes \
  --source-dir /path/to/IRS/MeF \
  --output /tmp/new-ats-rehearsal
```

Exit **2** means eight HTTP/PDF cases and 14 negative route checks passed while
filing gates remain open. Exit **1** means execution/evidence failure; inspect
step logs. No endpoint in this command contacts IRS. Generated PDFs are read
independently with PyMuPDF; source identity and all request/response/PDF hashes
are bound to that readback. Output directories must be new. The authentic 1040
schema/business-rules package, assigned tests and A2A enrollment remain separate
requirements. A successful local PDF rehearsal does not change IRS status.

Authority PDF pins are in `authority/ats1-sources.json`; official templates are
listed in `public/forms/Y2025/template-sources.json`. Existing Tax Table goldens,
Schedule 1-A HTTP cases and the canonical 1,018-case benchmark remain regression
checks. Agreement percentages describe those cases only, never the whole engine.
