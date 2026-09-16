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
    expect(s.schemaVersion).toBe('ustaxes-1040-line-snapshot-v10')
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
      '7a2': 0,
      '8': 0,
      interestPayerCount: 2,
      dividendPayerCount: 1
    })
    expect(s.worksheets.qualifiedDividendsCapitalGains).not.toBeNull()
  })

  it('reports no Schedule B when neither total is over $1,500', () => {
    // Exactly $1,500 each: the threshold is "over $1,500".
    const s = withInvestmentIncome([1500], 1500, 1200)
    expect(s.lines['2b']).toBe(1500)
    expect(s.lines['3b']).toBe(1500)
    expect(s.attachments.scheduleB).toBeNull()
  })
})
