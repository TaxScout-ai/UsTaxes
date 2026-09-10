import * as fc from 'fast-check'
import {
  rateToWholeDollars,
  sumExactCents,
  sumToWholeDollars,
  toExactCents
} from '../irsForms/rounding'

describe('exact legacy money boundary', () => {
  it.each([NaN, Infinity, -Infinity, 1.001, 1_000_000_000_000.001, 1e-7, 1e20])(
    'rejects invalid amount %s without snapping it to cents',
    (amount) => {
      expect(() => toExactCents(amount, 'probe')).toThrow()
    }
  )
  it('reads decimal cents even where multiplication by 100 is inexact', () => {
    expect(toExactCents(66031.01, 'probe')).toBe(6603101)
    expect(toExactCents(-66031.01, 'probe')).toBe(-6603101)
  })
  it('round-trips representable cent inputs and sums without order dependence', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: -1000000000, max: 1000000000 }), {
          maxLength: 40
        }),
        (cents) => {
          const dollars = cents.map((c) => c / 100)
          expect(sumExactCents(dollars, 'probe')).toBe(
            cents.reduce((a, b) => a + b, 0)
          )
          expect(sumToWholeDollars(dollars, 'probe')).toBe(
            sumToWholeDollars([...dollars].reverse(), 'probe')
          )
        }
      ),
      { numRuns: 2000, seed: 4679 }
    )
  })
  it('rejects aggregate overflow but permits cancellation regardless of order', () => {
    expect(() =>
      sumExactCents([80000000000000, 80000000000000], 'probe')
    ).toThrow()
    expect(
      sumExactCents([80000000000000, 80000000000000, -80000000000000], 'probe')
    ).toBe(8000000000000000)
  })
  it('records the Medicare rate result at the form line boundary', () => {
    expect(rateToWholeDollars(75000, 145, 10000, 'line 21')).toBe(1088)
    expect(rateToWholeDollars(75250, 145, 10000, 'line 21')).toBe(1091)
    expect(rateToWholeDollars(500, 9, 1000, 'line 7')).toBe(5)
  })
})
