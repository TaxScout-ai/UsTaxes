import F1040 from '../irsForms/F1040'
import { FilingStatus, IncomeW2, PersonRole } from 'ustaxes/core/data'
import { blankState } from 'ustaxes/redux/reducer'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

/**
 * Regression for the order-dependent return.
 *
 * Three W-2s whose Box 1 amounts sum to exactly $75,249.50 produced $75,249 in
 * one order and $75,250 in the other, because the amounts were added as
 * `number` before the whole-dollar rule was applied: one order gives
 * 75249.49999999999. The tax and the printed refund differed with them —
 * $7,999 / $1,101 against the correct $8,010 / $1,090.
 *
 * These call the real F1040, not the rounding helpers. The previous tests
 * exercised the helpers directly and passed while the form was still wrong.
 */

const w2 = (income: number, fedWithholding: number, n: number): IncomeW2 => ({
  employer: { EIN: `11111111${n}`, employerName: `employer ${n}` },
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

const infoWith = (w2s: IncomeW2[]): ValidatedInformation => ({
  ...blankState,
  w2s,
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

const formFor = (w2s: IncomeW2[]): F1040 => new F1040(infoWith(w2s), [])

/** Box 1 amounts summing to exactly $75,249.50. */
const WAGE_PARTS: Array<[number, number]> = [
  [66_031.01, 0],
  [8_135.56, 0],
  [1_082.93, 0]
]

/** Box 2 amounts summing to exactly $9,100.50. */
const WITHHOLDING_PARTS: Array<[number, number]> = [
  [30_000, 3_921.74],
  [30_000, 4_564.79],
  [15_250, 613.97]
]

const permutations = <T>(items: T[]): T[][] => {
  if (items.length <= 1) return [items]
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [
      item,
      ...rest
    ])
  )
}

describe('exact W-2 aggregation', () => {
  it('reports the same wages whichever order the documents arrive in', () => {
    const w2s = WAGE_PARTS.map(([income, fed], i) => w2(income, fed, i))
    const results = permutations(w2s).map((p) => formFor(p).wages())
    // $75,249.50 rounds to $75,250 under the whole-dollar rule.
    expect(new Set(results)).toEqual(new Set([75_250]))
    expect(results).toHaveLength(6)
  })

  it('reports the same withholding whichever order the documents arrive in', () => {
    const w2s = WITHHOLDING_PARTS.map(([income, fed], i) => w2(income, fed, i))
    const results = permutations(w2s).map((p) => formFor(p).l25a())
    // $9,100.50 rounds to $9,101.
    expect(new Set(results)).toEqual(new Set([9_101]))
  })

  it('carries the same tax and refund through the whole form', () => {
    const w2s = WAGE_PARTS.map(([income], i) => w2(income, 3_033.34, i))
    const forms = permutations(w2s).map(formFor)
    const lines = forms.map((f) => ({
      wages: f.wages(),
      taxable: f.l15(),
      tax: f.l16(),
      totalTax: f.l24(),
      payments: f.l25a(),
      overpaid: f.l34()
    }))
    const first = JSON.stringify(lines[0])
    for (const line of lines) expect(JSON.stringify(line)).toEqual(first)

    // Independently: $75,250 - $15,750 standard deduction = $59,500 taxable;
    // the published 2025 Tax Table gives $8,010 for Single.
    expect(lines[0].wages).toBe(75_250)
    expect(lines[0].taxable).toBe(59_500)
    expect(lines[0].tax).toBe(8_010)
  })

  it('refuses a Box 1 amount that is not an exact number of cents', () => {
    // The engine validates its own input contract rather than snapping the
    // value onto a cent and computing a return from it.
    expect(() => formFor([w2(1.001, 0, 0)]).wages()).toThrow(
      /exact number of cents/
    )
  })

  it('still computes a single ordinary W-2', () => {
    const f = formFor([w2(75_250, 9_100, 0)])
    expect(f.wages()).toBe(75_250)
    expect(f.l25a()).toBe(9_100)
    expect(f.l16()).toBe(8_010)
  })
})

describe('no sub-cent residue reaches the payment lines', () => {
  /**
   * The original fixture printed the right PDF while the raw result still said
   * `totalPayments: 9100.005000000001`. The half cent came from Form 8959:
   * 1.45% of $75,250 is $1,091.125, and against $1,091.13 of Medicare
   * withholding line 22 kept 0.005 — which line 25c then read even though the
   * form did not apply to this return.
   */
  const ordinary = (): F1040 => {
    const single: IncomeW2 = {
      ...w2(75_250, 9_100, 0),
      medicareIncome: 75_250,
      medicareWithholding: 1_091.13
    }
    return formFor([single])
  }

  it('leaves line 25c absent when Form 8959 does not apply', () => {
    const f = ordinary()
    expect(f.f8959.isNeeded()).toBe(false)
    expect(f.l25c()).toBeUndefined()
  })

  it('keeps every payment line a whole dollar', () => {
    const f = ordinary()
    const lines: Array<[string, number]> = [
      ['25a', f.l25a()],
      ['25d', f.l25d()],
      ['33', f.l33()],
      ['34', f.l34()]
    ]
    // Reported as a map so a failure names the offending line and its value.
    const fractional = lines.filter(([, value]) => !Number.isInteger(value))
    expect(fractional).toEqual([])
    expect(f.l33()).toBe(9_100)
    expect(f.l24()).toBe(8_010)
    expect(f.l34()).toBe(1_090)
  })

  it('still credits Additional Medicare Tax that was actually withheld', () => {
    // A taxpayer under the income threshold whose employer withheld the extra
    // tax is entitled to credit it. Suppressing line 25c on `isNeeded` alone
    // would have dropped that credit along with the residue, so the line is
    // also present when there is something creditable.
    const overWithheld: IncomeW2 = {
      ...w2(75_250, 9_100, 0),
      medicareIncome: 75_250,
      medicareWithholding: 1_541.13
    }
    const f = formFor([overWithheld])
    // IRS i8959 line 24 requires attaching the form when claiming its credit.
    expect(f.f8959.isNeeded()).toBe(true)
    expect(f.f8959.hasCreditableWithholding()).toBe(true)
    expect(f.l25c()).toBe(450)
    expect(f.l33()).toBe(9_550)
  })
})
