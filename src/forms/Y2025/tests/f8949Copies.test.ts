import F1040 from '../irsForms/F1040'
import { Asset } from 'ustaxes/core/data'
import { rehearsalInformation } from './fixtures/atsRehearsal'

/**
 * The TY2025 Form 8949 prints **eleven** rows in Part I and eleven in Part II;
 * more continue on another copy. This file asserted fourteen, the count of an
 * older form: the PDF we ship has eleven row lines per part (f1_03–f1_90 in
 * eight columns), so a twelfth row had nowhere to print (TAX-4953).
 *
 * The copy count had the Schedule B off-by-one (TAX-4847): a full part
 * produced an empty second copy.
 */
const sales = (count: number, longTerm: boolean): Asset<Date>[] =>
  Array.from({ length: count }, (_, i) => ({
    name: `${longTerm ? 'LT' : 'ST'} ${i + 1}`,
    positionType: 'Security',
    openDate: new Date(
      longTerm ? '2023-02-01T12:00:00Z' : '2025-02-01T12:00:00Z'
    ),
    closeDate: new Date('2025-09-01T12:00:00Z'),
    openPrice: 100,
    openFee: 0,
    closePrice: 110,
    closeFee: 0,
    quantity: 1
  }))

const copies = (short: number, long: number): number =>
  new F1040(rehearsalInformation(), [
    ...sales(short, false),
    ...sales(long, true)
  ])
    .schedules()
    .filter((s) => s.tag === 'f8949').length

describe('Form 8949 copies', () => {
  it.each([
    [1, 0, 1],
    [11, 0, 1],
    [12, 0, 2],
    [22, 0, 2],
    [23, 0, 3],
    [0, 11, 1],
    [11, 11, 1],
    [11, 12, 2]
  ])('%i short-term and %i long-term sales file %i copies', (s, l, n) => {
    expect(copies(s, l)).toBe(n)
  })
})
