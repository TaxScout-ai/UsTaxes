import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import {
  furnitureSales,
  jonesItemized,
  scenarioTwoInformation
} from './fixtures/scenarioTwo'

describe('ATS Scenario 2 (joint, deceased NRA-election spouse, statutory employee, Schedule A election)', () => {
  const f1040 = (over = {}) => new F1040(scenarioTwoInformation(over), [])
  const snapshot = (over = {}) => calculationSnapshot(f1040(over))

  it('routes the statutory-employee W-2 to Schedule C line 1 and keeps it off line 1a and Schedule SE', () => {
    const s = snapshot()
    expect(s.lines['1a']).toBe(8513)
    expect(s.attachments.scheduleC?.lines).toMatchObject({
      '1': 29513,
      '7': 29513,
      '8': 850,
      '9': 466,
      '19': 550,
      '22': 610,
      '23': 58,
      '28': 2534,
      '31': 26979,
      '44a': 665,
      '44b': 710,
      '44c': 15151
    })
    expect(s.attachments.scheduleSE).toBeNull()
    expect(s.attachments.schedule1?.lines).toMatchObject({
      '3': 26979,
      '10': 26979,
      '15': null,
      '26': 0
    })
    expect(s.attachments.schedule2.lines['21']).toBe(0)
    expect(s.indicators.scheduleCStatutoryEmployee).toBe(true)
    // Withholding from both W-2s still reaches line 25a.
    expect(s.lines['25a']).toBe(1164)
  })

  it('itemizes by election although the total is below the standard deduction', () => {
    const s = snapshot()
    expect(s.attachments.scheduleA?.lines).toMatchObject({
      '5a': 1028,
      '5b': 8972,
      '5d': 10000,
      '5e': 10000,
      '7': 10000,
      '8a': 11000,
      '8c': 251,
      '8e': 11251,
      '10': 11251,
      '11': 250,
      '12': 700,
      '14': 950,
      '17': 22201,
      '18': 1
    })
    expect(s.lines['12e']).toBe(22201)
    expect(s.indicators.itemizedDeductionsElected).toBe(true)
    expect(s.attachments.f8283?.lines).toEqual({
      count: 1,
      totalFmv: 700,
      totalCost: 3470
    })
  })

  it('gives the 19-year-old student the other-dependent credit and no child tax credit', () => {
    const s = snapshot()
    expect(s.attachments.schedule8812?.lines).toMatchObject({
      '1': 35492,
      '3': 35492,
      '4': 0,
      '5': 0,
      '6': 1,
      '7': 500,
      '8': 500,
      '12': 500,
      '14': 500
    })
    expect(s.lines['19']).toBe(500)
  })

  it('settles the return with the estimated payment and the declined EIC', () => {
    const { lines, indicators } = snapshot()
    expect(lines['8']).toBe(26979)
    expect(lines['9']).toBe(35492)
    expect(lines['11b']).toBe(35492)
    expect(lines['15']).toBe(13291)
    // Tax Table, married filing jointly, 13,250–13,300.
    expect(lines['16']).toBe(1328)
    expect(lines['22']).toBe(828)
    expect(lines['23']).toBe(0)
    expect(lines['24']).toBe(828)
    expect(lines['26']).toBe(300)
    expect(lines['27a']).toBe(0)
    expect(lines['33']).toBe(1464)
    expect(lines['34']).toBe(636)
    expect(indicators.eicDeclined).toBe(true)
    expect(indicators.spouseDeceased).toBe(true)
    expect(indicators.nraSpouseTreatedAsResident).toBe(true)
    expect(indicators.spouse65OrOlder).toBe(false)
  })

  it('claims the EIC when it is not declined, so the decline is a real election', () => {
    const s = snapshot({ questions: { CRYPTO: false } })
    expect(s.lines['27a']).toBeGreaterThan(0)
    expect(s.indicators.eicDeclined).toBe(false)
  })

  it('takes the standard deduction without the election when itemized is lower', () => {
    const s = snapshot({
      itemizedDeductions: jonesItemized({ electToItemize: false })
    })
    expect(s.attachments.scheduleA).toBeNull()
    expect(s.lines['12e']).toBe(31500)
    expect(s.indicators.itemizedDeductionsElected).toBe(false)
  })

  it('charges self-employment tax on an ordinary Schedule C with the same figures', () => {
    const s = snapshot({
      scheduleCBusinesses: [
        furnitureSales({ statutoryEmployee: false, grossReceipts: 29513 })
      ],
      w2s: [
        {
          income: 8513,
          medicareIncome: 8513,
          ssWages: 8513,
          ssWithholding: 528,
          medicareWithholding: 123,
          fedWithholding: 161,
          personRole: 'SPOUSE',
          occupation: 'Clerk'
        }
      ]
    })
    expect(s.attachments.scheduleSE?.lines['12']).toBeGreaterThan(0)
    expect(s.indicators.scheduleCStatutoryEmployee).toBe(false)
  })

  it('is v7', () => {
    expect(snapshot().schemaVersion).toBe('ustaxes-1040-line-snapshot-v7')
  })
})
