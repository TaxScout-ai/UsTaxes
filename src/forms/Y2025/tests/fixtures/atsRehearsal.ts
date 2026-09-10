import { blankState } from 'ustaxes/redux/reducer'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import {
  Form5695Data,
  Form5695Details,
  PersonRole,
  FilingStatus,
  ScheduleHData
} from 'ustaxes/core/data'

export const rehearsalInformation = (wages = 42470): ValidatedInformation => ({
  ...blankState,
  taxPayer: {
    filingStatus: FilingStatus.S,
    dependents: [],
    primaryPerson: {
      firstName: 'Synthetic',
      lastName: 'Rehearsal',
      ssid: '000000000',
      dateOfBirth: new Date('1985-01-01T00:00:00Z'),
      isBlind: false,
      isTaxpayerDependent: false,
      role: PersonRole.PRIMARY,
      address: {
        address: '1 Synthetic Street',
        city: 'Test',
        state: 'OH',
        zip: '00000'
      }
    }
  },
  w2s: [
    {
      income: wages,
      medicareIncome: wages,
      ssWages: Math.min(wages, 176100),
      ssWithholding: 0,
      medicareWithholding: 0,
      fedWithholding: 2713,
      personRole: PersonRole.PRIMARY,
      occupation: 'Synthetic'
    }
  ]
})

export const energyDetails = (
  values: Partial<Form5695Details> = {}
): Form5695Details => ({
  costsQualifiedFor2025: true,
  home: {
    street: '1 Synthetic Street',
    city: 'Test',
    state: 'OH',
    zip: '00000'
  },
  jointOccupancy: false,
  condominiumShare: false,
  cleanEnergyCarryforward: 0,
  envelope: {
    mainHomeInUS: true,
    originalUser: true,
    expectedLifeAtLeast5Years: true,
    constructionCostsExcluded: true
  },
  energyProperty: { homeInUS: true, originallyPlacedInServiceByTaxpayer: true },
  doors: [],
  windows: [],
  centralAirConditioners: [],
  waterHeaters: [],
  furnaces: [],
  heatPumps: [],
  heatPumpWaterHeaters: [],
  biomassStoves: [],
  enablingProperty: [],
  qualifiedHomeEnergyAudit: false,
  ...values
})

export const energyData = (
  values: Partial<Form5695Data> = {}
): Form5695Data => ({
  solarElectric: 0,
  solarWaterHeating: 0,
  fuelCell: 0,
  smallWindEnergy: 0,
  geothermalHeatPump: 0,
  batteryStorage: 0,
  insulationMaterials: 0,
  exteriorDoorsWindows: 0,
  roofingSurfaces: 0,
  heatPumps: 0,
  heatPumpWaterHeaters: 0,
  biomassStoves: 0,
  centralAC: 0,
  naturalGasFurnace: 0,
  panelboards: 0,
  homeEnergyAudit: 0,
  priorYearCreditsUsed: 0,
  details: energyDetails(),
  ...values
})

export const householdData = (
  values: Partial<ScheduleHData> = {}
): ScheduleHData => ({
  employerEin: '000000029',
  wageBasesEstablished: true,
  socialSecurityWages: 3100,
  medicareWages: 3100,
  additionalMedicareWages: 0,
  federalIncomeTaxWithheld: 0,
  quarterlyFutaThresholdMet: false,
  ...values
})

/** Complete SYNTHETIC variation. Overflow item/QMID detail is invented for this
 * regression only: the IRS Scenario 1 PDF does NOT establish these items. */
export const scenarioOneVariation = (): ValidatedInformation => ({
  ...rehearsalInformation(),
  scheduleH: householdData(),
  form5695: energyData({
    exteriorDoorsWindows: 6080,
    centralAC: 2500,
    details: energyDetails({
      doors: [
        { qmid: 'A1B2', cost: 1020 },
        { qmid: 'A1B3', cost: 920 },
        { qmid: 'A1B4', cost: 800 },
        ...[1, 2, 3, 4].map((n) => ({ qmid: `T00${n}`, cost: 685 }))
      ],
      windows: [{ qmid: 'A1B5', cost: 600 }],
      centralAirConditioners: [
        { qmid: 'A1B6', cost: 2100 },
        { qmid: 'T005', cost: 400 }
      ]
    })
  })
})
