import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import {
  FilingStatus,
  Income1099Type,
  PersonRole,
  Supported1099
} from 'ustaxes/core/data'
import { rehearsalInformation } from './fixtures/atsRehearsal'

/**
 * 28% rate gain and unrecaptured section 1250 gain, 2025 Instructions for
 * Schedule D:
 * - 28% Rate Gain Worksheet—Line 18: line 4 takes Form 1099-DIV box 2d,
 *   line 5 the long-term carryover as a (loss), line 6 a (loss) on
 *   Schedule D line 7, line 7 combines and floors at zero;
 * - Unrecaptured Section 1250 Gain Worksheet—Line 19: line 11 takes
 *   Form 1099-DIV box 2b, line 14 the total of lines 1–4 of the 28%
 *   worksheet, line 17 takes the combination only when it is a (loss);
 * - the Schedule D Tax Worksheet runs when line 18 or 19 is more than zero
 *   and lines 15 and 16 are gains.
 */

const dividends = (
  boxes: {
    ordinary?: number
    qualified?: number
    capitalGain?: number
    unrecaptured1250?: number
    collectibles?: number
  } = {}
): Supported1099 =>
  ({
    payer: 'Fund',
    type: Income1099Type.DIV,
    personRole: PersonRole.PRIMARY,
    form: {
      dividends: boxes.ordinary ?? 2_000,
      qualifiedDividends: boxes.qualified ?? 1_500,
      totalCapitalGainsDistributions: boxes.capitalGain ?? 10_000,
      unrecapturedSection1250Gain: boxes.unrecaptured1250 ?? 4_000,
      collectibles28PctGain: boxes.collectibles ?? 3_000
    }
  } as Supported1099)

const returnWith = (
  wages = 120_000,
  boxes: Parameters<typeof dividends>[0] = {},
  carryover: { short?: number; long?: number } = {},
  filingStatus: FilingStatus = FilingStatus.S
) => {
  const info = rehearsalInformation(wages)
  return new F1040(
    {
      ...info,
      taxPayer: { ...info.taxPayer, filingStatus },
      f1099s: [dividends(boxes)],
      shortTermCapitalLossCarryover: carryover.short,
      longTermCapitalLossCarryover: carryover.long
    },
    [],
    []
  )
}

describe('the two rate-group worksheets', () => {
  it('takes box 2d on line 4 and box 2b on line 11', () => {
    const w = calculationSnapshot(returnWith()).worksheets
    expect(w.rateGain?.lines).toMatchObject({
      '4': 3_000,
      '5': 0,
      '6': 0,
      '7': 3_000
    })
    // Line 14 is the 28% worksheet's lines 1–4, so a gain there leaves line
    // 17 at zero and the whole box 2b reaches Schedule D line 19.
    expect(w.unrecaptured1250?.lines).toMatchObject({
      '11': 4_000,
      '13': 4_000,
      '14': 3_000,
      '17': 0,
      '18': 4_000
    })
    expect(
      calculationSnapshot(returnWith()).attachments.scheduleD?.lines
    ).toMatchObject({ '17': 1, '18': 3_000, '19': 4_000, '20': 0 })
  })

  it('a long-term carryover reduces both groups', () => {
    // Carryover 5,000: the 28% group nets to zero, and lines 14–16 of the
    // 1250 worksheet combine to a (2,000) loss, which line 17 takes as
    // positive and line 18 subtracts.
    const w = calculationSnapshot(
      returnWith(120_000, {}, { long: 5_000 })
    ).worksheets
    expect(w.rateGain?.lines).toMatchObject({ '5': -5_000, '7': 0 })
    expect(w.unrecaptured1250?.lines).toMatchObject({
      '14': 3_000,
      '16': -5_000,
      '17': 2_000,
      '18': 2_000
    })
  })

  it('leaves both worksheets out when line 17 is not "Yes"', () => {
    // No capital gain distribution: Schedule D line 15 is zero, so line 17
    // is "No" and lines 18 and 19 are not completed.
    const s = calculationSnapshot(
      returnWith(120_000, {
        capitalGain: 0,
        unrecaptured1250: 0,
        collectibles: 0
      })
    )
    expect(s.worksheets.rateGain).toBeNull()
    expect(s.worksheets.unrecaptured1250).toBeNull()
    expect(s.worksheets.scheduleDTax).toBeNull()
  })
})

describe('the Schedule D Tax Worksheet', () => {
  it('taxes the 4,500 that lands above the 0% ceiling at 15%', () => {
    // Taxable income 116,250; line 21 111,750; line 30 4,500 at 15% = 675.
    // Line 45 20,342 against line 46 20,747 — the worksheet saves 405, the
    // nine points between the 24% and 15% rates on 4,500.
    const s = calculationSnapshot(returnWith())
    expect(s.worksheets.scheduleDTax?.lines).toMatchObject({
      '1': 116_250,
      '9': 10_000,
      '10': 11_500,
      '11': 7_000,
      '13': 4_500,
      '15': 48_350,
      '19': 116_250,
      '21': 111_750,
      '22': 0,
      '30': 4_500,
      '31': 675,
      '35': 4_000,
      '38': 7_000,
      '39': 0,
      '40': 0,
      '41': 116_250,
      '42': 0,
      '43': 0,
      '44': 19_667,
      '45': 20_342,
      '46': 20_747,
      '47': 20_342
    })
    expect(s.lines['16']).toBe(20_342)
  })

  it('takes the 24% ordinary ceiling on line 19, not the capital gain one', () => {
    // Line 19 is $197,300 for a single filer; the 15% capital gain ceiling
    // ($533,400) belongs to line 26. At this income the two differ.
    const s = calculationSnapshot(returnWith(260_000))
    expect(s.worksheets.scheduleDTax?.lines).toMatchObject({
      '19': 197_300,
      '26': 533_400
    })
  })

  it('skips lines 23 through 43 when lines 1 and 16 are the same', () => {
    // Taxable income below the 0% ceiling: every gain is taxed at 0% and
    // the form says to go straight to line 44.
    const s = calculationSnapshot(returnWith(42_470))
    const lines = s.worksheets.scheduleDTax?.lines
    expect(lines).toMatchObject({ '1': 38_720, '16': 38_720 })
    for (const line of ['23', '30', '31', '35', '41', '43'])
      expect(lines?.[line]).toBeNull()
    expect(lines?.['45']).toBe(lines?.['44'])
  })
})
