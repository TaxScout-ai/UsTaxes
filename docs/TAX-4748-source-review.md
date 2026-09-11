# TY2025 health deduction and simplified QBI source review

This change continues the Form 7206 implementation at f00ad1b (merged as f2f4028).
The calculator remains UsTaxes. It adds no filing transport or IRS approval.

Form 7206 validates source cents and rounds each form line. Plans under the same
business must be combined before the earnings cap is applied. In a multiple-business
return, a nonzero retirement deduction needs its actual business allocation through
`retirementContributions`; a profit ratio does not establish that allocation.
Spouse-owner, optional-method, partnership and foreign-income coordination are
explicitly unsupported by this Form 7206 path. Premium inputs represent the
eligible amounts after employer-plan/month, marketplace/PTC and age-limit checks;
TaxScout admission establishes these separately. The calculator does not infer
eligibility from the premium amount or W-2 box DD.

The new optional `information.scheduleCQbi` contract requires the Schedule C index,
qualification, other-adjustment and cooperative facts, and both prior-year loss
carryforwards (nonnegative dollar magnitudes, including explicit zero). It supports
one primary-owner qualified Schedule C on a Single return below the simplified
Form 8995 threshold. It subtracts the attributable half-SE, retirement and health
deductions. A missing contract retains the prior no-Schedule-C-QBI behavior; callers
must establish the claim decision before invoking the calculator.

Form 8995 uses the TY2025 thresholds (197,300; MFJ 394,600), preserves current and
prior losses, and keeps ordinary QBI separate from REIT/PTP income. Its snapshot
is an optional additional `attachments.f8995` in v5, null for an absent form or
Form 8995-A. Existing clients may ignore the additive field. Line 3/7/16/17 losses
are negative snapshot operands and positive magnitudes inside PDF parentheses.
Legacy Form 8995-A wages/UBIA/cooperative/SSTB coverage remains incomplete; the new
Schedule C contract refuses that path. The REIT/PTP component now reaches 8995-A
rather than disappearing when the taxpayer exceeds the simplified threshold.

Source: IRS TY2025 instructions and forms 7206, 8995, 8995-A; 2025 Tax Computation
Worksheet. Scenario 12 is a rehearsal, not an assigned ATS expected-result file.
The conditional qualified-business example has QBI 21,609, deduction 4,322,
taxable income 102,373 and ordinary tax 17,436. The source PDF does not establish
all eligibility/carryforward facts; its blank QBI line is not a verified election.
