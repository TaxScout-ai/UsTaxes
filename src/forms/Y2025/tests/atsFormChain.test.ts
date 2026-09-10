import F1040 from '../irsForms/F1040'
import { TaxFormInputError } from '../irsForms/formInput'
import {
  EnergyPropertyItem,
  ScheduleHData,
  PersonRole
} from 'ustaxes/core/data'
import {
  energyData,
  energyDetails,
  householdData,
  rehearsalInformation,
  scenarioOneVariation
} from './fixtures/atsRehearsal'

const form = (info = rehearsalInformation()) => new F1040(info, [])
const energy = (f: F1040) => {
  if (!f.f5695) throw new Error('Missing Form 5695')
  return f.f5695
}
const household = (f: F1040) => {
  if (!f.scheduleH) throw new Error('Missing Schedule H')
  return f.scheduleH
}
const state = (name = 'OH', late = 0) => ({
  state: name,
  taxableWages: 7000,
  experienceRatePpm: 27000,
  periodStart: '2025-01-01',
  periodEnd: '2025-12-31',
  contributionsOnTime: 189 - late,
  contributionsLate: late,
  futaWagesSubjectToStateTax: 7000
})
const futa = (states = [state()]): ScheduleHData['futa'] => ({
  taxableWages: 7000 * states.length,
  allWagesSubjectToStateTax: true,
  allContributionsPaidByDueDate: states.every((s) => s.contributionsLate === 0),
  states
})

// Expected values below are derived directly from the pinned IRS forms and table.
// They are NOT IRS-published expected ATS return totals.
describe('Schedule H, Form 5695 and the actual 1040 chain', () => {
  it('calculates the explicitly completed synthetic Scenario 1 variation', () => {
    const f = form(scenarioOneVariation())
    expect([f.l1a(), f.l12(), f.l15(), f.l16()]).toEqual([
      42470, 15750, 26720, 2969
    ])
    expect([household(f).l2(), household(f).l4(), household(f).l8()]).toEqual([
      384, 90, 474
    ])
    expect([f.schedule2.l9(), f.schedule2.l21(), f.l23()]).toEqual([
      474, 474, 474
    ])
    const e = energy(f)
    expect([
      e.pdfL19d(),
      e.pdfL19e(),
      e.pdfL19f(),
      e.pdfL19h(),
      e.pdfL20d(),
      e.pdfL22d(),
      e.pdfL27(),
      e.pdfL32()
    ]).toEqual([1720, 2740, 4460, 500, 180, 600, 1280, 1200])
    expect([
      f.schedule3.l5a(),
      f.schedule3.l5b(),
      f.l20(),
      f.l24(),
      f.l33(),
      f.l34()
    ]).toEqual([0, 1200, 1200, 2243, 2713, 470])
    expect(e.supportingStatements()).toHaveLength(2)
  })

  it.each([
    [futa(), 42],
    [futa([state('CA')]), 126],
    [futa([state('VI')]), 357],
    [futa([state('OH', 100)]), 52],
    [futa([state('CA', 100)]), 136],
    [futa([state('OH'), state('NY')]), 84]
  ])(
    'uses the FUTA branch, late credit and state reduction worksheets',
    (data, expected) => {
      const h = household(
        form({
          ...rehearsalInformation(),
          scheduleH: householdData({
            quarterlyFutaThresholdMet: true,
            futa: data
          })
        })
      )
      expect(h.toSchedule2()).toBe(474 + expected)
    }
  )

  it('handles no state contributions and no FICA/FIT', () => {
    const h = household(
      form({
        ...rehearsalInformation(),
        scheduleH: householdData({
          socialSecurityWages: 0,
          medicareWages: 0,
          quarterlyFutaThresholdMet: true,
          futa: {
            taxableWages: 2000,
            allWagesSubjectToStateTax: false,
            allContributionsPaidByDueDate: true,
            states: []
          }
        })
      })
    )
    expect(h.toSchedule2()).toBe(120)
    expect(h.namedFields()['c1_3[1]']).toBe(true)
    expect(h.namedFields().f1_11).toBeUndefined()
  })

  it('does not file Schedule H below all established triggers', () => {
    const h = household(
      form({
        ...rehearsalInformation(),
        scheduleH: householdData({ socialSecurityWages: 0, medicareWages: 0 })
      })
    )
    expect(h.isNeeded()).toBe(false)
    expect(h.toSchedule2()).toBe(0)
  })

  it('applies additional Medicare and FIT without dropping either tax', () => {
    const h = household(
      form({
        ...rehearsalInformation(),
        scheduleH: householdData({
          socialSecurityWages: 176100,
          medicareWages: 210000,
          additionalMedicareWages: 10000,
          federalIncomeTaxWithheld: 1000
        })
      })
    )
    expect([h.l2(), h.l4(), h.l6(), h.toSchedule2()]).toEqual([
      21836, 6090, 90, 29016
    ])
  })

  it.each([
    ['socialSecurityWages', -1],
    ['medicareWages', 1.001],
    ['federalIncomeTaxWithheld', undefined],
    ['wageBasesEstablished', false],
    ['quarterlyFutaThresholdMet', undefined]
  ])('refuses incomplete/invalid household fact %s', (key, value) => {
    expect(() =>
      form({
        ...rehearsalInformation(),
        scheduleH: { ...householdData(), [key]: value }
      })
    ).toThrow(TaxFormInputError)
  })

  it('puts the home-improvement credit before clean-energy credit', () => {
    const e = energy(
      form({
        ...rehearsalInformation(20000),
        form5695: energyData({ solarElectric: 1000, insulationMaterials: 1000 })
      })
    )
    expect([
      e.pdfL31(),
      e.pdfL32(),
      e.pdfL14(),
      e.pdfL15(),
      e.pdfL16()
    ]).toEqual([428, 300, 128, 128, 172])
  })

  it('coordinates 8812 Worksheet B without recursion or double deduction', () => {
    const info = rehearsalInformation(75250)
    info.taxPayer.dependents = [
      {
        firstName: 'Synthetic',
        lastName: 'Child',
        ssid: '000000001',
        dateOfBirth: new Date('2015-01-01T00:00:00Z'),
        role: PersonRole.DEPENDENT,
        relationship: 'child',
        isBlind: false
      }
    ]
    info.form5695 = energyData({
      solarElectric: 30000,
      insulationMaterials: 4000
    })
    const f = form(info)
    const e = energy(f)
    expect(f.schedule8812.l5()).toBe(2200)
    expect(f.schedule8812.creditLimitWorksheetBLine14()).toBe(500)
    expect([e.pdfL32(), e.pdfL15(), e.pdfL16(), f.l19(), f.l28()]).toEqual([
      1200, 6310, 2690, 500, 1700
    ])
  })

  it('uses fuel-cell capacity and prior-year clean-energy carryforward', () => {
    const e = energy(
      form({
        ...rehearsalInformation(75250),
        form5695: energyData({
          fuelCell: 10000,
          details: energyDetails({
            fuelCellCapacityKw: 0.5,
            fuelCellMainHomeInUS: true,
            cleanEnergyCarryforward: 100
          })
        })
      })
    )
    expect([e.pdfL9(), e.pdfL10(), e.pdfL11(), e.pdfL13()]).toEqual([
      3000, 500, 500, 600
    ])
  })

  it('respects the separate heat-pump and building-envelope annual limits', () => {
    const item = (cost: number): EnergyPropertyItem[] => [
      { qmid: 'T001', cost }
    ]
    const e = energy(
      form({
        ...rehearsalInformation(75250),
        form5695: energyData({
          insulationMaterials: 10000,
          heatPumps: 10000,
          details: energyDetails({ heatPumps: item(10000) })
        })
      })
    )
    expect([e.pdfL28(), e.pdfL29h(), e.pdfL30(), e.pdfL32()]).toEqual([
      1200, 2000, 3200, 3200
    ])
  })

  it('retains exact cents, sorts without mutating, and rounds printed item rows first', () => {
    const windows = [
      { qmid: 'T001', cost: 1.49 },
      { qmid: 'T002', cost: 1.49 }
    ]
    const e = energy(
      form({
        ...rehearsalInformation(),
        form5695: energyData({
          exteriorDoorsWindows: 2.98,
          details: energyDetails({ windows })
        })
      })
    )
    expect([e.pdfL20a(), e.pdfL20d()]).toEqual([2, 1])
    expect(windows.map((i) => i.qmid)).toEqual(['T001', 'T002'])
  })

  it('refuses aggregate costs without QMID/item facts instead of manufacturing an ATS return', () => {
    const i = scenarioOneVariation()
    if (!i.form5695?.details) throw new Error('fixture')
    i.form5695.details.doors = i.form5695.details.doors.slice(0, 3)
    expect(() => form(i)).toThrow('do not reconcile')
    i.form5695.details = undefined
    expect(() => form(i)).toThrow('qualification facts')
  })

  it.each([
    ['solarElectric', 1.001],
    ['centralAC', -1],
    ['roofingSurfaces', 100]
  ])('rejects invalid energy input %s', (key, value) => {
    expect(() =>
      form({
        ...rehearsalInformation(),
        form5695: energyData({ [key]: value })
      })
    ).toThrow(TaxFormInputError)
  })

  it('distinguishes an established disqualification from missing facts', () => {
    const d = energyDetails()
    if (!d.envelope) throw new Error('fixture')
    d.envelope.originalUser = false
    expect(
      energy(
        form({
          ...rehearsalInformation(),
          form5695: energyData({ insulationMaterials: 1000, details: d })
        })
      ).pdfL32()
    ).toBe(0)
    d.envelope = undefined
    expect(() =>
      form({
        ...rehearsalInformation(),
        form5695: energyData({ insulationMaterials: 1000, details: d })
      })
    ).toThrow('qualification facts')
  })
})

it('adds the printed state contribution rows rather than rerounding raw totals', () => {
  const h = household(
    form({
      ...rehearsalInformation(),
      scheduleH: householdData({
        quarterlyFutaThresholdMet: true,
        futa: futa([
          { ...state('OH'), contributionsOnTime: 188.49 },
          { ...state('NY'), contributionsOnTime: 188.49 }
        ])
      })
    })
  )
  expect(h.row(0)[8]).toBe(188)
  expect(h.row(1)[8]).toBe(188)
  expect(h.l18h()).toBe(376)
})

it('uses half of SE additional Medicare and separate rounded withholding lines in 8812', () => {
  const info = rehearsalInformation()
  info.taxPayer.dependents = [0, 1, 2].map((i) => ({
    firstName: 'Test',
    lastName: `Child${i}`,
    ssid: `00000000${i + 2}`,
    dateOfBirth: new Date('2015-01-01'),
    isBlind: false,
    role: PersonRole.DEPENDENT,
    relationship: 'Child'
  }))
  info.w2s[0].ssWithholding = 100.49
  info.w2s[0].medicareWithholding = 100.49
  const f = form(info)
  // Isolate the worksheet operand; the separate F8959 suite tests tax calculation.
  jest.spyOn(f.f8959, 'l13').mockReturnValue(100)
  expect(f.schedule8812.part2b().l21).toBe(250)
})
