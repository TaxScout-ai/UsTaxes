import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormStatement } from 'ustaxes/core/irsForms/Form'
import {
  FilingStatus,
  Form8801Data,
  Form8801PriorYear
} from 'ustaxes/core/data'
import F1040 from './F1040'
import {
  establishedBoolean,
  nonnegativeMoney,
  TaxFormInputError
} from './formInput'
import {
  MoneyInputError,
  rateToWholeDollars,
  roundLine,
  sumExactCents,
  sumToWholeDollars,
  toExactCents
} from './rounding'

const ROOT = '/information/form8801'
const joint = (status: FilingStatus): boolean =>
  status === FilingStatus.MFJ || status === FilingStatus.W

/** TY2025 Form 8801, using actual 2024 return/worksheet source lines.
 * This computes the minimum-tax credit, not the underlying 2024 return again.
 * Authority: pinned f8801/i8801. The current-year credit never calls its own
 * Schedule 3 total. Missing source worksheets are explicit needs_facts results.
 */
export default class F8801 extends F1040Attachment {
  tag = 'f8801'
  sequenceIndex = 801
  readonly data: Form8801Data
  readonly prior: Form8801PriorYear

  constructor(f1040: F1040, data: Form8801Data) {
    super(f1040)
    this.data = data
    this.requireObject(data.priorYear, 'priorYear')
    this.prior =
      data.priorYear ??
      this.fail(
        'needs_facts',
        'priorYear',
        'Provide the actual 2024 source return and worksheets'
      )
    this.validate()
  }

  private fail = (
    code: TaxFormInputError['code'],
    path: string,
    message: string
  ): never => {
    throw new TaxFormInputError(code, `${ROOT}/${path}`, message)
  }
  private requireObject = (value: unknown, path: string): void => {
    if (value === undefined || value === null)
      this.fail('needs_facts', path, 'Establish this source worksheet')
    if (typeof value !== 'object' || Array.isArray(value))
      this.fail('invalid_input', path, 'Expected a source worksheet object')
  }
  private signed = (value: unknown, path: string): number => {
    if (value === undefined || value === null)
      return this.fail(
        'needs_facts',
        path,
        'Establish this amount, including zero'
      )
    try {
      if (typeof value !== 'number') throw new MoneyInputError('Expected money')
      toExactCents(value, path)
      return value
    } catch (error) {
      if (error instanceof MoneyInputError)
        return this.fail('invalid_input', path, error.message)
      throw error
    }
  }
  private amount = (value: unknown, path: string): number =>
    nonnegativeMoney(value, `${ROOT}/${path}`)
  private sum = (...values: number[]): number => {
    try {
      return sumToWholeDollars(values, 'Form 8801')
    } catch (error) {
      if (error instanceof MoneyInputError)
        return this.fail('invalid_input', '', error.message)
      throw error
    }
  }
  private rate = (
    value: number,
    numerator: number,
    denominator = 100
  ): number => {
    try {
      return rateToWholeDollars(value, numerator, denominator, 'Form 8801')
    } catch (error) {
      if (error instanceof MoneyInputError)
        return this.fail('invalid_input', '', error.message)
      throw error
    }
  }
  private reference = (value: unknown, path: string): void => {
    if (typeof value !== 'string' || !value.trim())
      this.fail('needs_facts', path, 'Identify the prepared source worksheet')
  }
  private reconcile = (legacy: unknown, source: number, path: string): void => {
    const actual = this.signed(legacy, path)
    if (toExactCents(actual, path) !== toExactCents(source, path))
      this.fail(
        'invalid_input',
        path,
        'Legacy aggregate disagrees with the 2024 source lines'
      )
  }
  private validate = (): void => {
    const p = this.prior
    if (!Number.isInteger(p.taxYear) || Number(p.taxYear) !== 2024)
      this.fail(
        'unsupported',
        'priorYear/taxYear',
        'TY2025 Form 8801 uses 2024 sources'
      )
    if (!Object.values(FilingStatus).includes(p.filingStatus))
      this.fail(
        'invalid_input',
        'priorYear/filingStatus',
        'Establish the 2024 filing status'
      )
    if (!['1040', '1040-SR', '1040-NR'].includes(p.returnType))
      this.fail(
        'unsupported',
        'priorYear/returnType',
        'This attachment supports individual source returns'
      )
    this.requireObject(p.form6251, 'priorYear/form6251')
    this.signed(p.form6251.line1, 'priorYear/form6251/line1')
    this.amount(p.form6251.line2e, 'priorYear/form6251/line2e')
    this.amount(p.form6251.line10, 'priorYear/form6251/line10')
    this.amount(p.form6251.line11, 'priorYear/form6251/line11')
    this.signed(this.data.exclusionItems, 'exclusionItems')
    this.amount(this.data.mtcNOLDeduction, 'mtcNOLDeduction')
    this.amount(p.form8801Line26, 'priorYear/form8801Line26')
    this.amount(
      p.unallowedQualifiedElectricVehicleCredit,
      'priorYear/unallowedQualifiedElectricVehicleCredit'
    )
    this.amount(p.netUSRealPropertyGain, 'priorYear/netUSRealPropertyGain')
    if (p.returnType !== '1040-NR' && p.netUSRealPropertyGain !== 0)
      this.fail(
        'invalid_input',
        'priorYear/netUSRealPropertyGain',
        'The special line 10 floor applies only to a prior 1040-NR'
      )
    try {
      const legacy = this.signed(this.data.priorYearAMTI, 'priorYearAMTI')
      if (
        toExactCents(legacy, 'priorYearAMTI') !==
        sumExactCents(
          [p.form6251.line1, p.form6251.line2e],
          'Form 8801 source lines'
        )
      )
        this.fail(
          'invalid_input',
          'priorYearAMTI',
          'Legacy aggregate disagrees with the 2024 source lines'
        )
    } catch (error) {
      if (error instanceof MoneyInputError)
        return this.fail('invalid_input', 'priorYearAMTI', error.message)
      throw error
    }
    this.reconcile(
      this.data.priorYearRegularTaxMinusCredits,
      p.form6251.line10,
      'priorYearRegularTaxMinusCredits'
    )
    this.reconcile(
      this.data.priorYearAMTCreditCarryforward,
      p.form8801Line26,
      'priorYearAMTCreditCarryforward'
    )
    this.requireObject(p.foreignEarnedIncome, 'priorYear/foreignEarnedIncome')
    const foreign = p.foreignEarnedIncome
    establishedBoolean(
      foreign.applicable,
      `${ROOT}/priorYear/foreignEarnedIncome/applicable`
    )
    this.amount(
      foreign.form2555Lines45And50,
      'priorYear/foreignEarnedIncome/form2555Lines45And50'
    )
    this.amount(
      foreign.relatedDisallowedDeductions,
      'priorYear/foreignEarnedIncome/relatedDisallowedDeductions'
    )
    if (
      !foreign.applicable &&
      (foreign.form2555Lines45And50 !== 0 ||
        foreign.relatedDisallowedDeductions !== 0)
    )
      this.fail(
        'invalid_input',
        'priorYear/foreignEarnedIncome',
        'Nonzero Form 2555 facts contradict non-applicability'
      )
    this.requireObject(
      p.foreignTaxCreditOnExclusions,
      'priorYear/foreignTaxCreditOnExclusions'
    )
    const ftc = p.foreignTaxCreditOnExclusions
    this.amount(ftc.amount, 'priorYear/foreignTaxCreditOnExclusions/amount')
    if (
      !['none', 'election_without_1116', 'prepared_mtftce'].includes(ftc.method)
    )
      this.fail(
        'invalid_input',
        'priorYear/foreignTaxCreditOnExclusions/method',
        'Unknown MTFTCE source method'
      )
    if (ftc.method === 'none' && Number(ftc.amount) !== 0)
      this.fail(
        'invalid_input',
        'priorYear/foreignTaxCreditOnExclusions',
        'No credit requires explicit zero'
      )
    if (ftc.method === 'prepared_mtftce')
      this.reference(
        ftc.worksheetReference,
        'priorYear/foreignTaxCreditOnExclusions/worksheetReference'
      )
    this.requireObject(p.capitalGains, 'priorYear/capitalGains')
    const gains = p.capitalGains
    if (gains.method === 'qualified_dividends') {
      this.amount(
        gains.qualifiedDividends,
        'priorYear/capitalGains/qualifiedDividends'
      )
      this.amount(gains.netCapitalGain, 'priorYear/capitalGains/netCapitalGain')
      this.amount(gains.ordinaryIncome, 'priorYear/capitalGains/ordinaryIncome')
    } else if (gains.method === 'schedule_d') {
      for (const key of [
        'preferentialGain',
        'netCapitalGain',
        'ordinaryIncome',
        'ordinaryIncomeFor20PercentLimit',
        'unrecaptured1250Gain'
      ] as const)
        this.amount(gains[key], `priorYear/capitalGains/${key}`)
      if (gains.preferentialGain > gains.netCapitalGain)
        this.fail(
          'invalid_input',
          'priorYear/capitalGains',
          'Worksheet line 13 exceeds line 10'
        )
      const excess = this.capitalGainExcess()
      if (excess > 0) {
        const refigure =
          gains.foreignAMTRefigure ??
          this.fail(
            'needs_facts',
            'priorYear/capitalGains/foreignAMTRefigure',
            'Refigure the Schedule D and section 1250 worksheets for the Form 2555 AMT excess'
          )
        this.requireObject(
          refigure,
          'priorYear/capitalGains/foreignAMTRefigure'
        )
        for (const key of [
          'gainExcess',
          'preferentialGain',
          'netCapitalGain',
          'unrecaptured1250Gain'
        ] as const)
          this.amount(
            refigure[key],
            `priorYear/capitalGains/foreignAMTRefigure/${key}`
          )
        this.reference(
          refigure.worksheetReference,
          'priorYear/capitalGains/foreignAMTRefigure/worksheetReference'
        )
        if (
          refigure.gainExcess !== excess ||
          refigure.preferentialGain > refigure.netCapitalGain ||
          refigure.netCapitalGain > gains.netCapitalGain ||
          refigure.unrecaptured1250Gain > gains.unrecaptured1250Gain
        )
          this.fail(
            'invalid_input',
            'priorYear/capitalGains/foreignAMTRefigure',
            'Refigured worksheet does not reconcile with the AMT capital gain excess'
          )
      } else if (gains.foreignAMTRefigure)
        this.fail(
          'invalid_input',
          'priorYear/capitalGains/foreignAMTRefigure',
          'No AMT capital gain excess requires this refigure'
        )
    } else if (!['ordinary'].includes(gains.method))
      this.fail(
        'invalid_input',
        'priorYear/capitalGains/method',
        'Unknown line 11 calculation method'
      )
    if (this.l10() > 0 && this.sum(ftc.amount) > this.l11())
      this.fail(
        'invalid_input',
        'priorYear/foreignTaxCreditOnExclusions/amount',
        'MTFTCE exceeds exclusion-item tentative tax'
      )
    this.l21()
    // These current-year facts need parallel AMT basis/foreign worksheets that
    // the existing Form 6251 does not compute. Do not turn missing refigures
    // into zero and overstate a minimum-tax credit.
    if (this.f1040.assets.length > 0)
      this.fail(
        'unsupported',
        'currentYear/assets',
        'Current-year AMT basis and disposition refigures are not yet supported by the minimum-tax credit integration'
      )
    const info = this.f1040.info
    const unsupported = [
      'form2555s',
      'form1116s',
      'form4952',
      'form4797',
      'form8582',
      'form4562s',
      'form8829s',
      'scheduleCBusinesses',
      'scheduleFData',
      'scheduleK1Form1065s',
      'realEstate',
      'f3921s'
    ] as const
    for (const key of unsupported) {
      const value = info[key]
      if (Array.isArray(value) ? value.length > 0 : value !== undefined)
        this.fail(
          'unsupported',
          `currentYear/${key}`,
          'Current-year AMT refiguring for these facts is not yet supported by the minimum-tax credit integration'
        )
    }
  }

  isNeeded = (): boolean => this.l21() > 0
  l1 = (): number =>
    this.sum(this.prior.form6251.line1, this.prior.form6251.line2e)
  l2 = (): number => this.sum(this.data.exclusionItems)
  l3 = (): number =>
    this.sum(-this.amount(this.data.mtcNOLDeduction, 'mtcNOLDeduction'))
  l4 = (): number => {
    let income = Math.max(0, this.sum(this.l1(), this.l2(), this.l3()))
    if (this.prior.filingStatus === FilingStatus.MFS && income > 875950)
      income = this.sum(income, Math.min(66650, this.rate(income - 875950, 25)))
    return income
  }
  l5 = (): number =>
    joint(this.prior.filingStatus)
      ? 133300
      : this.prior.filingStatus === FilingStatus.MFS
      ? 66650
      : 85700
  l6 = (): number => (joint(this.prior.filingStatus) ? 1218700 : 609350)
  l7 = (): number => Math.max(0, this.l4() - this.l6())
  l8 = (): number => this.rate(this.l7(), 25)
  l9 = (): number => Math.max(0, this.l5() - this.l8())
  l10 = (): number =>
    Math.max(
      0,
      this.l4() - this.l9(),
      this.prior.returnType === '1040-NR'
        ? Math.min(this.sum(this.prior.netUSRealPropertyGain), this.l4())
        : 0
    )
  private ordinaryTax = (amount: number): number => {
    const cap = this.prior.filingStatus === FilingStatus.MFS ? 116300 : 232600
    return amount <= cap
      ? this.rate(amount, 26)
      : this.sum(this.rate(amount, 28), -this.rate(cap, 2))
  }
  private foreignExcludedIncome = (): number =>
    this.prior.foreignEarnedIncome.applicable
      ? Math.max(
          0,
          this.sum(
            this.prior.foreignEarnedIncome.form2555Lines45And50,
            -this.prior.foreignEarnedIncome.relatedDisallowedDeductions
          )
        )
      : 0
  private capitalGainExcess = (): number => {
    if (!this.prior.foreignEarnedIncome.applicable) return 0
    const gains = this.prior.capitalGains
    const gain =
      gains.method === 'ordinary'
        ? 0
        : gains.method === 'qualified_dividends'
        ? this.sum(gains.qualifiedDividends, gains.netCapitalGain)
        : this.sum(gains.netCapitalGain)
    return Math.max(0, gain - this.l10())
  }
  part3 = (): Partial<Record<number, number>> => {
    const gains = this.prior.capitalGains
    if (gains.method === 'ordinary' || this.l10() === 0) return {}
    const lines: Partial<Record<number, number>> = {}
    const get = (n: number): number => lines[n] ?? 0
    const status = this.prior.filingStatus
    lines[27] = this.sum(this.l10(), this.foreignExcludedIncome())
    if (gains.method === 'qualified_dividends') {
      const excess = this.capitalGainExcess()
      const capital = Math.max(0, this.sum(gains.netCapitalGain) - excess)
      const dividends = Math.max(
        0,
        this.sum(gains.qualifiedDividends) -
          Math.max(0, excess - this.sum(gains.netCapitalGain))
      )
      lines[28] = this.sum(dividends, capital)
      lines[30] = get(28)
      lines[35] = lines[42] = this.sum(gains.ordinaryIncome)
    } else {
      const source =
        this.capitalGainExcess() > 0 ? gains.foreignAMTRefigure : gains
      if (!source)
        return this.fail(
          'needs_facts',
          'priorYear/capitalGains/foreignAMTRefigure',
          'A refigured source worksheet is required'
        )
      lines[28] = this.sum(source.preferentialGain)
      lines[29] = this.sum(source.unrecaptured1250Gain)
      lines[30] = Math.min(
        this.sum(get(28), get(29)),
        this.sum(source.netCapitalGain)
      )
      lines[35] = this.sum(gains.ordinaryIncome)
      lines[42] = this.sum(gains.ordinaryIncomeFor20PercentLimit)
    }
    lines[31] = Math.min(get(27), get(30))
    lines[32] = get(27) - get(31)
    lines[33] = this.ordinaryTax(get(32))
    lines[34] = joint(status)
      ? 94050
      : status === FilingStatus.HOH
      ? 63000
      : 47025
    lines[36] = Math.max(0, get(34) - get(35))
    lines[37] = Math.min(get(27), get(28))
    lines[38] = Math.min(get(36), get(37))
    lines[39] = get(37) - get(38)
    lines[40] = joint(status)
      ? 583750
      : status === FilingStatus.MFS
      ? 291850
      : status === FilingStatus.HOH
      ? 551350
      : 518900
    lines[41] = get(36)
    lines[43] = this.sum(get(41), get(42))
    lines[44] = Math.max(0, get(40) - get(43))
    lines[45] = Math.min(get(39), get(44))
    lines[46] = this.rate(get(45), 15)
    lines[47] = this.sum(get(38), get(45))
    if (get(47) !== get(27)) {
      lines[48] = get(37) - get(47)
      lines[49] = this.rate(get(48), 20)
      if (get(29) > 0) {
        lines[50] = this.sum(get(32), get(47), get(48))
        lines[51] = get(27) - get(50)
        lines[52] = this.rate(get(51), 25)
      }
    }
    lines[53] = this.sum(get(33), get(46), get(49), get(52))
    lines[54] = this.ordinaryTax(get(27))
    lines[55] = Math.min(get(53), get(54))
    return lines
  }
  l11 = (): number => {
    if (this.l10() === 0) return 0
    const excluded = this.foreignExcludedIncome()
    const gross =
      this.prior.capitalGains.method === 'ordinary'
        ? this.ordinaryTax(this.sum(this.l10(), excluded))
        : this.part3()[55] ??
          this.fail(
            'invalid_input',
            'priorYear/capitalGains',
            'Part III did not establish line 55'
          )
    return this.sum(gross, -this.ordinaryTax(excluded))
  }
  l12 = (): number =>
    this.l10() === 0
      ? 0
      : this.sum(this.prior.foreignTaxCreditOnExclusions.amount)
  l13 = (): number => this.l11() - this.l12()
  l14 = (): number => this.sum(this.prior.form6251.line10)
  l15 = (): number =>
    this.l10() === 0 ? 0 : Math.max(0, this.l13() - this.l14())
  l16 = (): number => this.sum(this.prior.form6251.line11)
  l17 = (): number => this.l15()
  l18 = (): number => this.l16() - this.l17()
  l19 = (): number => this.sum(this.prior.form8801Line26)
  l20 = (): number =>
    this.sum(this.prior.unallowedQualifiedElectricVehicleCredit)
  l21 = (): number => this.sum(this.l18(), this.l19(), this.l20())
  l22 = (): number => {
    const s = this.f1040.schedule3
    const credits = [
      this.f1040.l19(),
      s.l1(),
      s.l2(),
      s.l3(),
      s.l4(),
      s.l5a(),
      s.l5b(),
      s.l6a(),
      s.l6c(),
      s.l6d(),
      s.l6e(),
      s.l6f(),
      s.l6g(),
      s.l6h(),
      s.l6i(),
      s.l6j(),
      s.l6l(),
      s.l6m(),
      s.l6z()
    ]
    return Math.max(
      0,
      this.sum(
        roundLine(this.f1040.l16() ?? 0),
        roundLine(this.f1040.schedule2.l1z()),
        ...credits.map((value) => -roundLine(value ?? 0))
      )
    )
  }
  l23 = (): number => roundLine(this.f1040.f6251.l9())
  l24 = (): number => Math.max(0, this.l22() - this.l23())
  l25 = (): number => (this.l21() <= 0 ? 0 : Math.min(this.l21(), this.l24()))
  l26 = (): number => Math.max(0, this.l21() - this.l25())
  credit = (): number => this.l25()
  carryforward = (): number => this.l26()
  netMinimumTax = (): number => this.l15()

  namedFields = (): Record<string, Field> => {
    const values: Record<string, Field> = {
      f1_1: this.f1040.namesString(),
      f1_2: this.f1040.info.taxPayer.primaryPerson.ssid
    }
    const first = [
      this.l1(),
      this.l2(),
      -this.l3(),
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
      this.l15()
    ]
    first.forEach((value, i) => {
      const line = i + 1
      if (line >= 5 && line <= 14 && this.l4() === 0) return
      if (line >= 11 && line <= 14 && this.l10() === 0) return
      values[`f1_${line + 2}`] = value
    })
    const second = [
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19(),
      this.l20(),
      this.l21()
    ]
    if (this.isNeeded())
      second.push(this.l22(), this.l23(), this.l24(), this.l25(), this.l26())
    second.forEach((value, i) => {
      values[`f2_${i + 1}`] = value
    })
    for (const [line, value] of Object.entries(this.part3())) {
      const number = Number(line)
      values[number <= 42 ? `f3_${number - 26}` : `f4_${number - 42}`] = value
    }
    return values
  }
  fields = (): Field[] => {
    const named = this.namedFields()
    return [17, 11, 16, 13].flatMap((count, page) =>
      Array.from(
        { length: count },
        (_, index) => named[`f${page + 1}_${index + 1}`]
      )
    )
  }
  supportingStatements = (): FormStatement[] => {
    if (!this.prior.foreignEarnedIncome.applicable || this.l10() === 0)
      return []
    const excluded = this.foreignExcludedIncome()
    const total = this.sum(this.l10(), excluded)
    return [
      {
        title: 'Form 8801 line 11 - Foreign Earned Income Tax Worksheet',
        lines: [
          `Source year: 2024; name: ${this.f1040.namesString()}`,
          `Line 1: ${this.l10()}`,
          `Line 2a: ${this.prior.foreignEarnedIncome.form2555Lines45And50}`,
          `Line 2b: ${this.prior.foreignEarnedIncome.relatedDisallowedDeductions}`,
          `Line 2c: ${excluded}`,
          `Line 3: ${total}`,
          `Line 4: ${
            this.prior.capitalGains.method === 'ordinary'
              ? this.ordinaryTax(total)
              : this.part3()[55] ??
                this.fail(
                  'invalid_input',
                  'priorYear/capitalGains',
                  'Part III did not establish line 55'
                )
          }`,
          `Line 5: ${this.ordinaryTax(excluded)}`,
          `Line 6: ${this.l11()}`
        ]
      }
    ]
  }
}
