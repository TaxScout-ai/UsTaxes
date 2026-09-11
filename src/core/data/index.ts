import { enumKeys } from '../util'

export enum TaxYears {
  Y2019 = 2019,
  Y2020 = 2020,
  Y2021 = 2021,
  Y2022 = 2022,
  Y2023 = 2023,
  Y2024 = 2024,
  Y2025 = 2025,
  Y2026 = 2026
}

export type TaxYear = keyof typeof TaxYears

export enum PersonRole {
  PRIMARY = 'PRIMARY',
  SPOUSE = 'SPOUSE',
  DEPENDENT = 'DEPENDENT',
  EMPLOYER = 'EMPLOYER'
}

/**
 * Types such as the following are generic with respect to the Date
 * type. AJV tests the typed serialization of these interfaces
 * in JSON, and Date is not a valid type in JSON. So when our data
 * is serialized in and out of local storage, or to a JSON file,
 * these data must be parsed / serialized from / to strings.
 *
 * Our AJV schema generator ignores generic types.
 */
export interface Person<D = Date> {
  firstName: string
  lastName: string
  ssid: string
  role: PersonRole
  isBlind: boolean
  dateOfBirth: D
}

// Concrete type for our AJV schema generator.
export type PersonDateString = Person<string>

export interface QualifyingInformation {
  numberOfMonths: number
  isStudent: boolean
}

export interface Dependent<D = Date> extends Person<D> {
  relationship: string
  qualifyingInfo?: QualifyingInformation
}

export type DependentDateString = Dependent<string>

export interface Address {
  address: string
  aptNo?: string
  city: string
  state?: State
  zip?: string
  foreignCountry?: string
  province?: string
  postalCode?: string
}

export interface PrimaryPerson<D = Date> extends Person<D> {
  address: Address
  isTaxpayerDependent: boolean
}
export type PrimaryPersonDateString = PrimaryPerson<string>

export interface Spouse<D = Date> extends Person<D> {
  isTaxpayerDependent: boolean
}

export type SpouseDateString = Spouse<string>

export interface Employer {
  EIN?: string
  employerName?: string
  address?: Address
}

export enum AccountType {
  checking = 'checking',
  savings = 'savings'
}

export interface Refund {
  routingNumber: string
  accountNumber: string
  accountType: AccountType
}

export interface IncomeW2 {
  occupation: string
  income: number
  medicareIncome: number
  fedWithholding: number
  ssWages: number
  ssWithholding: number
  medicareWithholding: number
  employer?: Employer
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  state?: State
  stateWages?: number
  stateWithholding?: number
  box12?: W2Box12Info
}

export interface EstimatedTaxPayments {
  label: string
  payment: number
}

export enum Income1099Type {
  B = 'B',
  INT = 'INT',
  DIV = 'DIV',
  R = 'R',
  SSA = 'SSA'
}

export interface F1099BData {
  shortTermProceeds: number
  shortTermCostBasis: number
  longTermProceeds: number
  longTermCostBasis: number
  federalIncomeTaxWithheld?: number
}

export interface F1099IntData {
  income: number
  federalIncomeTaxWithheld?: number
  earlyWithdrawalPenalty?: number // Box 2
}

export interface F1099DivData {
  dividends: number
  qualifiedDividends: number
  totalCapitalGainsDistributions: number
  federalIncomeTaxWithheld?: number
  unrecapturedSection1250Gain?: number // Box 2d
  collectibles28PctGain?: number // Box 2e (28% rate gain distributions)
  section199ADividends?: number // Box 5
}
/*
 TODO: Add in logic for various different distributions
 that should go in box 4a and 5a. Will need to implement
 form 8606 and Schedule 1 line 19.
 */
export enum PlanType1099 {
  /* IRA includes a traditional IRA, Roth IRA,
   * simplified employee pension (SEP) IRA,
   * and a savings incentive match plan for employees (SIMPLE) IRA
   */
  IRA = 'IRA',
  RothIRA = 'RothIRA',
  SepIRA = 'SepIRA',
  SimpleIRA = 'SimpleIRA',
  // Pension and annuity payments include distributions from 401(k), 403(b), and governmental 457(b) plans.
  Pension = 'Pension'
}

export const PlanType1099Texts: { [k in keyof typeof PlanType1099]: string } = {
  IRA: 'traditional IRA',
  RothIRA: 'Roth IRA',
  SepIRA: 'simplified employee pension (SEP) IRA',
  SimpleIRA: 'savings incentive match plan for employees (SIMPLE) IRA',
  Pension: '401(k), 403(b), or 457(b) plan'
}

// Simplified Method Worksheet data for pension/annuity 1099-R
// Used when box 2a (taxable amount) needs to be calculated
export interface SimplifiedMethodData {
  costInPlan: number // Line 2: cost (investment) in the plan at annuity starting date
  ageAtAnnuityStart: number // Age at annuity starting date (for Table 1)
  combinedAgesAtStart?: number // Combined ages (for Table 2, joint/survivor annuity)
  useTable2: boolean // true if joint/survivor annuity after 11/18/1996
  annuityStartedBefore19861231: boolean // true if annuity starting date before 1987
  annuityStartedBefore19961119: boolean // true if annuity starting date before 11/19/1996
  monthsOfPayments: number // Line 5: number of months payments were made this year
  priorYearTaxFreeRecovery: number // Line 6: amount recovered tax free in years after 1986
}

export interface F1099RData {
  grossDistribution: number
  taxableAmount: number
  taxableAmountNotDetermined?: boolean // box 2b: taxable amount not determined
  simplifiedMethodData?: SimplifiedMethodData // used when taxableAmountNotDetermined
  federalIncomeTaxWithheld: number
  planType: PlanType1099
  distributionCode?: string // Box 7 (code D = annuity subject to NIIT)
}

export interface F1099SSAData {
  // benefitsPaid: number
  // benefitsRepaid: number
  netBenefits: number
  federalIncomeTaxWithheld: number
}

export interface Income1099<T, D> {
  payer: string
  type: T
  form: D
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
}
export enum W2Box12Code {
  A = 'A', // Uncollected social security or RRTA tax on tips.
  B = 'B', // Uncollected Medicare tax on tips.
  C = 'C', // Taxable cost of group-term life insurance over $50,000.
  D = 'D', // Elective deferrals under a section 401(k) cash or deferred arrangement (plan).
  E = 'E', // Elective deferrals under a section 403(b) salary reduction agreement.
  F = 'F', // Elective deferrals under a section 408(k)(6) salary reduction SEP.
  G = 'G', // Elective deferrals and employer contributions (including nonelective deferrals) to any governmental or nongovernmental section 457(b) deferred compensation plan.
  H = 'H', // Elective deferrals under section 501(c)(18)(D) tax-exempt organization plan.
  J = 'J', // Nontaxable sick pay.
  K = 'K', // 20% excise tax on excess golden parachute payments (not applicable to Forms W-2AS, W-2CM, W-2GU, or W-2VI).
  L = 'L', // Substantiated employee business expense reimbursements.
  M = 'M', // Uncollected social security or RRTA tax on taxable cost of group-term life insurance over $50,000 (for former employees).
  N = 'N', // Uncollected Medicare tax on taxable cost of group-term life insurance over $50,000 (for former employees).
  P = 'P', // Excludable moving expense reimbursements paid directly to a member of the U.S. Armed Forces.
  Q = 'Q', // Nontaxable combat pay.
  R = 'R', // Employer contributions to an Archer MSA.
  S = 'S', // Employee salary reduction contributions under a section 408(p) SIMPLE plan.
  T = 'T', // Adoption benefits.
  V = 'V', // Income from the exercise of nonstatutory stock option(s).
  W = 'W', // Employer contributions to a health savings account (HSA).
  Y = 'Y', // Deferrals under a section 409A nonqualified deferred compensation plan.
  Z = 'Z', // Income under a nonqualified deferred compensation plan that fails to satisfy section 409A.
  AA = 'AA', // Designated Roth contributions under a section 401(k) plan.
  BB = 'BB', // Designated Roth contributions under a section 403(b) plan.
  DD = 'DD', // Cost of employer-sponsored health coverage.
  EE = 'EE', // Designated Roth contributions under a governmental section 457(b) plan.
  FF = 'FF', // Permitted benefits under a qualified small employer health reimbursement arrangement.
  GG = 'GG', // Income from qualified equity grants under section 83(i).
  HH = 'HH' // Aggregate deferrals under section 83(i) elections as of the close of the calendar year.}
}

export const W2Box12CodeDescriptions: { [key in W2Box12Code]: string } = {
  A: 'Uncollected social security or RRTA tax on tips.',
  B: 'Uncollected Medicare tax on tips.',
  C: 'Taxable cost of group-term life insurance over $50,000.',
  D: 'Elective deferrals under a section 401(k) cash or deferred arrangement plan.',
  E: 'Elective deferrals under a section 403(b) salary reduction agreement.',
  F: 'Elective deferrals under a section 408(k)(6) salary reduction SEP.',
  G: 'Elective deferrals and employer contributions (including nonelective deferrals) to any governmental or nongovernmental section 457(b) deferred compensation plan.',
  H: 'Elective deferrals under section 501(c)(18)(D) tax-exempt organization plan.',
  J: 'Nontaxable sick pay.',
  K: '20% excise tax on excess golden parachute payments (not applicable to Forms W-2AS, W-2CM, W-2GU, or W-2VI).',
  L: 'Substantiated employee business expense reimbursements.',
  M: 'Uncollected social security or RRTA tax on taxable cost of group-term life insurance over $50,000 (for former employees).',
  N: 'Uncollected Medicare tax on taxable cost of group-term life insurance over $50,000 (for former employees).',
  P: 'Excludable moving expense reimbursements paid directly to a member of the U.S. Armed Forces.',
  Q: 'Nontaxable combat pay.',
  R: 'Employer contributions to an Archer MSA.',
  S: 'Employee salary reduction contributions under a section 408(p) SIMPLE plan.',
  T: 'Adoption benefits.',
  V: 'Income from the exercise of nonstatutory stock option(s).',
  W: 'Employer contributions to a health savings account (HSA).',
  Y: 'Deferrals under a section 409A nonqualified deferred compensation plan.',
  Z: 'Income under a nonqualified deferred compensation plan that fails to satisfy section 409A.',
  AA: 'Designated Roth contributions under a section 401(k) plan.',
  BB: 'Designated Roth contributions under a section 403(b) plan.',
  DD: 'Cost of employer-sponsored health coverage.',
  EE: 'Designated Roth contributions under a governmental section 457(b) plan.',
  FF: 'Permitted benefits under a qualified small employer health reimbursement arrangement.',
  GG: 'Income from qualified equity grants under section 83(i).',
  HH: 'Aggregate deferrals under section 83(i) elections as of the close of the calendar year.'
}

export type W2Box12Info<A = number> = { [key in W2Box12Code]?: A }

export interface HealthSavingsAccount<D = Date> {
  label: string
  coverageType: 'self-only' | 'family'
  contributions: number
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  startDate: D
  endDate: D
  totalDistributions: number
  qualifiedDistributions: number
}

export type HealthSavingsAccountDateString = HealthSavingsAccount<string>

export enum IraPlanType {
  IRA = 'IRA',
  RothIRA = 'RothIRA',
  SepIRA = 'SepIRA',
  SimpleIRA = 'SimpleIRA'
}

export const IraPlanTypeTexts = {
  [IraPlanType.IRA]: 'Traditional IRA',
  [IraPlanType.RothIRA]: 'Roth IRA',
  [IraPlanType.SepIRA]: 'Simplified employee pension (SEP) IRA',
  [IraPlanType.SimpleIRA]:
    'Savings incentive match plan for employees (SIMPLE) IRA'
}

export type IraPlanName = keyof typeof IraPlanType

export const iraPlanNames: IraPlanName[] = enumKeys(IraPlanType)
// export const iraPlanNames: IraPlanName[] = [
//   'IRA',
//   'RothIRA',
//   'SepIRA',
//   'SimpleIRA'
// ]

export interface Ira {
  payer: string
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  // fields about distributions from form 1099-R
  grossDistribution: number // 1099-R box 1
  taxableAmount: number // 1099-R box 2a
  taxableAmountNotDetermined: boolean // 1099-R box 2b
  totalDistribution: boolean // 1099-R box 2b
  federalIncomeTaxWithheld: number // 1099-R box 4
  planType: IraPlanType
  // fields about contributions from form 5498
  contributions: number // contributions depending on the plan type
  rolloverContributions: number // 5498 box 2
  rothIraConversion: number // 5498 box 3
  recharacterizedContributions: number // 5498 box 4
  requiredMinimumDistributions: number // 5498 box 12b
  lateContributions: number // 5498 box 13a
  repayments: number // 5498 box 14a
}

export enum FilingStatus {
  S = 'S',
  MFJ = 'MFJ',
  MFS = 'MFS',
  HOH = 'HOH',
  W = 'W'
}

export type FilingStatusName = keyof typeof FilingStatus

export const FilingStatusTexts = {
  [FilingStatus.S]: 'Single',
  [FilingStatus.MFJ]: 'Married Filing Jointly',
  [FilingStatus.MFS]: 'Married Filing Separately',
  [FilingStatus.HOH]: 'Head of Household',
  [FilingStatus.W]: 'Widow(er)'
}

export const filingStatuses = <D>(
  p: TaxPayer<D> | undefined
): FilingStatus[] => {
  let withDependents: FilingStatus[] = []
  let spouseStatuses: FilingStatus[] = []

  if ((p?.dependents ?? []).length > 0) {
    withDependents = [FilingStatus.HOH]
  }
  if (p?.spouse !== undefined) {
    spouseStatuses = [FilingStatus.MFJ, FilingStatus.MFS]
    // HoH not available if married
    withDependents = []
  } else {
    spouseStatuses = [FilingStatus.S, FilingStatus.W]
  }
  return [...spouseStatuses, ...withDependents]
}

export interface ContactInfo {
  contactPhoneNumber?: string
  contactEmail?: string
}

export interface TaxPayer<D = Date> extends ContactInfo {
  filingStatus?: FilingStatus
  primaryPerson?: PrimaryPerson<D>
  spouse?: Spouse<D>
  dependents: Dependent<D>[]
}

export type TaxPayerDateString = TaxPayer<string>

export type Income1099Int = Income1099<Income1099Type.INT, F1099IntData>
export type Income1099B = Income1099<Income1099Type.B, F1099BData>
export type Income1099Div = Income1099<Income1099Type.DIV, F1099DivData>
export type Income1099R = Income1099<Income1099Type.R, F1099RData>
export type Income1099SSA = Income1099<Income1099Type.SSA, F1099SSAData>

export type Supported1099 =
  | Income1099Int
  | Income1099B
  | Income1099Div
  | Income1099R
  | Income1099SSA

export enum PropertyType {
  singleFamily,
  multiFamily,
  vacation,
  commercial,
  land,
  selfRental,
  other
}

export type PropertyTypeName = keyof typeof PropertyType

export enum PropertyExpenseType {
  advertising,
  auto,
  cleaning,
  commissions,
  insurance,
  legal,
  management,
  mortgage,
  otherInterest,
  repairs,
  supplies,
  taxes,
  utilities,
  depreciation,
  other
}

export type PropertyExpenseTypeName = keyof typeof PropertyExpenseType

export interface Property {
  address: Address
  rentalDays: number
  personalUseDays: number
  rentReceived: number
  propertyType: PropertyTypeName
  otherPropertyType?: string
  qualifiedJointVenture: boolean
  expenses: Partial<{ [K in PropertyExpenseTypeName]: number }>
  otherExpenseType?: string
}

export interface F1098e {
  lender: string
  interest: number
}

export interface F3921 {
  name: string
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  exercisePricePerShare: number
  fmv: number
  numShares: number
}

// See https://www.irs.gov/instructions/i1065sk1
export interface ScheduleK1Form1065 {
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  partnershipName: string
  partnershipEin: string
  partnerOrSCorp: 'P' | 'S'
  isForeign: boolean
  isPassive: boolean
  ordinaryBusinessIncome: number // Schedule E (Form 1040), line 28, column (i) or (k).
  interestIncome: number // Form 1040, line 2b
  guaranteedPaymentsForServices: number // Schedule E (Form 1040), line 28, column (k)
  guaranteedPaymentsForCapital: number // Schedule E (Form 1040), line 28, column (k)
  selfEmploymentEarningsA: number // Box 14 A: net SE earnings (loss), regular method
  selfEmploymentEarningsB: number // Box 14 B: gross farming/fishing income, optional method
  selfEmploymentEarningsC: number // Box 14 C: gross nonfarm income, optional method
  distributionsCodeAAmount: number // If the amount shown as code A exceeds the adjusted basis of your partnership interest immediately before the distribution, the excess is treated as gain from the sale or exchange of your partnership interest. Generally, this gain is treated as gain from the sale of a capital asset and should be reported on Form 8949 and the Schedule D for your return.
  section199AQBI: number // Form 8995 or 8995-A
  shortTermCapitalGains?: number // Box 8 — Schedule D, line 5
  longTermCapitalGains?: number // Box 9a — Schedule D, line 12
  collectibles28PctGain?: number // Box 9b — 28% rate gain (collectibles)
  unrecapturedSection1250Gain?: number // Box 9c — Unrecaptured section 1250 gain
  qualifiedReitDividends?: number // Box 20 Code AB — for F8995 QBI
  publiclyTradedPartnershipIncome?: number // Box 20 Code Z — for F8995 PTP
}

export interface ItemizedDeductions {
  medicalAndDental: string | number
  stateAndLocalTaxes: string | number
  isSalesTax: boolean
  stateAndLocalRealEstateTaxes: string | number
  stateAndLocalPropertyTaxes: string | number
  interest8a: string | number
  interest8b: string | number
  interest8c: string | number
  interest8d: string | number
  investmentInterest: string | number
  charityCashCheck: string | number
  charityOther: string | number
  charityCarryover?: string | number
  casualtyAndTheftLosses?: string | number
  otherItemizedDeductions?: string | number
  otherTaxes?: string | number
}

export type State =
  | 'AL'
  | 'AK'
  | 'AZ'
  | 'CO'
  | 'DC'
  | 'FL'
  | 'HI'
  | 'ID'
  | 'IN'
  | 'KY'
  | 'MA'
  | 'ME'
  | 'MN'
  | 'MS'
  | 'NC'
  | 'NE'
  | 'NJ'
  | 'NV'
  | 'OH'
  | 'OR'
  | 'RI'
  | 'SD'
  | 'TX'
  | 'VA'
  | 'WA'
  | 'WV'
  | 'AR'
  | 'CA'
  | 'CT'
  | 'DE'
  | 'GA'
  | 'IA'
  | 'IL'
  | 'KS'
  | 'LA'
  | 'MD'
  | 'MI'
  | 'MO'
  | 'MT'
  | 'ND'
  | 'NH'
  | 'NM'
  | 'NY'
  | 'OK'
  | 'PA'
  | 'SC'
  | 'TN'
  | 'UT'
  | 'VT'
  | 'WI'
  | 'WY'

// Hold information about state residency
// TODO: Support part-year state residency
export interface StateResidency {
  state: State
}

// Defines usable tag names for each question later defined,
// and maps to a type which is the expected response type.
export interface QuestionTag {
  CRYPTO: boolean
  FOREIGN_ACCOUNT_EXISTS: boolean
  FINCEN_114: boolean
  FINCEN_114_ACCOUNT_COUNTRY: string
  FOREIGN_TRUST_RELATIONSHIP: boolean
  LIVE_APART_FROM_SPOUSE: boolean
}

export type QuestionTagName = keyof QuestionTag

// Typescript provides no way to access
// keys of an interface at runtime.
export const questionTagNames: QuestionTagName[] = [
  'CRYPTO',
  'FOREIGN_ACCOUNT_EXISTS',
  'FINCEN_114',
  'FINCEN_114_ACCOUNT_COUNTRY',
  'FOREIGN_TRUST_RELATIONSHIP',
  'LIVE_APART_FROM_SPOUSE'
]

export type ValueTag = 'string' | 'boolean'

export type Responses = Partial<QuestionTag> // Defines usable tag names for each question later defined,

export enum CreditType {
  AdvanceChildTaxCredit = 'CreditType/AdvanceChildTaxCredit',
  Other = 'CreditType/Other'
}

export interface Credit {
  recipient: PersonRole
  amount: number
  type: CreditType
}

// --- Form 1099-NEC (Nonemployee Compensation) ---
export interface F1099NECData {
  nonemployeeCompensation: number // Box 1
  federalIncomeTaxWithheld: number // Box 4
}

// --- Form 1099-MISC (Miscellaneous Income) ---
export interface F1099MISCData {
  rents: number // Box 1
  royalties: number // Box 2
  otherIncome: number // Box 3
  federalIncomeTaxWithheld: number // Box 4
  fishingBoatProceeds: number // Box 5
  medicalPayments: number // Box 6
  substitutePayments: number // Box 8
  cropInsurance: number // Box 9
  grossProceedsAttorney: number // Box 10
  section409ADeferrals: number // Box 12
  excessGoldenParachute: number // Box 13
  nonqualifiedDeferredComp: number // Box 14
}

// --- Form 1099-G (Government Payments) ---
export interface F1099GData {
  unemploymentCompensation: number // Box 1
  stateLocalTaxRefund: number // Box 2
  taxYear: number // Box 3 — tax year of refund
  federalIncomeTaxWithheld: number // Box 4
  rtaaPayments: number // Box 5
  taxableGrants: number // Box 6
  agriculturePayments: number // Box 7
}

// --- Schedule C (Profit or Loss from Business) ---
export enum ScheduleCAccountingMethod {
  Cash = 'Cash',
  Accrual = 'Accrual',
  Other = 'Other'
}

export interface ScheduleCData {
  businessName: string
  ein?: string
  businessCode: string // NAICS code
  accountingMethod: ScheduleCAccountingMethod
  didMateriallyParticipate: boolean
  didStartBusiness: boolean
  didMakePaymentsRequiring1099: boolean
  didFile1099s: boolean
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  // Income
  grossReceipts: number // Line 1
  returns: number // Line 2
  costOfGoodsSold: number // Line 4 (from Part III)
  otherIncome: number // Line 6
  // Expenses (Part II)
  advertising: number
  carAndTruck: number
  commissions: number
  contractLabor: number
  depletion: number
  depreciation: number // Form 4562
  employeeBenefits: number
  insurance: number
  interestMortgage: number
  interestOther: number
  legal: number
  officeExpense: number
  pensionProfitSharing: number
  rentVehicles: number
  rentOther: number
  repairs: number
  supplies: number
  taxes: number
  travel: number
  meals: number
  utilities: number
  wages: number
  otherExpenses: number
  // Part III: Cost of Goods Sold
  inventoryBeginning?: number
  purchases?: number
  laborCost?: number
  materials?: number
  otherCosts?: number
  inventoryEnd?: number
  // Part IV: Vehicle (simplified)
  vehicleMiles?: number
  businessMiles?: number
  // Home office (from Form 8829)
  homeOfficeDeduction?: number
}

// --- Form 8829 (Home Office Deduction) ---
export interface Form8829Data {
  totalAreaOfHome: number // Line 1
  businessArea: number // Line 2
  // Direct expenses
  directMortgageInterest: number
  directRealEstateTaxes: number
  directInsurance: number
  directRepairs: number
  directUtilities: number
  directOther: number
  // Indirect expenses (allocated by business %)
  indirectMortgageInterest: number
  indirectRealEstateTaxes: number
  indirectInsurance: number
  indirectRepairs: number
  indirectUtilities: number
  indirectOther: number
  // Depreciation
  costOrBasisOfHome: number
  costOfLand: number
  datePlacedInService?: string
}

// --- Form 4562 (Depreciation and Amortization) ---
export interface Section179Property {
  description: string
  cost: number
  electedCost: number
}

export interface MACRSProperty {
  classification: string // e.g. "3-year", "5-year", "7-year"
  monthAndYearPlacedInService: string
  basisForDepreciation: number
  recoveryPeriod: string
  convention: string
  method: string
  depreciationDeduction: number
}

export interface AmortizationCosts {
  description: string
  dateBegan: string
  amortizableAmount: number
  codeSection: string
  amortizationPeriodOrPercentage: string
  amortizationForThisYear: number
}

export interface Form4562Data {
  businessOrActivityToWhichThisFormRelates: string
  // Part I: Election To Expense Certain Property Under Section 179
  maximumAmount?: number // Line 1
  totalCostOfSection179Property?: number // Line 2
  thresholdCost?: number // Line 3
  section179Property?: Section179Property[] // Line 6
  tentativeDeduction?: number // Line 9
  carryoverOfDisallowedDeductionFromPriorYear?: number // Line 10
  businessIncomeLimitation?: number // Line 11
  // Part II: Special Depreciation Allowance and Other Depreciation
  specialDepreciationAllowance?: number // Line 14
  propertySubjectTo168f1?: number // Line 15
  otherDepreciation?: number // Line 16
  // Part III: MACRS Depreciation (Lines 17-19)
  macrsDeductionsPriorYears?: number // Line 17
  macrsProperty?: MACRSProperty[] // Line 19a-i
  // Part IV: Summary
  listedProperty?: number // Line 21
  // Part VI: Amortization
  amortizationCosts?: AmortizationCosts[] // Line 42
}

// --- Form 4835 (Farm Rental Income and Expenses) ---
/** One Form 4835: a landowner's share-rental farm income, reported on Schedule E line 40 and not subject to SE tax. */
export interface F4835Data {
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  ein?: string
  /** Line A: actively participated in the operation of the farm. */
  activelyParticipated: boolean
  // Part I — gross farm rental income (based on production)
  productionIncome: number // Line 1
  cooperativeDistributions: number // Line 2a
  cooperativeDistributionsTaxable: number // Line 2b
  agriculturePayments: number // Line 3a
  agriculturePaymentsTaxable: number // Line 3b
  cccLoansReportedUnderElection: number // Line 4a
  cccLoansForfeited: number // Line 4b
  cccLoansForfeitedTaxable: number // Line 4c
  cropInsuranceProceeds: number // Line 5a
  cropInsuranceProceedsTaxable: number // Line 5b
  cropInsuranceDeferredFromPriorYear: number // Line 5d
  otherIncome: number // Line 6
  // Part II — expenses
  carAndTruck: number // Line 8
  chemicals: number // Line 9
  conservation: number // Line 10
  customHire: number // Line 11
  depreciation: number // Line 12
  employeeBenefits: number // Line 13
  feed: number // Line 14
  fertilizers: number // Line 15
  freight: number // Line 16
  fuel: number // Line 17
  insurance: number // Line 18
  interestMortgage: number // Line 19a
  interestOther: number // Line 19b
  labor: number // Line 20
  pensionProfitSharing: number // Line 21
  rentVehicles: number // Line 22a
  rentOther: number // Line 22b
  repairs: number // Line 23
  seeds: number // Line 24
  storage: number // Line 25
  supplies: number // Line 26
  taxes: number // Line 27
  utilities: number // Line 28
  veterinary: number // Line 29
  otherExpenses: Array<{ description: string; amount: number }> // Line 30a–30g
  /** Line 34a: all investment is at risk (a loss is deductible in full). */
  allInvestmentAtRisk: boolean
}

/** Form 7206: the self-employed health insurance deduction for one business's plan. */
export interface Form7206Data {
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  /** Index into `scheduleCBusinesses` of the business the plan is established under. */
  scheduleCIndex: number
  /** Line 1: health insurance premiums paid for the year (net of the exclusions the form lists). */
  healthInsurancePremiums: number
  /** Line 2: qualified long-term care premiums, already limited by age. */
  longTermCarePremiums: number
}

/** Schedule A (Form 8911): one qualified alternative fuel vehicle refueling property. */
export interface Form8911PropertyData {
  /** Line 2a: description of the refueling property. */
  description: string
  /** Line 3a: where the property is (the home address when it is installed there). */
  location: Address
  /** Line 4: date construction began, YYYY-MM-DD. */
  constructionStartDate: string
  /** Line 5: date placed in service, YYYY-MM-DD; must fall in the tax year. */
  placedInServiceDate: string
  /** Line 6a: placed in service in an eligible census tract (no credit otherwise). */
  eligibleCensusTract: boolean
  /** Line 6b: the 11-digit census tract GEOID, required when line 6a is yes. */
  censusTractGeoid?: string
  /** Line 7: certification or permit number, when one was issued. */
  certificationOrPermitNumber?: string
  /** Line 8: cost of the property. */
  cost: number
  /** Line 9: business/investment use as a fraction of one; 0 when personal only. */
  businessUseFraction: number
  /** Line 17: installed on property used as the taxpayer's main home. */
  installedAtMainHome: boolean
}

/** Form 8911: the alternative fuel vehicle refueling property credit, one Schedule A per property. */
export interface Form8911Data {
  properties: Form8911PropertyData[]
}

/** Schedule SE Part II: the taxpayer elects an optional method to figure net earnings. */
export interface ScheduleSEOptions {
  /** Farm optional method (lines 14–15): allowed when gross farm income is at or below the limit or net farm profit is below it. */
  farmOptionalMethod: boolean
}

// --- Schedule F (Profit or Loss From Farming) ---
export enum ScheduleFAccountingMethod {
  Cash = 'Cash',
  Accrual = 'Accrual'
}

// --- Form 2441 (Child and Dependent Care Expenses) ---
export interface CareProvider {
  name: string
  address: string
  tin: string // SSN or EIN
  amountPaid: number
}

export interface QualifyingPerson2441 {
  name: string
  ssn: string
  qualifyingExpenses: number
}

export interface Form2441Data {
  careProviders: CareProvider[]
  qualifyingPersons: QualifyingPerson2441[]
  employerProvidedBenefits: number // W-2 box 10 (dependent care benefits)
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  priorYearCarryforward?: number
}

// --- Form 8863 (Education Credits) ---
export const USTAXES_HTTP_CONTRACT_VERSION =
  'ustaxes-http-education-election-v2' as const

export const FORM_8863_CONTRACT_VERSION =
  'form8863-explicit-election-v1' as const

export type EducationCreditElection8863 = 'aotc' | 'llc'

export interface EducationCreditEligibility8863 {
  policyVersion: string
  aotc: 'eligible' | 'ineligible' | 'unknown'
  llc: 'eligible' | 'ineligible' | 'unknown'
}

export interface Student8863 {
  /** Opaque TaxScout identities; never a name, TIN, or other PII. */
  studentPersonId: string
  educationExpenseSetId: string
  creditElection: EducationCreditElection8863
  eligibility: EducationCreditEligibility8863
  name: string
  ssn: string
  institutionName: string
  institutionEIN: string
  institutionAddress: string
  qualifiedExpenses: number // Adjusted qualified expenses
  wasAtLeastHalfTime: boolean
  wasFirstFourYears: boolean // First 4 years of postsecondary education
  hasCompletedFourYears: boolean // Already completed 4 years
  hasBeenConvictedOfFelonyDrug: boolean
  receivedAOTCPriorYears: number // Number of prior years AOTC claimed
  isGraduateStudent: boolean
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE | PersonRole.DEPENDENT
}

export interface Form8863Data {
  contractVersion: typeof FORM_8863_CONTRACT_VERSION
  students: Student8863[]
}

// --- Form 8606 (Nondeductible IRAs) ---
export interface Form8606Data {
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  // Part I: Nondeductible Contributions
  nondeductibleContributions: number // Line 1
  totalBasisPriorYears: number // Line 2 — basis from prior years
  // Part II: Conversions & Distributions
  amountConverted: number // Line 8 — net amount converted to Roth
  distributionsFromTraditional: number // Line 7
  valueOfAllTraditionalIRAs: number // Line 6 — year-end value of all traditional IRAs
  // Part III: Roth IRA Distributions
  rothDistributions?: number // Line 19
  rothContributionBasis?: number // Line 22 — basis in Roth contributions
}

// --- Form 1116 (Foreign Tax Credit) ---
export enum ForeignIncomeCategory {
  SectionA = 'A', // Section 951A (GILTI)
  SectionB = 'B', // Foreign branch income
  PassiveCategory = 'C', // Passive category income
  GeneralCategory = 'D', // General category income
  SectionE = 'E', // Section 901(j) income
  CertainIncomeResourced = 'F' // Certain income re-sourced by treaty
}

export interface ForeignIncome1116 {
  country: string
  grossIncome: number
  definitelyAllocableDeductions: number
  apportionedShareDeductions: number
  foreignTaxesPaidOrAccrued: number
  taxType: 'paid' | 'accrued'
  datesPaid?: string
}

export interface Form1116Data {
  category: ForeignIncomeCategory
  foreignIncomes: ForeignIncome1116[]
  electionToClaimCredit: boolean // vs. itemized deduction
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
}

// --- Form 2210 (Underpayment of Estimated Tax) ---
export interface Form2210Data {
  priorYearTax: number // Prior year's total tax (line 9)
  // Quarterly estimated payment dates and amounts
  estimatedPayments: Array<{
    datePaid: string
    amount: number
  }>
  withholding: number
  // For annualized income installment method (Schedule AI)
  useAnnualizedMethod?: boolean
  annualizedIncome?: [number, number, number, number] // income for each period
}

/** Prepared TY2025 payroll bases, after employee exclusions and annual caps.
 * This is a Schedule H worksheet contract, not a payroll classification engine.
 */
export interface ScheduleHData {
  employerEin: string
  wageBasesEstablished: boolean
  socialSecurityWages: number
  medicareWages: number
  additionalMedicareWages: number
  federalIncomeTaxWithheld: number
  quarterlyFutaThresholdMet: boolean
  futa?: {
    taxableWages: number
    allWagesSubjectToStateTax: boolean
    allContributionsPaidByDueDate: boolean
    states: Array<{
      state: string
      taxableWages: number
      /** Exact rate numerator, denominator 1,000,000; 27,000 means 2.7%. */
      experienceRatePpm: number
      periodStart: string
      periodEnd: string
      contributionsOnTime: number
      contributionsLate: number
      /** FUTA wages also subject to state tax (Worksheet 2, not column b). */
      futaWagesSubjectToStateTax: number
    }>
  }
}

export interface EnergyPropertyItem {
  qmid: string
  cost: number
}

export interface EnergyHome {
  street: string
  unit?: string
  city: string
  state: string
  zip: string
}

export interface Form5695Details {
  /** Qualified net costs after business-use, subsidy and labor exclusions. */
  costsQualifiedFor2025: boolean
  home: EnergyHome
  jointOccupancy: boolean
  condominiumShare: boolean
  cleanEnergyCarryforward: number
  batteryAtLeast3Kwh?: boolean
  fuelCellCapacityKw?: number
  fuelCellMainHomeInUS?: boolean
  envelope?: {
    mainHomeInUS: boolean
    originalUser: boolean
    expectedLifeAtLeast5Years: boolean
    constructionCostsExcluded: boolean
  }
  energyProperty?: {
    homeInUS: boolean
    originallyPlacedInServiceByTaxpayer: boolean
  }
  doors: EnergyPropertyItem[]
  windows: EnergyPropertyItem[]
  centralAirConditioners: EnergyPropertyItem[]
  waterHeaters: EnergyPropertyItem[]
  furnaces: EnergyPropertyItem[]
  heatPumps: EnergyPropertyItem[]
  heatPumpWaterHeaters: EnergyPropertyItem[]
  biomassStoves: EnergyPropertyItem[]
  enablingProperty: EnergyPropertyItem[]
  enablingPropertyCodes?: Array<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'>
  qualifiedHomeEnergyAudit?: boolean
}

// --- Form 5695 (Residential Energy Credits) ---
export interface Form5695Data {
  // Part I: Residential Clean Energy Credit (Section 25D)
  solarElectric: number // Line 1
  solarWaterHeating: number // Line 2
  fuelCell: number // Line 3
  smallWindEnergy: number // Line 4
  geothermalHeatPump: number // Line 5
  batteryStorage: number // Line 6
  // Part II: Energy Efficient Home Improvement Credit (Section 25C)
  insulationMaterials: number // Line 13a
  exteriorDoorsWindows: number // Line 13b
  roofingSurfaces: number // Line 13c — reserved for future, currently 0
  heatPumps: number // Line 14a
  heatPumpWaterHeaters: number // Line 14b
  biomassStoves: number // Line 14c
  centralAC: number // Line 14d — reserved
  naturalGasFurnace: number // Line 14e — reserved
  panelboards: number // Line 14f — reserved
  homeEnergyAudit: number // Line 15
  priorYearCreditsUsed: number // To track lifetime limits
  /** TY2025 evidence / item breakdown. Legacy totals must reconcile to items. */
  details?: Form5695Details
}

// --- Form 8880 (Saver's Credit) ---
export interface Form8880Data {
  // Contributions by taxpayer
  primaryTraditionalIRA: number
  primaryRothIRA: number
  primaryEmployerPlan: number // 401k, 403b, 457b, TSP
  primaryABLEAccount: number
  // Contributions by spouse
  spouseTraditionalIRA?: number
  spouseRothIRA?: number
  spouseEmployerPlan?: number
  spouseABLEAccount?: number
  // Distributions received in testing period
  primaryDistributions: number
  spouseDistributions?: number
}

// --- Schedule F (Profit or Loss from Farming) ---
export interface ScheduleFData {
  farmName: string
  ein?: string
  accountingMethod: 'Cash' | 'Accrual'
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
  // Income
  salesLivestock: number
  costLivestock: number
  cooperativeDistributions: number
  agriculturePayments: number
  cccLoans: number
  cropInsurance: number
  customHireIncome: number
  otherFarmIncome: number
  // Expenses
  carAndTruck: number
  chemicals: number
  conservation: number
  customHire: number
  depreciation: number
  employeeBenefits: number
  feed: number
  fertilizers: number
  freight: number
  fuel: number
  insurance: number
  interestMortgage: number
  interestOther: number
  labor: number
  pensionProfitSharing: number
  rentVehicles: number
  rentOther: number
  repairs: number
  seeds: number
  storage: number
  supplies: number
  taxes: number
  utilities: number
  veterinary: number
  otherExpenses: number
}

// --- Form 2555 (Foreign Earned Income Exclusion) ---
export interface Form2555Data {
  foreignCountry: string
  foreignAddress: string
  employerName: string
  employerAddress: string
  employerIsForeign: boolean
  qualifyingTest: 'bonafide' | 'physicalPresence'
  // Bona fide residence
  residenceStartDate?: string
  residenceEndDate?: string
  // Physical presence
  physicalPresenceDays?: number // out of 330 days in 12-month period
  presenceStartDate?: string
  presenceEndDate?: string
  // Income
  foreignEarnedIncome: number
  housingExpenses: number
  employerProvidedHousing: number
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE
}

// --- Form 8582 (Passive Activity Loss Limitations) ---
export interface PassiveActivity {
  name: string
  currentYearIncome: number
  currentYearLoss: number
  priorYearUnallowedLoss: number
  isRentalRealEstate: boolean
  activeParticipation: boolean // for $25k special allowance
}

export interface Form8582Data {
  activities: PassiveActivity[]
  modifiedAGI?: number // for $25k special allowance phaseout
}

// --- Form 4797 (Sales of Business Property) ---
export interface BusinessPropertySale {
  description: string
  dateAcquired: string
  dateSold: string
  grossSalesPrice: number
  depreciationAllowed: number
  cost: number
  section1231: boolean
  section1245: boolean
  section1250: boolean
}

export interface Form4797Data {
  sales: BusinessPropertySale[]
}

// --- Form 4952 (Investment Interest Expense Deduction) ---
export interface Form4952Data {
  investmentInterestExpense: number // Line 1
  disallowedPriorYear: number // Line 2 — carryover from prior year
  netInvestmentIncome: number // Line 4a
  electToIncludeCapGains: boolean // Line 4e checkbox
  electedCapGainsAmount?: number // Line 4e
}

// --- Form 8919 (Uncollected SS & Medicare Tax on Wages) ---
export interface Employer8919 {
  employerName: string
  employerEIN: string
  reasonCode: string // a-h
  wages: number
  federalIncomeTaxWithheld: number
}

export interface Form8919Data {
  employers: Employer8919[]
}

// --- Form 4137 (SS & Medicare Tax on Unreported Tip Income) ---
export interface Form4137Data {
  employerAllocatedTips: number // Line 1
  tipsReportedToEmployer: number // Line 2
}

// --- Form 8283 (Noncash Charitable Contributions) ---
export interface NoncashContribution {
  doneeOrganization: string
  doneeAddress: string
  description: string
  dateOfContribution: string
  dateAcquired: string
  howAcquired: string
  donorCost: number
  fairMarketValue: number
  methodOfFMV: string
}

export interface NoncashContributionSectionB {
  doneeOrganization: string
  doneeAddress: string
  description: string
  condition: string // physical condition of property
  dateAcquired: string
  dateOfContribution: string
  howAcquired: string
  donorCost: number
  fairMarketValue: number
  appraiserName: string
  appraiserTIN: string
  appraisalDate: string
}

export interface Form8283Data {
  contributions: NoncashContribution[]
  contributionsSectionB?: NoncashContributionSectionB[]
}

// --- Form 8962 (Premium Tax Credit) ---
export interface MarketplacePolicy {
  marketplaceId: string // Line 11 — Marketplace identifier
  policyNumber: string
  startMonth: number
  endMonth: number
  annualPremium: number
  annualSLCSP: number // Second Lowest Cost Silver Plan
  advancePayments: number // Advance PTC received
}

export interface Form8962Data {
  policies: MarketplacePolicy[]
  familySize: number
  annualHouseholdIncome: number
  federalPovertyLine: number
  isSharedPolicy: boolean
  sharedPolicyAllocationPercentage?: number
}

// --- Schedule R (Credit for the Elderly or the Disabled) ---
export interface ScheduleRData {
  // Filing status box (1-9) — determines initial amount
  filingStatusBox: number
  // Nontaxable social security/railroad retirement benefits
  nontaxableSocialSecurity: number
  // Nontaxable pensions/annuities/disability income
  nontaxablePensions: number
  // Disability income (if under 65, retired on permanent/total disability)
  disabilityIncome?: number
}

// --- Form 8814 (Parents' Election for Child's Interest/Dividends) ---
export interface Form8814Data {
  childName: string
  childSSN: string
  interestIncome: number // Line 1a
  ordinaryDividends: number // Line 2a
  capitalGainDistributions: number // Line 3
  qualifiedDividendsIncluded?: number // Qualified dividends from child's 1099-DIV
  taxExemptInterest?: number // Line 1b: Tax-exempt interest
}

// --- Schedule 1-A (Additional Deductions — TY2025) ---
export interface Schedule1APersonFacts {
  // Specific facts required by the 2025 instructions; never inferred from SSN shape.
  ssnValidForEmployment: boolean
  ssnIssuedByReturnDeadline: boolean // Including extensions
  dateOfDeath: string | null // ISO calendar date; explicit null means living
}

export interface Schedule1AData {
  // Qualified amounts below are prepared worksheet inputs, not raw payroll.
  // Qualification of the occupation, FLSA premium, loan and vehicle is external.
  // Explicit zeros establish that territorial exclusions are absent.
  incomeExclusions?: { puertoRico: number; form4563: number }
  people?: {
    primary?: Schedule1APersonFacts
    spouse?: Schedule1APersonFacts
  }
  tipRecipients?: Array<'primary' | 'spouse'>
  overtimeRecipients?: Array<'primary' | 'spouse'>
  // Part II: No Tax on Tips
  qualifiedTipsW2?: number // Line 4a: qualified tips on W-2 box 7
  qualifiedTipsF4137?: number // Line 4b: qualified tips on Form 4137
  qualifiedTipsSelfEmployed?: number // Line 5: qualified tips from 1099-NEC/MISC
  // Per-employer maxima, not max(sum(W-2), sum(4137)). Mutually exclusive
  // with the legacy single-employer line 4a/4b inputs above.
  employeeTips?: Array<{ reportedTips: number; form4137Tips: number }>
  // Net income after all deductions allocable to this particular business,
  // including deductible SE tax, retirement and health insurance (i1040gi).
  businessTips?: Array<{ qualifiedTips: number; netIncome: number }>
  // Part III: No Tax on Overtime
  qualifiedOvertimeW2?: number // Line 14a: qualified overtime from W-2
  qualifiedOvertime1099?: number // Line 14b: qualified overtime from 1099-NEC/MISC
  // Part IV: No Tax on Car Loan Interest
  vehicleInterest?: Array<{
    vin: string
    interestDeductedOnSchedule: number // (ii) already deducted on C/E/F
    interestForSchedule1A: number // (iii) Schedule 1-A deduction
  }>
  // Part V: Enhanced Deduction for Seniors
  primaryBornBefore1962?: boolean // Deprecated; rejected for TY2025. Use person DOB.
  spouseBornBefore1962?: boolean // Deprecated; rejected for TY2025. Use person DOB.
}

// --- Form 8801 (Credit for Prior Year Minimum Tax) ---
export type PriorMinimumTaxCapitalGains =
  | { method: 'ordinary' }
  | {
      method: 'qualified_dividends'
      // Prepared 2024 QDCG worksheet lines 2, 3 (nonnegative), and 5.
      qualifiedDividends: number
      netCapitalGain: number
      ordinaryIncome: number
    }
  | {
      method: 'schedule_d'
      // Prepared 2024 Schedule D Tax Worksheet lines 13, 10, 14 and 21,
      // plus Schedule D line 19. These are source worksheet facts, not tax overrides.
      preferentialGain: number
      netCapitalGain: number
      ordinaryIncome: number
      ordinaryIncomeFor20PercentLimit: number
      unrecaptured1250Gain: number
      // When Form 2555 produces an AMT capital gain excess, the modified
      // prior-year worksheet (including its section 1250 refigure) is required.
      foreignAMTRefigure?: {
        gainExcess: number
        preferentialGain: number
        netCapitalGain: number
        unrecaptured1250Gain: number
        worksheetReference: string
      }
    }

export interface Form8801PriorYear {
  taxYear: 2024
  filingStatus: FilingStatus
  returnType: '1040' | '1040-SR' | '1040-NR'
  form6251: { line1: number; line2e: number; line10: number; line11: number }
  form8801Line26: number
  unallowedQualifiedElectricVehicleCredit: number
  netUSRealPropertyGain: number
  capitalGains: PriorMinimumTaxCapitalGains
  foreignEarnedIncome: {
    applicable: boolean
    form2555Lines45And50: number
    relatedDisallowedDeductions: number
  }
  foreignTaxCreditOnExclusions:
    | { method: 'none'; amount: 0 }
    | { method: 'election_without_1116'; amount: number }
    | { method: 'prepared_mtftce'; amount: number; worksheetReference: string }
}

export interface Form8801Data {
  // Legacy aggregates retained for other tax years. TY2025 requires priorYear
  // and reconciles these values exactly to its actual source-form lines.
  priorYear?: Form8801PriorYear
  priorYearAMTI: number // Misnamed legacy field: Form 6251 line 1 + 2e, NOT its AMTI line 4.
  exclusionItems: number // Line 2: Adjustments treated as exclusion items
  mtcNOLDeduction?: number // Line 3: Minimum tax credit NOL deduction
  // Prior-year Form 6251 line 10 -> current Form 8801 line 14.
  priorYearRegularTaxMinusCredits: number
  // AMT credit carryforward from prior year
  priorYearAMTCreditCarryforward?: number
}

export interface Information<D = Date> {
  f1099s: Supported1099[]
  w2s: IncomeW2[]
  realEstate: Property[]
  estimatedTaxes: EstimatedTaxPayments[]
  f1098es: F1098e[]
  f3921s: F3921[]
  scheduleK1Form1065s: ScheduleK1Form1065[]
  itemizedDeductions: ItemizedDeductions | undefined
  refund?: Refund
  taxPayer: TaxPayer<D>
  questions: Responses
  credits: Credit[]
  stateResidencies: StateResidency[]
  healthSavingsAccounts: HealthSavingsAccount<D>[]
  individualRetirementArrangements: Ira[]
  // --- New data types for extended form coverage ---
  scheduleCBusinesses?: ScheduleCData[]
  f1099necs?: Array<Income1099<'NEC', F1099NECData>>
  f1099miscs?: Array<Income1099<'MISC', F1099MISCData>>
  f1099gs?: Array<Income1099<'G', F1099GData>>
  form1116s?: Form1116Data[]
  form8606s?: Form8606Data[]
  form8829s?: Form8829Data[]
  form8863?: Form8863Data
  form2441?: Form2441Data
  form2210?: Form2210Data
  form5695?: Form5695Data
  scheduleH?: ScheduleHData
  form8880?: Form8880Data
  form4562s?: Form4562Data[]
  scheduleFData?: ScheduleFData[]
  /** Form 4835 farm rental income and expenses (crop/livestock shares, not subject to SE tax); net → Schedule E line 40. */
  f4835s?: F4835Data[]
  /** Schedule SE Part II elections; absent means the regular method. */
  scheduleSEOptions?: ScheduleSEOptions
  /** Form 7206 per trade or business; Schedule 1 line 17 is their sum (replaces the scalar when present). */
  form7206s?: Form7206Data[]
  /** Form 8911 with one Schedule A per refueling property; the personal-use part → Schedule 3 line 6j. */
  form8911?: Form8911Data
  form2555s?: Form2555Data[]
  form8582?: Form8582Data
  form4797?: Form4797Data
  form4952?: Form4952Data
  form8919?: Form8919Data
  form4137?: Form4137Data
  form8283?: Form8283Data
  form8962?: Form8962Data
  form8814s?: Form8814Data[]
  scheduleRData?: ScheduleRData
  form8801?: Form8801Data
  schedule1AData?: Schedule1AData
  // --- Additional Schedule 1 data ---
  educatorExpenses?: number // Schedule 1, line 11 (max $300)
  selfEmploymentRetirementContributions?: number // Schedule 1, line 16 (SEP/SIMPLE/qualified plans)
  selfEmploymentHealthInsurance?: number // Schedule 1, line 17
  iraDeduction?: number // Schedule 1, line 19a (from IRA Deduction Worksheet)
  extensionPaymentAmount?: number // Schedule 3, line 10
  // --- Additional income items (Schedule 1, Part I) ---
  gamblingIncome?: number // Schedule 1, line 8a (prizes, awards, gambling)
  cancellationOfDebtIncome?: number // Schedule 1, line 8c
  scholarshipIncome?: number // Schedule 1, line 8q
  section529Distributions?: number // Schedule 1, line 8p
  // --- F1040 line 1 additional income items ---
  householdEmployeeIncome?: number // F1040, line 1b
  medicaidWaiverPayments?: number // F1040, line 1d (excluded from income)
  strikeBenefits?: number // F1040, line 1h
  stockOptionIncome?: number // F1040, line 1i
  // --- Schedule D capital loss carryover ---
  shortTermCapitalLossCarryover?: number // Schedule D, line 6 (from prior year)
  longTermCapitalLossCarryover?: number // Schedule D, line 14 (from prior year)
  // --- RRTA (Railroad Retirement) ---
  rrtaCompensation?: number // Tier 1 RRTA compensation for F8959
  rrtaTax?: number // Tier 1 RRTA tax withheld
}

export type InformationDateString = Information<string>

/**
 * An asset can be anything that is transactable, such as a stock,
 * bond, mutual fund, real estate, or cryptocurrency, which is not reported
 * on 1099-B. A position always has an open date. A position may
 * be sold, at which time its gain or loss will be reported,
 * or it may be gifted to another person, at which time its
 * gain or loss will not be reported.
 *
 * An asset can be carried across multiple tax years,
 * so it should not be a sibling rather than a member of `Information`.
 *
 * If a position is real estate, then it has a state, which will
 * require state apportionment.
 *
 * "Closing an asset" can result in a long-term or short-term capital
 * gain. An asset is closed when it gets a closeDate.
 */
export type AssetType = 'Security' | 'Real Estate'
export interface Asset<D = Date> {
  name: string
  positionType: AssetType
  openDate: D
  closeDate?: D
  giftedDate?: D
  openPrice: number
  openFee: number
  closePrice?: number
  closeFee?: number
  quantity: number
  state?: State
}

export type SoldAsset<D> = Asset<D> & {
  closePrice: number
  closeDate: D
}

export const isSold = <D>(p: Asset<D>): p is SoldAsset<D> => {
  return p.closeDate !== undefined && p.closePrice !== undefined
}

export type AssetString = Asset<string>

// Validated action types:

export interface ArrayItemEditAction<A> {
  index: number
  value: A
}

export type EditDependentAction = ArrayItemEditAction<DependentDateString>
export type EditW2Action = ArrayItemEditAction<IncomeW2>
export type EditEstimatedTaxesAction = ArrayItemEditAction<EstimatedTaxPayments>
export type Edit1099Action = ArrayItemEditAction<Supported1099>
export type EditPropertyAction = ArrayItemEditAction<Property>
export type Edit1098eAction = ArrayItemEditAction<F1098e>
export type EditHSAAction = ArrayItemEditAction<HealthSavingsAccountDateString>
export type EditIraAction = ArrayItemEditAction<Ira>
export type EditAssetAction = ArrayItemEditAction<Asset<Date>>
export type EditF3921Action = ArrayItemEditAction<F3921>
export type EditScheduleK1Form1065Action =
  ArrayItemEditAction<ScheduleK1Form1065>
export type EditCreditAction = ArrayItemEditAction<Credit>
