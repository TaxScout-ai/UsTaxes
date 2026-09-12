import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8835Data, Form8835ElectricitySource } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { TaxFormInputError, nonnegativeMoney } from './formInput'
import { roundLine } from './rounding'
import F1040 from './F1040'

/** Part II line 1 column (b): the rates the 2025 form prints for a facility placed in service after 2021. */
export const F8835_RATES: Record<Form8835ElectricitySource, number> = {
  wind: 0.006,
  closedLoopBiomass: 0.006,
  geothermal: 0.006,
  solar: 0.006,
  offshoreWind: 0.006,
  openLoopBiomass: 0.003,
  landfillGas: 0.003,
  trash: 0.003,
  hydropower: 0.003,
  marineHydrokinetic: 0.003
}
/** Footnote **: hydropower and marine facilities placed in service after 2022. */
const HYDRO_AFTER_2022_RATE = 0.006
/** Line 9: a qualified facility (any "Yes" on line 8) earns five times the credit. */
export const F8835_QUALIFIED_FACILITY_MULTIPLIER = 5
/** Lines 10 and 11: the domestic content and energy community bonuses. */
const BONUS_RATE = 0.1
/** Line 5c: the tax-exempt bond reduction is capped at 15% of line 4. */
const BOND_REDUCTION_CAP = 0.15

export const F8835_SOURCES: Form8835ElectricitySource[] = [
  'wind',
  'closedLoopBiomass',
  'geothermal',
  'solar',
  'offshoreWind',
  'openLoopBiomass',
  'landfillGas',
  'trash',
  'hydropower',
  'marineHydrokinetic'
]

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Form 8835 (2025) — Renewable Electricity Production Credit. Part I is the
 * facility as stated; Part II figures the credit from kilowatt-hours at the
 * form's rates, the qualified-facility multiplier and the bonuses. Line 15
 * goes to Form 3800, Part III, line 1f: in column (f) when the credit was
 * bought under a transfer election, in column (e) otherwise.
 */
export default class F8835 extends F1040Attachment {
  tag: FormTag = 'f8835'
  sequenceIndex = 835

  readonly data: Form8835Data
  readonly path = '/information/form8835'

  constructor(f1040: F1040, data: Form8835Data) {
    super(f1040)
    this.data = data
    for (const [name, value] of [
      ['constructionStartDate', data.constructionStartDate],
      ['placedInServiceDate', data.placedInServiceDate]
    ] as const) {
      if (typeof value !== 'string' || !ISO_DATE.test(value))
        throw new TaxFormInputError(
          'invalid_input',
          `${this.path}/${name}`,
          'Expected a date as YYYY-MM-DD'
        )
    }
    if (data.placedInServiceDate < '2022-01-01')
      throw new TaxFormInputError(
        'unsupported',
        `${this.path}/placedInServiceDate`,
        'The rates for a facility placed in service before 2022 are not carried'
      )
    if (
      typeof data.facilityTypeDescription !== 'string' ||
      data.facilityTypeDescription.trim() === ''
    )
      throw new TaxFormInputError(
        'needs_facts',
        `${this.path}/facilityTypeDescription`,
        'Form 8835 line 2a names the type of facility'
      )
    const sources = F8835_SOURCES.filter(
      (s) => data.kilowattHoursSold[s] !== undefined
    )
    if (sources.length === 0)
      throw new TaxFormInputError(
        'needs_facts',
        `${this.path}/kilowattHoursSold`,
        'Form 8835 Part II needs the kilowatt-hours produced and sold'
      )
    for (const s of sources)
      nonnegativeMoney(
        data.kilowattHoursSold[s],
        `${this.path}/kilowattHoursSold/${s}`
      )
    if (data.phaseoutAdjustment !== undefined)
      nonnegativeMoney(
        data.phaseoutAdjustment,
        `${this.path}/phaseoutAdjustment`
      )
    if (data.creditFromPassThroughs !== undefined)
      nonnegativeMoney(
        data.creditFromPassThroughs,
        `${this.path}/creditFromPassThroughs`
      )
    if (
      data.taxExemptBondRatio !== undefined &&
      (typeof data.taxExemptBondRatio !== 'number' ||
        data.taxExemptBondRatio < 0 ||
        data.taxExemptBondRatio > 1)
    )
      throw new TaxFormInputError(
        'invalid_input',
        `${this.path}/taxExemptBondRatio`,
        'The tax-exempt bond ratio is a fraction between 0 and 1'
      )
  }

  isNeeded = (): boolean => this.l15() > 0

  /** The facility qualifies (line 8a, 8b or 8c) for the increased credit. */
  qualifiedFacility = (): boolean =>
    this.data.netOutputUnder1MW ||
    this.data.constructionBeganBefore2023Jan29 ||
    this.data.meetsWageAndApprenticeshipRequirements

  rate = (source: Form8835ElectricitySource): number =>
    (source === 'hydropower' || source === 'marineHydrokinetic') &&
    this.data.placedInServiceDate >= '2023-01-01'
      ? HYDRO_AFTER_2022_RATE
      : F8835_RATES[source]

  kilowattHours = (source: Form8835ElectricitySource): number | undefined =>
    this.data.kilowattHoursSold[source]

  /** Line 1 column (c): kilowatt-hours times the rate, in whole dollars. */
  l1c = (source: Form8835ElectricitySource): number | undefined => {
    const kwh = this.kilowattHours(source)
    return kwh === undefined ? undefined : roundLine(kwh * this.rate(source))
  }

  l2 = (): number => sumFields(F8835_SOURCES.map((s) => this.l1c(s)))
  l3 = (): number => this.data.phaseoutAdjustment ?? 0
  l4 = (): number => Math.max(0, this.l2() - this.l3())
  l5a = (): number | undefined => this.data.taxExemptBondRatio
  l5b = (): number | undefined =>
    this.l5a() === undefined
      ? undefined
      : roundLine(this.l4() * (this.l5a() ?? 0))
  l5c = (): number | undefined =>
    this.l5a() === undefined
      ? undefined
      : roundLine(this.l4() * BOND_REDUCTION_CAP)
  l5d = (): number => Math.min(this.l5b() ?? 0, this.l5c() ?? 0)
  l6 = (): number => this.l4() - this.l5d()
  // Lines 7a–7f apply to wind facilities placed in service before 2022, which are refused.
  l7a = (): number | undefined => undefined
  l7b = (): number => 0
  l7c = (): number | undefined => undefined
  l7d = (): number => 0
  l7e = (): number | undefined => undefined
  l7f = (): number => 0
  l7g = (): number => this.l7b() + this.l7d() + this.l7f()
  l8 = (): number => this.l6() - this.l7g()
  l9 = (): number =>
    this.qualifiedFacility()
      ? this.l8() * F8835_QUALIFIED_FACILITY_MULTIPLIER
      : this.l8()
  l10 = (): number =>
    this.data.domesticContentBonus ? roundLine(this.l9() * BONUS_RATE) : 0
  l11 = (): number =>
    this.data.energyCommunityBonus === 'yes'
      ? roundLine(this.l9() * BONUS_RATE)
      : 0
  l12 = (): number => this.l9() + this.l10() + this.l11()
  /** Line 13: no elective payment election is carried, so the 90% rule never applies. */
  l13 = (): number => this.l12()
  l14 = (): number | undefined => this.data.creditFromPassThroughs
  /** Line 15: to Form 3800, Part III, line 1f. */
  l15 = (): number => this.l13() + (this.l14() ?? 0)

  /** Form 3800 column (f): the credit was bought under a transfer election. */
  purchased = (): boolean => this.data.purchasedUnderTransferElection === true

  namedFields = (): Record<string, Field> => {
    const money = (v: number | undefined): Field =>
      v === undefined || v === 0 ? undefined : v
    const date = (iso: string): string => {
      const [y, m, d] = iso.split('-')
      return `${m}/${d}/${y}`
    }
    const comb = (
      value: string | undefined
    ): [string | undefined, string | undefined, string | undefined] => {
      if (value === undefined) return [undefined, undefined, undefined]
      const m = /^([+-])(\d+)\.(\d+)$/.exec(value)
      return m ? [m[1], m[2], m[3]] : [undefined, value, undefined]
    }
    const [latSign, latDeg, latDec] = comb(this.data.latitude)
    const [lonSign, lonDeg, lonDec] = comb(this.data.longitude)
    const d = this.data
    const owner = d.owner
    const address = d.facilityAddress
    const ac = d.nameplateCapacityAcKw
    const sourceRow: Partial<Record<Form8835ElectricitySource, number>> = {
      wind: 1,
      closedLoopBiomass: 4,
      geothermal: 7,
      solar: 10,
      offshoreWind: 13,
      openLoopBiomass: 16,
      landfillGas: 19,
      trash: 22,
      hydropower: 25,
      marineHydrokinetic: 28
    }
    const rows: Record<string, Field> = {}
    for (const s of F8835_SOURCES) {
      const kwh = this.kilowattHours(s)
      if (kwh === undefined) continue
      const base = sourceRow[s] ?? 0
      rows[`f2_${base}`] = kwh
      rows[`f2_${base + 2}`] = this.l1c(s)
    }
    return {
      f1_1: this.f1040.namesString(),
      f1_2: this.f1040.info.taxPayer.primaryPerson.ssid,
      f1_3: d.registrationNumber,
      f1_4: d.facilityTypeDescription,
      f1_6: owner?.businessName ?? owner?.personName,
      f1_7: owner?.tin,
      f1_8:
        address === undefined
          ? undefined
          : `${address.address}, ${address.city}, ${address.state ?? ''} ${
              address.zip ?? ''
            }`.trim(),
      f1_10: latSign,
      f1_11: latDeg,
      f1_12: latDec,
      f1_13: lonSign,
      f1_14: lonDeg,
      f1_15: lonDec,
      f1_16: date(d.constructionStartDate),
      f1_17: date(d.placedInServiceDate),
      'c1_1[0]': d.expansionOfBiomassFacility,
      'c1_1[1]': !d.expansionOfBiomassFacility,
      'c1_3[0]': d.netOutputUnder1MW,
      'c1_3[1]': d.constructionBeganBefore2023Jan29,
      'c1_3[2]': d.meetsWageAndApprenticeshipRequirements,
      'c1_3[3]': !this.qualifiedFacility(),
      'c1_4[0]': d.domesticContentBonus,
      'c1_4[1]': !d.domesticContentBonus,
      'c1_5[0]': d.energyCommunityBonus === 'yes',
      'c1_5[1]': d.energyCommunityBonus === 'no',
      'c1_5[2]': d.energyCommunityBonus === 'not_applicable',
      'c1_6[0]': d.nameplateCapacityDcKw !== undefined,
      f1_18: d.nameplateCapacityDcKw,
      'c1_6[1]': d.nameplateCapacityDcKw === undefined,
      'c1_7[0]': ac?.solar !== undefined,
      f1_19: ac?.solar,
      'c1_8[0]': ac?.wind !== undefined,
      f1_20: ac?.wind,
      'c1_9[0]': ac?.other !== undefined,
      f1_21: ac?.other,
      'c1_10[0]':
        ac === undefined ||
        (ac.solar === undefined &&
          ac.wind === undefined &&
          ac.other === undefined),
      ...rows,
      f2_31: this.l2(),
      f2_34: this.l3(),
      f2_35: this.l4(),
      f2_36: this.l5a(),
      f2_37: money(this.l5b()),
      f2_38: money(this.l5c()),
      f2_39: this.l5d(),
      f2_40: this.l6(),
      f2_42: this.l7b(),
      f2_44: this.l7d(),
      f2_46: this.l7f(),
      f2_47: this.l7g(),
      f2_48: this.l8(),
      f2_49: this.l9(),
      f2_50: this.l10(),
      f2_51: this.l11(),
      f2_52: this.l12(),
      f2_53: this.l13(),
      f3_1: money(this.l14()),
      f3_2: this.l15()
    }
  }

  fields = (): Field[] => Object.values(this.namedFields())
}
