import federalBrackets from '../data/federal'
import { FilingStatus } from 'ustaxes/core/data'
import _ from 'lodash'

const computeTax =
  (brackets: (status: FilingStatus) => number[], rates: number[]) =>
  (filingStatus: FilingStatus, income: number): number =>
    _.chain([0, ...brackets(filingStatus)]) // Low end of each bracket
      .zipWith(
        [...brackets(filingStatus), undefined], // top end of each bracket
        rates.map((r) => r / 100), // rate for each bracket
        (low, high, rate) => {
          if (income < low) {
            // this bracket is above income, no tax here
            return 0
          } else if (high === undefined) {
            // This is the top bracket
            return Math.max(0, income - low) * rate
          } else if (income >= high) {
            // Taxable income is above the top of this bracket
            // so add the max tax for this bracket
            return (high - low) * rate
          }
          // Otherwise max income is inside this bracket,
          // add the tax on the amount falling in this bracket

          if (income < 5) {
            return 0
          }
          // If income is between $5 and $25, tax table computes rate at midpoint of $5 ranges
          if (income >= 5 && income < 25) {
            income = Math.floor(income)
            const over5 = income % 5
            income += 2.5 - over5
          }
          // If income is between $25 and $3,000, tax table computes rate at midpoint of $25 ranges
          else if (income >= 25 && income < 3000) {
            income = Math.floor(income)
            const over25 = income % 25
            income += 12.5 - over25
          }
          // If income is between $3,000 and $100,000, tax table computes rate at midpoint of $50 ranges
          else if (income >= 3000 && income < 100000) {
            income = Math.floor(income)
            const over50 = income % 50
            income += 25 - over50
          }
          return (income - low) * rate
        }
      )
      .sum()
      .value()

/** Exact progressive arithmetic; the published Tax Table uses band midpoints.
 * Return the rational worksheet amount; F1040 records its rounded line value.
 * The complete published table is independently checked, not generated here.
 */
export const computeOrdinaryTax = (
  status: FilingStatus,
  income: number
): number => {
  if (!Number.isFinite(income) || income < 0)
    throw new Error('Invalid taxable income')
  if (income < 5) return 0
  let basis = income
  if (income < 25) basis = Math.floor(income / 5) * 5 + 2.5
  else if (income < 3000) basis = Math.floor(income / 25) * 25 + 12.5
  else if (income < 100000) basis = Math.floor(income / 50) * 50 + 25
  // A worksheet intermediate can have more than two decimals. Interpret its
  // round-trip decimal exactly; source money is validated at the API boundary.
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(basis))
  if (!match) throw new Error('Invalid tax basis')
  const fraction = match[2] ?? ''
  const scale = fraction.length - Number(match[3] ?? 0)
  const denominator = BigInt(10) ** BigInt(Math.max(0, scale))
  const amount =
    BigInt(match[1] + fraction) * BigInt(10) ** BigInt(Math.max(0, -scale))
  const brackets = federalBrackets.ordinary.status[status].brackets
  const rates = federalBrackets.ordinary.rates
  let total = BigInt(0)
  let lower = BigInt(0)
  for (let i = 0; i < rates.length; i++) {
    const upper =
      i < brackets.length ? BigInt(brackets[i]) * denominator : amount
    const taxable = (amount < upper ? amount : upper) - lower
    if (taxable > BigInt(0)) total += taxable * BigInt(rates[i])
    if (amount <= upper) break
    lower = upper
  }
  return Number(total) / Number(denominator * BigInt(100))
}

export const computeLongTermCapGainsTax = computeTax(
  (status) => federalBrackets.longTermCapGains.status[status].brackets,
  federalBrackets.longTermCapGains.rates
)
