import F1040 from '../irsForms/F1040'
import { Asset } from 'ustaxes/core/data'
import { rehearsalInformation } from './fixtures/atsRehearsal'

/**
 * Form 8949 prints 14 sales in Part I and 14 in Part II; more continue on
 * another copy. The copy count had the Schedule B off-by-one (TAX-4847): a
 * full part produced an empty second copy.
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
    [14, 0, 1],
    [15, 0, 2],
    [28, 0, 2],
    [29, 0, 3],
    [0, 14, 1],
    [14, 14, 1],
    [14, 15, 2]
  ])('%i short-term and %i long-term sales file %i copies', (s, l, n) => {
    expect(copies(s, l)).toBe(n)
  })
})
