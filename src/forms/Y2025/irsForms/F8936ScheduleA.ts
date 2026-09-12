import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Form8936VehicleData } from 'ustaxes/core/data'
import { TaxFormInputError, nonnegativeMoney } from './formInput'
import { roundLine } from './rounding'
import F1040 from './F1040'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Form 8936 Part I chart: the modified AGI limits for the Part II/III credit. */
export const F8936_NEW_VEHICLE_MAGI_LIMIT: Record<FilingStatus, number> = {
  [FilingStatus.S]: 150000,
  [FilingStatus.MFS]: 150000,
  [FilingStatus.HOH]: 225000,
  [FilingStatus.MFJ]: 300000,
  [FilingStatus.W]: 300000
}

/**
 * Schedule A (Form 8936) 2025 — one per clean vehicle. Only a new clean
 * vehicle whose credit was not transferred to the dealer is carried: Part
 * II figures the business/investment use part (to Form 8936 line 6 and Form
 * 3800 line 1y) and Part III the personal use part (to Form 8936 line 9).
 */
export default class F8936ScheduleA extends F1040Attachment {
  tag: FormTag = 'f8936sa'
  sequenceIndex = 69.1

  readonly data: Form8936VehicleData
  readonly path: string

  constructor(f1040: F1040, data: Form8936VehicleData, index: number) {
    super(f1040)
    this.data = data
    this.path = `/information/form8936/vehicles/${index}`
    if (
      typeof data.placedInServiceDate !== 'string' ||
      !ISO_DATE.test(data.placedInServiceDate)
    )
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/placedInServiceDate`,
        'Expected a date as YYYY-MM-DD'
      )
    if (!data.placedInServiceDate.startsWith('2025-'))
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/placedInServiceDate`,
        'Schedule A (Form 8936) covers a vehicle placed in service during the tax year'
      )
    if (typeof data.vin !== 'string' || data.vin.length !== 17)
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/vin`,
        'A vehicle identification number has 17 characters'
      )
    if (data.transferredToDealer)
      throw new TaxFormInputError(
        'unsupported',
        `${this.path}/transferredToDealer`,
        'A credit transferred to the dealer at the time of sale is not carried'
      )
    if (data.kind !== 'new')
      throw new TaxFormInputError(
        'unsupported',
        `${this.path}/kind`,
        'Only a new clean vehicle (Parts II and III) is carried'
      )
    if (data.resoldWithin30Days)
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/resoldWithin30Days`,
        'A vehicle resold within 30 days earns no credit; omit it'
      )
    if (!data.acquiredForUseNotResale)
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/acquiredForUseNotResale`,
        'A vehicle not acquired for use earns no credit; omit it'
      )
    nonnegativeMoney(data.tentativeCredit, `${this.path}/tentativeCredit`)
    if (data.tentativeCredit <= 0)
      throw new TaxFormInputError(
        'needs_facts',
        `${this.path}/tentativeCredit`,
        "Line 9 needs the tentative credit amount from the seller's report"
      )
    if (
      typeof data.businessUseFraction !== 'number' ||
      data.businessUseFraction < 0 ||
      data.businessUseFraction > 1
    )
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/businessUseFraction`,
        'Business/investment use is a fraction between 0 and 1'
      )
  }

  isNeeded = (): boolean => true

  // Part I
  l1a = (): number => this.data.year
  l1b = (): string => this.data.make
  l1c = (): string => this.data.model
  l2 = (): string => this.data.vin
  l3 = (): string => this.data.placedInServiceDate
  l4a = (): boolean => false
  l5 = (): boolean => true

  // Part II
  l8a = (): boolean => false
  /** Line 8b: filed with an individual income tax return. */
  l8b = (): boolean => true
  /** Line 8c: this year's modified AGI (Form 8936 line 2) is over the limit. */
  l8c = (): boolean =>
    this.f1040.f8936 !== undefined &&
    this.f1040.f8936.l2() >
      F8936_NEW_VEHICLE_MAGI_LIMIT[this.f1040.info.taxPayer.filingStatus]
  /** Line 8d: answered only after a "Yes" on 8c — last year's modified AGI over its limit. */
  l8d = (): boolean | undefined =>
    !this.l8c() || this.f1040.f8936 === undefined
      ? undefined
      : this.f1040.f8936.l4() >
        F8936_NEW_VEHICLE_MAGI_LIMIT[
          this.f1040.f8936.data.priorYearFilingStatus
        ]
  l8e = (): boolean => true
  /** No credit when both years exceed the modified AGI limit. */
  allowed = (): boolean => this.l8d() !== true
  l9 = (): number | undefined =>
    this.allowed() ? this.data.tentativeCredit : undefined
  l10 = (): number | undefined =>
    this.allowed() ? this.data.businessUseFraction : undefined
  /** Line 11: the business/investment use part, to Form 8936 line 6. */
  l11 = (): number | undefined => {
    const l9 = this.l9()
    const l10 = this.l10()
    return l9 === undefined || l10 === undefined
      ? undefined
      : roundLine(l9 * l10)
  }
  businessCredit = (): number => this.l11() ?? 0

  // Part III
  /** Line 12: the personal use part when the vehicle is not used wholly for business, to Form 8936 line 9. */
  l12 = (): number | undefined => {
    const l9 = this.l9()
    const l11 = this.l11()
    if (l9 === undefined || l11 === undefined || this.l10() === 1)
      return undefined
    return l9 - l11
  }
  personalCredit = (): number => this.l12() ?? 0

  namedFields = (): Record<string, Field> => {
    const date = (iso: string): string => {
      const [y, m, d] = iso.split('-')
      return `${m}/${d}/${y}`
    }
    const l8c = this.l8c()
    const l8d = this.l8d()
    const l10 = this.l10()
    return {
      f1_1: this.f1040.namesString(),
      f1_2: this.f1040.info.taxPayer.primaryPerson.ssid,
      f1_3: String(this.l1a()),
      f1_4: this.l1b(),
      f1_5: this.l1c(),
      f1_6: this.l2(),
      f1_7: date(this.l3()),
      'c1_1[1]': true,
      'c1_3[0]': true,
      'c1_6[1]': true,
      'c1_7[0]': true,
      'c1_8[0]': l8c,
      'c1_8[1]': !l8c,
      'c1_9[0]': l8d === true,
      'c1_9[1]': l8d === false,
      'c2_1[0]': this.allowed(),
      f2_1: this.l9(),
      f2_2: l10 === undefined ? undefined : String(roundLine(l10 * 100)),
      f2_3: this.l11(),
      f2_4: this.l12()
    }
  }

  fields = (): Field[] => Object.values(this.namedFields())
}
