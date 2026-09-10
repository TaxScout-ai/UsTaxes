import { IncomeW2, PersonRole, W2Box12Code } from 'ustaxes/core/data'
import { fica } from '../data/federal'
import { nonnegativeMoney, TaxFormInputError } from './formInput'
import { toExactCents } from './rounding'

const ZERO = BigInt(0)
const LIMIT = BigInt(
  toExactCents(fica.maxSSTax, 'Social Security annual limit')
)
const ROOT = '/information/w2s'

const cents = (value: unknown, path: string): bigint =>
  BigInt(toExactCents(nonnegativeMoney(value, path), path))

const line = (amount: bigint): number => {
  if (amount < ZERO || amount > BigInt(Number.MAX_SAFE_INTEGER))
    throw new TaxFormInputError(
      'invalid_input',
      ROOT,
      'Payroll total exceeds the exact cent range'
    )
  return Number((amount + BigInt(50)) / BigInt(100))
}

/** Actual source W-2 amounts. No Box 1 wage proxy or inferred payroll rate. */
export function uncollectedW2Tax(
  w2s: readonly IncomeW2[],
  codes: readonly W2Box12Code[]
): number {
  let total = ZERO
  for (const [i, w2] of w2s.entries())
    for (const code of codes)
      total += cents(w2.box12?.[code] ?? 0, `${ROOT}/${i}/box12/${code}`)
  return line(total)
}

/** 2025 Pub. 3 excess-Social-Security worksheet and 1040 Schedule 3 line 11.
 * Cap withholding by employer, apply the annual limit separately per person,
 * then combine their exact credits before rounding the single reported line.
 * Employer overcollection is excluded; it is not a Schedule 3 credit.
 * Standard W-2 employer identity is its EIN. Common-agent/paymaster and corrected
 * document reconciliation must be established before calling the calculator.
 */
export function excessSocialSecurity(w2s: readonly IncomeW2[]): number {
  let totalCredit = ZERO
  for (const person of [PersonRole.PRIMARY, PersonRole.SPOUSE]) {
    const sources = w2s.flatMap((w2, i) =>
      w2.personRole === person ? [{ w2, i }] : []
    )
    const amounts = sources.map(({ w2, i }) => ({
      w2,
      i,
      withheld: cents(w2.ssWithholding, `${ROOT}/${i}/ssWithholding`),
      uncollected:
        cents(w2.box12?.A ?? 0, `${ROOT}/${i}/box12/A`) +
        cents(w2.box12?.M ?? 0, `${ROOT}/${i}/box12/M`)
    }))
    // No possible excess, regardless of employer identity, and no employer
    // reconciliation is necessary to establish a zero result.
    if (
      amounts.reduce((sum, x) => sum + x.withheld + x.uncollected, ZERO) <=
      LIMIT
    )
      continue
    const employers = new Map<
      string,
      { withheld: bigint; uncollected: bigint }
    >()
    for (const { w2, i, withheld, uncollected } of amounts) {
      if (withheld === ZERO && uncollected === ZERO) continue
      const raw: unknown = w2.employer?.EIN
      if (raw === undefined || raw === '')
        throw new TaxFormInputError(
          'needs_facts',
          `${ROOT}/${i}/employer/EIN`,
          'Establish the employer identity before claiming excess Social Security tax'
        )
      if (typeof raw !== 'string' || !/^\d{2}-?\d{7}$/.test(raw.trim()))
        throw new TaxFormInputError(
          'invalid_input',
          `${ROOT}/${i}/employer/EIN`,
          'Expected an employer EIN'
        )
      const ein = raw.trim().replace('-', '')
      const prior = employers.get(ein) ?? { withheld: ZERO, uncollected: ZERO }
      employers.set(ein, {
        withheld: prior.withheld + withheld,
        uncollected: prior.uncollected + uncollected
      })
    }
    if (employers.size <= 1) continue
    let eligible = ZERO
    for (const employer of Array.from(employers.values()))
      eligible +=
        (employer.withheld < LIMIT ? employer.withheld : LIMIT) +
        employer.uncollected
    if (eligible > LIMIT) totalCredit += eligible - LIMIT
  }
  return line(totalCredit)
}
