# TY2025 minimum-tax credit candidate — TAX-4702

Continues UsTaxes `101960b`, including all TAX-4679, TAX-4698 and TAX-4688
work. This is development evidence, not IRS acceptance or authority to file.
The production engine and TaxScout admission rules are not changed here.

## Implemented

Form 8801 now consumes actual 2024 Form 6251 source lines, prior Form 8801
carryforward, prior filing status, exclusion adjustments and MTC NOL.
Legacy aggregates are retained for older years and reconciled for TY2025;
`priorYearAMTI` means source line 1 + 2e, not Form 6251 line 4.
Missing source facts, including explicit zero NOL/foreign amounts, fail closed.

Lines 1–26 and Part III (27–55) use exact cents, integer ratios and explicit
whole-dollar lines. The implementation handles negative line 18, carryforward,
prior MFS additional income, exemption phaseout, prior 1040-NR real-property
minimum, 0/15/20/25% capital gains, foreign earned income tax worksheet and
the supplied exclusion-only foreign tax credit. Current credits are applied
before the minimum-tax credit without reading its own Schedule 3 total.
The new genuine four-page Form 8801 template has all 57 fields mapped by name.

The current Form 6251 dependency also required corrections:

- TY2025 exemption phaseout, MFS eligibility, surviving-spouse exemption,
  239100/119550 rate caps, and current capital-gain bands.
- Current MFS additional income and the senior deduction addback.
- New line 1a/1b and all 62 PDF fields; the old positional map shifted values.
- Whole-dollar worksheet outputs and inclusion when the 8801 credit is claimed.
- Qualified-dividend worksheet initialization moved out of reading 1040 line 16. AMT must be identical before and after reading regular tax. The old path
  overstated the high-income synthetic AMT by $16000 when read first.

A further whole-return probe found that the ordinary-tax helper still returned
8009.5 (the table-band midpoint formula) to the qualified-dividend worksheet,
although the actual Tax Table says 8010. W-2 wages 75250 plus 57 of qualified
dividends therefore understated line 16 (8018 instead of 8019) by one dollar. The ordinary-tax helper
now returns the actual integer table/worksheet result for every caller and
selects a table band only after rounding its income line. This closes the
source of the error rather than adding another final-return rounding wrapper.

The Form 6251 MFS line-25 value is 300000, exactly as printed in the pinned
2025 form and instructions. It is not inferred from half the MFJ threshold.

## Verification contract

The Python Decimal oracle imports no engine code, rates or rounding helper.
243 committed synthetic source-return fixtures cover all five prior filing
statuses, thresholds and special methods. Additional explicit tests cover
actual 1040 credit ordering, current AMT, senior addback, call ordering,
bad/missing facts and fractional cents. These are synthetic calculations
derived from IRS forms, not official ATS expected return totals.

One command regenerates/checks the oracle, rebuilds the request schema, makes
246 calculations and 20 refusal probes through the real local HTTP routes,
and independently reads 18 produced PDFs using PyMuPDF:

```sh
python scripts/verification/minimum-tax-verify.py /absolute/new/evidence-directory
```

Use Python with `scripts/verification/requirements.txt` installed and Node
dependencies from `npm ci`. The runner saves exact requests, responses, PDFs,
source identity, hashes and logs. It has no IRS endpoint or credential use.
`minimum-tax-oracle.py --write` explicitly regenerates the committed fixtures;
the default invocation verifies them. Every primary PDF source is hash-pinned
in `authority/minimum-tax-sources.json`.

## Limits that remain real

This computes a minimum-tax credit **from prepared source-return facts**. It
does not reconstruct the full prior return, calculate missing exclusion/NOL
source worksheets, or verify the correctness of facts supplied by a preparer.
Schedule D + foreign AMT gain excess requires a referenced refigured source
worksheet; a prepared MTFTCE requires its source reference. Estates/trusts
are outside this individual-return attachment.

Current-year Form 8801 combinations needing unimplemented foreign/basis,
depreciation, partnership, passive-loss or business AMT refigures are explicitly
`unsupported`. Those existing Form 6251 gaps are not solved by changing its
constants. Current asset dispositions are also refused for this integration.
Other legacy forms have not acquired verified full coverage by association.

The TY2025 state registry remains empty. Business entity returns, genuine
1040 MeF XML/Business Rules, assigned ATS acceptance and A2A enrollment/testing
are not implemented or approved by this change. Actual SOR files, Toolkit
delivery, certificates and a tester's written scenario assignment remain
separate prerequisites. The existing TAX-4688 readiness report stays open.
