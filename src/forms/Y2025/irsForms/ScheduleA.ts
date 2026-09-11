import F1040Attachment from './F1040Attachment'
import { FilingStatus, ItemizedDeductions } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import { SCHEDULE_A_FIELDS } from '../fieldMaps'
import { roundLine } from './rounding'

const blankItemizedDeductions = {
  medicalAndDental: 0,
  stateAndLocalTaxes: 0,
  isSalesTax: false,
  stateAndLocalRealEstateTaxes: 0,
  stateAndLocalPropertyTaxes: 0,
  interest8a: 0,
  interest8b: 0,
  interest8c: 0,
  interest8d: 0,
  investmentInterest: 0,
  charityCashCheck: 0,
  charityOther: 0
}

export default class ScheduleA extends F1040Attachment {
  tag: FormTag = 'f1040sa'
  itemizedDeductions: ItemizedDeductions
  sequenceIndex = 7

  constructor(f1040: F1040) {
    super(f1040)
    this.itemizedDeductions = {
      ...blankItemizedDeductions,
      ...(f1040.info.itemizedDeductions ?? {})
    }
  }

  isNeeded = (): boolean => {
    if (this.f1040.info.itemizedDeductions !== undefined) {
      if (this.f1040.info.itemizedDeductions.electToItemize) return true
      const standardDeduction = this.f1040.standardDeduction()
      const itemizedAmount = this.deductions()
      return (
        standardDeduction === undefined || itemizedAmount > standardDeduction
      )
    }
    return false
  }

  deductions(): number {
    return (
      this.l4() + this.l7() + this.l10() + this.l14() + this.l15() + this.l16()
    )
  }

  l1 = (): number => Number(this.itemizedDeductions.medicalAndDental)

  l2 = (): number => this.f1040.l11()

  l3 = (): number => roundLine(this.l2() * 0.075)

  l4 = (): number => Math.max(0, this.l1() - this.l3())

  l5aSalesTax = (): boolean => this.itemizedDeductions.isSalesTax

  l5a = (): number => Number(this.itemizedDeductions.stateAndLocalTaxes)
  l5b = (): number =>
    Number(this.itemizedDeductions.stateAndLocalRealEstateTaxes)
  l5c = (): number => Number(this.itemizedDeductions.stateAndLocalPropertyTaxes)
  l5d = (): number => this.l5a() + this.l5b() + this.l5c()
  l5e = (): number => {
    // OBBBA 2025: SALT cap raised from $10K to $40K ($20K for MFS)
    // Phaseout: 30% of (MAGI - $500K), floor $10K ($5K MFS)
    const isMfs = this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS
    const baseCap = isMfs ? 20000 : 40000
    const threshold = isMfs ? 250000 : 500000
    const floor = isMfs ? 5000 : 10000
    const magi = this.f1040.l11() // AGI as MAGI proxy
    let cap = baseCap
    if (magi > threshold) {
      const reduction = Math.round((magi - threshold) * 0.3)
      cap = Math.max(floor, baseCap - reduction)
    }
    return Math.min(cap, this.l5d())
  }

  l6OtherTaxesTypeAndAmount1 = (): string | undefined => undefined
  l6OtherTaxesTypeAndAmount2 = (): string | undefined => undefined

  // Line 6: Other taxes (generation-skipping transfer tax, etc.)
  l6 = (): number | undefined => {
    const val = Number(this.itemizedDeductions.otherTaxes ?? 0)
    return val > 0 ? val : undefined
  }

  l7 = (): number => this.l5e() + (this.l6() ?? 0)

  // TODO
  l8AllMortgageLoan = (): boolean => false
  l8a = (): number => Number(this.itemizedDeductions.interest8a)

  // TODO
  l8bUnreportedInterest1 = (): string | undefined => undefined
  // TODO
  l8bUnreportedInterest2 = (): string | undefined => undefined
  l8b = (): number => Number(this.itemizedDeductions.interest8b)
  l8c = (): number => Number(this.itemizedDeductions.interest8c)
  l8d = (): number | undefined => undefined // Reserved for future use
  l8e = (): number => this.l8a() + this.l8b() + this.l8c()

  // Line 9: Investment interest. Use F4952 allowed deduction when filed.
  l9 = (): number | undefined =>
    this.f1040.f4952?.l8() ?? Number(this.itemizedDeductions.investmentInterest)

  l10 = (): number => this.l8e() + (this.l9() ?? 0)

  l11 = (): number => Number(this.itemizedDeductions.charityCashCheck)

  l12 = (): number => Number(this.itemizedDeductions.charityOther)
  // Line 13: Carryover from prior year
  l13 = (): number => Number(this.itemizedDeductions.charityCarryover ?? 0)
  l14 = (): number => this.l11() + this.l12() + this.l13()

  // Line 15: Casualty and theft losses from Form 4684
  l15 = (): number =>
    Number(this.itemizedDeductions.casualtyAndTheftLosses ?? 0)

  l16Other1 = (): string | undefined => undefined
  l16Other2 = (): string | undefined => undefined
  l16Other3 = (): string | undefined => undefined
  // Line 16: Other itemized deductions (gambling losses, federal estate tax on IRD, etc.)
  l16 = (): number =>
    Number(this.itemizedDeductions.otherItemizedDeductions ?? 0)

  l17 = (): number =>
    this.l4() + this.l7() + this.l10() + this.l14() + this.l15() + this.l16()

  /** Line 18: the election to itemize although the total is below the standard deduction. */
  l18 = (): boolean =>
    (this.itemizedDeductions.electToItemize ?? false) &&
    this.deductions() <= Number(this.f1040.standardDeduction())

  namedFields = (): Record<string, Field> => {
    const fm = SCHEDULE_A_FIELDS
    const vals: Record<string, Field> = {}
    const set = (key: string, value: Field) => {
      const f = fm[key]
      if (f && value !== undefined) vals[f] = value
    }
    set('name', this.f1040.namesString())
    set('ssn', this.f1040.info.taxPayer.primaryPerson.ssid)
    // Medical
    set('line_1', this.l1())
    set('line_2', this.l2())
    set('line_3', this.l3())
    set('line_4', this.l4())
    // SALT
    set('sales_tax_check', this.l5aSalesTax())
    set('line_5a', this.l5a())
    set('line_5b', this.l5b())
    set('line_5c', this.l5c())
    set('line_5d', this.l5d())
    set('line_5e', this.l5e())
    // Other taxes
    set('line_6_desc1', this.l6OtherTaxesTypeAndAmount1())
    set('line_6_desc2', this.l6OtherTaxesTypeAndAmount2())
    set('line_6', this.l6())
    // Interest
    set('mortgage_check', this.l8AllMortgageLoan())
    set('line_8a', this.l8a())
    set('line_8b_desc', this.l8bUnreportedInterest1())
    set('line_8b', this.l8b())
    set('line_8c', this.l8c())
    set('line_8d', this.l8d())
    set('line_8e', this.l8e())
    // Investment interest
    set('line_9', this.l9())
    // Charity
    set('line_10', this.l10())
    set('line_11', this.l11())
    set('line_12', this.l12())
    set('line_13', this.l13())
    // Casualty
    set('line_14', this.l14())
    // Other
    set('line_15', this.l15())
    set(
      'line_16_desc',
      [this.l16Other1(), this.l16Other2(), this.l16Other3()]
        .filter(Boolean)
        .join('; ')
    )
    set('line_16', this.l16())
    // Total
    set('line_17', this.l17())
    set('line_18', this.l18())
    return vals
  }

  // 2025 Schedule A — 33 fields (was 37 in 2024: removed l16 detail fields)
  fields = (): Field[] => [
    this.f1040.namesString(), // [ 0] f1_1  name
    this.f1040.info.taxPayer.primaryPerson.ssid, // [ 1] f1_2  SSN
    this.l1(), // [ 2] f1_3  medical
    this.l2(), // [ 3] f1_4  AGI × 7.5%
    this.l3(), // [ 4] f1_5  medical deduction
    this.l4(), // [ 5] f1_6  line 4
    this.l5aSalesTax(), // [ 6] c1_1  sales tax checkbox
    this.l5a(), // [ 7] f1_7  state/local tax
    this.l5b(), // [ 8] f1_8  real estate tax
    this.l5c(), // [ 9] f1_9  property tax
    this.l5d(), // [10] f1_10 total 5a-5c
    this.l5e(), // [11] f1_11 SALT (capped)
    this.l6OtherTaxesTypeAndAmount1(), // [12] f1_12 other taxes desc 1
    this.l6OtherTaxesTypeAndAmount2(), // [13] f1_13 other taxes desc 2
    this.l6(), // [14] f1_14 other taxes amount
    this.l8AllMortgageLoan(), // [15] c1_2  all mortgage interest checkbox
    this.l8a(), // [16] f1_15 mortgage interest 1098
    this.l8bUnreportedInterest1(), // [17] f1_16 mortgage not on 1098
    this.l8b(), // [18] f1_17 line 8b
    this.l8c(), // [19] f1_18 points
    this.l8d(), // [20] f1_19 mortgage insurance
    this.l8e(), // [21] f1_20 interest total
    this.l9(), // [22] f1_21 investment interest
    this.l10(), // [23] f1_22 charity cash
    this.l11(), // [24] f1_23 charity other
    this.l12(), // [25] f1_24 charity carryover
    this.l13(), // [26] f1_25 charity total
    this.l14(), // [27] f1_26 casualty/theft
    this.l15(), // [28] f1_27 other deductions
    [this.l16Other1(), this.l16Other2(), this.l16Other3()]
      .filter(Boolean)
      .join('; '), // [29] f1_28 description
    this.l16(), // [30] f1_29 other amount
    this.l17(), // [31] f1_30 total itemized
    this.l18() // [32] c1_3 election to itemize when below standard
  ]
}
