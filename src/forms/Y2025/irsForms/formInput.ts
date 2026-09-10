import { MoneyInputError, toExactCents } from './rounding'

/** Expected refusal at the form boundary, also used by both HTTP routes. */
export class TaxFormInputError extends Error {
  constructor(
    readonly code: 'invalid_input' | 'needs_facts' | 'unsupported',
    readonly path: string,
    message: string
  ) {
    super(message)
    this.name = 'TaxFormInputError'
    Object.setPrototypeOf(this, TaxFormInputError.prototype)
  }
}

export function nonnegativeMoney(value: unknown, path: string): number {
  if (value === undefined || value === null)
    throw new TaxFormInputError(
      'needs_facts',
      path,
      'Establish this amount, including explicit zero'
    )
  try {
    if (typeof value !== 'number' || value < 0)
      throw new MoneyInputError('Expected nonnegative money')
    toExactCents(value, path)
    return value
  } catch (error) {
    if (!(error instanceof MoneyInputError)) throw error
    throw new TaxFormInputError('invalid_input', path, error.message)
  }
}

export function establishedBoolean(value: unknown, path: string): boolean {
  if (value === undefined || value === null)
    throw new TaxFormInputError(
      'needs_facts',
      path,
      'Establish this yes/no fact'
    )
  if (typeof value !== 'boolean')
    throw new TaxFormInputError('invalid_input', path, 'Expected a boolean')
  return value
}
