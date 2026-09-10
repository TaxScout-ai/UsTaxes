import { FilingStatus } from 'ustaxes/core/data'
import { computeOrdinaryTax } from '../irsForms/TaxTable'
import { roundLine, roundTaxTableResult } from '../irsForms/rounding'

/**
 * The defect these cover: a synthetic Single return with $8,010 of tax and
 * $9,100 of payments produced a refund of $1,091 in the filled PDF.
 *
 * `computeOrdinaryTax` returns the tax for the midpoint of the $50 band, which
 * at $59,500 of taxable income is 8009.5. The published table says 8,010. The
 * tax-rate test rounded that itself before comparing against the CSV, so every
 * table value matched while the form line carried 8009.5 into the rest of the
 * return: 9100.005 - 8009.5 = 1090.505, which rounds to 1,091.
 */

describe('whole-dollar line rounding', () => {
  it('rounds half away from zero, as the instructions describe', () => {
    expect(roundLine(0.49)).toBe(0)
    expect(roundLine(0.5)).toBe(1)
    expect(roundLine(0.99)).toBe(1)
    expect(roundLine(1.5)).toBe(2)
    expect(roundLine(-0.5)).toBe(-1)
    expect(roundLine(-0.49)).toBe(-0)
  })

  it('sums cents before rounding the line, not each amount first', () => {
    // "If you have to add two or more amounts to figure the amount to enter on
    // a line, include cents when adding and only round off the total."
    const twoW2s = [20_000.49, 20_000.49]
    expect(roundLine(twoW2s.reduce((a, b) => a + b, 0))).toBe(40_001)

    const roundedFirst = twoW2s
      .map(roundLine)
      .reduce((a: number, b: number) => a + b, 0)
    expect(roundedFirst).toBe(40_000)
    expect(roundedFirst).not.toBe(40_001)
  })

  it('keeps an absent line absent rather than turning it into zero', () => {
    expect(roundTaxTableResult(undefined)).toBeUndefined()
    expect(roundTaxTableResult(0)).toBe(0)
  })

  it('refuses a non-finite amount instead of producing NaN dollars', () => {
    expect(() => roundLine(Number.NaN)).toThrow()
    expect(() => roundLine(Number.POSITIVE_INFINITY)).toThrow()
  })
})

describe('line 16 equals the published Tax Table value', () => {
  /**
   * Deliberately no `Math.round` in this test. The point is that the value the
   * form line carries is already the table's value — the previous tax-rate test
   * rounded on the test side, which is why this defect survived 400,000
   * comparisons.
   */
  const publishedSingle: Array<[number, number]> = [
    [59_500, 8_010],
    [59_549, 8_010],
    [59_550, 8_021],
    [39_250, 4_475],
    [59_499, 7_999]
  ]

  it.each(publishedSingle)(
    'taxable income %i gives %i without the test rounding it',
    (taxableIncome, expected) => {
      const line = roundTaxTableResult(
        computeOrdinaryTax(FilingStatus.S, taxableIncome)
      )
      expect(line).toBe(expected)
    }
  )

  it('returns the actual published integer even when called by a worksheet', () => {
    expect(computeOrdinaryTax(FilingStatus.S, 59_500)).toBe(8010)
    expect(computeOrdinaryTax(FilingStatus.S, 59_499.5)).toBe(8010)
  })

  it.each([
    [59499.49, 7999],
    [59499.5, 8010],
    [4249.49, 423],
    [4249.5, 428]
  ])(
    'selects the table band after recording income %s as a line',
    (income, tax) => {
      expect(computeOrdinaryTax(FilingStatus.S, income)).toBe(tax)
    }
  )

  it('reproduces the reported refund once the lines are whole dollars', () => {
    const tax = roundTaxTableResult(computeOrdinaryTax(FilingStatus.S, 59_500))
    const payments = roundLine(9_100.005)
    expect(tax).toBe(8_010)
    expect(payments).toBe(9_100)
    expect(payments - (tax ?? 0)).toBe(1_090)

    // What the unrounded chain produced.
    const unrounded = 9_100.005 - 8_009.5
    expect(Math.round(unrounded)).toBe(1_091)
  })
})
