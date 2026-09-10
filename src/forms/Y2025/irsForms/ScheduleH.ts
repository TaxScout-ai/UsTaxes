import { Field } from 'ustaxes/core/pdfFiller'
import { ScheduleHData } from 'ustaxes/core/data'
import { FormStatement } from 'ustaxes/core/irsForms/Form'
import F1040Attachment from './F1040Attachment'
import F1040 from './F1040'
import {
  establishedBoolean,
  nonnegativeMoney,
  TaxFormInputError
} from './formInput'
import {
  MoneyInputError,
  rateToWholeDollars,
  sumExactCents,
  sumToWholeDollars
} from './rounding'

const ROOT = '/information/scheduleH'
const STATES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR VI'.split(
    ' '
  )
)
const reductionPpm = (state: string): number =>
  state === 'CA' ? 12000 : state === 'VI' ? 45000 : 0

/** 2025 Schedule H and its Worksheets 1/2. Prepared payroll wage bases only.
 * https://www.irs.gov/instructions/i1040sh. No standalone H signature/filing.
 */
export default class ScheduleH extends F1040Attachment {
  tag = 'f1040sh'
  sequenceIndex = 44
  readonly data: ScheduleHData

  constructor(f1040: F1040, data: ScheduleHData) {
    super(f1040)
    this.data = data
    this.validate()
  }

  private validate = (): void => {
    const d = this.data
    if (!/^\d{9}$/.test(d.employerEin ?? ''))
      throw new TaxFormInputError(
        'invalid_input',
        `${ROOT}/employerEin`,
        'A nine-digit employer EIN is required'
      )
    if (
      !establishedBoolean(
        d.wageBasesEstablished,
        `${ROOT}/wageBasesEstablished`
      )
    )
      throw new TaxFormInputError(
        'needs_facts',
        ROOT,
        'Prepare wage bases using employee exclusions and annual per-employee caps before calculation'
      )
    const amounts = [
      d.socialSecurityWages,
      d.medicareWages,
      d.additionalMedicareWages,
      d.federalIncomeTaxWithheld
    ]
    amounts.forEach((v, i) =>
      nonnegativeMoney(
        v,
        `${ROOT}/${
          [
            'socialSecurityWages',
            'medicareWages',
            'additionalMedicareWages',
            'federalIncomeTaxWithheld'
          ][i]
        }`
      )
    )
    if (
      d.socialSecurityWages > d.medicareWages ||
      d.additionalMedicareWages > d.medicareWages
    )
      throw new TaxFormInputError(
        'invalid_input',
        ROOT,
        'Social security and additional Medicare bases cannot exceed the Medicare base'
      )
    this.sum(...amounts)
    const threshold = establishedBoolean(
      d.quarterlyFutaThresholdMet,
      `${ROOT}/quarterlyFutaThresholdMet`
    )
    if (!threshold && d.futa !== undefined)
      throw new TaxFormInputError(
        'invalid_input',
        `${ROOT}/futa`,
        'FUTA data conflicts with the established quarterly threshold'
      )
    if (!threshold) return
    const f = d.futa
    if (!f)
      throw new TaxFormInputError(
        'needs_facts',
        `${ROOT}/futa`,
        'Prepare FUTA bases and state contribution details'
      )
    nonnegativeMoney(f.taxableWages, `${ROOT}/futa/taxableWages`)
    establishedBoolean(
      f.allWagesSubjectToStateTax,
      `${ROOT}/futa/allWagesSubjectToStateTax`
    )
    establishedBoolean(
      f.allContributionsPaidByDueDate,
      `${ROOT}/futa/allContributionsPaidByDueDate`
    )
    if (!Array.isArray(f.states))
      throw new TaxFormInputError(
        'needs_facts',
        `${ROOT}/futa/states`,
        'Provide state rows, including an empty array if no state contributions are applicable'
      )
    f.states.forEach((s, i) => {
      const path = `${ROOT}/futa/states/${i}`
      if (!STATES.has(s.state))
        throw new TaxFormInputError(
          'invalid_input',
          path,
          'Unknown state abbreviation'
        )
      if (
        !Number.isInteger(s.experienceRatePpm) ||
        s.experienceRatePpm < 0 ||
        s.experienceRatePpm > 1000000
      )
        throw new TaxFormInputError(
          'invalid_input',
          path,
          'State rate must be an integer numerator between zero and 1,000,000'
        )
      for (const key of [
        'taxableWages',
        'contributionsOnTime',
        'contributionsLate',
        'futaWagesSubjectToStateTax'
      ] as const)
        nonnegativeMoney(s[key], `${path}/${key}`)
      for (const date of [s.periodStart, s.periodEnd]) {
        if (
          typeof date !== 'string' ||
          !/^2025-\d{2}-\d{2}$/.test(date) ||
          !Number.isFinite(Date.parse(date)) ||
          new Date(date).toISOString().slice(0, 10) !== date
        )
          throw new TaxFormInputError(
            'invalid_input',
            path,
            'Rate period requires valid 2025 calendar dates'
          )
      }
      if (s.periodStart > s.periodEnd)
        throw new TaxFormInputError(
          'invalid_input',
          path,
          'State rate period is reversed'
        )
      if (f.allContributionsPaidByDueDate && s.contributionsLate > 0)
        throw new TaxFormInputError(
          'invalid_input',
          path,
          'Late contributions contradict the timely-payment fact'
        )
    })
    const stateFuta = this.cents(
      f.states.map((s) => s.futaWagesSubjectToStateTax),
      ROOT
    )
    if (
      stateFuta > this.cents([f.taxableWages], ROOT) ||
      (f.allWagesSubjectToStateTax &&
        stateFuta !== this.cents([f.taxableWages], ROOT))
    )
      throw new TaxFormInputError(
        'invalid_input',
        `${ROOT}/futa`,
        'State-subject FUTA wages must reconcile to the FUTA wage base'
      )
    this.sum(
      f.taxableWages,
      ...f.states.flatMap((s) => [
        s.taxableWages,
        s.contributionsOnTime,
        s.contributionsLate
      ])
    )
  }

  private cents = (values: number[], label: string): number => {
    try {
      return sumExactCents(values, label)
    } catch (e) {
      if (e instanceof MoneyInputError)
        throw new TaxFormInputError('invalid_input', ROOT, e.message)
      throw e
    }
  }

  private sum = (...values: number[]): number => {
    try {
      return sumToWholeDollars(values, 'Schedule H')
    } catch (e) {
      if (e instanceof MoneyInputError)
        throw new TaxFormInputError('invalid_input', ROOT, e.message)
      throw e
    }
  }
  private rate = (
    value: number,
    numerator: number,
    denominator = 1000
  ): number => rateToWholeDollars(value, numerator, denominator, 'Schedule H')
  private stateRows = () => this.data.futa?.states ?? []
  isNeeded = (): boolean =>
    this.data.medicareWages > 0 ||
    this.data.federalIncomeTaxWithheld > 0 ||
    this.data.quarterlyFutaThresholdMet
  l1 = (): number => this.sum(this.data.socialSecurityWages)
  l2 = (): number => this.rate(this.l1(), 124)
  l3 = (): number => this.sum(this.data.medicareWages)
  l4 = (): number => this.rate(this.l3(), 29)
  l5 = (): number => this.sum(this.data.additionalMedicareWages)
  l6 = (): number => this.rate(this.l5(), 9)
  l7 = (): number => this.sum(this.data.federalIncomeTaxWithheld)
  l8 = (): number => this.sum(this.l2(), this.l4(), this.l6(), this.l7())
  oneState = (): boolean =>
    new Set(this.stateRows().map((s) => s.state)).size === 1 &&
    this.stateRows().every((s) => reductionPpm(s.state) === 0)
  sectionA = (): boolean =>
    this.data.quarterlyFutaThresholdMet &&
    this.oneState() &&
    this.data.futa?.allContributionsPaidByDueDate === true &&
    this.data.futa.allWagesSubjectToStateTax
  l14 = (): number =>
    this.sum(...this.stateRows().map((s) => s.contributionsOnTime))
  l15 = (): number => this.sum(this.data.futa?.taxableWages ?? 0)
  l16 = (): number => (this.sectionA() ? this.rate(this.l15(), 6) : 0)
  row = (index: number): Field[] => {
    const s = this.stateRows()[index]
    if (!s) return Array<Field>(9).fill(undefined)
    const wages = this.sum(s.taxableWages)
    const e = this.rate(wages, 54)
    const f = this.rate(wages, s.experienceRatePpm, 1000000)
    return [
      s.state,
      wages,
      s.periodStart,
      s.periodEnd,
      String(s.experienceRatePpm / 1000000),
      e,
      f,
      Math.max(0, e - f),
      this.sum(s.contributionsOnTime)
    ]
  }
  l18g = (): number =>
    this.sum(
      ...this.stateRows().map((s) =>
        Math.max(
          0,
          this.rate(this.sum(s.taxableWages), 54) -
            this.rate(this.sum(s.taxableWages), s.experienceRatePpm, 1000000)
        )
      )
    )
  l18h = (): number =>
    this.sum(...this.stateRows().map((s) => this.sum(s.contributionsOnTime)))
  l19 = (): number => this.sum(this.l18g(), this.l18h())
  l20 = (): number => this.l15()
  l21 = (): number => this.rate(this.l20(), 60)
  l22 = (): number => this.rate(this.l20(), 54)
  lateCredit = (): number =>
    this.rate(
      Math.min(
        Math.max(0, this.l22() - this.l19()),
        this.sum(...this.stateRows().map((s) => s.contributionsLate))
      ),
      9,
      10
    )
  creditReduction = (): number =>
    this.sum(
      ...['CA', 'VI'].map((state) =>
        this.rate(
          this.sum(
            ...this.stateRows()
              .filter((s) => s.state === state)
              .map((s) => s.futaWagesSubjectToStateTax)
          ),
          reductionPpm(state),
          1000000
        )
      )
    )
  l23 = (): number =>
    Math.max(
      0,
      Math.min(this.l22(), this.sum(this.l19(), this.lateCredit())) -
        this.creditReduction()
    )
  l24 = (): number => this.l21() - this.l23()
  l25 = (): number => this.l8()
  l26 = (): number =>
    this.sum(this.sectionA() ? this.l16() : this.l24(), this.l25())
  toSchedule2 = (): number =>
    this.data.quarterlyFutaThresholdMet ? this.l26() : this.l8()

  supportingStatements = (): FormStatement[] => {
    if (!this.data.quarterlyFutaThresholdMet || this.sectionA()) return []
    const result: FormStatement[] = []
    if (this.stateRows().length > 2)
      result.push({
        title: 'Schedule H line 17 - additional state rate periods',
        lines: [
          'Columns: state | wages | from | to | rate | 5.4% | state tax | difference | timely contributions',
          ...this.stateRows()
            .slice(2)
            .map((_, i) => this.row(i + 2).join(' | '))
        ]
      })
    if (this.lateCredit() > 0 || this.creditReduction() > 0)
      result.push({
        title: 'Schedule H line 23 - credit worksheets',
        lines: [
          `Worksheet 1: limit ${this.l22()}; regular credit ${this.l19()}; late-payment credit ${this.lateCredit()}`,
          ...this.stateRows().map(
            (s) =>
              `Worksheet 2: ${
                s.state
              }; FUTA wages subject to state tax ${this.sum(
                s.futaWagesSubjectToStateTax
              )}; reduction rate ${reductionPpm(s.state) / 1000000}`
          ),
          `Credit reduction ${this.creditReduction()}; allowed credit ${this.l23()}`
        ]
      })
    return result
  }

  namedFields = (): Record<string, Field> => {
    const d = this.data
    const a = d.medicareWages > 0
    const b = d.federalIncomeTaxWithheld > 0
    const f: Record<string, Field> = {
      f1_1: this.f1040.namesString(),
      f1_2: this.f1040.info.taxPayer.primaryPerson.ssid,
      f1_3: d.employerEin,
      'c1_1[0]': a,
      'c1_1[1]': !a
    }
    if (!a) Object.assign(f, { 'c1_2[0]': b, 'c1_2[1]': !b })
    if (!a && !b)
      Object.assign(f, {
        'c1_3[0]': !d.quarterlyFutaThresholdMet,
        'c1_3[1]': d.quarterlyFutaThresholdMet
      })
    if (a || b) {
      if (a)
        [
          this.l1(),
          this.l2(),
          this.l3(),
          this.l4(),
          this.l5(),
          this.l6()
        ].forEach((v, i) => {
          f[`f1_${i + 4}`] = v
        })
      Object.assign(f, {
        f1_10: this.l7(),
        f1_11: this.l8(),
        'c1_4[0]': d.quarterlyFutaThresholdMet,
        'c1_4[1]': !d.quarterlyFutaThresholdMet
      })
    }
    if (d.quarterlyFutaThresholdMet) {
      Object.assign(f, {
        'c2_1[0]': this.oneState(),
        'c2_1[1]': !this.oneState(),
        'c2_2[0]': d.futa?.allContributionsPaidByDueDate,
        'c2_2[1]': !d.futa?.allContributionsPaidByDueDate,
        'c2_3[0]': d.futa?.allWagesSubjectToStateTax,
        'c2_3[1]': !d.futa?.allWagesSubjectToStateTax,
        f2_31: this.l25(),
        f2_32: this.l26(),
        'c2_5[0]': true,
        'c2_5[1]': false
      })
      if (this.sectionA())
        Object.assign(f, {
          f2_1: this.stateRows()[0]?.state,
          f2_2: this.l14(),
          f2_3: this.l15(),
          f2_4: this.l16()
        })
      else {
        for (let i = 0; i < Math.min(2, this.stateRows().length); i++)
          this.row(i).forEach((v, j) => {
            f[`f2_${5 + i * 9 + j}`] = v
          })
        Object.assign(f, {
          f2_23: this.l18g(),
          f2_24: this.l18h(),
          f2_25: this.l19(),
          f2_26: this.l20(),
          f2_27: this.l21(),
          f2_28: this.l22(),
          f2_29: this.l23(),
          f2_30: this.l24(),
          c2_4: this.stateRows().some(
            (s) => s.contributionsLate > 0 || reductionPpm(s.state) > 0
          )
        })
      }
    }
    return f
  }
  fields = (): Field[] => Object.values(this.namedFields())
}
