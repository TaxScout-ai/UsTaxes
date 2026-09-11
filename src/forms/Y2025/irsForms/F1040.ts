import {
  AccountType,
  Dependent,
  FilingStatus,
  IncomeW2,
  PersonRole,
  PlanType1099,
  Asset
} from 'ustaxes/core/data'
import federalBrackets from '../data/federal'
import { F1040_FIELDS } from '../fieldMaps'
import { seniorAtDeath, seniorAtYearEnd } from './schedule1AInput'
import F4972 from './F4972'
import F5695 from './F5695'
import ScheduleH from './ScheduleH'
import F8814 from './F8814'
import F8888 from './F8888'
import F8889 from './F8889'
import F8910 from './F8910'
import F8936 from './F8936'
import F8959 from './F8959'
import F8995, {
  getF8995PhaseOutIncome,
  hasQbiSources,
  validateScheduleCQbi
} from './F8995'
import F8995A from './F8995A'
import Schedule1 from './Schedule1'
import Schedule2 from './Schedule2'
import Schedule3 from './Schedule3'
import Schedule8812 from './Schedule8812'
import ScheduleA from './ScheduleA'
import ScheduleD from './ScheduleD'
import ScheduleE from './ScheduleE'
import ScheduleSE from './ScheduleSE'
import ScheduleEIC from './ScheduleEIC'
import ScheduleR from './ScheduleR'
import Form, { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import ScheduleB from './ScheduleB'
import { computeOrdinaryTax } from './TaxTable'
import { roundLine, roundTaxTableResult, sumToWholeDollars } from './rounding'
import SDQualifiedAndCapGains from './worksheets/SDQualifiedAndCapGains'
import QualifyingDependents from './worksheets/QualifyingDependents'
import SocialSecurityBenefitsWorksheet from './worksheets/SocialSecurityBenefits'
import F4797 from './F4797'
import SimplifiedMethodWorksheet from './worksheets/SimplifiedMethodWorksheet'
import StudentLoanInterestWorksheet from './worksheets/StudentLoanInterestWorksheet'
import F1040V from './F1040v'
import _ from 'lodash'
import F8960 from './F8960'
import F4952 from './F4952'
import F2555 from './F2555'
import F4563 from './F4563'
import F1116 from './F1116'
import F8606 from './F8606'
import F8863 from './F8863'
import F8962 from './F8962'
import F4136 from './F4136'
import F2439 from './F2439'
import F2441 from './F2441'
import ScheduleC from './ScheduleC'
import F8949 from './F8949'
import F6251 from './F6251'
import F4137 from './F4137'
import F8919 from './F8919'
import F8853 from './F8853'
import F2210 from './F2210'
import F8283 from './F8283'
import F8582 from './F8582'
import F8829 from './F8829'
import F8880 from './F8880'
import ScheduleF from './ScheduleF'
import F4835 from './F4835'
import F7206 from './F7206'
import F8911 from './F8911'
import F4562 from './F4562'
import F8801 from './F8801'
import Schedule1A from './Schedule1A'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040Base, { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import F1040Attachment from './F1040Attachment'

export default class F1040 extends F1040Base {
  tag: FormTag = 'f1040'
  sequenceIndex = 0

  assets: Asset<Date>[]

  schedule1: Schedule1
  schedule2: Schedule2
  schedule3: Schedule3
  scheduleA: ScheduleA
  scheduleB: ScheduleB
  scheduleC?: ScheduleC
  _scheduleCList?: ScheduleC[]
  scheduleD: ScheduleD
  scheduleE: ScheduleE
  scheduleSE: ScheduleSE
  scheduleEIC: ScheduleEIC
  scheduleF?: ScheduleF
  _f4835List?: F4835[]
  _f7206List?: F7206[]
  _scheduleFList?: ScheduleF[]
  scheduleR?: ScheduleR
  schedule8812: Schedule8812
  f1116?: F1116
  _f1116List?: F1116[]
  f2210?: F2210
  f2439?: F2439
  f2441?: F2441
  f2555?: F2555
  f4136?: F4136
  f4137?: F4137
  f4563?: F4563
  f4797?: F4797
  f4952?: F4952
  f4972?: F4972
  f5695?: F5695
  scheduleH?: ScheduleH
  f6251: F6251
  f8911?: F8911
  f8606?: F8606
  _f8606List?: F8606[]
  f8283?: F8283
  f8814?: F8814
  _f8814List?: F8814[]
  f8582?: F8582
  f4562?: F4562
  _f4562List?: F4562[]
  f8829?: F8829
  _f8829List?: F8829[]
  f8853?: F8853
  f8863?: F8863
  f8801?: F8801
  f8880?: F8880
  f8888?: F8888
  f8889: F8889
  f8889Spouse?: F8889
  f8910?: F8910
  f8919?: F8919
  f8936?: F8936
  f8949: F8949
  _f8949s?: F8949[]
  f8959: F8959
  f8960: F8960
  f8962?: F8962
  f8995?: F8995 | F8995A
  schedule1A?: Schedule1A
  readonly qualifiedAndCapGainsWorksheet: SDQualifiedAndCapGains
  studentLoanInterestWorksheet?: StudentLoanInterestWorksheet
  socialSecurityBenefitsWorksheet?: SocialSecurityBenefitsWorksheet

  qualifyingDependents: QualifyingDependents

  constructor(info: ValidatedInformation, assets: Asset<Date>[]) {
    super(info)
    this.assets = assets
    // Form 6251 must see the same worksheet even before 1040 line 16 is read.
    this.qualifiedAndCapGainsWorksheet = new SDQualifiedAndCapGains(this)
    this.qualifyingDependents = new QualifyingDependents(this)

    this.scheduleA = new ScheduleA(this)
    this.scheduleB = new ScheduleB(this)
    this.scheduleD = new ScheduleD(this)
    this.scheduleE = new ScheduleE(this)
    this.scheduleEIC = new ScheduleEIC(this)
    this.scheduleSE = new ScheduleSE(this)

    // Create Schedule C forms for each business
    if (
      this.info.scheduleCBusinesses !== undefined &&
      this.info.scheduleCBusinesses.length > 0
    ) {
      this._scheduleCList = this.info.scheduleCBusinesses.map(
        (data) => new ScheduleC(this, data)
      )
      this.scheduleC = this._scheduleCList[0]
    }

    // Create Schedule F for farm income
    if (
      this.info.scheduleFData !== undefined &&
      this.info.scheduleFData.length > 0
    ) {
      this._scheduleFList = this.info.scheduleFData.map(
        (data) => new ScheduleF(this, data)
      )
      this.scheduleF = this._scheduleFList[0]
    }

    // Form 7206 per business plan; Schedule 1 line 17 sums them.
    if (this.info.form7206s !== undefined && this.info.form7206s.length > 0) {
      this._f7206List = this.info.form7206s.map((data) => new F7206(this, data))
    }

    // Form 4835 per farm rental; Schedule E line 40 sums them.
    if (this.info.f4835s !== undefined && this.info.f4835s.length > 0) {
      this._f4835List = this.info.f4835s.map((data) => new F4835(this, data))
    }

    // Create Form 8880 for saver's credit
    if (this.info.form8880 !== undefined) {
      this.f8880 = new F8880(this, this.info.form8880)
    }

    // Create Form 8283 for noncash charity
    if (
      this.info.form8283 !== undefined &&
      this.info.form8283.contributions.length > 0
    ) {
      this.f8283 = new F8283(this, this.info.form8283)
    }

    // Create Form 2441 if child/dependent care data exists
    if (this.info.form2441 !== undefined) {
      this.f2441 = new F2441(this)
    }

    // Create Form 8863 if education credit data exists
    if (
      this.info.form8863 !== undefined &&
      this.info.form8863.students.length > 0
    ) {
      this.f8863 = new F8863(this, this.info.form8863)
    }

    // Create Form 8962 if marketplace health insurance data exists
    if (
      this.info.form8962 !== undefined &&
      this.info.form8962.policies.length > 0
    ) {
      this.f8962 = new F8962(this, this.info.form8962)
    }

    // Create Form 8606 for nondeductible IRA activity
    if (this.info.form8606s !== undefined && this.info.form8606s.length > 0) {
      this._f8606List = this.info.form8606s.map((data) => new F8606(this, data))
      this.f8606 = this._f8606List[0]
    }

    // Create Form 8829 for home office deduction
    if (this.info.form8829s !== undefined && this.info.form8829s.length > 0) {
      this._f8829List = this.info.form8829s.map((data) => new F8829(this, data))
      this.f8829 = this._f8829List[0]
    }

    // Create Form 8582 for passive activity loss limitations
    if (this.info.form8582 !== undefined || this.info.realEstate.length > 0) {
      this.f8582 = new F8582(this)
    }

    // Create Form 1116 for foreign tax credit
    if (this.info.form1116s !== undefined && this.info.form1116s.length > 0) {
      this._f1116List = this.info.form1116s.map((data) => new F1116(this, data))
      this.f1116 = this._f1116List[0]
    }

    // Create Form 2555 for foreign earned income exclusion
    if (this.info.form2555s !== undefined && this.info.form2555s.length > 0) {
      this.f2555 = new F2555(this, this.info.form2555s[0])
    }

    // Create Form 5695 if residential energy credit data exists
    if (this.info.form5695 !== undefined) {
      this.f5695 = new F5695(this, this.info.form5695)
    }
    if (this.info.scheduleH !== undefined) {
      this.scheduleH = new ScheduleH(this, this.info.scheduleH)
    }
    // Form 8911 with a Schedule A per refueling property; Schedule 3 line 6j.
    if (this.info.form8911 !== undefined) {
      this.f8911 = new F8911(this, this.info.form8911)
    }

    // Create Form 4137 for unreported tip income
    if (this.info.form4137 !== undefined) {
      this.f4137 = new F4137(this, this.info.form4137)
    }

    // Create Form 8919 for uncollected SS/Medicare tax on wages
    if (this.info.form8919 !== undefined) {
      this.f8919 = new F8919(this, this.info.form8919)
    }

    // Create Form 4797 for sales of business property
    if (this.info.form4797 !== undefined) {
      this.f4797 = new F4797(this, this.info.form4797)
    }

    // Create Form 4952 for investment interest expense deduction
    if (this.info.form4952 !== undefined) {
      this.f4952 = new F4952(this, this.info.form4952)
    }

    // Create Form 4562 for depreciation and amortization
    if (this.info.form4562s !== undefined && this.info.form4562s.length > 0) {
      this._f4562List = this.info.form4562s.map((data) => new F4562(this, data))
      this.f4562 = this._f4562List[0]
    }

    // Create Form 8814 for child's interest/dividends on parent's return
    if (this.info.form8814s !== undefined && this.info.form8814s.length > 0) {
      this._f8814List = this.info.form8814s.map((data) => new F8814(this, data))
      this.f8814 = this._f8814List[0]
    }

    // Create Schedule R for credit for elderly/disabled
    if (this.info.scheduleRData !== undefined) {
      this.scheduleR = new ScheduleR(this)
    }

    this.schedule1 = new Schedule1(this)
    this.schedule2 = new Schedule2(this)
    this.schedule3 = new Schedule3(this)
    this.schedule8812 = new Schedule8812(this)

    this.f6251 = new F6251(this)
    this.f8949 = new F8949(this)
    this.f8889 = new F8889(this, this.info.taxPayer.primaryPerson)

    // add in separate form 8889 for the spouse
    if (this.info.taxPayer.spouse) {
      this.f8889Spouse = new F8889(this, this.info.taxPayer.spouse)
    }

    this.f8959 = new F8959(this)
    this.f8960 = new F8960(this)

    if (this.f1099ssas().length > 0) {
      const ssws = new SocialSecurityBenefitsWorksheet(this)
      this.socialSecurityBenefitsWorksheet = ssws
    }

    if (this.info.f1098es.length > 0) {
      this.studentLoanInterestWorksheet = new StudentLoanInterestWorksheet(
        this,
        this.info.f1098es
      )
    }

    // Create Form 8801 for prior year minimum tax credit
    if (this.info.form8801 !== undefined) {
      this.f8801 = new F8801(this, this.info.form8801)
    }

    // Create Form 2210 for underpayment penalty calculation
    if (this.info.form2210 !== undefined) {
      this.f2210 = new F2210(this, this.info.form2210)
    }

    // Create Schedule 1-A for additional deductions (TY2026+)
    if (this.info.schedule1AData !== undefined) {
      this.schedule1A = new Schedule1A(this)
    }

    validateScheduleCQbi(this)
    if (hasQbiSources(this)) {
      const formAMinAmount = getF8995PhaseOutIncome(
        this.info.taxPayer.filingStatus
      )
      if (
        roundLine(this.l11()) -
          roundLine(this.l12()) -
          roundLine(this.l13b() ?? 0) >
        formAMinAmount
      ) {
        this.f8995 = new F8995A(this)
      } else {
        this.f8995 = new F8995(this)
      }
    }
  }

  get f8949s(): F8949[] {
    if (this._f8949s === undefined) {
      this._f8949s = [this.f8949, ...this.f8949.copies()]
    }
    return this._f8949s
  }

  totalQbi = () =>
    this.info.scheduleK1Form1065s
      .map((k1) => k1.section199AQBI)
      .reduce((c, a) => c + a, 0)

  // Total net profit/loss from all Schedule C businesses
  scheduleCNetProfit = (): number =>
    (this._scheduleCList ?? []).reduce(
      (sum, sc) => sum + sc.netProfitOrLoss(),
      0
    )

  // All Schedule C forms (for copies pattern)
  get scheduleCList(): ScheduleC[] {
    return this._scheduleCList ?? []
  }

  // All Form 8606 forms (for copies pattern)
  get f8606List(): F8606[] {
    return this._f8606List ?? []
  }

  // All Form 1116 forms (for copies pattern)
  get f1116List(): F1116[] {
    return this._f1116List ?? []
  }

  // All Schedule F forms
  get scheduleFList(): ScheduleF[] {
    return this._scheduleFList ?? []
  }

  // All Form 8814 forms (for copies pattern)
  get f8814List(): F8814[] {
    return this._f8814List ?? []
  }

  // Total F8814 income for Schedule 1, line 8n
  f8814TotalIncome = (): number =>
    (this._f8814List ?? []).reduce((sum, f) => sum + f.l12(), 0)

  // Total F8814 tax for Form 1040, line 16
  f8814TotalTax = (): number =>
    (this._f8814List ?? []).reduce((sum, f) => sum + f.tax(), 0)

  // Total net farm profit/loss from all Schedule F
  scheduleFNetProfit = (): number =>
    (this._scheduleFList ?? []).reduce(
      (sum, sf) => sum + sf.netProfitOrLoss(),
      0
    )

  /** Gross farm income (Schedule F line 9) across all Schedules F — the farm optional method's base. */
  scheduleFGrossIncome = (): number =>
    (this._scheduleFList ?? []).reduce((sum, sf) => sum + sf.l9(), 0)

  f4835s = (): F4835[] => this._f4835List ?? []

  f7206s = (): F7206[] => this._f7206List ?? []

  // Total foreign tax credit across all categories
  totalForeignTaxCredit = (): number =>
    (this._f1116List ?? []).reduce((sum, f) => sum + f.l24(), 0)

  toString = (): string => `
    Form 1040 generated from information:
    Information:
    ${JSON.stringify(this.info)}
  `

  // TODO - get from W2 box 12, code Q
  nonTaxableCombatPay = (): number | undefined => undefined

  schedules = (): Form[] => {
    const res1: (F1040Attachment | undefined)[] = [
      this.scheduleA,
      this.scheduleB,
      this.scheduleC,
      this.scheduleD,
      this.scheduleE,
      this.scheduleSE,
      this.scheduleF,
      ...this.f4835s(),
      ...this.f7206s(),
      this.scheduleR,
      this.scheduleEIC,
      this.schedule8812,
      this.f1116,
      this.f2210,
      this.f2441,
      this.f2555,
      this.f4137,
      this.f4562,
      this.f4797,
      this.f8283,
      this.f8606,
      this.f8829,
      this.f8863,
      this.f8801,
      this.f8880,
      this.f4952,
      this.f4972,
      this.f5695,
      this.scheduleH,
      this.f6251,
      this.f8911,
      ...(this.f8911?.schedules ?? []),
      this.f8582,
      this.f8814,
      this.f8888,
      this.f8889,
      this.f8889Spouse,
      this.f8910,
      this.f8919,
      this.f8936,
      this.f8949,
      this.f8959,
      this.f8960,
      this.f8962,
      this.f8995,
      this.schedule1,
      this.schedule1A,
      this.schedule2,
      this.schedule3
    ]
    const res = _.compact(res1)
      .filter((f) => f.isNeeded())
      .flatMap((f) => [f, ...f.copies()])

    // Attach payment voucher to front if there is a payment due
    if (this.l37() > 0) {
      res.push(new F1040V(this))
    }

    return [this, ...res].sort((a, b) => a.sequenceIndex - b.sequenceIndex)
  }

  // Civil-date cutoff must not move when the server's time zone changes.
  bornBeforeDate = (): boolean => {
    const birth = this.info.taxPayer.primaryPerson.dateOfBirth
    const facts = this.info.schedule1AData?.people?.primary
    return (
      seniorAtYearEnd(birth) &&
      (facts === undefined || seniorAtDeath(birth, facts))
    )
  }

  blind = (): boolean => this.info.taxPayer.primaryPerson.isBlind

  spouseBeforeDate = (): boolean => {
    const birth = this.info.taxPayer.spouse?.dateOfBirth
    const facts = this.info.schedule1AData?.people?.spouse
    return (
      birth !== undefined &&
      seniorAtYearEnd(birth) &&
      (facts === undefined || seniorAtDeath(birth, facts))
    )
  }

  spouseBlind = (): boolean => this.info.taxPayer.spouse?.isBlind ?? false

  validW2s = (): IncomeW2[] => {
    if (this.info.taxPayer.filingStatus === FilingStatus.MFS) {
      return this.info.w2s.filter((w2) => w2.personRole === PersonRole.PRIMARY)
    }
    return this.info.w2s
  }

  /**
   * Box 1 across every valid W-2, summed with cents and rounded once.
   *
   * Rounding each W-2 first would lose a dollar on amounts like
   * $20,000.49 + $20,000.49, which the instructions address directly.
   */
  wages = (): number =>
    sumToWholeDollars(
      this.validW2s().map((w2) => w2.income),
      'W-2 box 1'
    )
  medicareWages = (): number =>
    this.validW2s().reduce((res, w2) => res + w2.medicareIncome, 0)

  occupation = (r: PersonRole): string | undefined =>
    this.info.w2s.find((w2) => w2.personRole === r && w2.occupation !== '')
      ?.occupation

  standardDeduction = (): number | undefined => {
    const filingStatus = this.info.taxPayer.filingStatus

    const allowances = [
      this.bornBeforeDate(),
      this.blind(),
      this.spouseBeforeDate(),
      this.spouseBlind()
    ].reduce((res, e) => res + +!!e, 0)

    if (
      this.info.taxPayer.primaryPerson.isTaxpayerDependent ||
      (this.info.taxPayer.spouse?.isTaxpayerDependent ?? false)
    ) {
      const l4a = Math.min(
        federalBrackets.ordinary.status[filingStatus].deductions[0].amount,
        this.wages() > 750 ? this.wages() + 350 : 1100
      )
      if (allowances > 0) {
        if (
          filingStatus === FilingStatus.HOH ||
          filingStatus === FilingStatus.S
        ) {
          return l4a + allowances * 1700
        } else {
          return l4a + allowances * 1350
        }
      } else {
        return l4a
      }
    }

    return federalBrackets.ordinary.status[filingStatus].deductions[allowances]
      .amount
  }

  totalQualifiedDividends = (): number =>
    this.f1099Divs()
      .map((f) => f.form.qualifiedDividends)
      .reduce((l, r) => l + r, 0)

  totalGrossDistributionsFromIra = (): number =>
    this.info.individualRetirementArrangements.reduce(
      (res, i) => res + i.grossDistribution,
      0
    )

  totalTaxableFromIra = (): number =>
    this.info.individualRetirementArrangements.reduce(
      (r, i) => r + i.taxableAmount,
      0
    )

  totalGrossDistributionsFrom1099R = (planType: PlanType1099): number =>
    this.f1099rs()
      .filter((element) => element.form.planType === planType)
      .reduce((res, f1099) => res + f1099.form.grossDistribution, 0)

  totalTaxableFrom1099R = (planType: PlanType1099): number =>
    this.f1099rs()
      .filter((element) => element.form.planType === planType)
      .reduce((res, f1099) => res + f1099.form.taxableAmount, 0)

  l1a = (): number => this.wages()
  l1b = (): number | undefined => this.info.householdEmployeeIncome ?? undefined
  l1c = (): number | undefined => this.f4137?.l4()
  l1d = (): number | undefined => this.info.medicaidWaiverPayments ?? undefined
  l1e = (): number | undefined => {
    const val = this.f2441?.l14()
    return val !== undefined && val > 0 ? val : undefined
  }
  l1f = (): number | undefined => undefined
  l1g = (): number | undefined => {
    const wages = this.f8919?.l5()
    return wages !== undefined && wages > 0 ? wages : undefined
  }
  l1h = (): number | undefined => this.info.strikeBenefits ?? undefined
  l1i = (): number | undefined => this.info.stockOptionIncome ?? undefined
  l1z = (): number =>
    sumFields([
      this.l1a(),
      this.l1b(),
      this.l1c(),
      this.l1d(),
      this.l1e(),
      this.l1f(),
      this.l1g(),
      this.l1h(),
      this.l1i()
    ])
  l2a = (): number | undefined => this.scheduleB.l3()
  l2b = (): number | undefined => this.scheduleB.to1040l2b()
  l3a = (): number | undefined => this.totalQualifiedDividends()
  l3b = (): number | undefined => this.scheduleB.to1040l3b()
  // This is the value of box 1 in 1099-R forms coming from IRAs
  l4a = (): number | undefined => this.totalGrossDistributionsFromIra()
  // Taxable IRA distributions. If Form 8606 is filed, use its calculation
  // (accounts for nontaxable basis); otherwise use 1099-R box 2a.
  l4b = (): number | undefined => {
    if (this._f8606List && this._f8606List.length > 0) {
      return this._f8606List.reduce((sum, f) => sum + f.taxableAmount(), 0)
    }
    return this.totalTaxableFromIra()
  }
  // This is the value of box 1 in 1099-R forms coming from pensions/annuities
  l5a = (): number | undefined =>
    this.totalGrossDistributionsFrom1099R(PlanType1099.Pension)
  // Taxable pension/annuity amount. Uses Simplified Method Worksheet when
  // box 2a is not determined; otherwise uses box 2a directly.
  l5b = (): number | undefined => {
    const pensions = this.f1099rs().filter(
      (f) => f.form.planType === PlanType1099.Pension
    )
    if (pensions.length === 0) return undefined
    return pensions.reduce((sum, f) => {
      if (f.form.taxableAmountNotDetermined && f.form.simplifiedMethodData) {
        const ws = new SimplifiedMethodWorksheet(
          f.form.grossDistribution,
          f.form.simplifiedMethodData
        )
        return sum + ws.taxableAmount()
      }
      return sum + f.form.taxableAmount
    }, 0)
  }
  // The sum of box 5 from SSA-1099
  l6a = (): number | undefined => this.socialSecurityBenefitsWorksheet?.l1()
  // calculation of the taxable amount of line 6a based on other income
  l6b = (): number | undefined =>
    this.socialSecurityBenefitsWorksheet?.taxableAmount()
  // TODO: change this so that it is not hard coded
  l6c = (): boolean => false
  l7Box = (): boolean => !this.scheduleD.isNeeded()
  l7 = (): number | undefined => this.scheduleD.to1040()
  l8 = (): number | undefined => this.schedule1.l10()
  l9 = (): number =>
    sumFields([
      this.l1z(),
      this.l2b(),
      this.l3b(),
      this.l4b(),
      this.l5b(),
      this.l6b(),
      this.l7(),
      this.l8()
    ])

  l10 = (): number | undefined => this.schedule1.to1040Line10()

  l11 = (): number => Math.max(0, this.l9() - (this.l10() ?? 0))

  l12 = (): number => {
    if (this.scheduleA.isNeeded()) {
      return this.scheduleA.deductions()
    }
    return this.standardDeduction() ?? 0
  }

  l13 = (): number | undefined => this.f8995?.deductions()
  // Line 13b: Schedule 1-A additional deductions (TY2025)
  l13b = (): number | undefined => this.schedule1A?.deduction()
  l14 = (): number => sumFields([this.l12(), this.l13(), this.l13b()])

  l15 = (): number => Math.max(0, this.l11() - this.l14())

  f8814Box = (): boolean | undefined => this.f8814 !== undefined
  f4972Box = (): boolean | undefined => this.f4972 !== undefined
  // TODO: tax from other form?
  otherFormBox = (): boolean => false
  otherFormName = (): string | undefined => undefined

  computeTax = (): number | undefined => {
    // If Schedule D Tax Worksheet is needed (28% rate gain or unrecaptured 1250),
    // use it instead of the simpler Qualified Dividends worksheet
    if (this.scheduleD.taxWorksheet.isNeeded()) {
      return this.scheduleD.taxWorksheet.tax()
    }

    if (
      this.scheduleD.computeTaxOnQDWorksheet() ||
      this.totalQualifiedDividends() > 0
    ) {
      return this.qualifiedAndCapGainsWorksheet.tax()
    }

    return computeOrdinaryTax(this.info.taxPayer.filingStatus, this.l15())
  }

  /**
   * The Tax Table publishes whole dollars. `computeTax` returns the tax for the
   * midpoint of the band, which is frequently a half dollar, so the line is the
   * table's value only after rounding.
   */
  l16 = (): number | undefined =>
    roundTaxTableResult(
      sumFields([this.f8814TotalTax(), this.f4972?.tax(), this.computeTax()])
    )

  l17 = (): number | undefined => this.schedule2.l3()
  l18 = (): number => sumFields([this.l16(), this.l17()])

  l19 = (): number | undefined => this.schedule8812.to1040Line19()
  l20 = (): number | undefined =>
    this.schedule3.isNeeded() ? this.schedule3.l8() : undefined

  l21 = (): number => sumFields([this.l19(), this.l20()])

  l22 = (): number => Math.max(0, this.l18() - this.l21())

  l23 = (): number | undefined => this.schedule2.l21()

  l24 = (): number => sumFields([this.l22(), this.l23()])

  /** Box 2 across every valid W-2, summed with cents and rounded once. */
  l25a = (): number =>
    sumToWholeDollars(
      this.validW2s().map((w2) => w2.fedWithholding),
      'W-2 box 2'
    )

  // Tax withheld from every 1099 type (R, SSA, INT, DIV, B, NEC, MISC, G) and
  // from IRA distributions. An IRA-type 1099-R travels as
  // `individualRetirementArrangements` so that lines 4a/4b can read it, and
  // that structure carries its own box 4. It was never summed here, so a
  // traditional IRA distribution with withholding understated the refund.
  // Every source keeps its cents until the line rounds once, as line 25a does;
  // the previous float sum could hand the PDF a fractional dollar.
  l25b = (): number =>
    sumToWholeDollars(
      [
        ...this.f1099rs().map((f) => f.form.federalIncomeTaxWithheld),
        ...this.info.individualRetirementArrangements.map(
          (i) => i.federalIncomeTaxWithheld
        ),
        ...this.f1099ssas().map((f) => f.form.federalIncomeTaxWithheld),
        ...this.f1099Ints().map((f) => f.form.federalIncomeTaxWithheld ?? 0),
        ...this.f1099Divs().map((f) => f.form.federalIncomeTaxWithheld ?? 0),
        ...this.f1099Bs().map((f) => f.form.federalIncomeTaxWithheld ?? 0),
        ...(this.info.f1099necs ?? []).map(
          (f) => f.form.federalIncomeTaxWithheld
        ),
        ...(this.info.f1099miscs ?? []).map(
          (f) => f.form.federalIncomeTaxWithheld
        ),
        ...(this.info.f1099gs ?? []).map((f) => f.form.federalIncomeTaxWithheld)
      ],
      '1099 box 4'
    )

  // TODO: form(s) W-2G box 4, schedule K-1, form 1042-S, form 8805, form 8288-A
  /**
   * Only present when Form 8959 is filed. It was read unconditionally, so a
   * return that needs no Form 8959 still carried its residue onto line 25c.
   */
  /**
   * Present only when Form 8959 applies, or when Additional Medicare Tax was
   * actually withheld and is creditable. It was read unconditionally, so a
   * return needing no Form 8959 still carried its residue onto line 25c.
   */
  l25c = (): number | undefined =>
    this.f8959.isNeeded() ? this.f8959.l24() : undefined

  l25d = (): number => sumFields([this.l25a(), this.l25b(), this.l25c()])

  l26 = (): number =>
    this.info.estimatedTaxes.reduce((res, et) => res + et.payment, 0)

  l27 = (): number =>
    this.scheduleEIC.isNeeded() ? this.scheduleEIC.credit() : 0

  // TODO: handle taxpayers between 1998 and 2004 that
  // can claim themselves for eic.
  //l27acheckBox = (): boolean => false

  // TODO: nontaxable combat pay
  //l27b = (): number | undefined => undefined

  // TODO: prior year earned income
  //l27c = (): number | undefined => undefined

  l28 = (): number | undefined => this.schedule8812.to1040Line28()

  l29 = (): number | undefined => this.f8863?.l8()

  // TODO: recovery rebate credit?
  l30 = (): number | undefined => undefined

  l31 = (): number | undefined =>
    this.schedule3.isNeeded() ? this.schedule3.l15() : undefined

  l32 = (): number =>
    sumFields([this.l27(), this.l28(), this.l29(), this.l30(), this.l31()])

  l33 = (): number => sumFields([this.l25d(), this.l26(), this.l32()])

  l34 = (): number => Math.max(0, this.l33() - this.l24())

  // TODO: assuming user wants amount refunded
  // rather than applied to estimated tax
  l35a = (): number => this.l34()
  l36 = (): number => Math.max(0, this.l34() - this.l35a())

  l37 = (): number => Math.max(0, this.l24() - this.l33())

  // Estimated tax penalty (from Form 2210)
  l38 = (): number | undefined => this.f2210?.estimatedTaxPenalty()

  _depField = (idx: number): string | boolean => {
    const deps: Dependent[] = this.info.taxPayer.dependents

    // Based on the PDF row we are on, select correct dependent
    const depIdx = Math.floor(idx / 5)
    const depFieldIdx = idx % 5

    let fieldArr = ['', '', '', false, false]

    if (depIdx < deps.length) {
      const dep = deps[depIdx]
      // Based on the PDF column, select the correct field
      fieldArr = [
        `${dep.firstName} ${dep.lastName}`,
        dep.ssid,
        dep.relationship,
        this.qualifyingDependents.qualifiesChild(dep),
        this.qualifyingDependents.qualifiesOther(dep)
      ]
    }

    return fieldArr[depFieldIdx]
  }

  // 1040 allows 4 dependents listed without a supplemental schedule,
  // so create field mappings for 4x5 grid of fields
  _depFieldMappings = (): Array<string | boolean> =>
    Array.from(Array(20)).map((u, n: number) => this._depField(n))

  // 2025 dependent text fields: 4 deps × 4 text columns = 16 fields
  _depField2025 = (): Array<string> => {
    const deps = this.info.taxPayer.dependents
    const result: string[] = []
    for (let i = 0; i < 4; i++) {
      if (i < deps.length) {
        const dep = deps[i]
        result.push(
          `${dep.firstName} ${dep.lastName}`,
          dep.ssid,
          dep.relationship,
          ''
        )
      } else {
        result.push('', '', '', '')
      }
    }
    return result
  }

  // 2025 dependent checkboxes: Row5 (4×2) + Row6 (4×2) + Row7 (4×2) = 24 checkboxes
  _depCheckboxes2025 = (): Array<boolean> => {
    const deps = this.info.taxPayer.dependents
    const result: boolean[] = []
    for (let row = 0; row < 3; row++) {
      for (let depIdx = 0; depIdx < 4; depIdx++) {
        if (depIdx < deps.length) {
          result.push(
            this.qualifyingDependents.qualifiesChild(deps[depIdx]),
            this.qualifyingDependents.qualifiesOther(deps[depIdx])
          )
        } else {
          result.push(false, false)
        }
      }
    }
    return result
  }

  /**
   * Named field mapping for 2025 PDF.
   * Maps semantic names → PDF field IDs → values.
   * Used by fillPDFByName (preferred over positional fields()).
   */
  namedFields = (): Record<string, Field> => {
    const fm = F1040_FIELDS
    const vals: Record<string, Field> = {}

    // Helper: set a value using the named map
    const set = (key: string, value: Field) => {
      const pdfField = fm[key]
      if (pdfField && value !== undefined) {
        vals[pdfField] = value
      }
    }

    // Header
    set('first_name', this.info.taxPayer.primaryPerson.firstName)
    set('last_name', this.info.taxPayer.primaryPerson.lastName)
    set('ssn', this.info.taxPayer.primaryPerson.ssid)
    if (
      this.info.taxPayer.filingStatus === FilingStatus.MFJ &&
      this.info.taxPayer.spouse
    ) {
      set('spouse_first_name', this.info.taxPayer.spouse.firstName)
      set('spouse_last_name', this.info.taxPayer.spouse.lastName)
      set('spouse_ssn', this.info.taxPayer.spouse.ssid)
    }

    // Address
    set('address', this.info.taxPayer.primaryPerson.address.address)
    set('apt_no', this.info.taxPayer.primaryPerson.address.aptNo)
    set('city', this.info.taxPayer.primaryPerson.address.city)
    set('state', this.info.taxPayer.primaryPerson.address.state)
    set('zip', this.info.taxPayer.primaryPerson.address.zip)

    // TY2025 uses separate checkboxes, not a radio widget group.
    const fsMap: Record<FilingStatus, number> = {
      [FilingStatus.S]: 0,
      [FilingStatus.MFJ]: 1,
      [FilingStatus.MFS]: 2,
      [FilingStatus.HOH]: 3,
      [FilingStatus.W]: 4
    }
    const fsIdx = fsMap[this.info.taxPayer.filingStatus]
    ;['single', 'mfj', 'mfs', 'hoh', 'qss'].forEach((key, i) =>
      set(`filing_status_${key}`, fsIdx === i)
    )
    if (this.info.taxPayer.filingStatus === FilingStatus.MFS) {
      set('mfs_spouse_name', this.spouseFullName())
    }

    // Dependents
    const deps = this.info.taxPayer.dependents
    for (let i = 0; i < Math.min(deps.length, 4); i++) {
      const dep = deps[i]
      set(`dep${i + 1}_first_name`, dep.firstName)
      set(`dep${i + 1}_last_name`, dep.lastName)
      set(`dep${i + 1}_ssn`, dep.ssid)
      set(`dep${i + 1}_rel`, dep.relationship)
    }

    // Income
    set('line_1a', this.l1a())
    set('line_1b', this.l1b())
    set('line_1c', this.l1c())
    set('line_1d', this.l1d())
    set('line_1e', this.l1e())
    set('line_1f', this.l1f())
    set('line_1g', this.l1g())
    set('line_1h', this.l1h())
    set('line_1i', this.l1i())
    set('line_1z', this.l1z())
    set('line_2a', this.l2a())
    set('line_2b', this.l2b())
    set('line_3a', this.l3a())
    set('line_3b', this.l3b())
    set('line_4a', this.l4a())
    set('line_4b', this.l4b())
    set('line_5a', this.l5a())
    set('line_5b', this.l5b())
    set('line_6a', this.l6a())
    set('line_6b', this.l6b())
    set('line_7', this.l7())
    set('line_8', this.l8())
    set('line_9', this.l9())
    set('line_10', this.l10())
    set('line_11', this.l11())

    // Page 2
    set('born_before_1961_01_02', this.bornBeforeDate())
    set(
      'spouse_born_before_1961_01_02',
      this.info.taxPayer.filingStatus === FilingStatus.MFJ &&
        this.spouseBeforeDate()
    )
    set('blind', this.blind())
    set(
      'spouse_blind',
      this.info.taxPayer.filingStatus === FilingStatus.MFJ && this.spouseBlind()
    )
    set('line_11b', this.l11())
    set('line_12', this.l12())
    set('line_13a', this.l13())
    set('line_13b', this.l13b())
    set('line_14', this.l14())
    set('line_15', this.l15())
    set('line_16', this.l16())
    set('line_17', this.l17())
    set('line_18', this.l18())
    set('line_19', this.l19())
    set('line_20', this.l20())
    set('line_21', this.l21())
    set('line_22', this.l22())
    set('line_23', this.l23())
    set('line_24', this.l24())
    set('line_25a', this.l25a())
    set('line_25b', this.l25b())
    set('line_25c', this.l25c())
    set('line_25d', this.l25d())
    set('line_26', this.l26())
    set('line_27a', this.l27())
    // TY2025 line 27c is an election NOT to claim EIC, not an age test.
    // The current input has no opt-out election; do not infer one from age.
    set('line_27c', false)
    set('line_28', this.l28())
    set('line_29', this.l29())
    set('line_31', this.l31())
    set('line_32', this.l32())
    set('line_33', this.l33())
    set('line_34', this.l34())
    set('line_35a', this.l35a())
    set('line_37', this.l37())
    set('line_38', this.l38())

    // Refund
    if (this.info.refund) {
      set('routing_number', this.info.refund.routingNumber)
      set('account_number', this.info.refund.accountNumber)
    }

    // Sign here
    set('your_occupation', this.occupation(PersonRole.PRIMARY))
    set('spouse_occupation', this.occupation(PersonRole.SPOUSE))
    set('phone', this.info.taxPayer.contactPhoneNumber)
    set('email', this.info.taxPayer.contactEmail)

    return vals
  }

  // Legacy positional fields — kept for backward compatibility
  // Y2025 uses namedFields() instead via fillPDFByName
  fields = (): Field[] =>
    [
      // ══ PAGE 1 (128 fields, 0-127) ══
      // Header
      '', // [  0] f1_01
      '', // [  1] f1_02
      '', // [  2] f1_03
      false, // [  3] c1_1
      false, // [  4] c1_2
      this.info.taxPayer.primaryPerson.firstName, // [  5] f1_04 first name
      false, // [  6] c1_3
      this.info.taxPayer.primaryPerson.lastName, // [  7] f1_05 last name
      this.info.taxPayer.primaryPerson.ssid, // [  8] f1_06 SSN
      this.info.taxPayer.filingStatus === FilingStatus.MFJ
        ? this.info.taxPayer.spouse?.firstName ?? ''
        : '', // [  9] f1_07 spouse first
      this.info.taxPayer.filingStatus === FilingStatus.MFJ
        ? this.info.taxPayer.spouse?.lastName ?? ''
        : '', // [ 10] f1_08 spouse last
      this.info.taxPayer.spouse?.ssid ?? '', // [ 11] f1_09 spouse SSN
      this.info.taxPayer.primaryPerson.address.address, // [ 12] f1_10 address
      false, // [ 13] c1_4  PO box
      this.info.taxPayer.primaryPerson.address.aptNo ?? '', // [ 14] f1_11 apt
      this.info.taxPayer.primaryPerson.address.city, // [ 15] f1_12 city
      this.info.taxPayer.primaryPerson.address.state, // [ 16] f1_13 state
      this.info.taxPayer.primaryPerson.address.zip, // [ 17] f1_14 zip
      '', // [ 18] f1_15 foreign country
      '', // [ 19] f1_16 foreign province
      '', // [ 20] f1_17 foreign postal
      '', // [ 21] f1_18
      '', // [ 22] f1_19
      '', // [ 23] f1_20
      '', // [ 24] f1_21
      '', // [ 25] f1_22
      '', // [ 26] f1_23
      '', // [ 27] f1_24
      '', // [ 28] f1_25
      '', // [ 29] f1_26
      '', // [ 30] f1_27
      false, // [ 31] c1_5  campaign you
      false, // [ 32] c1_6  campaign spouse
      this.info.taxPayer.filingStatus === FilingStatus.S, // [ 33] c1_7  Single
      this.info.taxPayer.filingStatus === FilingStatus.MFJ, // [ 34] c1_8  MFJ
      this.info.taxPayer.filingStatus === FilingStatus.MFS, // [ 35] c1_8[1] MFS
      this.info.taxPayer.filingStatus === FilingStatus.HOH, // [ 36] c1_8[2] HOH
      this.info.taxPayer.filingStatus === FilingStatus.MFS
        ? this.spouseFullName()
        : '', // [ 37] f1_28 MFS spouse name
      this.info.taxPayer.filingStatus === FilingStatus.W, // [ 38] c1_8  QSS
      false, // [ 39] c1_8[1] nonresident
      '', // [ 40] f1_29 QSS deceased
      this.info.questions.CRYPTO ?? false, // [ 41] c1_9  digital assets yes
      '', // [ 42] f1_30
      !(this.info.questions.CRYPTO ?? true), // [ 43] c1_10 digital assets no
      false, // [ 44] c1_10[1]
      this.info.taxPayer.primaryPerson.isTaxpayerDependent, // [ 45] c1_11 you as dependent
      // Dependent text fields (4 deps × 4 cols = 16)       // [46-61]
      ...this._depField2025(),
      // Dependent checkboxes (3 rows × 4 deps × 2 = 24)   // [62-85]
      ...this._depCheckboxes2025(),
      this.info.taxPayer.dependents.length > 4, // [ 86] c1_32 more dependents
      // Income
      this.l1a(), // [ 87] f1_47 line 1a
      this.l1b(), // [ 88] f1_48
      this.l1c(), // [ 89] f1_49
      this.l1d(), // [ 90] f1_50
      this.l1e(), // [ 91] f1_51
      this.l1f(), // [ 92] f1_52
      this.l1g(), // [ 93] f1_53
      this.l1h(), // [ 94] f1_54
      this.l1i(), // [ 95] f1_55
      this.l1z(), // [ 96] f1_56
      this.l2a(), // [ 97] f1_57
      this.l2b(), // [ 98] f1_58
      this.l3a(), // [ 99] f1_59
      this.l3b(), // [100] f1_60
      this.l4a(), // [101] f1_61
      this.bornBeforeDate(), // [102] c1_33
      this.blind(), // [103] c1_34
      this.l4b(), // [104] f1_62
      this.l5a(), // [105] f1_63
      this.spouseBeforeDate(), // [106] c1_35
      this.spouseBlind(), // [107] c1_36
      false, // [108] c1_37 spouse itemizes
      this.l5b(), // [109] f1_64
      this.l6a(), // [110] f1_65
      this.l6b(), // [111] f1_66
      this.l6c(), // [112] c1_38
      this.l7Box(), // [113] c1_39
      false, // [114] c1_40
      this.l7(), // [115] f1_67
      this.l8(), // [116] f1_68
      this.l9(), // [117] f1_69
      false, // [118] c1_41
      false, // [119] c1_42
      this.l10(), // [120] f1_70
      false, // [121] c1_43
      false, // [122] c1_44
      this.l11(), // [123] f1_71 AGI
      this.l12(), // [124] f1_72 deductions
      this.l13(), // [125] f1_73 QBI
      this.l14(), // [126] f1_74
      this.l15(), // [127] f1_75 taxable income
      // ══ PAGE 2 (71 fields, 128-198) ══
      '', // [128] f2_01 name header
      this.f8814Box(), // [129] c2_1
      this.f4972Box(), // [130] c2_2
      this.otherFormBox(), // [131] c2_3
      false, // [132] c2_4
      false, // [133] c2_5
      false, // [134] c2_6
      false, // [135] c2_7
      false, // [136] c2_8
      this.l16(), // [137] f2_02 tax
      this.l17(), // [138] f2_03
      this.l18(), // [139] f2_04
      this.l19(), // [140] f2_05
      this.l20(), // [141] f2_06
      false, // [142] c2_9
      false, // [143] c2_10
      false, // [144] c2_11
      this.l21(), // [145] f2_07
      this.l22(), // [146] f2_08
      this.l23(), // [147] f2_09
      this.l24(), // [148] f2_10 total tax
      this.l25a(), // [149] f2_11
      this.l25b(), // [150] f2_12
      this.l25c(), // [151] f2_13
      this.l25d(), // [152] f2_14
      this.l26(), // [153] f2_15
      this.l27(), // [154] f2_16
      this.l28(), // [155] f2_17
      this.l29(), // [156] f2_18
      undefined, // [157] f2_19 line 30
      this.l31(), // [158] f2_20
      this.l32(), // [159] f2_21
      this.l33(), // [160] f2_22
      this.l34(), // [161] f2_23
      this.f8888 !== undefined, // [162] c2_12 form 8888
      false, // [163] c2_13
      false, // [164] c2_14
      this.l35a(), // [165] f2_24 refund
      this.info.refund?.routingNumber ?? '', // [166] f2_25 routing
      this.l36(), // [167] f2_26
      this.l37(), // [168] f2_27 owed
      this.l38(), // [169] f2_28 penalty
      '', // [170] f2_29
      '', // [171] f2_30
      this.info.refund?.accountType === AccountType.checking, // [172] c2_15 checking
      this.info.refund?.accountNumber ?? '', // [173] f2_31 account
      this.info.refund?.routingNumber ?? '', // [174] f2_32 routing dup
      this.info.refund?.accountType === AccountType.checking, // [175] c2_16 checking
      this.info.refund?.accountType === AccountType.savings, // [176] c2_16[1] savings
      this.info.refund?.accountNumber ?? '', // [177] f2_33 account dup
      '', // [178] f2_34 third party name
      '', // [179] f2_35 phone
      '', // [180] f2_36 pin
      false, // [181] c2_17 third party yes
      false, // [182] c2_17[1] no
      this.occupation(PersonRole.PRIMARY), // [183] f2_37 occupation
      '', // [184] f2_38 identity pin
      this.occupation(PersonRole.SPOUSE), // [185] f2_39 spouse occ
      '', // [186] f2_40 spouse pin
      this.info.taxPayer.contactPhoneNumber ?? '', // [187] f2_41 phone
      this.info.taxPayer.contactEmail ?? '', // [188] f2_42 email
      '', // [189] f2_43
      '', // [190] f2_44
      '', // [191] f2_45
      '', // [192] f2_46
      '', // [193] f2_47 preparer name
      false, // [194] c2_18 self-employed
      '', // [195] f2_48 PTIN
      '', // [196] f2_49 firm name
      '', // [197] f2_50 firm EIN
      '' // [198] f2_51 firm address
    ].map((x) => (x === undefined ? '' : x))
}
