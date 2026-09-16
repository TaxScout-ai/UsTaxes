import F1040 from '../irsForms/F1040'
import { PersonRole, Supported1099 } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './fixtures/atsRehearsal'

/**
 * Schedule B prints 14 interest payers (Part I line 1) and 15 dividend payers
 * (Part II line 5); more continue on another copy. Found by the IRS Direct
 * File scenario `schedule-b-multiple-interest-rounding` (TAX-4847): exactly
 * 14 payers produced an empty second copy.
 */
const withPayers = (
  interest: number,
  dividends: number
): ValidatedInformation => {
  const base = rehearsalInformation()
  const f1099s: Supported1099[] = [
    ...Array.from(
      { length: interest },
      (_, i) =>
        ({
          payer: `Bank ${i + 1}`,
          type: 'INT',
          personRole: PersonRole.PRIMARY,
          form: { income: 1600.51 }
        } as Supported1099)
    ),
    ...Array.from(
      { length: dividends },
      (_, i) =>
        ({
          payer: `Fund ${i + 1}`,
          type: 'DIV',
          personRole: PersonRole.PRIMARY,
          form: {
            dividends: 200.25,
            qualifiedDividends: 0,
            totalCapitalGainsDistributions: 0
          }
        } as Supported1099)
    )
  ]
  return { ...base, f1099s }
}

const scheduleBCopies = (info: ValidatedInformation): number =>
  new F1040(info, []).schedules().filter((s) => s.tag === 'f1040sb').length

describe('Schedule B copies', () => {
  it.each([
    [1, 0, 1],
    [14, 0, 1],
    [15, 0, 2],
    [28, 0, 2],
    [29, 0, 3],
    [14, 15, 1],
    [0, 15, 1],
    [0, 16, 2],
    [14, 16, 2]
  ])(
    '%i interest and %i dividend payers file %i copies',
    (interest, dividends, copies) => {
      expect(scheduleBCopies(withPayers(interest, dividends))).toBe(copies)
    }
  )

  it('a continuation copy lists only the payers past the first', () => {
    const f = new F1040(withPayers(15, 0), [])
    const [first, second] = f
      .schedules()
      .filter((s) => s.tag === 'f1040sb') as unknown as Array<{
      l1: () => Array<string | undefined>
    }>
    expect(first.l1().filter((v) => v !== undefined)).toHaveLength(28)
    expect(second.l1().slice(0, 2)).toEqual(['Bank 15', '1601'])
    expect(
      second
        .l1()
        .slice(2)
        .every((v) => v === undefined)
    ).toBe(true)
  })
})
