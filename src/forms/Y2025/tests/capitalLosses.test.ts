import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { capitalLossCarryover } from '../irsForms/worksheets/CapitalLossCarryoverWorksheet'
import {
  FilingStatus,
  Form8949Category,
  Form8949Row,
  Income1099Type,
  PersonRole,
  Supported1099
} from 'ustaxes/core/data'
import { rehearsalInformation } from './fixtures/atsRehearsal'
import { validateCalculationRequest } from '../../../../server/utils/calculation-contract'
import { blankState } from 'ustaxes/redux/reducer'

/**
 * Capital losses, 2025 Schedule D and its instructions:
 * - line 16 a loss: "skip lines 17 through 20 below. Then, go to line 21.
 *   Also be sure to complete line 22";
 * - line 16 zero: "skip lines 17 through 21 below ... Then, go to line 22";
 * - line 21: the smaller of the loss on line 16 or ($3,000), ($1,500) if
 *   married filing separately;
 * - Capital Loss Carryover Worksheet—Lines 6 and 14, lines 1–13.
 */

const row = (
  category: Form8949Category,
  proceeds: number,
  costBasis: number
): Form8949Row<Date> => ({
  description: `${category} lot`,
  category,
  acquiredDate: new Date(
    category === 'A' ? '2025-01-02T00:00:00Z' : '2020-01-02T00:00:00Z'
  ),
  soldDate: new Date('2025-06-30T00:00:00Z'),
  proceeds,
  costBasis
})

const returnWith = (
  rows: Form8949Row<Date>[],
  carryover: { short?: number; long?: number } = {},
  filingStatus: FilingStatus = FilingStatus.S
) => {
  const info = rehearsalInformation()
  return new F1040(
    {
      ...info,
      taxPayer: { ...info.taxPayer, filingStatus },
      shortTermCapitalLossCarryover: carryover.short,
      longTermCapitalLossCarryover: carryover.long
    },
    [],
    rows
  )
}

describe('Capital Loss Carryover Worksheet (lines 1–13)', () => {
  it('splits a short- and long-term loss between the two carryovers', () => {
    // Line 16 −12,000 = line 7 −8,500 + line 15 −3,500; line 21 −3,000.
    const w = capitalLossCarryover({
      taxableIncomeBeforeFloor: 23_720,
      scheduleDLine21: -3_000,
      scheduleDLine7: -8_500,
      scheduleDLine15: -3_500
    })
    expect(w.lines).toEqual({
      '1': 23_720,
      '2': 3_000,
      '3': 26_720,
      '4': 3_000,
      '5': 8_500,
      '6': 0,
      '7': 3_000,
      '8': 5_500,
      '9': 3_500,
      '10': 0,
      '11': 0,
      '12': 0,
      '13': 3_500
    })
    expect([w.shortTerm, w.longTerm]).toEqual([5_500, 3_500])
  })

  it('uses up the short-term gain before the long-term loss carries', () => {
    // Line 7 a gain: line 5 is zero and lines 6–8 are skipped.
    const w = capitalLossCarryover({
      taxableIncomeBeforeFloor: 50_000,
      scheduleDLine21: -3_000,
      scheduleDLine7: 1_000,
      scheduleDLine15: -6_000
    })
    expect(w.lines).toMatchObject({
      '5': 0,
      '6': null,
      '7': null,
      '8': null,
      '9': 6_000,
      '10': 1_000,
      '11': 3_000,
      '12': 4_000,
      '13': 2_000
    })
    expect([w.shortTerm, w.longTerm]).toEqual([0, 2_000])
  })

  it('carries the whole loss when taxable income would be negative', () => {
    // Line 1 in parentheses: line 3 is zero, so none of the loss was used.
    const w = capitalLossCarryover({
      taxableIncomeBeforeFloor: -8_750,
      scheduleDLine21: -3_000,
      scheduleDLine7: -3_000,
      scheduleDLine15: 0
    })
    expect(w.lines).toMatchObject({ '1': -8_750, '3': 0, '4': 0, '8': 3_000 })
    expect([w.shortTerm, w.longTerm]).toEqual([3_000, 0])
  })

  it('has no carryover without a loss on line 21', () => {
    expect(
      capitalLossCarryover({
        taxableIncomeBeforeFloor: 10_000,
        scheduleDLine21: undefined,
        scheduleDLine7: 500,
        scheduleDLine15: 0
      })
    ).toEqual({ shortTerm: 0, longTerm: 0, lines: null })
  })
})

describe('Schedule D with a net loss (TY2025)', () => {
  const lossReturn = () =>
    returnWith([row('A', 10_000, 17_000), row('D', 5_000, 6_000)], {
      short: 1_500,
      long: 2_500
    })

  it('takes the carryovers, limits line 21 and skips line 17', () => {
    const s = calculationSnapshot(lossReturn())
    expect(s.attachments.scheduleD?.lines).toMatchObject({
      '6': -1_500,
      '7': -8_500,
      '14': -2_500,
      '15': -3_500,
      '16': -12_000,
      '17': null,
      '18': null,
      '19': null,
      '20': null,
      '21': -3_000,
      '22': 0
    })
    expect(s.lines['7']).toBe(-3_000)
  })

  it('reports the carryover into 2026 from this return', () => {
    const s = calculationSnapshot(lossReturn())
    // Line 1: AGI 39,470 less the 15,750 standard deduction.
    expect(s.worksheets.capitalLossCarryover?.lines).toMatchObject({
      '1': 23_720,
      '8': 5_500,
      '13': 3_500
    })
  })

  it('limits a separate filer to $1,500', () => {
    const f = returnWith([row('A', 1_000, 9_000)], {}, FilingStatus.MFS)
    expect(f.scheduleD.l21()).toBe(-1_500)
    expect(f.l7()).toBe(-1_500)
  })

  it('files Schedule D for a carryover alone', () => {
    const s = calculationSnapshot(returnWith([], { long: 5_000 }))
    expect(s.attachments.scheduleD?.lines).toMatchObject({
      '14': -5_000,
      '16': -5_000,
      '21': -3_000
    })
    expect(s.worksheets.capitalLossCarryover?.lines).toMatchObject({
      '5': 0,
      '13': 2_000
    })
  })

  it('skips lines 17 through 21 when line 16 is zero', () => {
    const s = calculationSnapshot(
      returnWith([row('A', 3_000, 1_000)], { short: 2_000 })
    )
    expect(s.attachments.scheduleD?.lines).toMatchObject({
      '16': 0,
      '17': null,
      '21': null,
      '22': 0
    })
    expect(s.worksheets.capitalLossCarryover).toBeNull()
  })

  it('answers line 17 "No" for a gain with a long-term loss, and skips 21', () => {
    const s = calculationSnapshot(
      returnWith([row('A', 6_000, 1_000), row('D', 1_000, 2_000)])
    )
    expect(s.attachments.scheduleD?.lines).toMatchObject({
      '15': -1_000,
      '16': 4_000,
      '17': 0,
      '20': null,
      '21': null,
      '22': 0
    })
  })
})

describe('Schedule D from 1099-B totals with cents', () => {
  const brokerage = (wages?: number) => {
    const info = rehearsalInformation(wages)
    return new F1040(
      {
        ...info,
        f1099s: [
          {
            payer: 'Brokerage',
            type: Income1099Type.B,
            personRole: PersonRole.PRIMARY,
            form: {
              shortTermProceeds: 8_000.4,
              shortTermCostBasis: 12_500.1,
              longTermProceeds: 15_000.49,
              longTermCostBasis: 14_000.51
            }
          } as Supported1099
        ],
        shortTermCapitalLossCarryover: 2_000,
        longTermCapitalLossCarryover: 4_000
      },
      [],
      []
    )
  }

  it('rounds each column of lines 1a and 8a, then nets', () => {
    // Line 8a: 15,000 less 14,001 — the exact cents would net to 1,000.
    expect(
      calculationSnapshot(brokerage()).attachments.scheduleD?.lines
    ).toMatchObject({
      '1ad': 8_000,
      '1ae': 12_500,
      '1ah': -4_500,
      '8ad': 15_000,
      '8ae': 14_001,
      '8ah': 999,
      '16': -9_501,
      '21': -3_000
    })
  })

  it('carries the whole loss when deductions exceed income', () => {
    // AGI 9,000 less the 15,750 standard deduction: line 1 is (6,750).
    expect(
      calculationSnapshot(brokerage(12_000)).worksheets.capitalLossCarryover
        ?.lines
    ).toMatchObject({ '1': -6_750, '3': 0, '4': 0, '8': 6_500, '13': 3_001 })
  })
})

describe('the calculation contract', () => {
  const request = (information: Record<string, unknown>) => ({
    taxYear: 'Y2025',
    information: { ...blankState, ...information }
  })

  it('refuses a negative or fractional carryover', () => {
    for (const bad of [-1, 10.5])
      expect(
        validateCalculationRequest(
          request({ shortTermCapitalLossCarryover: bad })
        ).map((i) => i.path)
      ).toContain('/information/shortTermCapitalLossCarryover')
    expect(
      validateCalculationRequest(
        request({ longTermCapitalLossCarryover: 2_500 })
      ).filter((i) => i.path.includes('CapitalLossCarryover'))
    ).toEqual([])
  })
})
