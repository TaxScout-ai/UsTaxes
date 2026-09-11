import F1040Attachment from './F1040Attachment'
import F8911ScheduleA from './F8911ScheduleA'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8911Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { TaxFormInputError } from './formInput'
import F1040 from './F1040'

/**
 * Form 8911 (Rev. December 2025) — Alternative Fuel Vehicle Refueling
 * Property Credit. Part II limits the personal use part of the credit to the
 * net regular tax over the tentative minimum tax (Form 6251 line 9), and the
 * result is Schedule 3 line 6j. Part I (business/investment use) is a
 * general business credit and is not carried; see Schedule A.
 */
export default class F8911 extends F1040Attachment {
  tag: FormTag = 'f8911'
  sequenceIndex = 151

  readonly schedules: F8911ScheduleA[]

  constructor(f1040: F1040, data: Form8911Data) {
    super(f1040)
    if (data.properties.length === 0)
      throw new TaxFormInputError(
        'needs_facts',
        '/information/form8911/properties',
        'Form 8911 needs at least one refueling property on Schedule A'
      )
    this.schedules = data.properties.map(
      (p, i) => new F8911ScheduleA(f1040, p, i)
    )
  }

  isNeeded = (): boolean => this.l3() > 0 || this.l4() > 0

  /** Item A: the number of properties, one Schedule A each. */
  lA = (): number => this.schedules.length

  // Part I — business/investment use (always zero here; Schedule A refuses a business fraction)
  l1 = (): number => sumFields(this.schedules.map((s) => s.businessCredit()))
  l2 = (): number | undefined => undefined
  l3 = (): number => this.l1() + (this.l2() ?? 0)

  // Part II — personal use
  l4 = (): number => sumFields(this.schedules.map((s) => s.personalCredit()))
  /** Line 5: Form 1040 line 16 plus Schedule 2 line 1z. */
  l5 = (): number => (this.f1040.l16() ?? 0) + this.f1040.schedule2.l1z()
  l6a = (): number | undefined => this.f1040.schedule3.l1()
  /**
   * Line 6b: the other credits that reduce regular tax first — Form 1040 line
   * 19 and Schedule 3 lines 2 through 5 and 7, the latter without the general
   * business credit (6a), the prior-year minimum tax credit (6b), the tax
   * credit bond credit (6k) and this credit (6j).
   */
  l6b = (): number => {
    const s3 = this.f1040.schedule3
    return sumFields([
      this.f1040.l19(),
      s3.l2(),
      s3.l3(),
      s3.l4(),
      s3.l5a(),
      s3.l5b(),
      s3.l6c(),
      s3.l6d(),
      s3.l6e(),
      s3.l6f(),
      s3.l6g(),
      s3.l6h(),
      s3.l6i(),
      s3.l6l(),
      s3.l6m(),
      s3.l6z()
    ])
  }
  l6c = (): number => (this.l6a() ?? 0) + this.l6b()
  /** Line 7: net regular tax. */
  l7 = (): number => Math.max(0, this.l5() - this.l6c())
  /** Line 8: tentative minimum tax, Form 6251 line 9. */
  l8 = (): number => this.f1040.f6251.l9()
  l9 = (): number => Math.max(0, this.l7() - this.l8())
  /** Line 10: the personal use part of the credit allowed, for Schedule 3 line 6j. */
  l10 = (): number => Math.min(this.l4(), this.l9())

  namedFields = (): Record<string, Field> => {
    const money = (v: number | undefined): Field =>
      v === undefined || v === 0 ? undefined : v
    return {
      f1_01: this.f1040.namesString(),
      f1_02: this.f1040.info.taxPayer.primaryPerson.ssid,
      f1_03: this.lA(),
      f1_04: money(this.l1()),
      f1_05: money(this.l2()),
      f1_06: money(this.l3()),
      f1_07: this.l4(),
      f1_08: this.l5(),
      f1_09: money(this.l6a()),
      f1_10: money(this.l6b()),
      f1_11: money(this.l6c()),
      f1_12: this.l7(),
      f1_13: this.l8(),
      f1_14: this.l9(),
      f1_15: this.l10()
    }
  }

  fields = (): Field[] => Object.values(this.namedFields())
}
