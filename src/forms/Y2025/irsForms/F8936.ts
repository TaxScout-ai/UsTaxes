import F1040Attachment from './F1040Attachment'
import F8936ScheduleA from './F8936ScheduleA'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Form8936Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { TaxFormInputError, nonnegativeMoney } from './formInput'
import F1040 from './F1040'

/** Line 5: the prior-year filing status as the form's chart abbreviates it. */
const FILING_STATUS_CODE: Record<FilingStatus, string> = {
  [FilingStatus.S]: 'S',
  [FilingStatus.MFS]: 'MFS',
  [FilingStatus.HOH]: 'HOH',
  [FilingStatus.MFJ]: 'MFJ',
  [FilingStatus.W]: 'QSS'
}

/**
 * Form 8936 (2025) — Clean Vehicle Credits, with a Schedule A per vehicle.
 * Part I states the modified AGI for both years; Part II sums the
 * business/investment use parts (to Form 3800, Part III, line 1y); Part III
 * limits the personal use part to the tax after the other personal credits
 * (to Schedule 3 line 6f). Parts IV and V are not carried.
 */
export default class F8936 extends F1040Attachment {
  tag: FormTag = 'f8936'
  sequenceIndex = 69

  readonly data: Form8936Data
  readonly schedules: F8936ScheduleA[]
  readonly path = '/information/form8936'

  constructor(f1040: F1040, data: Form8936Data) {
    super(f1040)
    this.data = data
    if (!Array.isArray(data.vehicles) || data.vehicles.length === 0)
      throw new TaxFormInputError(
        'needs_facts',
        `${this.path}/vehicles`,
        'Form 8936 needs at least one vehicle on Schedule A'
      )
    nonnegativeMoney(data.priorYearAgi, `${this.path}/priorYearAgi`)
    if (!(data.priorYearFilingStatus in FILING_STATUS_CODE))
      throw new TaxFormInputError(
        'needs_facts',
        `${this.path}/priorYearFilingStatus`,
        'Form 8936 line 5 needs the prior-year filing status'
      )
    if (data.creditFromPassThroughs !== undefined)
      nonnegativeMoney(
        data.creditFromPassThroughs,
        `${this.path}/creditFromPassThroughs`
      )
    this.schedules = data.vehicles.map(
      (v, i) => new F8936ScheduleA(f1040, v, i)
    )
  }

  isNeeded = (): boolean => this.l8() > 0 || this.l9() > 0

  // Part I — modified AGI
  l1a = (): number => this.f1040.l11()
  l1b = (): number | undefined => undefined
  l1c = (): number | undefined => undefined
  l1d = (): number | undefined => undefined
  l1e = (): number | undefined => undefined
  l2 = (): number =>
    sumFields([this.l1a(), this.l1b(), this.l1c(), this.l1d(), this.l1e()])
  l3a = (): number => this.data.priorYearAgi
  l3b = (): number | undefined => undefined
  l3c = (): number | undefined => undefined
  l3d = (): number | undefined => undefined
  l3e = (): number | undefined => undefined
  l4 = (): number =>
    sumFields([this.l3a(), this.l3b(), this.l3c(), this.l3d(), this.l3e()])
  l5 = (): string => FILING_STATUS_CODE[this.data.priorYearFilingStatus]

  // Part II — business/investment use
  l6 = (): number => sumFields(this.schedules.map((s) => s.businessCredit()))
  l7 = (): number | undefined => this.data.creditFromPassThroughs
  /** Line 8: to Form 3800, Part III, line 1y. */
  l8 = (): number => this.l6() + (this.l7() ?? 0)

  // Part III — personal use
  l9 = (): number => sumFields(this.schedules.map((s) => s.personalCredit()))
  l10 = (): number | undefined => (this.l9() > 0 ? this.f1040.l18() : undefined)
  /** Line 11: Schedule 3 lines 1 through 4, 5b, 6d, 6l and 6m. */
  l11 = (): number | undefined => {
    if (this.l9() === 0) return undefined
    const s3 = this.f1040.schedule3
    return sumFields([
      s3.l1(),
      s3.l2(),
      s3.l3(),
      s3.l4(),
      s3.l5b(),
      s3.l6d(),
      s3.l6l(),
      s3.l6m()
    ])
  }
  l12 = (): number | undefined =>
    this.l9() === 0
      ? undefined
      : Math.max(0, (this.l10() ?? 0) - (this.l11() ?? 0))
  /** Line 13: the personal use part allowed, to Schedule 3 line 6f. */
  l13 = (): number | undefined =>
    this.l9() === 0 ? undefined : Math.min(this.l9(), this.l12() ?? 0)

  namedFields = (): Record<string, Field> => {
    const money = (v: number | undefined): Field =>
      v === undefined || v === 0 ? undefined : v
    return {
      f1_1: this.f1040.namesString(),
      f1_2: this.f1040.info.taxPayer.primaryPerson.ssid,
      f1_3: this.l1a(),
      f1_8: this.l2(),
      f1_9: this.l3a(),
      f1_14: this.l4(),
      f1_15: this.l5(),
      f1_16: money(this.l6()),
      f1_17: money(this.l7()),
      f1_18: money(this.l8()),
      f1_19: money(this.l9()),
      f1_20: this.l10(),
      f1_21: this.l11(),
      f1_22: this.l12(),
      f1_23: this.l13()
    }
  }

  fields = (): Field[] => Object.values(this.namedFields())
}
