# TY2025 payroll and Schedule 2 corrections — TAX-4706

Continues TAX-4688/4702 in the sole UsTaxes engine. No production switch,
expanded TaxScout admission, IRS transmission or claimed ATS approval.

## Reproduced defects

The full suite on `3d4606c` failed at seed 49317589: two W-2s with the SAME
employer EIN (SS withholding $2,978 + $7,941) manufactured a $0.80 credit.
The old random test also used Box 1 as an SS wage-base proxy and combined
spouses against one limit. Its two invalid properties are replaced by the
retained counterexample, explicit employer/person cases and 300 constructive
integer-cent split/merge/permutation properties. No test is disabled.

The independent PDF reader then found that Schedule 2 line 13 was blank while
its $63 amount was printed on line 11. Page 1's map had omitted two description
fields. This also printed Schedule H on line 7 instead of line 9. The prior
`ats-http-pdf.ts` expected the wrong leaf (`f1_18`): that assertion was not
independent evidence of correct printed placement. It now checks line 7 = 0,
line 9 (`f1_20`) = 474 and page 2 total = 474 against the pinned IRS template.
Do not use the earlier 197-check rehearsal as proof of correct Schedule 2 PDF
placement. Re-run it on the corrected code.

## Implemented

- Exact BigInt cents, per-employer withholding cap $10,918.20, separate taxpayer
  and spouse limits, combined line rounding. W-2 count is not employer count.
  EIN formatting is normalized; source document reconciliation remains upstream.
- Employer overcollection is excluded without discarding allowable credit from
  other employers. Box 1 is not used to infer Social Security wages/withholding.
- Uncollected W-2 A/M Social Security enters the worksheet; A/B/M/N enters
  Schedule 2 line 13. Missing employer identity when needed returns needs_facts;
  invalid source money returns invalid_input.
- Complete Schedule 2 page-1 named mapping corrected from the actual PDF.
  Positional callers reuse these values with the template's actual widget order.
  Forms 4137 and 8919 feed separate lines 5 and 6, summed at line 7.
- Whole-return HTTP requests with legacy nonzero aggregate RRTA amounts return
  unsupported: the model lacks required per-person/per-employer tier components.
  Component Form 8959 calculations are retained. Both HTTP routes preserve
  invalid_input / unsupported / needs_facts as distinct refusal categories.

## Independent verification

Public sources and PDFs are pinned in
`authority/excess-social-security-sources.json`. Pub. 3 (2025), pages 23–24,
provides the employer/person worksheet. Its stale reference to Schedule 2 line
6 is resolved using the actual 2025 Schedule 2 and 1040 instructions, line 13.

With npm dependencies and Python's verification requirements installed:

```
python scripts/verification/excess-social-security-verify.py /absolute/new/evidence
```

Runs schema generation, the real local calculate/PDF routes, six synthetic
payroll cases, eight refusal checks, then Decimal recomputation from the actual
captured requests and PyMuPDF reads of the produced widgets. No engine rate
constants, JS expected values or engine PDF maps are imported into that oracle.
Output includes source identity and SHA256 hashes. All calls are loopback only.

## Limits

This is not validation of every Form 1040 fact combination. The source model
still needs upstream corrected-W-2/common-paymaster reconciliation; RRTA source
components remain unsupported at the full-return HTTP boundary. The separate
Form 4137/8919 line-routing test is not a claim that those forms' entire tax
models, source details or PDF rows are verified. Their wider support and the
TaxScout admission expansion need independent source-based acceptance. States,
business entity returns, genuine MeF XML/BR and assigned ATS remain outside this
calculation/PDF correction.
