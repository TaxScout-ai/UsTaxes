import F1040Attachment from './F1040Attachment'
import { FilingStatus } from 'ustaxes/core/data'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'
import { SCHEDULE1_FIELDS, SCHEDULE1_PDF_FIELDS } from '../fieldMaps'
import { roundLine } from './rounding'
import { Field } from 'ustaxes/core/pdfFiller'

export default class Schedule1 extends F1040Attachment {
  tag: FormTag = 'f1040s1'
  sequenceIndex = 1
  otherIncomeStrings: Set<string>

  constructor(f1040: F1040) {
    super(f1040)
    this.otherIncomeStrings = new Set<string>()
  }

  isNeeded = (): boolean =>
    this.f1040.scheduleE.isNeeded() ||
    (this.f1040.scheduleC?.isNeeded() ?? false) ||
    (this.f1040.scheduleF?.isNeeded() ?? false) ||
    (this.f1040.f4797?.l7() ?? 0) !== 0 ||
    (this.f1040.f2555?.l50() ?? 0) > 0 ||
    (this.f1040.studentLoanInterestWorksheet !== undefined &&
      this.f1040.studentLoanInterestWorksheet.notMFS() &&
      this.f1040.studentLoanInterestWorksheet.isNotDependent()) ||
    this.f1040.f8889.isNeeded() ||
    (this.f1040.f8889Spouse?.isNeeded() ?? false) ||
    this.f1040.f8814TotalIncome() > 0 ||
    (this.f1040.info.f1099gs ?? []).length > 0 ||
    (this.f1040.info.educatorExpenses ?? 0) > 0 ||
    (this.f1040.info.selfEmploymentRetirementContributions ?? 0) > 0 ||
    (this.f1040.info.selfEmploymentHealthInsurance ?? 0) > 0 ||
    this.f1040.f7206s().length > 0 ||
    this.l18() !== undefined

  // Line 1: Taxable refunds from 1099-G (state/local tax refunds)
  // Only taxable if taxpayer itemized in the prior year
  l1 = (): number | undefined => {
    const refunds = (this.f1040.info.f1099gs ?? []).reduce(
      (sum, g) => sum + g.form.stateLocalTaxRefund,
      0
    )
    return refunds > 0 ? refunds : undefined
  }
  l2a = (): number | undefined => undefined
  l2b = (): number | undefined => undefined
  l3 = (): number | undefined =>
    this.f1040.scheduleCNetProfit() !== 0
      ? this.f1040.scheduleCNetProfit()
      : undefined
  l4 = (): number | undefined => this.f1040.f4797?.l18b()
  l5 = (): number | undefined => this.f1040.scheduleE.l41()
  l6 = (): number | undefined =>
    this.f1040.scheduleFNetProfit() !== 0
      ? this.f1040.scheduleFNetProfit()
      : undefined
  // Line 7: Unemployment compensation from 1099-G
  l7 = (): number | undefined => {
    const unemployment = (this.f1040.info.f1099gs ?? []).reduce(
      (sum, g) => sum + g.form.unemploymentCompensation,
      0
    )
    return unemployment > 0 ? unemployment : undefined
  }
  // TY2025 line 8a is reserved for a net operating loss; gambling is line 8b.
  l8a = (): number | undefined => undefined
  l8b = (): number | undefined => this.f1040.info.gamblingIncome ?? undefined
  // Line 8c: Cancellation of debt
  l8c = (): number | undefined =>
    this.f1040.info.cancellationOfDebtIncome ?? undefined
  l8d = (): number | undefined => {
    const exclusion = this.f1040.f2555?.l50() ?? 0
    return exclusion > 0 ? -exclusion : undefined
  }
  l8e = (): number | undefined => undefined
  l8f = (): number | undefined =>
    sumFields([this.f1040.f8889.l16(), this.f1040.f8889Spouse?.l16()])
  l8g = (): number | undefined => undefined
  l8h = (): number | undefined => undefined
  l8i = (): number | undefined => undefined
  l8j = (): number | undefined => undefined
  l8k = (): number | undefined => undefined
  l8l = (): number | undefined => undefined
  l8m = (): number | undefined => undefined
  // Form 8814 income is reported in line 8z with its source description; line
  // 8n is reserved for section 951(a) inclusions in the TY2025 form.
  l8n = (): number | undefined => undefined
  l8o = (): number | undefined => undefined
  // Line 8p: section 461(l) excess business loss adjustment (not admitted yet)
  l8p = (): number | undefined => undefined
  l8q = (): number | undefined => undefined
  // Line 8r: Scholarship/fellowship income not on W-2
  l8r = (): number | undefined => this.f1040.info.scholarshipIncome ?? undefined
  l8s = (): number | undefined => undefined
  l8t = (): number | undefined => undefined
  l8u = (): number | undefined => undefined
  l8v = (): number | undefined => undefined

  l8z = (): number => {
    const form8814Income = this.f1040.f8814TotalIncome()
    if (form8814Income > 0) this.otherIncomeStrings.add('Form 8814')
    if (
      (this.f1040.f8889.isNeeded() && this.f1040.f8889.l20() > 0) ||
      ((this.f1040.f8889Spouse?.isNeeded() ?? false) &&
        this.f1040.f8889Spouse?.l20() !== undefined &&
        this.f1040.f8889Spouse.l20() > 0)
    ) {
      this.otherIncomeStrings.add('HSA')
    }

    return sumFields([
      this.f1040.f8889.l20(),
      this.f1040.f8889Spouse?.l20(),
      form8814Income
    ])
  }

  l9 = (): number =>
    sumFields([
      this.l8a(),
      this.l8b(),
      this.l8c(),
      this.l8d(),
      this.l8e(),
      this.l8f(),
      this.l8g(),
      this.l8h(),
      this.l8i(),
      this.l8j(),
      this.l8k(),
      this.l8l(),
      this.l8m(),
      this.l8n(),
      this.l8o(),
      this.l8p(),
      this.l8q(),
      this.l8r(),
      this.l8s(),
      this.l8t(),
      this.l8u(),
      this.l8v(),
      this.l8z()
    ])

  l10 = (): number =>
    sumFields([
      this.l1(),
      this.l2a(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l9()
    ])

  to1040Line8 = (): number => this.l10()

  // Line 11: Educator expenses (max $300 per educator, $600 MFJ with two educators)
  l11 = (): number | undefined => {
    const expenses = this.f1040.info.educatorExpenses
    if (expenses === undefined || expenses <= 0) return undefined
    const limit =
      this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ ? 600 : 300
    return Math.min(expenses, limit)
  }
  l12 = (): number | undefined => undefined
  l13 = (): number | undefined =>
    sumFields([this.f1040.f8889.l13(), this.f1040.f8889Spouse?.l13()])
  l14 = (): number | undefined => undefined
  l15 = (): number | undefined => this.f1040.scheduleSE.l13()
  // Line 16: Self-employed SEP, SIMPLE, and qualified plans
  l16 = (): number | undefined =>
    this.f1040.info.selfEmploymentRetirementContributions ?? undefined
  // Line 17: Self-employed health insurance deduction
  /** Line 17: the Forms 7206 when the return carries them, else the legacy scalar. */
  l17 = (): number | undefined =>
    this.f1040.f7206s().length > 0
      ? this.f1040.f7206s().reduce((sum, f) => sum + f.l14(), 0)
      : this.f1040.info.selfEmploymentHealthInsurance ?? undefined
  // Line 18: Penalty on early withdrawal of savings (from 1099-INT box 2)
  l18 = (): number | undefined => {
    const penalty = this.f1040
      .f1099Ints()
      .reduce((sum, f) => sum + (f.form.earlyWithdrawalPenalty ?? 0), 0)
    return penalty > 0 ? penalty : undefined
  }
  // Line 19a: IRA deduction (from IRA Deduction Worksheet)
  l19a = (): number | undefined => this.f1040.info.iraDeduction ?? undefined
  l19b = (): string | undefined => undefined
  l19c = (): string | undefined => undefined
  l20 = (): number | undefined => undefined
  l21 = (): number | undefined => this.f1040.studentLoanInterestWorksheet?.l9()
  l23 = (): number | undefined => undefined
  l24a = (): number | undefined => undefined
  l24b = (): number | undefined => undefined
  l24c = (): number | undefined => undefined
  l24d = (): number | undefined => undefined
  l24e = (): number | undefined => undefined
  l24f = (): number | undefined => undefined
  l24g = (): number | undefined => undefined
  l24h = (): number | undefined => undefined
  l24i = (): number | undefined => undefined
  l24j = (): number | undefined => undefined
  l24k = (): number | undefined => undefined
  l24zDesc = (): string | undefined => undefined
  l24zDesc2 = (): string | undefined => undefined
  l24z = (): number | undefined => undefined

  l25 = (): number =>
    sumFields([
      this.l24a(),
      this.l24b(),
      this.l24c(),
      this.l24d(),
      this.l24e(),
      this.l24f(),
      this.l24g(),
      this.l24h(),
      this.l24i(),
      this.l24j(),
      this.l24k(),
      this.l24z()
    ])

  l26 = (): number =>
    sumFields([
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19a(),
      this.l20(),
      this.l21(),
      this.l23(),
      this.l25()
    ])

  to1040Line10 = (): number => this.l26()

  namedFields = (): Record<string, Field> => {
    const fm = SCHEDULE1_FIELDS
    const vals: Record<string, Field> = {}
    const set = (key: string, value: Field) => {
      const f = key in fm ? fm[key] : undefined
      if (f !== undefined && value !== undefined)
        vals[f] = typeof value === 'number' ? roundLine(value) : value
    }
    // Page 1 — Additional Income
    set('name', this.f1040.namesString())
    set('ssn', this.f1040.info.taxPayer.primaryPerson.ssid)
    set('line_1', this.l1())
    set('line_2a', this.l2a())
    set('line_2b', this.l2b())
    set('line_3', this.l3())
    set('line_4', this.l4())
    set('line_4_form_4797_check', this.f1040.f4797?.isNeeded() ?? false)
    // Form 4684 is outside the current TY2025 engine scope.
    set('line_4_form_4684_check', false)
    set('line_5', this.l5())
    set('line_6', this.l6())
    set('line_7', this.l7())
    set('line_7_repaid_check', false)
    set('line_8a', this.l8a())
    set('line_8b', this.l8b())
    set('line_8c', this.l8c())
    set('line_8d', this.l8d())
    set('line_8e', this.l8e())
    set('line_8f', this.l8f())
    set('line_8g', this.l8g())
    set('line_8h', this.l8h())
    set('line_8i', this.l8i())
    set('line_8j', this.l8j())
    set('line_8k', this.l8k())
    set('line_8l', this.l8l())
    set('line_8m', this.l8m())
    set('line_8n', this.l8n())
    set('line_8o', this.l8o())
    set('line_8p', this.l8p())
    set('line_8q', this.l8q())
    set('line_8r', this.l8r())
    set('line_8s', this.l8s())
    set('line_8t', this.l8t())
    set('line_8u', this.l8u())
    set('line_8v', this.l8v())
    set('line_8z', this.l8z())
    // l8z discovers source labels (HSA, Form 8814) while computing its amount.
    set('line_8z_desc', Array.from(this.otherIncomeStrings).join(' '))
    set('line_9', this.l9())
    set('line_10', this.l10())
    // Page 2 — Adjustments to Income
    set('line_11', this.l11())
    set('line_12', this.l12())
    set('line_13', this.l13())
    set('line_14', this.l14())
    set('line_14_storage_check', false)
    set('line_15', this.l15())
    set('line_16', this.l16())
    set('line_17', this.l17())
    set('line_18', this.l18())
    set('line_19a', this.l19a())
    set('line_20_lived_apart_check', false)
    set('line_19b', this.l19b())
    set('line_19c', this.l19c())
    set('line_20', this.l20())
    set('line_21', this.l21())
    set('line_23', this.l23())
    for (const suffix of [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
      'g',
      'h',
      'i',
      'j',
      'k'
    ] as const)
      set(`line_24${suffix}`, this[`l24${suffix}`]())
    set('line_24z_desc', this.l24zDesc())
    set('line_24z', this.l24z())
    set('line_25', this.l25())
    set('line_26', this.l26())
    return vals
  }

  fields = (): Field[] => {
    const named = this.namedFields()
    return SCHEDULE1_PDF_FIELDS.map((field) => named[field])
  }
}
