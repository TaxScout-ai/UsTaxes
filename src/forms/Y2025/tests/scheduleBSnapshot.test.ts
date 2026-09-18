import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { Income1099Type, PersonRole } from 'ustaxes/core/data'
import { rehearsalInformation } from './fixtures/atsRehearsal'

const withInvestmentIncome = (
  interest: number[],
  dividends: number,
  qualifiedDividends: number
) => {
  const info = rehearsalInformation(60000)
  info.f1099s = [
    ...interest.map((income, i) => ({
      payer: `Synthetic Bank ${i + 1}`,
      type: Income1099Type.INT as const,
      personRole: PersonRole.PRIMARY as const,
      form: { income }
    })),
    {
      payer: 'Synthetic Fund',
      type: Income1099Type.DIV,
      personRole: PersonRole.PRIMARY,
      form: {
        dividends,
        qualifiedDividends,
        totalCapitalGainsDistributions: 0
      }
    }
  ]
  return calculationSnapshot(new F1040(info, []))
}

describe('calculation snapshot v10: interest, dividends and Schedule B', () => {
  it('exposes lines 2a–3b and Schedule B when a total is over $1,500', () => {
    const s = withInvestmentIncome([1200, 700], 2000, 1600)
    expect(s.schemaVersion).toBe('ustaxes-1040-line-snapshot-v15')
    expect(s.lines).toMatchObject({
      '2a': null,
      '2b': 1900,
      '3a': 1600,
      '3b': 2000
    })
    expect(s.attachments.scheduleB?.lines).toEqual({
      '2': 1900,
      '3': null,
      '4': 1900,
      '6': 2000,
      '7a': 0,
      '7a2': null,
      '8': 0,
      interestPayerCount: 2,
      dividendPayerCount: 1
    })
    expect(s.worksheets.qualifiedDividendsCapitalGains).not.toBeNull()
    // Line 7a is No, so its FinCEN Form 114 question stays unanswered.
    expect(new F1040(rehearsalInformation(60000), []).scheduleB.l7a2()).toEqual(
      [false, false]
    )
  })

  it('adds source cents before rounding lines 2b, 3a, 3b and Schedule B', () => {
    const info = rehearsalInformation(60000)
    info.f1099s = [
      {
        payer: 'Synthetic Bank',
        type: Income1099Type.INT,
        personRole: PersonRole.PRIMARY,
        form: { income: 1210.4 }
      },
      {
        payer: 'Synthetic Treasury',
        type: Income1099Type.INT,
        personRole: PersonRole.PRIMARY,
        form: { income: 640.35 }
      },
      {
        payer: 'Synthetic Fund',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 2345.55,
          qualifiedDividends: 1980.25,
          totalCapitalGainsDistributions: 0
        }
      }
    ]
    const f = new F1040(info, [])
    const s = calculationSnapshot(f)
    // 1,210.40 + 640.35 = 1,850.75 → 1,851; each row alone rounds to 1,210 and 640.
    expect(s.lines).toMatchObject({ '2b': 1851, '3a': 1980, '3b': 2346 })
    expect(s.attachments.scheduleB?.lines).toMatchObject({
      '2': 1851,
      '6': 2346
    })
    expect(f.scheduleB.l1().slice(0, 4)).toEqual([
      'Synthetic Bank',
      '1210',
      'Synthetic Treasury',
      '640'
    ])
    expect(Number.isInteger(s.lines['9'])).toBe(true)
    expect(Number.isInteger(s.lines['15'])).toBe(true)
  })

  it('lists no Part II row for a 1099-DIV with only a capital gain distribution', () => {
    const info = rehearsalInformation(60000)
    info.f1099s = [
      {
        payer: 'Synthetic Bank',
        type: Income1099Type.INT,
        personRole: PersonRole.PRIMARY,
        form: { income: 1600 }
      },
      {
        payer: 'Synthetic REIT',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 0,
          qualifiedDividends: 0,
          totalCapitalGainsDistributions: 700
        }
      }
    ]
    const s = calculationSnapshot(new F1040(info, []))
    expect(s.attachments.scheduleB?.lines).toMatchObject({
      '6': 0,
      interestPayerCount: 1,
      dividendPayerCount: 0
    })
  })

  it('reports no Schedule B when neither total is over $1,500', () => {
    // Exactly $1,500 each: the threshold is "over $1,500".
    const s = withInvestmentIncome([1500], 1500, 1200)
    expect(s.lines['2b']).toBe(1500)
    expect(s.lines['3b']).toBe(1500)
    expect(s.attachments.scheduleB).toBeNull()
  })
})
