import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8911PropertyData } from 'ustaxes/core/data'
import { TaxFormInputError, nonnegativeMoney } from './formInput'
import { rateToWholeDollars } from './rounding'
import F1040 from './F1040'

/** Line 15: the cap on the business/investment use part of the credit. */
export const F8911_MAX_BUSINESS_CREDIT = 100000
/** Line 20: the cap on the personal use part of the credit. */
export const F8911_MAX_PERSONAL_CREDIT = 1000

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Schedule A (Form 8911), Rev. December 2025 — one per qualified alternative
 * fuel vehicle refueling property. Only the personal use part (Part III) is
 * carried: business/investment use (Part II) would flow to Form 3800, which
 * this return cannot produce, so a business fraction is refused rather than
 * silently dropped.
 */
export default class F8911ScheduleA extends F1040Attachment {
  tag: FormTag = 'f8911sa'
  sequenceIndex = 151.1

  readonly data: Form8911PropertyData
  readonly path: string

  constructor(f1040: F1040, data: Form8911PropertyData, index: number) {
    super(f1040)
    this.data = data
    this.path = `/information/form8911/properties/${index}`
    nonnegativeMoney(data.cost, `${this.path}/cost`)
    if (data.cost <= 0)
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/cost`,
        'A refueling property without a cost earns no credit; omit it'
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
    if (data.businessUseFraction > 0)
      throw new TaxFormInputError(
        'unsupported',
        `${this.path}/businessUseFraction`,
        'Business/investment use of refueling property is a general business credit on Form 3800, which this return cannot carry'
      )
    if (!data.eligibleCensusTract)
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/eligibleCensusTract`,
        'Refueling property outside an eligible census tract does not qualify; omit it'
      )
    if (!/^\d{11}$/.test(data.censusTractGeoid ?? ''))
      throw new TaxFormInputError(
        'needs_facts',
        `${this.path}/censusTractGeoid`,
        'An eligible census tract needs its 11-digit GEOID'
      )
    for (const key of ['constructionStartDate', 'placedInServiceDate'] as const)
      if (!ISO_DATE.test(data[key]))
        throw new TaxFormInputError(
          'invalid_input',
          `${this.path}/${key}`,
          'Dates are YYYY-MM-DD'
        )
    if (!data.placedInServiceDate.startsWith('2025-'))
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/placedInServiceDate`,
        'The credit is for property placed in service during the tax year'
      )
    if (data.placedInServiceDate < data.constructionStartDate)
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/placedInServiceDate`,
        'Property is placed in service on or after the day construction began'
      )
  }

  isNeeded = (): boolean => true

  l1 = (): string | undefined => undefined
  l2a = (): string => this.data.description
  l3a = (): string => {
    const a = this.data.location
    const street = a.aptNo ? `${a.address} ${a.aptNo}` : a.address
    const region = [a.state, a.zip].filter((x) => x).join(' ')
    return `${street}, ${a.city} ${region}`.trim()
  }
  l4 = (): string => this.data.constructionStartDate
  l5 = (): string => this.data.placedInServiceDate
  l6a = (): boolean => this.data.eligibleCensusTract
  l6b = (): string | undefined => this.data.censusTractGeoid
  l7 = (): string | undefined => this.data.certificationOrPermitNumber

  // Part II — business/investment use
  l8 = (): number => this.data.cost
  /** Line 9 as a fraction of one; the form prints a percentage. */
  l9 = (): number => this.data.businessUseFraction
  l10 = (): number =>
    this.l9() === 0
      ? 0
      : rateToWholeDollars(
          this.l8(),
          Math.round(this.l9() * 100000),
          100000,
          'Schedule A (Form 8911) line 10'
        )
  // Lines 11–16 stay blank when line 10 is zero (the form says skip them).
  l11 = (): number | undefined => (this.l10() === 0 ? undefined : 0)
  l12 = (): number | undefined =>
    this.l10() === 0 ? undefined : this.l10() - (this.l11() ?? 0)
  l13 = (): boolean | undefined => undefined
  l14 = (): number | undefined => {
    const l12 = this.l12()
    if (l12 === undefined) return undefined
    return rateToWholeDollars(
      l12,
      this.l13() ? 30 : 6,
      100,
      'Schedule A (Form 8911) line 14'
    )
  }
  l15 = (): number => F8911_MAX_BUSINESS_CREDIT
  l16 = (): number | undefined => {
    const l14 = this.l14()
    return l14 === undefined ? undefined : Math.min(l14, this.l15())
  }

  // Part III — personal use
  l17 = (): boolean => this.data.installedAtMainHome
  l18 = (): number | undefined =>
    this.l17() ? this.l8() - this.l10() : undefined
  l19 = (): number | undefined => {
    const l18 = this.l18()
    return l18 === undefined
      ? undefined
      : rateToWholeDollars(l18, 30, 100, 'Schedule A (Form 8911) line 19')
  }
  l20 = (): number => F8911_MAX_PERSONAL_CREDIT
  l21 = (): number | undefined => {
    const l19 = this.l19()
    return l19 === undefined ? undefined : Math.min(l19, this.l20())
  }

  /** The business/investment use part of the credit for Form 8911 line 1. */
  businessCredit = (): number => this.l16() ?? 0
  /** The personal use part of the credit for Form 8911 line 4. */
  personalCredit = (): number => this.l21() ?? 0

  namedFields = (): Record<string, Field> => {
    const money = (v: number | undefined): Field =>
      v === undefined || v === 0 ? undefined : v
    const date = (iso: string): string => {
      const [y, m, d] = iso.split('-')
      return `${m}/${d}/${y}`
    }
    return {
      f1_01: this.f1040.namesString(),
      f1_02: this.f1040.info.taxPayer.primaryPerson.ssid,
      f1_03: this.l1(),
      f1_04: this.l2a(),
      f1_07: this.l3a(),
      f1_14: date(this.l4()),
      f1_15: date(this.l5()),
      'c1_1[0]': this.l6a(),
      'c1_1[1]': !this.l6a(),
      f1_16: this.l6b(),
      f1_17: this.l7(),
      f1_18: this.l8(),
      f1_19: this.l9() === 0 ? undefined : (this.l9() * 100).toFixed(2),
      f1_20: money(this.l10()),
      f1_21: money(this.l11()),
      f1_22: money(this.l12()),
      'c1_2[0]': this.l13() === true,
      'c1_2[1]': this.l13() === false,
      f1_23: money(this.l14()),
      f1_25: money(this.l16()),
      'c1_3[0]': this.l17(),
      'c1_3[1]': !this.l17(),
      f1_26: this.l18(),
      f1_27: this.l19(),
      f1_29: this.l21()
    }
  }

  fields = (): Field[] => Object.values(this.namedFields())
}
