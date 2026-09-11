import {
  Form7206Data,
  PersonRole,
  ScheduleCAccountingMethod,
  ScheduleCData
} from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './atsRehearsal'

/**
 * IRS ATS Scenario 12 as the published PDF states it: Single, digital assets
 * "No", one W-2 (100,836 / 14,444 withheld / 105,878 Social Security and
 * Medicare wages), a cash-method Schedule C ("Designer", 541310: gross
 * 35,235; insurance 550, legal 125, office 1,000, other rent 2,500, supplies
 * 6,532, taxes 200 → net 24,328), Form 7206 with $1,000 of premiums under
 * that business, and a Form 7217 that carries no return line. The PDF's
 * standard deduction (15,000) is the TY2024 figure; the form prints 15,750
 * and the engine uses it.
 */
export const designBusiness = (
  over: Partial<ScheduleCData> = {}
): ScheduleCData => ({
  businessName: 'Energy Build',
  businessCode: '541310',
  accountingMethod: ScheduleCAccountingMethod.Cash,
  didMateriallyParticipate: true,
  didStartBusiness: false,
  didMakePaymentsRequiring1099: false,
  didFile1099s: false,
  personRole: PersonRole.PRIMARY,
  grossReceipts: 35235,
  returns: 0,
  costOfGoodsSold: 0,
  otherIncome: 0,
  advertising: 0,
  carAndTruck: 0,
  commissions: 0,
  contractLabor: 0,
  depletion: 0,
  depreciation: 0,
  employeeBenefits: 0,
  insurance: 550,
  interestMortgage: 0,
  interestOther: 0,
  legal: 125,
  officeExpense: 1000,
  pensionProfitSharing: 0,
  rentVehicles: 0,
  rentOther: 2500,
  repairs: 0,
  supplies: 6532,
  taxes: 200,
  travel: 0,
  meals: 0,
  utilities: 0,
  wages: 0,
  otherExpenses: 0,
  ...over
})

export const healthPlan = (over: Partial<Form7206Data> = {}): Form7206Data => ({
  personRole: PersonRole.PRIMARY,
  scheduleCIndex: 0,
  healthInsurancePremiums: 1000,
  longTermCarePremiums: 0,
  ...over
})

export const scenarioTwelveInformation = (
  over: Partial<ValidatedInformation> = {}
): ValidatedInformation => {
  const base = rehearsalInformation()
  return {
    ...base,
    questions: { ...base.questions, CRYPTO: false },
    w2s: [
      {
        income: 100836,
        medicareIncome: 105878,
        ssWages: 105878,
        ssWithholding: 6564,
        medicareWithholding: 1535,
        fedWithholding: 14444,
        personRole: PersonRole.PRIMARY,
        occupation: 'Designer'
      }
    ],
    scheduleCBusinesses: [designBusiness()],
    form7206s: [healthPlan()],
    ...over
  }
}
