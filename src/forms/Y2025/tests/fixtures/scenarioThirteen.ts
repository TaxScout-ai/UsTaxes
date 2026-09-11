import {
  FilingStatus,
  Form8911Data,
  Form8911PropertyData,
  PersonRole
} from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './atsRehearsal'

/**
 * IRS ATS Scenario 13 as the published PDF states it: married filing
 * jointly, digital assets "No", one W-2 (31,620 / 609 withheld / 31,620
 * Social Security and Medicare wages), and one personal-use electric charger
 * on Schedule A (Form 8911): cost 1,000, placed in service 03/01/2025 in an
 * eligible census tract, at the main home → credit 300, limited by the net
 * regular tax. The PDF's standard deduction (30,000) is the TY2024 figure;
 * the form prints 31,500 and the engine uses it, so taxable income is 120,
 * the tax-table tax 11 and the credit limited to 11, not 162. Form 6251 is
 * required because the personal-use credit is claimed.
 */
export const electricCharger = (
  over: Partial<Form8911PropertyData> = {}
): Form8911PropertyData => ({
  description: 'ELECTRIC CHARGER',
  location: {
    address: '1 Synthetic Street',
    city: 'Test',
    state: 'OH',
    zip: '00000'
  },
  constructionStartDate: '2025-03-01',
  placedInServiceDate: '2025-03-01',
  eligibleCensusTract: true,
  censusTractGeoid: '48201100000',
  cost: 1000,
  businessUseFraction: 0,
  installedAtMainHome: true,
  ...over
})

export const refuelingCredit = (
  properties: Form8911PropertyData[] = [electricCharger()]
): Form8911Data => ({ properties })

export const scenarioThirteenInformation = (
  over: Partial<ValidatedInformation> = {}
): ValidatedInformation => {
  const base = rehearsalInformation()
  return {
    ...base,
    taxPayer: {
      ...base.taxPayer,
      filingStatus: FilingStatus.MFJ,
      spouse: {
        firstName: 'Synthetic',
        lastName: 'Spouse',
        ssid: '000000000',
        dateOfBirth: new Date('1986-01-01T00:00:00Z'),
        isBlind: false,
        isTaxpayerDependent: false,
        role: PersonRole.SPOUSE
      }
    },
    questions: { ...base.questions, CRYPTO: false },
    w2s: [
      {
        income: 31620,
        medicareIncome: 31620,
        ssWages: 31620,
        ssWithholding: 1960,
        medicareWithholding: 458,
        fedWithholding: 609,
        personRole: PersonRole.PRIMARY,
        occupation: 'Clerk'
      }
    ],
    form8911: refuelingCredit(),
    ...over
  }
}
