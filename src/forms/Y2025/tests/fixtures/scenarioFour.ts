import {
  FilingStatus,
  Form3800Data,
  Form8835Data,
  Form8936Data,
  Form8936VehicleData,
  PersonRole
} from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './atsRehearsal'

/**
 * IRS ATS Scenario 4 as the published PDF states it: Single, born
 * 1989-07-08, one W-2 (36,014 / 4,581 withheld / 36,014 Social Security and
 * Medicare wages), a Form 8835 renewable electricity credit bought under a
 * transfer election (solar, 440,000 kWh × $0.006 = 2,640, a qualified
 * facility → × 5 = 13,200), and the business/investment use part of a new
 * clean vehicle on Schedule A (Form 8936): the package states 130 on Form
 * 3800 line 1y and leaves Schedule A lines 9–10 blank, so the fixture states
 * a 130 tentative credit at 100% business use. Form 3800 limits the 13,330
 * to the regular tax (no AMT, no TMT), applied first to the Form 8835 line.
 */
export const solarFacility = (
  over: Partial<Form8835Data> = {}
): Form8835Data => ({
  registrationNumber: 'PAZ123055555',
  facilityTypeDescription: '8860952 Solar',
  owner: { businessName: 'Texas Solar Energy', tin: '000000029' },
  facilityAddress: {
    address: '808 Spring Love Lane',
    city: 'Houston',
    state: 'TX',
    zip: '77004'
  },
  latitude: '+24.778212',
  longitude: '-103.743636',
  constructionStartDate: '2017-08-15',
  placedInServiceDate: '2023-09-22',
  expansionOfBiomassFacility: false,
  netOutputUnder1MW: true,
  constructionBeganBefore2023Jan29: true,
  meetsWageAndApprenticeshipRequirements: true,
  domesticContentBonus: false,
  energyCommunityBonus: 'no',
  nameplateCapacityDcKw: 10000,
  nameplateCapacityAcKw: { solar: 765 },
  kilowattHoursSold: { solar: 440000 },
  purchasedUnderTransferElection: true,
  ...over
})

export const bmwI4 = (
  over: Partial<Form8936VehicleData> = {}
): Form8936VehicleData => ({
  year: 2024,
  make: 'BMW',
  model: 'i4 Gran Coupe',
  vin: 'IHGBH41JXMN108186',
  placedInServiceDate: '2025-01-25',
  transferredToDealer: false,
  kind: 'new',
  resoldWithin30Days: false,
  acquiredForUseNotResale: true,
  tentativeCredit: 130,
  businessUseFraction: 1,
  ...over
})

export const cleanVehicleCredit = (
  vehicles: Form8936VehicleData[] = [bmwI4()]
): Form8936Data => ({
  vehicles,
  priorYearAgi: 0,
  priorYearFilingStatus: FilingStatus.S
})

export const generalBusinessCredit = (): Form3800Data => ({
  transferElectionStatementCount: 1,
  lineDetails: [
    {
      line: '1f',
      registrationNumber: 'PAZ123055555',
      entityEinAppliedFor: true
    },
    { line: '1y', entityEinAppliedFor: true }
  ]
})

export const scenarioFourInformation = (
  over: Partial<ValidatedInformation> = {}
): ValidatedInformation => {
  const base = rehearsalInformation()
  return {
    ...base,
    taxPayer: {
      ...base.taxPayer,
      filingStatus: FilingStatus.S,
      primaryPerson: {
        ...base.taxPayer.primaryPerson,
        dateOfBirth: new Date('1989-07-08T00:00:00Z')
      }
    },
    questions: { ...base.questions, CRYPTO: false },
    w2s: [
      {
        income: 36014,
        medicareIncome: 36014,
        ssWages: 36014,
        ssWithholding: 2233,
        medicareWithholding: 522,
        fedWithholding: 4581,
        personRole: PersonRole.PRIMARY,
        occupation: 'Clerk'
      }
    ],
    form8835: solarFacility(),
    form8936: cleanVehicleCredit(),
    form3800: generalBusinessCredit(),
    ...over
  }
}
