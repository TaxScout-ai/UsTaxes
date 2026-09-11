import {
  FilingStatus,
  Form8283Data,
  ItemizedDeductions,
  PersonRole,
  ScheduleCAccountingMethod,
  ScheduleCData
} from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './atsRehearsal'

/**
 * IRS ATS Scenario 2 (TY2025) as the published package states it — inputs
 * only, the return is computed. Married filing jointly; the spouse died
 * 2025-09-11 and, a nonresident alien, is treated as a resident by election;
 * one dependent son born 2006-07-20, a full-time student (19: no child tax
 * credit, the $500 other-dependent credit). Two W-2s: the primary's is a
 * statutory employee's (29,513 → Schedule C line 1, not line 1a; no
 * Schedule SE), the spouse's ordinary (8,513). Schedule C "Furniture
 * Sales": advertising 850, 665 business miles (line 9 = 466 at 70¢), pension
 * 550, supplies 610, taxes 58 → 26,979. Schedule A elected although below
 * the standard deduction: SALT 1,028 + 8,972, mortgage interest 11,000 and
 * points 251, cash gifts 250, noncash 700 (Form 8283) → 22,201. Estimated
 * payment 300 applied from 2024; the EIC declined (line 27c).
 */
export const furnitureSales = (
  over: Partial<ScheduleCData> = {}
): ScheduleCData => ({
  businessName: '',
  businessCode: '449110',
  accountingMethod: ScheduleCAccountingMethod.Cash,
  didMateriallyParticipate: true,
  didStartBusiness: false,
  didMakePaymentsRequiring1099: false,
  didFile1099s: false,
  personRole: PersonRole.PRIMARY,
  statutoryEmployee: true,
  grossReceipts: 0,
  returns: 0,
  costOfGoodsSold: 0,
  otherIncome: 0,
  advertising: 850,
  carAndTruck: 0,
  vehicle: {
    placedInServiceDate: '2023-08-22',
    businessMiles: 665,
    commutingMiles: 710,
    otherMiles: 15151,
    availableForPersonalUse: true,
    anotherVehicleAvailable: true,
    hasEvidence: true,
    evidenceIsWritten: true
  },
  commissions: 0,
  contractLabor: 0,
  depletion: 0,
  depreciation: 0,
  employeeBenefits: 0,
  insurance: 0,
  interestMortgage: 0,
  interestOther: 0,
  legal: 0,
  officeExpense: 0,
  pensionProfitSharing: 550,
  rentVehicles: 0,
  rentOther: 0,
  repairs: 0,
  supplies: 610,
  taxes: 58,
  travel: 0,
  meals: 0,
  utilities: 0,
  wages: 0,
  otherExpenses: 0,
  ...over
})

export const jonesItemized = (
  over: Partial<ItemizedDeductions> = {}
): ItemizedDeductions => ({
  medicalAndDental: 0,
  stateAndLocalTaxes: 1028,
  isSalesTax: false,
  stateAndLocalRealEstateTaxes: 8972,
  stateAndLocalPropertyTaxes: 0,
  interest8a: 11000,
  interest8b: 0,
  interest8c: 251,
  interest8d: 0,
  investmentInterest: 0,
  charityCashCheck: 250,
  charityOther: 700,
  electToItemize: true,
  ...over
})

export const goodwillDonation = (): Form8283Data => ({
  contributions: [
    {
      doneeOrganization: 'Goodwill',
      doneeAddress: '936 Folly Road, Charleston, SC 29412',
      description: 'Clothes & toys',
      dateOfContribution: '2025-11-13',
      dateAcquired: 'Various',
      howAcquired: 'Purchase',
      donorCost: 3470,
      fairMarketValue: 700,
      methodOfFMV: 'Thrift Store Value'
    }
  ]
})

export const scenarioTwoInformation = (
  over: Partial<ValidatedInformation> = {}
): ValidatedInformation => {
  const base = rehearsalInformation()
  return {
    ...base,
    taxPayer: {
      ...base.taxPayer,
      filingStatus: FilingStatus.MFJ,
      primaryPerson: {
        ...base.taxPayer.primaryPerson,
        dateOfBirth: new Date('1965-08-02T00:00:00Z')
      },
      spouse: {
        firstName: 'Synthetic',
        lastName: 'Spouse',
        ssid: '000000001',
        dateOfBirth: new Date('1966-03-19T00:00:00Z'),
        dateOfDeath: '2025-09-11',
        nonresidentAlienTreatedAsResident: true,
        isBlind: false,
        isTaxpayerDependent: false,
        role: PersonRole.SPOUSE
      },
      dependents: [
        {
          firstName: 'Synthetic',
          lastName: 'Child',
          ssid: '000000002',
          dateOfBirth: new Date('2006-07-20T00:00:00Z'),
          isBlind: false,
          role: PersonRole.DEPENDENT,
          relationship: 'Son',
          qualifyingInfo: { numberOfMonths: 12, isStudent: true }
        }
      ]
    },
    questions: { ...base.questions, CRYPTO: false, DECLINE_EIC: true },
    w2s: [
      {
        income: 29513,
        medicareIncome: 29513,
        ssWages: 29513,
        ssWithholding: 1830,
        medicareWithholding: 428,
        fedWithholding: 1003,
        personRole: PersonRole.PRIMARY,
        occupation: 'Sales',
        statutoryEmployee: true
      },
      {
        income: 8513,
        medicareIncome: 8513,
        ssWages: 8513,
        ssWithholding: 528,
        medicareWithholding: 123,
        fedWithholding: 161,
        personRole: PersonRole.SPOUSE,
        occupation: 'Clerk'
      }
    ],
    scheduleCBusinesses: [furnitureSales()],
    itemizedDeductions: jonesItemized(),
    form8283: goodwillDonation(),
    estimatedTaxes: [{ label: 'Applied from the 2024 return', payment: 300 }],
    ...over
  }
}
