/* eslint @typescript-eslint/no-empty-function: "off" */

import * as federal from '../data/federal'
import { testKit, commonTests } from '.'

beforeAll(() => jest.spyOn(console, 'warn').mockImplementation(() => {}))

describe('ScheduleEIC', () => {
  it('should disallow EIC for income below threshold', async () => {
    await testKit.with1040Assert((forms): Promise<void> => {
      const f1040 = commonTests.findF1040OrFail(forms)
      const formula = federal.EIC.formulas[f1040.info.taxPayer.filingStatus]
      if (formula !== undefined && f1040.wages() < formula[0][1].lowerBound) {
        expect(f1040.scheduleEIC.allowed()).toBe(false)
        expect(f1040.scheduleEIC.credit()).toBe(0)
      }
      return Promise.resolve()
    })
  })
})

describe('EIC Table (2025 Instructions for Form 1040)', () => {
  const rows: Array<[number, number[], number[]]> = [
    // [band start, unmarried 0..3 children, joint 0..3 children]
    [50, [6, 26, 30, 34], [6, 26, 30, 34]],
    [2400, [186, 825, 970, 1091], [186, 825, 970, 1091]],
    [8450, [649, 2882, 3390, 3814], [649, 2882, 3390, 3814]],
    [12700, [488, 4328, 5090, 5726], [649, 4328, 5090, 5726]],
    [17850, [94, 4328, 7152, 8046], [638, 4328, 7152, 8046]],
    [23350, [0, 4324, 7147, 8041], [217, 4328, 7152, 8046]],
    [30450, [0, 3189, 5651, 6545], [0, 4328, 7152, 8046]],
    [31200, [0, 3070, 5494, 6388], [0, 4207, 6993, 7887]],
    [29750, [0, 3301, 5799, 6693], [0, 4328, 7152, 8046]],
    [68550, [0, 0, 0, 0], [0, 0, 0, 21]]
  ]
  it.each(rows)(
    'band %i reads as the table prints it',
    (start, unmarried, joint) => {
      for (let k = 0; k < 4; k++) {
        expect(federal.eicTableCredit(start + 49, k, false)).toBe(unmarried[k])
        expect(federal.eicTableCredit(start, k, true)).toBe(joint[k])
      }
    }
  )
  it('gives nothing below one dollar and at the end of the phase-out', () => {
    expect(federal.eicTableCredit(0, 2, false)).toBe(0)
    expect(federal.eicTableCredit(57310, 2, false)).toBe(0)
    expect(federal.eicTableCredit(61555, 3, false)).toBe(0)
    expect(federal.eicTableCredit(68675, 3, true)).toBe(0)
  })
})
