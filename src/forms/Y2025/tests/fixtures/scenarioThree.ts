import {
  F4835Data,
  Income1099Type,
  PersonRole,
  PlanType1099,
  ScheduleFData,
  Supported1099
} from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './atsRehearsal'

/**
 * IRS ATS Scenario 3 as the published PDF states it: Single, born
 * 1965-10-29, digital assets "Yes", a $3,110 taxable state refund, a code 7
 * pension of $53,778 / $43,100 / $3,405 withheld, Schedule D totals on
 * lines 1a and 8a (14,222 − 12,234; 14,211 − 4,486), a cash-method Schedule
 * F (Floral Plants: $8,111 of sales; $750 chemicals, $890 feed, $250
 * fertilizer, $2,970 seeds) with the farm optional method elected on
 * Schedule SE, and a Form 4835 farm rental ($17,035; $879 chemicals, $350
 * feed, $690 fuel, $1,355 repairs, $2,700 supplies). The PDF publishes no
 * totals; the expectations below are derived from the forms.
 */
export const farm = (over: Partial<ScheduleFData> = {}): ScheduleFData => ({
  farmName: 'Floral Plants',
  accountingMethod: 'Cash',
  personRole: PersonRole.PRIMARY,
  salesLivestock: 8111,
  costLivestock: 0,
  cooperativeDistributions: 0,
  agriculturePayments: 0,
  cccLoans: 0,
  cropInsurance: 0,
  customHireIncome: 0,
  otherFarmIncome: 0,
  carAndTruck: 0,
  chemicals: 750,
  conservation: 0,
  customHire: 0,
  depreciation: 0,
  employeeBenefits: 0,
  feed: 890,
  fertilizers: 250,
  freight: 0,
  fuel: 0,
  insurance: 0,
  interestMortgage: 0,
  interestOther: 0,
  labor: 0,
  pensionProfitSharing: 0,
  rentVehicles: 0,
  rentOther: 0,
  repairs: 0,
  seeds: 2970,
  storage: 0,
  supplies: 0,
  taxes: 0,
  utilities: 0,
  veterinary: 0,
  otherExpenses: 0,
  ...over
})

export const rental = (over: Partial<F4835Data> = {}): F4835Data => ({
  personRole: PersonRole.PRIMARY,
  activelyParticipated: true,
  productionIncome: 17035,
  cooperativeDistributions: 0,
  cooperativeDistributionsTaxable: 0,
  agriculturePayments: 0,
  agriculturePaymentsTaxable: 0,
  cccLoansReportedUnderElection: 0,
  cccLoansForfeited: 0,
  cccLoansForfeitedTaxable: 0,
  cropInsuranceProceeds: 0,
  cropInsuranceProceedsTaxable: 0,
  cropInsuranceDeferredFromPriorYear: 0,
  otherIncome: 0,
  carAndTruck: 0,
  chemicals: 879,
  conservation: 0,
  customHire: 0,
  depreciation: 0,
  employeeBenefits: 0,
  feed: 350,
  fertilizers: 0,
  freight: 0,
  fuel: 690,
  insurance: 0,
  interestMortgage: 0,
  interestOther: 0,
  labor: 0,
  pensionProfitSharing: 0,
  rentVehicles: 0,
  rentOther: 0,
  repairs: 1355,
  seeds: 0,
  storage: 0,
  supplies: 2700,
  taxes: 0,
  utilities: 0,
  veterinary: 0,
  otherExpenses: [],
  allInvestmentAtRisk: true,
  ...over
})

export const scenarioThreeInformation = (
  over: Partial<ValidatedInformation> = {}
): ValidatedInformation => {
  const base = rehearsalInformation()
  const f1099s: Supported1099[] = [
    {
      payer: 'Primrose Retirement Fund',
      type: Income1099Type.R,
      personRole: PersonRole.PRIMARY,
      form: {
        grossDistribution: 53778,
        taxableAmount: 43100,
        federalIncomeTaxWithheld: 3405,
        planType: PlanType1099.Pension,
        distributionCode: '7'
      }
    } as Supported1099,
    {
      payer: 'Brokerage',
      type: Income1099Type.B,
      personRole: PersonRole.PRIMARY,
      form: {
        shortTermProceeds: 14222,
        shortTermCostBasis: 12234,
        longTermProceeds: 14211,
        longTermCostBasis: 4486
      }
    } as Supported1099
  ]
  return {
    ...base,
    taxPayer: {
      ...base.taxPayer,
      primaryPerson: {
        ...base.taxPayer.primaryPerson,
        dateOfBirth: new Date('1965-10-29T00:00:00Z')
      }
    },
    questions: { ...base.questions, CRYPTO: true },
    w2s: [],
    f1099s,
    f1099gs: [
      {
        payer: 'State tax agency',
        type: 'G',
        personRole: PersonRole.PRIMARY,
        form: {
          unemploymentCompensation: 0,
          stateLocalTaxRefund: 3110,
          taxYear: 2024,
          federalIncomeTaxWithheld: 0,
          rtaaPayments: 0,
          taxableGrants: 0,
          agriculturePayments: 0
        }
      }
    ],
    scheduleFData: [farm()],
    f4835s: [rental()],
    scheduleSEOptions: { farmOptionalMethod: true },
    ...over
  }
}
