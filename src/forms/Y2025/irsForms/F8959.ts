import F1040Attachment from './F1040Attachment'
import {
  roundLine,
  roundOptionalLine,
  sumToWholeDollars,
  sumExactCents,
  toExactCents,
  rateToWholeDollars
} from './rounding'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { fica } from '../data/federal'
import { Field } from 'ustaxes/core/pdfFiller'

export default class F8959 extends F1040Attachment {
  tag: FormTag = 'f8959'
  sequenceIndex = 71

  /** IRS i8959, Who Must File and line 24. A withholding credit must travel
   * with the completed form, including MFJ below the $250,000 tax threshold.
   * The legacy RRTA aggregate lacks individual W-2 box 14 detail: include its
   * reconciliation whenever populated; admission blocks RRTA for this product.
   */
  isNeeded = (): boolean => {
    const individualTrigger = this.f1040
      .validW2s()
      .some((w2) => toExactCents(w2.medicareIncome, 'W-2 box 5') > 20_000_000)
    const wageCents = sumExactCents(
      this.f1040.validW2s().map((w2) => w2.medicareIncome),
      'W-2 box 5'
    )
    const positiveSE = Math.max(0, this.l8() ?? 0)
    const tips = (this.l2() ?? 0) + (this.l3() ?? 0)
    const exceedsThreshold =
      BigInt(wageCents) +
        BigInt(toExactCents(positiveSE + tips, 'Form 8959 income')) >
      BigInt(this.thresholdFromFilingStatus()) * BigInt(100)
    return (
      individualTrigger ||
      exceedsThreshold ||
      (this.l14() ?? 0) > 0 ||
      this.hasCreditableWithholding()
    )
  }

  hasCreditableWithholding = (): boolean => {
    if ((this.l23() ?? 0) > 0) return true
    // Establish an excess from source cents before testing rounded form lines.
    // Two ordinary payroll amounts can straddle different whole-dollar rounding
    // boundaries. Their apparent $1 line-22 residual is not evidence that the
    // employer withheld Additional Medicare Tax (i8959, Purpose/Who Must File).
    const w2s = this.f1040.validW2s()
    const withheld = BigInt(
      sumExactCents(
        w2s.map((w) => w.medicareWithholding),
        'W-2 box 6'
      )
    )
    const ordinary = w2s.reduce(
      (sum, w) =>
        sum +
        (BigInt(toExactCents(w.medicareIncome, 'W-2 box 5')) * BigInt(145) +
          BigInt(5000)) /
          BigInt(10000),
      BigInt(0)
    )
    return withheld > ordinary && this.l24() > 0
  }

  thresholdFromFilingStatus = (): number =>
    fica.additionalMedicareTaxThreshold(this.f1040.info.taxPayer.filingStatus)

  computeAdditionalMedicareTax = (compensation: number): number =>
    rateToWholeDollars(
      compensation,
      9,
      1000,
      'Form 8959 Additional Medicare Tax'
    )

  // Part I: Additional Medicare Tax on Medicare Wages
  l1 = (): number =>
    sumToWholeDollars(
      this.f1040.validW2s().map((w2) => w2.medicareIncome),
      'Form 8959 line 1'
    )

  l2 = (): number | undefined => roundOptionalLine(this.f1040.f4137?.l6())
  l3 = (): number | undefined =>
    roundOptionalLine(this.f1040.f8919?.totalWages())
  l4 = (): number => sumFields([this.l1(), this.l2(), this.l3()])

  l5 = (): number => this.thresholdFromFilingStatus()
  l6 = (): number => Math.max(0, this.l4() - this.l5())

  l7 = (): number | undefined => this.computeAdditionalMedicareTax(this.l6())

  // Part II: Additional Medicare Tax on Self-Employment Income
  l8 = (): number | undefined => roundOptionalLine(this.f1040.scheduleSE.l6())
  l9 = (): number => this.thresholdFromFilingStatus()
  l10 = (): number => this.l4()
  l11 = (): number => Math.max(0, this.l9() - this.l10())

  l12 = (): number => Math.max(0, (this.l8() ?? 0) - this.l11())

  l13 = (): number | undefined => this.computeAdditionalMedicareTax(this.l12())

  // Part III: Additional Medicare Tax on Railroad Retirement Tax Act
  // (RRTA) Compensation
  // RRTA (Railroad Retirement Tax Act) Tier 1 compensation
  l14 = (): number | undefined =>
    roundOptionalLine(this.f1040.info.rrtaCompensation)
  l15 = (): number => this.thresholdFromFilingStatus()
  l16 = (): number => Math.max(0, (this.l14() ?? 0) - this.l15())

  l17 = (): number => this.computeAdditionalMedicareTax(this.l16())

  // Part IV: Total Medicare Tax
  l18 = (): number => sumFields([this.l7(), this.l13(), this.l17()])

  // Part V: Withholding Reconciliation
  l19 = (): number =>
    sumToWholeDollars(
      this.f1040.validW2s().map((w2) => w2.medicareWithholding),
      'W-2 Medicare tax withheld'
    )

  l20 = (): number => this.l1()
  // Line 21 is a printed line. Use the same whole-dollar policy as line 19;
  // subtracting a rounded withholding from an unrounded tax creates fake credit.
  l21 = (): number =>
    rateToWholeDollars(this.l20(), 145, 10000, 'Form 8959 line 21')
  l22 = (): number => Math.max(0, this.l19() - this.l21())

  // Legacy rrtaTax must represent ADDITIONAL Medicare withholding only.
  // Admission rejects RRTA until per-document box 14 facts are supported.
  l23 = (): number | undefined => roundLine(this.f1040.info.rrtaTax ?? 0)
  l24 = (): number => sumFields([this.l22(), this.l23()])

  toSchedule2l11 = (): number => this.l18()
  to1040l25c = (): number => this.l24()

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    this.l5(),
    this.l6(),
    this.l7(),

    this.l8(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    this.l14(),

    this.l15(),
    this.l16(),
    this.l17(),

    this.l18(),

    this.l19(),
    this.l20(),
    this.l21(),
    this.l22(),
    this.l23(),
    this.l24()
  ]
}
