import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form7206Data } from 'ustaxes/core/data'
import { TaxFormInputError } from './formInput'
import F1040 from './F1040'

/**
 * Form 7206 — Self-Employed Health Insurance Deduction (TY2025), one per
 * trade or business under which the plan is established. Line 14 goes to
 * Schedule 1 line 17. Lines 11–12 (S corporation wages, Form 2555) are not
 * carried: those inputs are not part of this data model.
 */
export default class F7206 extends F1040Attachment {
  tag: FormTag = 'f7206'
  sequenceIndex = 206

  readonly data: Form7206Data

  constructor(f1040: F1040, data: Form7206Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.l3() > 0

  business = () => {
    const list = this.f1040.scheduleCList
    if (this.data.scheduleCIndex < 0 || this.data.scheduleCIndex >= list.length)
      throw new TaxFormInputError(
        'invalid_input',
        '/information/form7206s/scheduleCIndex',
        'Form 7206 names a Schedule C business that is not in the return'
      )
    return list[this.data.scheduleCIndex]
  }

  l1 = (): number => this.data.healthInsurancePremiums
  l2 = (): number => this.data.longTermCarePremiums
  l3 = (): number => this.l1() + this.l2()
  /** Line 4: net profit of the business the plan is under (regular method). */
  l4 = (): number => Math.max(0, this.business().netProfitOrLoss())
  /** Line 5: total net profits of every business with a profit (no losses). */
  l5 = (): number =>
    this.f1040.scheduleCList.reduce(
      (sum, c) => sum + Math.max(0, c.netProfitOrLoss()),
      0
    ) + Math.max(0, this.f1040.scheduleFNetProfit())
  /** Line 6: line 4 over line 5, to five decimals as the form prints it. */
  l6 = (): number => {
    const l5 = this.l5()
    if (l5 <= 0) return 0
    return Math.round((this.l4() / l5) * 100000) / 100000
  }
  /** Line 7: the deductible half of SE tax (Schedule 1 line 15) times line 6, whole dollars. */
  l7 = (): number => Math.round((this.f1040.schedule1.l15() ?? 0) * this.l6())
  l8 = (): number => Math.max(0, this.l4() - this.l7())
  /** Line 9: SEP/SIMPLE/qualified plans attributable to the business; the scalar times line 6. */
  l9 = (): number => Math.round((this.f1040.schedule1.l16() ?? 0) * this.l6())
  l10 = (): number => Math.max(0, this.l8() - this.l9())
  l11 = (): number | undefined => undefined
  l12 = (): number | undefined => undefined
  l13 = (): number => this.l10()
  /** Line 14: the deduction, the smaller of lines 3 and 13. */
  l14 = (): number => Math.min(this.l3(), this.l13())

  namedFields = (): Record<string, Field> => {
    const money = (v: number | undefined): Field =>
      v === undefined || v === 0 ? undefined : v
    return {
      f1_1: this.f1040.namesString(),
      f1_2: this.f1040.info.taxPayer.primaryPerson.ssid,
      f1_3: money(this.l1()),
      f1_4: money(this.l2()),
      f1_5: this.l3(),
      f1_6: this.l4(),
      f1_7: this.l5(),
      f1_8: this.l6().toFixed(5),
      f1_9: this.l7(),
      f1_10: this.l8(),
      f1_11: money(this.l9()),
      f1_12: this.l10(),
      f1_13: money(this.l11()),
      f1_14: money(this.l12()),
      f1_15: this.l13(),
      f1_16: this.l14()
    }
  }

  fields = (): Field[] => Object.values(this.namedFields())
}
