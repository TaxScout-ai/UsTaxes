import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { Asset, Form8949Category, Form8949Row } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './fixtures/atsRehearsal'

/**
 * Form 8949 rows a broker reported, as the 2025 Instructions for Form 8949
 * and the 2025 Schedule D require:
 *
 * - one box per part ("Check only one box on each Part I"), so each category
 *   is its own part and eleven rows fill a part;
 * - whole-dollar entries ("If you round to whole dollars, round all
 *   amounts"), so column (h) is the difference of the rounded entries;
 * - Schedule D line 1b takes box A or G, line 2 box B or H, line 3 box C or
 *   I, and Part II lines 8b, 9 and 10 their long-term counterparts.
 */

const row = (
  description: string,
  category: Form8949Category,
  proceeds: number,
  costBasis: number,
  acquired: Partial<Form8949Row<Date>> = {
    acquiredDate: new Date('2025-01-02T00:00:00Z')
  }
): Form8949Row<Date> => ({
  description,
  category,
  soldDate: new Date('2025-06-30T00:00:00Z'),
  proceeds,
  costBasis,
  ...acquired
})

const returnWith = (rows: Form8949Row<Date>[], assets: Asset<Date>[] = []) => {
  const info: ValidatedInformation = rehearsalInformation()
  return new F1040(info, assets, rows)
}

const asset = (
  name: string,
  openDate: string,
  closeDate: string
): Asset<Date> => ({
  name,
  positionType: 'Security',
  openDate: new Date(openDate),
  closeDate: new Date(closeDate),
  openPrice: 100,
  openFee: 0,
  closePrice: 150,
  closeFee: 0,
  quantity: 10
})

describe('Form 8949 rows (TY2025)', () => {
  it('rounds each row and adds the rounded entries', () => {
    // 1,000.49 → 1,000 and 400.50 → 401, so column (h) is 599. Rounding the
    // difference instead would print 600 beside entries that do not make it.
    const f = returnWith([row('50 sh NWT', 'B', 1_000.49, 400.5)])
    const parts = calculationSnapshot(f).form8949
    expect(parts).toHaveLength(1)
    expect(parts?.[0]).toMatchObject({
      part: 'I',
      box: 'B',
      totals: { proceeds: 1_000, costBasis: 401, gain: 599 }
    })
    expect(parts?.[0].rows[0]).toMatchObject({
      description: '50 sh NWT',
      acquired: '1/2/2025',
      sold: '6/30/2025',
      proceeds: 1_000,
      costBasis: 401,
      gain: 599
    })
  })

  it('checks one box per part and carries the totals to Schedule D 2 and 9', () => {
    const f = returnWith([
      row('short noncovered', 'B', 5_000, 3_000),
      row('long noncovered', 'E', 9_000, 4_000, {
        acquiredDate: new Date('2020-03-04T00:00:00Z')
      })
    ])
    const copy = f.f8949s[0]
    expect(f.f8949s).toHaveLength(1)
    expect([
      copy.part1BoxA(),
      copy.part1BoxB(),
      copy.part1BoxC(),
      copy.part1BoxG(),
      copy.part1BoxH(),
      copy.part1BoxI()
    ]).toEqual([false, true, false, false, false, false])
    expect([
      copy.part2BoxD(),
      copy.part2BoxE(),
      copy.part2BoxF(),
      copy.part2BoxJ(),
      copy.part2BoxK(),
      copy.part2BoxL()
    ]).toEqual([false, true, false, false, false, false])
    const d = f.scheduleD
    expect([d.l2d(), d.l2e(), d.l2h()]).toEqual([5_000, 3_000, 2_000])
    expect([d.l9d(), d.l9e(), d.l9h()]).toEqual([9_000, 4_000, 5_000])
    // Line 1a/8a report the Exception 1 totals, which this return has none of.
    expect(d.l1ad()).toBe(0)
    expect([d.l1bd(), d.l8bd()]).toEqual([0, 0])
    const { attachments } = calculationSnapshot(f)
    expect(attachments.scheduleD?.lines).toMatchObject({
      '2d': 5_000,
      '2e': 3_000,
      '2h': 2_000,
      '9d': 9_000,
      '9e': 4_000,
      '9h': 5_000
    })
  })

  it('starts a second copy at the twelfth row of a category', () => {
    const rows = Array.from(Array(12)).map((_, i) =>
      row(`lot ${i + 1}`, 'B', 100 + i, 50)
    )
    const f = returnWith(rows)
    expect(f.f8949s).toHaveLength(2)
    expect(f.f8949s[0].shortTermSales()).toHaveLength(11)
    expect(f.f8949s[1].shortTermSales()).toHaveLength(1)
    expect(f.f8949s[1].part1BoxB()).toBe(true)
    expect(f.f8949s[1].shortTermSales()[0].description).toBe('lot 12')
    // Both copies check box B, so line 2 adds both.
    expect(f.scheduleD.l2d()).toBe(rows.reduce((acc, r) => acc + r.proceeds, 0))
    expect(calculationSnapshot(f).form8949).toHaveLength(2)
  })

  it('gives each category its own part', () => {
    const f = returnWith([
      row('covered', 'A', 1_000, 900),
      row('noncovered', 'B', 2_000, 1_500)
    ])
    expect(f.f8949s).toHaveLength(2)
    expect(f.f8949s.map((c) => c.part1BoxA())).toEqual([true, false])
    expect(f.f8949s.map((c) => c.part1BoxB())).toEqual([false, true])
    expect(f.scheduleD.l1bd()).toBe(1_000)
    expect(f.scheduleD.l2d()).toBe(2_000)
  })

  it('reports a digital-asset category on the same Schedule D lines', () => {
    // Line 1b is "Box A or Box G"; line 3 is "Box C or Box I".
    const f = returnWith([
      row('1.5 BTC', 'G', 60_000, 40_000),
      row('unreported token', 'I', 500, 100)
    ])
    expect(f.f8949s.map((c) => c.part1BoxG())).toEqual([true, false])
    expect(f.f8949s.map((c) => c.part1BoxI())).toEqual([false, true])
    expect(f.scheduleD.l1bd()).toBe(60_000)
    expect(f.scheduleD.l3d()).toBe(500)
  })

  it('prints a column (b) code instead of a date', () => {
    const f = returnWith([
      row('various lots', 'E', 3_000, 1_000, { acquiredCode: 'VARIOUS' })
    ])
    expect(calculationSnapshot(f).form8949?.[0].rows[0].acquired).toBe(
      'VARIOUS'
    )
  })

  it('keeps a legacy portfolio asset on box C or F', () => {
    const f = returnWith(
      [],
      [
        asset('short position', '2025-01-02', '2025-06-30'),
        asset('long position', '2020-01-02', '2025-06-30')
      ]
    )
    const copy = f.f8949s[0]
    expect(copy.part1BoxC()).toBe(true)
    expect(copy.part2BoxF()).toBe(true)
    expect(f.scheduleD.l3d()).toBe(1_500)
    expect(f.scheduleD.l10d()).toBe(1_500)
  })

  it('needs no Form 8949 without rows or assets', () => {
    const f = returnWith([])
    expect(f.f8949.isNeeded()).toBe(false)
    expect(calculationSnapshot(f).form8949).toBeNull()
  })

  it('is v14', () => {
    expect(calculationSnapshot(returnWith([])).schemaVersion).toBe(
      'ustaxes-1040-line-snapshot-v14'
    )
  })

  it('fills the six Part I boxes in form order', () => {
    const f = returnWith([row('1.5 BTC', 'H', 60_000, 0)])
    const fields = f.f8949s[0].fields()
    // [0] name, [1] SSN, then A, B, C, G, H, I.
    expect(fields.slice(2, 8)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false
    ])
    expect(f.f8949s[0].fields()[0]).toBe(f.namesString())
  })
})
