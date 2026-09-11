import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'
import { fica, seOptionalMethod } from '../data/federal'
import { TaxFormInputError } from './formInput'

export default class ScheduleSE extends F1040Attachment {
  tag: FormTag = 'f1040sse'
  sequenceIndex = 14

  isNeeded = (): boolean =>
    this.f1040.info.scheduleK1Form1065s
      // Box 14 A is net SE earnings. B/C are gross amounts for optional
      // methods (Part II), not additional profit under the regular method.
      .map((k1) => k1.selfEmploymentEarningsA)
      .reduce((a, b) => a + b, 0) > 0 ||
    this.f1040.scheduleCSelfEmploymentProfit() !== 0 ||
    this.f1040.scheduleFNetProfit() !== 0 ||
    this.farmOptionalMethod()

  /**
   * Part II farm optional method (lines 14–15), when elected. The form allows
   * it only when gross farm income is at or below the limit or net farm
   * profit is below its limit; an election outside those bounds is refused,
   * not silently ignored.
   */
  farmOptionalMethod = (): boolean => {
    if (!(this.f1040.info.scheduleSEOptions?.farmOptionalMethod ?? false))
      return false
    const gross = this.f1040.scheduleFGrossIncome()
    const net = this.f1040.scheduleFNetProfit()
    if (
      gross > seOptionalMethod.farmGrossIncomeLimit &&
      net >= seOptionalMethod.farmNetProfitLimit
    )
      throw new TaxFormInputError(
        'invalid_input',
        '/information/scheduleSEOptions/farmOptionalMethod',
        `The farm optional method needs gross farm income of at most ${seOptionalMethod.farmGrossIncomeLimit} or net farm profit below ${seOptionalMethod.farmNetProfitLimit}`
      )
    return true
  }

  postL4Field = (f: () => number | undefined): number | undefined => {
    if (this.l4c() < 400) {
      return undefined
    }
    return f()
  }

  l8aRelatedField = (f: () => number | undefined): number | undefined => {
    return this.postL4Field(() => {
      if ((this.l8a() ?? 0) >= fica.maxIncomeSSTaxApplies) {
        return undefined
      }
      return f()
    })
  }

  /** Skipped (blank) when the farm optional method is used, as the form says. */
  l1a = (): number | undefined =>
    this.farmOptionalMethod() ? undefined : this.f1040.scheduleFNetProfit()

  l1b = (): number => 0

  l2 = (): number => {
    const schCL31 = this.f1040.scheduleCSelfEmploymentProfit()
    const k1SEA = this.f1040.info.scheduleK1Form1065s.reduce(
      (c, k1) => c + k1.selfEmploymentEarningsA,
      0
    )
    // Same regular-method source as upstream: code A, without adding C again.
    return schCL31 + k1SEA
  }

  l3 = (): number => sumFields([this.l1a(), this.l1b(), this.l2()])

  // TODO: Handle line 4A being less than 400 due to the Conservation Reserve Program
  /** Whole dollars: each "multiply by" line of the form is a line boundary. */
  l4a = (): number => {
    const l3 = this.l3()
    if (l3 > 0) {
      return Math.round(l3 * 0.9235)
    }
    return l3
  }

  /** Line 4b: the optional-method amounts (line 15; the nonfarm method is not implemented). */
  l4b = (): number | undefined => this.l15()

  l4c = (): number => sumFields([this.l4a(), this.l4b()])

  l5a = (): number | undefined => this.postL4Field(() => 0)
  l5b = (): number | undefined =>
    this.postL4Field(() => {
      const l5a = this.l5a()
      if (l5a === undefined) {
        return undefined
      }
      return Math.round(l5a * 0.9235)
    })

  l6 = (): number | undefined =>
    this.postL4Field((): number => sumFields([this.l4c(), this.l5b()]))

  l7 = (): number => fica.maxIncomeSSTaxApplies

  l8a = (): number | undefined =>
    this.postL4Field((): number =>
      this.f1040.validW2s().reduce((c, w2) => c + w2.ssWages, 0)
    )

  // Line 8b: Unreported tips subject to social security tax (from Form 4137, line 10)
  l8b = (): number | undefined =>
    this.l8aRelatedField(
      (): number | undefined => this.f1040.f4137?.l10() ?? undefined
    )
  // Line 8c: Wages subject to social security tax (from Form 8919, line 10)
  l8c = (): number | undefined =>
    this.l8aRelatedField(
      (): number | undefined => this.f1040.f8919?.l10() ?? undefined
    )
  l8d = (): number | undefined =>
    this.l8aRelatedField((): number =>
      sumFields([this.l8a(), this.l8b(), this.l8c()])
    )

  l9 = (): number | undefined =>
    this.l8aRelatedField((): number =>
      Math.max(0, this.l7() - (this.l8d() ?? 0))
    )

  l10 = (): number | undefined =>
    this.l8aRelatedField((): number =>
      Math.round(Math.min(this.l6() ?? 0, this.l9() ?? 0) * 0.124)
    )

  l11 = (): number | undefined =>
    this.postL4Field((): number => Math.round((this.l6() ?? 0) * 0.029))

  l12 = (): number | undefined =>
    this.postL4Field((): number => sumFields([this.l10(), this.l11()]))

  l13 = (): number | undefined =>
    this.postL4Field((): number => Math.round((this.l12() ?? 0) * 0.5))

  // --- Part II: Optional methods ---

  /** Line 14: maximum income for the optional methods. */
  l14 = (): number | undefined =>
    this.farmOptionalMethod() ? seOptionalMethod.maxNetEarnings : undefined

  /**
   * Line 15: the smaller of two-thirds of gross farm income (not less than
   * zero) or line 14, in whole dollars — the line is a form boundary.
   */
  l15 = (): number | undefined => {
    if (!this.farmOptionalMethod()) return undefined
    const twoThirds = Math.round(
      Math.max(0, this.f1040.scheduleFGrossIncome()) * (2 / 3)
    )
    return Math.min(twoThirds, seOptionalMethod.maxNetEarnings)
  }

  /** Lines 16–17: the nonfarm optional method is not implemented. */
  l16 = (): number | undefined => undefined
  l17 = (): number | undefined => undefined

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    false, // Minister
    this.l1a(),
    this.l1b(),
    this.l2(),
    this.l3(),
    this.l4a(),
    this.l4b(),
    this.l4c(),
    this.l5a(),
    this.l5b(),
    this.l6(),
    this.l7(),
    this.l8a(),
    this.l8b(),
    this.l8c(),
    this.l8d(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    // 2025: page 2, Part II optional methods
    this.l14(), // [23] f2_1
    this.l15(), // [24] f2_2
    this.l16(), // [25] f2_3
    this.l17() // [26] f2_4
  ]
}
