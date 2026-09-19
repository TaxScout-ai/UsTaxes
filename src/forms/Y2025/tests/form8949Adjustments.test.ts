import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { Form8949Category, Form8949Row } from 'ustaxes/core/data'
import { blankState } from 'ustaxes/redux/reducer'
import { rehearsalInformation } from './fixtures/atsRehearsal'
import { validateCalculationRequest } from '../../../../server/utils/calculation-contract'

/**
 * Form 8949 columns (f) and (g), 2025 Instructions for Form 8949:
 * - column (h): "subtract the cost or other basis in column (e) from the
 *   proceeds in column (d). Then take into account any adjustments in
 *   column (g)";
 * - code B, box A: "enter the basis shown on Form 1099-B … in column (e) …
 *   Correct the error by entering an adjustment in column (g)" (Worksheet for
 *   Basis Adjustments; Example 4: $1,000 proceeds, $900 reported basis,
 *   $100 correct basis, (g) $800, (h) $900);
 * - code B, box B: "enter the correct basis in column (e), and enter -0- in
 *   column (g)";
 * - code W: "enter the amount of the nondeductible loss as a positive
 *   number in column (g)".
 */

const row = (
  category: Form8949Category,
  proceeds: number,
  costBasis: number,
  adjustment?: { code: string; amount?: number }
): Form8949Row<Date> => ({
  description: `${category} lot`,
  category,
  acquiredDate: new Date('2025-01-02T00:00:00Z'),
  soldDate: new Date('2025-06-30T00:00:00Z'),
  proceeds,
  costBasis,
  ...(adjustment
    ? {
        adjustmentCode: adjustment.code,
        adjustmentAmount: adjustment.amount
      }
    : {})
})

const returnWith = (rows: Form8949Row<Date>[]) =>
  new F1040(rehearsalInformation(), [], rows)

describe('Form 8949 columns (f) and (g) (TY2025)', () => {
  it('reproduces Example 4: code B on box A adjusts in column (g)', () => {
    const f = returnWith([row('A', 1_000, 900, { code: 'B', amount: 800 })])
    const part = calculationSnapshot(f).form8949?.[0]
    expect(part?.rows[0]).toMatchObject({
      proceeds: 1_000,
      costBasis: 900,
      adjustmentCode: 'B',
      adjustment: 800,
      gain: 900
    })
    expect(part?.totals).toEqual({
      proceeds: 1_000,
      costBasis: 900,
      adjustments: 800,
      gain: 900
    })
    expect([
      f.scheduleD.l1bd(),
      f.scheduleD.l1be(),
      f.scheduleD.l1bg(),
      f.scheduleD.l1bh()
    ]).toEqual([1_000, 900, 800, 900])
  })

  it('prints a zero column (g) for code B on box B', () => {
    const f = returnWith([row('B', 1_000, 100, { code: 'B', amount: 0 })])
    const snapshot = calculationSnapshot(f)
    expect(snapshot.form8949?.[0].rows[0]).toMatchObject({
      adjustmentCode: 'B',
      adjustment: 0,
      gain: 900
    })
    expect(snapshot.form8949?.[0].totals.adjustments).toBe(0)
    const fields = f.f8949s[0].fields()
    // Row 1 starts after name, SSN and six boxes; columns (f) and (g) are
    // its sixth and seventh entries.
    expect(fields.slice(8 + 5, 8 + 7)).toEqual(['B', 0])
  })

  it('adds back a wash sale loss with code W', () => {
    const f = returnWith([
      row('A', 900, 1_200, { code: 'W', amount: 150.5 }),
      row('A', 2_000, 500)
    ])
    const part = calculationSnapshot(f).form8949?.[0]
    // 150.50 rounds to 151 on its own; (h) is 900 − 1,200 + 151.
    expect(part?.rows[0]).toMatchObject({ adjustment: 151, gain: -149 })
    expect(part?.rows[1]).toMatchObject({
      adjustmentCode: null,
      adjustment: null,
      gain: 1_500
    })
    expect(part?.totals).toEqual({
      proceeds: 2_900,
      costBasis: 1_700,
      adjustments: 151,
      gain: 1_351
    })
    expect(calculationSnapshot(f).attachments.scheduleD?.lines).toMatchObject({
      '1bg': 151,
      '1bh': 1_351
    })
  })

  it('leaves column (g) blank on a part with no adjustment', () => {
    const f = returnWith([row('E', 3_000, 1_000)])
    expect(calculationSnapshot(f).form8949?.[0].totals.adjustments).toBeNull()
    expect(f.f8949s[0].longTermTotalAdjustments()).toBeUndefined()
  })

  it('is v18', () => {
    expect(calculationSnapshot(returnWith([])).schemaVersion).toBe(
      'ustaxes-1040-line-snapshot-v18'
    )
  })
})

describe('Form 8949 adjustment contract', () => {
  const codes = (adjustment: Record<string, unknown>) =>
    validateCalculationRequest({
      taxYear: 'Y2025',
      information: blankState,
      form8949Rows: [
        {
          description: 'lot',
          category: 'A',
          acquiredDate: '2025-01-02',
          soldDate: '2025-06-30',
          proceeds: 1_000,
          costBasis: 900,
          ...adjustment
        }
      ]
    }).map((i) => `${i.path} ${i.code}`)

  it('takes codes the instructions define, in order, each once', () => {
    expect(codes({ adjustmentCode: 'BW', adjustmentAmount: 10 })).toEqual([])
    expect(codes({ adjustmentCode: 'WB', adjustmentAmount: 10 })).toContain(
      '/form8949Rows/0/adjustmentCode invalid_input'
    )
    expect(codes({ adjustmentCode: 'BB', adjustmentAmount: 10 })).toContain(
      '/form8949Rows/0/adjustmentCode invalid_input'
    )
    expect(codes({ adjustmentCode: 'A', adjustmentAmount: 10 })).toContain(
      '/form8949Rows/0/adjustmentCode invalid_input'
    )
  })

  it('refuses an amount without a code to explain it', () => {
    expect(codes({ adjustmentAmount: 10 })).toContain(
      '/form8949Rows/0/adjustmentAmount invalid_input'
    )
  })
})
