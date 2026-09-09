import { parseFormNumber, parseFormNumberOrThrow } from '../util'

// In addition to upstream's NaN regression, consume the entire decimal input.
it.each(['Infinity', '-Infinity', '1e999', '123abc', '12,500', '0x10', '1e'])(
  'rejects a non-finite or partial decimal: %s',
  (input) => {
    expect(parseFormNumber(input)).toBeUndefined()
    expect(() => parseFormNumberOrThrow(input)).toThrow()
  }
)

it.each([
  [' .5 ', 0.5],
  ['-1.25e2', -125],
  ['+12.', 12]
])('preserves a valid complete decimal: %s', (input, expected) =>
  expect(parseFormNumber(String(input))).toBe(expected)
)

describe('parseFormNumber', () => {
  it('parses valid numeric strings', () => {
    expect(parseFormNumber('123')).toBe(123)
    expect(parseFormNumber('12.5')).toBe(12.5)
    expect(parseFormNumber('0')).toBe(0)
    expect(parseFormNumber('-4')).toBe(-4)
    expect(parseFormNumber('1e3')).toBe(1000)
  })

  it('returns undefined for empty or absent input', () => {
    expect(parseFormNumber('')).toBeUndefined()
    expect(parseFormNumber(undefined)).toBeUndefined()
  })

  it('returns undefined (not NaN) for non-numeric input', () => {
    expect(parseFormNumber('abc')).toBeUndefined()
    expect(parseFormNumber('   ')).toBeUndefined()
  })
})

describe('parseFormNumberOrThrow', () => {
  it('returns the parsed number for valid input', () => {
    expect(parseFormNumberOrThrow('42')).toBe(42)
  })

  it('throws on non-numeric input instead of returning NaN', () => {
    expect(() => parseFormNumberOrThrow('abc')).toThrow()
    expect(() => parseFormNumberOrThrow('')).toThrow()
  })
})
