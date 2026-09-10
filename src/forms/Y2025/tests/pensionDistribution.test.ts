import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import {
  FilingStatus,
  Income1099Type,
  IncomeW2,
  Ira,
  IraPlanType,
  PersonRole,
  PlanType1099,
  Supported1099
} from 'ustaxes/core/data'
import { blankState } from 'ustaxes/redux/reducer'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Form 1099-R distributions on the real F1040.
 *
 * Two source documents are IRS ATS scenarios read from the published PDFs,
 * not from this engine:
 *
 *   TY2025 Scenario 3, page 4 — Primrose Retirement Fund, code 7:
 *     box 1 $53,778, box 2a $43,100, box 4 $3,405
 *   TY2025 Scenario 8, page 5 — Jubilee Retirement Fund, code G:
 *     box 1 $20,300, box 2a $10,300, box 4 $2,555
 *
 * Box 2a is a supplied fact. The engine does not compute the taxable amount
 * of a pension; it reports what the payer reported, which is why the lines
 * below are checked against the document and not against a formula.
 *
 * Two defects are pinned here. Before this test, an IRA-type distribution —
 * which must travel as `individualRetirementArrangements` so that lines 4a/4b
 * can read it — never reached line 25b, so its withholding was lost from the
 * refund. And line 25b was a plain float sum, so box 4 amounts with cents
 * could hand the return a fractional dollar.
 */

const w2 = (income: number, fedWithholding: number): IncomeW2 => ({
  employer: { EIN: '111111111', employerName: 'employer' },
  personRole: PersonRole.PRIMARY,
  occupation: 'occupation',
  state: 'AL',
  income,
  medicareIncome: income,
  fedWithholding,
  ssWages: income,
  ssWithholding: 0,
  medicareWithholding: 0,
  stateWages: 0,
  stateWithholding: 0
})

const pension = (
  payer: string,
  grossDistribution: number,
  taxableAmount: number,
  federalIncomeTaxWithheld: number,
  distributionCode: string
): Supported1099 => ({
  payer,
  type: Income1099Type.R,
  personRole: PersonRole.PRIMARY,
  form: {
    grossDistribution,
    taxableAmount,
    federalIncomeTaxWithheld,
    planType: PlanType1099.Pension,
    distributionCode
  }
})

const ira = (
  payer: string,
  grossDistribution: number,
  taxableAmount: number,
  federalIncomeTaxWithheld: number
): Ira => ({
  payer,
  personRole: PersonRole.PRIMARY,
  grossDistribution,
  taxableAmount,
  taxableAmountNotDetermined: false,
  totalDistribution: true,
  federalIncomeTaxWithheld,
  planType: IraPlanType.IRA,
  contributions: 0,
  rolloverContributions: 0,
  rothIraConversion: 0,
  recharacterizedContributions: 0,
  requiredMinimumDistributions: 0,
  lateContributions: 0,
  repayments: 0
})

const infoWith = (parts: {
  w2s?: IncomeW2[]
  f1099s?: Supported1099[]
  iras?: Ira[]
}): ValidatedInformation => ({
  ...blankState,
  w2s: parts.w2s ?? [],
  f1099s: parts.f1099s ?? [],
  individualRetirementArrangements: parts.iras ?? [],
  taxPayer: {
    dependents: [],
    filingStatus: FilingStatus.S,
    primaryPerson: {
      address: { address: '', city: '' },
      firstName: '',
      isTaxpayerDependent: false,
      lastName: '',
      role: PersonRole.PRIMARY,
      ssid: '',
      isBlind: false,
      dateOfBirth: new Date('1985-01-01')
    }
  }
})

const formFor = (parts: Parameters<typeof infoWith>[0]): F1040 =>
  new F1040(infoWith(parts), [])

const permutations = <T>(items: T[]): T[][] => {
  if (items.length <= 1) return [items]
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
      item,
      ...rest
    ])
  )
}

/** Scenario 3, page 4, exactly as printed. */
const primrose = pension('Primrose Retirement Fund', 53_778, 43_100, 3_405, '7')
/** Scenario 8, page 5, exactly as printed. */
const jubilee = pension('Jubilee Retirement Fund', 20_300, 10_300, 2_555, 'G')

describe('pension distributions on Form 1040', () => {
  it('reports Scenario 3 box 1, box 2a and box 4 on lines 5a, 5b and 25b', () => {
    const f = formFor({ w2s: [w2(30_000, 2_000)], f1099s: [primrose] })
    expect(f.l5a()).toBe(53_778)
    expect(f.l5b()).toBe(43_100)
    expect(f.l25b()).toBe(3_405)
    // Line 25a is W-2 box 2 only; 1099-R withholding must not leak into it.
    expect(f.l25a()).toBe(2_000)
    expect(f.l25d()).toBe(5_405)
    // Total income is wages plus the taxable pension, not the gross.
    expect(f.l9()).toBe(73_100)
    // Independently: $73,100 - $15,750 = $57,350 taxable. The published 2025
    // Tax Table row $57,350–$57,400 (midpoint $57,375) gives $7,537 Single:
    // $1,192.50 + 12% × $36,550 + 22% × $8,900 = $7,536.50.
    expect(f.l15()).toBe(57_350)
    expect(f.l16()).toBe(7_537)
  })

  it('reports a code G rollover with a taxable component as the document states it', () => {
    const f = formFor({ f1099s: [jubilee] })
    expect(f.l5a()).toBe(20_300)
    expect(f.l5b()).toBe(10_300)
    expect(f.l25b()).toBe(2_555)
    // No IRA in the return: the engine folds an empty list to 0 rather than
    // leaving the line blank. Either way nothing from a pension lands here.
    expect(f.l4a() ?? 0).toBe(0)
    expect(f.l4b() ?? 0).toBe(0)
  })

  it('does not put a pension on lines 4a/4b', () => {
    const f = formFor({ f1099s: [primrose, jubilee] })
    expect(f.l4a() ?? 0).toBe(0)
    expect(f.l4b() ?? 0).toBe(0)
    expect(f.l5a()).toBe(74_078)
    expect(f.l5b()).toBe(53_400)
  })

  it('carries IRA withholding to line 25b', () => {
    // Before the fix this returned 0: line 25b summed only `f1099s`, and an
    // IRA-type distribution cannot be in `f1099s` if lines 4a/4b are to see it.
    const f = formFor({
      iras: [ira('Liberty Trust Company', 12_000, 12_000, 2_555)]
    })
    expect(f.l4a()).toBe(12_000)
    expect(f.l4b()).toBe(12_000)
    expect(f.l25b()).toBe(2_555)
  })

  it('adds IRA and pension withholding together on line 25b', () => {
    const f = formFor({
      f1099s: [primrose],
      iras: [ira('Liberty Trust Company', 12_000, 12_000, 2_555)]
    })
    expect(f.l25b()).toBe(3_405 + 2_555)
  })

  it('rounds line 25b once, after summing cents', () => {
    // $1,000.50 + $1,000.25 = $2,000.75 → $2,001. A float sum would print
    // 2000.75 and the PDF would carry a fractional dollar.
    const f = formFor({
      f1099s: [
        pension('A', 5_000, 5_000, 1_000.5, '7'),
        pension('B', 5_000, 5_000, 1_000.25, '7')
      ]
    })
    expect(f.l25b()).toBe(2_001)
    expect(Number.isInteger(f.l25b())).toBe(true)
  })

  it('reports the same lines whichever order the documents arrive in', () => {
    const docs = [
      primrose,
      jubilee,
      pension('C', 1_000.33, 1_000.33, 100.67, '7')
    ]
    const results = permutations(docs).map((p) => {
      const f = formFor({ f1099s: p })
      return JSON.stringify([f.l5a(), f.l5b(), f.l25b()])
    })
    expect(new Set(results).size).toBe(1)
    expect(results).toHaveLength(6)
  })

  it('exposes lines 4a, 4b, 5a and 5b in the calculation snapshot', () => {
    const f = formFor({
      f1099s: [primrose],
      iras: [ira('Liberty Trust Company', 12_000, 12_000, 0)]
    })
    const { lines } = calculationSnapshot(f)
    expect(lines['4a']).toBe(12_000)
    expect(lines['4b']).toBe(12_000)
    expect(lines['5a']).toBe(53_778)
    expect(lines['5b']).toBe(43_100)
    expect(lines['25b']).toBe(3_405)
    // Line 9 in the snapshot must be the sum a replay can rebuild.
    expect(lines['9']).toBe(12_000 + 43_100)
  })
})
