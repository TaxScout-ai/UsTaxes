/** TY2025 whole-dollar policy: aggregate source cents before rounding a line.
 * Source: https://www.irs.gov/instructions/i1040gi#en_US_2025_publink1000104428
 * Rates/ratios retain their precision until the named form-line boundary.
 * Legacy numeric inputs mean their shortest round-trip decimal representation;
 * we never infer extra precision or repair a fractional cent with a tolerance.
 */
const ZERO = BigInt(0)
const ONE = BigInt(1)
const HUNDRED = BigInt(100)
const MAX_CENTS = BigInt(Number.MAX_SAFE_INTEGER)

export class MoneyInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyInputError'
    Object.setPrototypeOf(this, MoneyInputError.prototype)
  }
}

const safeInteger = (value: bigint, label: string): number => {
  if (value > MAX_CENTS || value < -MAX_CENTS) {
    throw new MoneyInputError(`${label} exceeds the exact integer range`)
  }
  return Number(value)
}

/** Exact rational rounding, ties away from zero; no binary rate multiplication. */
const roundedRatio = (numerator: bigint, denominator: bigint): bigint => {
  if (denominator <= ZERO) throw new MoneyInputError('Invalid denominator')
  const magnitude = numerator < ZERO ? -numerator : numerator
  const quotient = magnitude / denominator
  const result =
    quotient +
    ((magnitude % denominator) * BigInt(2) >= denominator ? ONE : ZERO)
  return numerator < ZERO ? -result : result
}

export const toExactCents = (amount: number, label: string): number => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    throw new MoneyInputError(`${label} must be a finite number`)
  }
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(amount))
  if (!match)
    throw new MoneyInputError(`${label} must be an exact number of cents`)
  const magnitude =
    BigInt(match[2]) * HUNDRED + BigInt((match[3] ?? '').padEnd(2, '0'))
  return safeInteger(match[1] === '-' ? -magnitude : magnitude, label)
}

export const sumExactCents = (
  amounts: readonly number[],
  label: string
): number =>
  safeInteger(
    amounts.reduce(
      (sum, amount) => sum + BigInt(toExactCents(amount, label)),
      ZERO
    ),
    label
  )

export const sumToWholeDollars = (
  amounts: readonly number[],
  label: string
): number =>
  safeInteger(
    roundedRatio(BigInt(sumExactCents(amounts, label)), HUNDRED),
    label
  )

/** General worksheet result boundary. Source-money validation uses toExactCents. */
export const roundLine = (amount: number): number => {
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    Math.abs(amount) > Number.MAX_SAFE_INTEGER / 100
  ) {
    throw new MoneyInputError('Line amount is outside the finite exact range')
  }
  return Math.sign(amount) * Math.round(Math.abs(amount))
}

export const roundOptionalLine = (
  amount: number | undefined
): number | undefined => (amount === undefined ? undefined : roundLine(amount))

export const roundTaxTableResult = roundOptionalLine

/** Apply an integer ratio to source dollars, rounding only the resulting line. */
export const rateToWholeDollars = (
  amount: number,
  numerator: number,
  denominator: number,
  label: string
): number => {
  if (
    !Number.isSafeInteger(numerator) ||
    !Number.isSafeInteger(denominator) ||
    denominator <= 0
  ) {
    throw new MoneyInputError(`${label} has an invalid rate`)
  }
  return safeInteger(
    roundedRatio(
      BigInt(toExactCents(amount, label)) * BigInt(numerator),
      HUNDRED * BigInt(denominator)
    ),
    label
  )
}
