import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import {
  CareProvider,
  FilingStatus,
  Form2441Data,
  QualifyingPerson2441
} from 'ustaxes/core/data'
import F1040 from './F1040'

/**
 * Form 2441 (2025) — Child and Dependent Care Expenses. Lines follow the
 * 2025 form: Part II lines 3–11 figure the credit (Schedule 3 line 2), Part
 * III lines 12–31 the exclusion of employer-provided benefits (line 26 →
 * Form 1040 line 1e, line 31 → line 3). Part III is blank without benefits.
 */
export default class F2441 extends F1040Attachment {
  tag: FormTag = 'f2441'
  sequenceIndex = 21

  constructor(f1040: F1040) {
    super(f1040)
  }

  isNeeded = (): boolean => this.f1040.info.form2441 !== undefined

  get data(): Form2441Data | undefined {
    return this.f1040.info.form2441
  }

  /** Line 2 column (d) total: qualified expenses paid for the persons listed. */
  qualifyingExpenses = (): number =>
    this.data?.qualifyingPersons.reduce(
      (sum, qp) => sum + qp.qualifyingExpenses,
      0
    ) ?? 0

  /** The dollar limit: 3,000 for one qualifying person, 6,000 for two or more. */
  expenseLimit = (): number => {
    const numPersons = this.data?.qualifyingPersons.length ?? 0
    if (numPersons === 0) return 0
    return numPersons === 1 ? 3000 : 6000
  }

  hasBenefits = (): boolean => this.l12() > 0

  // --- Part II: credit ---

  /** Line 3: the smaller of the expenses and the limit, or Part III line 31. */
  l3 = (): number =>
    this.hasBenefits()
      ? this.l31()
      : Math.min(this.qualifyingExpenses(), this.expenseLimit())

  /** Line 4: the filer's earned income (the primary's on a joint return). */
  l4 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    const wages =
      fs === FilingStatus.MFJ
        ? this.f1040
            .validW2s()
            .filter((w2) => w2.personRole === 'PRIMARY')
            .reduce((s, w2) => s + w2.income, 0)
        : this.f1040.validW2s().reduce((s, w2) => s + w2.income, 0)
    const seIncome = this.f1040.scheduleCNetProfit()
    return Math.max(0, wages + seIncome)
  }

  /** Line 5: the spouse's earned income on a joint return; otherwise line 4. */
  l5 = (): number => {
    const fs = this.f1040.info.taxPayer.filingStatus
    if (fs !== FilingStatus.MFJ) return this.l4()
    const spouseWages = this.f1040
      .validW2s()
      .filter((w2) => w2.personRole === 'SPOUSE')
      .reduce((s, w2) => s + w2.income, 0)
    const spouseSE = this.f1040.scheduleFNetProfit()
    return Math.max(0, spouseWages + spouseSE)
  }

  /** Line 6: the smallest of lines 3, 4 and 5. */
  l6 = (): number => Math.max(0, Math.min(this.l3(), this.l4(), this.l5()))

  /** Line 7: Form 1040 line 11a. */
  l7 = (): number => this.f1040.l11()

  /**
   * Line 8: the decimal from the line 8 table — .35 through 15,000, one
   * point less per 2,000 (or part) above it, .20 above 43,000.
   */
  l8 = (): number => {
    const agi = this.l7()
    if (agi <= 15000) return 0.35
    if (agi > 43000) return 0.2
    const reductionSteps = Math.ceil((agi - 15000) / 2000)
    return Math.max(0.2, 0.35 - reductionSteps * 0.01)
  }

  /** Line 8 as the whole-percent integer the form prints after "X." */
  l8Percent = (): number => Math.round(this.l8() * 100)

  /** Line 9a: line 6 times line 8. */
  l9a = (): number => Math.round((this.l6() * this.l8Percent()) / 100)

  /** Line 9b: the credit for 2024 expenses paid in 2025 (Worksheet A). */
  l9b = (): number => this.data?.priorYearCarryforward ?? 0

  l9c = (): number => this.l9a() + this.l9b()

  /** Line 10: the Credit Limit Worksheet — Form 1040 line 18 less Schedule 3 line 1. */
  l10 = (): number => {
    const tax = this.f1040.l18()
    const priorCredits = this.f1040.schedule3.l1() ?? 0
    return Math.max(0, tax - priorCredits)
  }

  /** Line 11: the credit, the smaller of lines 9c and 10 → Schedule 3 line 2. */
  l11 = (): number => Math.min(this.l9c(), this.l10())

  credit = (): number | undefined => (this.l11() > 0 ? this.l11() : undefined)

  // --- Part III: dependent care benefits ---

  /** Line 12: employer-provided benefits (W-2 box 10). */
  l12 = (): number => this.data?.employerProvidedBenefits ?? 0
  l13 = (): number => 0
  l14 = (): number => 0
  l15 = (): number => this.l12() + this.l13() - this.l14()
  /** Line 16: qualified expenses incurred in 2025 for the persons listed. */
  l16 = (): number => (this.hasBenefits() ? this.qualifyingExpenses() : 0)
  l17 = (): number => Math.min(this.l15(), this.l16())
  l18 = (): number => (this.hasBenefits() ? this.l4() : 0)
  l19 = (): number => (this.hasBenefits() ? this.l5() : 0)
  l20 = (): number => Math.min(this.l17(), this.l18(), this.l19())
  l21 = (): number =>
    this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS ? 2500 : 5000
  /** Line 22: benefits from a sole proprietorship or partnership (none). */
  l22 = (): number => 0
  l23 = (): number => this.l15() - this.l22()
  /** Line 24: deductible benefits (only from line 22). */
  l24 = (): number => Math.min(this.l20(), this.l21(), this.l22())
  /** Line 25: excluded benefits. */
  l25 = (): number =>
    this.l22() > 0
      ? Math.max(0, Math.min(this.l20(), this.l21()) - this.l24())
      : Math.min(this.l20(), this.l21(), this.l23())
  /** Line 26: taxable benefits → Form 1040 line 1e. */
  l26 = (): number | undefined =>
    this.hasBenefits()
      ? Math.max(0, this.l15() - this.l24() - this.l25())
      : undefined
  l27 = (): number => this.expenseLimit()
  l28 = (): number => this.l24() + this.l25()
  l29 = (): number => Math.max(0, this.l27() - this.l28())
  l30 = (): number => this.qualifyingExpenses()
  l31 = (): number => Math.min(this.l29(), this.l30())

  fields = (): Field[] => {
    const providers = this.data?.careProviders ?? []
    const persons = this.data?.qualifyingPersons ?? []
    const benefits = this.hasBenefits()
    const part3 = (v: number): number | undefined => (benefits ? v : undefined)

    // Part I: three provider rows — name, address, TIN, household employee yes/no, amount.
    const providerFields: Field[] = []
    for (let i = 0; i < 3; i++) {
      const cp = providers[i] as CareProvider | undefined
      if (cp !== undefined) {
        providerFields.push(
          cp.name,
          cp.address,
          cp.tin,
          false, // c1_x[0] household employee: yes
          true, // c1_x[1] household employee: no
          cp.amountPaid
        )
      } else {
        providerFields.push('', '', '', false, false, '')
      }
    }

    // Part II line 2: three qualifying-person rows — first, last, SSN, over-12-disabled box, expenses.
    const personFields: Field[] = []
    for (let i = 0; i < 3; i++) {
      const qp = persons[i] as QualifyingPerson2441 | undefined
      if (qp !== undefined) {
        const [first, ...rest] = qp.name.split(' ')
        personFields.push(
          first,
          rest.join(' '),
          qp.ssn,
          false,
          qp.qualifyingExpenses
        )
      } else {
        personFields.push('', '', '', false, '')
      }
    }

    return [
      this.f1040.namesString(), // 0 f1_1
      this.f1040.info.taxPayer.primaryPerson.ssid, // 1 f1_2
      false, // 2 c1_1 box A (MFS exception)
      false, // 3 c1_2 box B (student or disabled deemed income)
      providers.length > 3, // 4 c1_3 more than three providers
      ...providerFields, // 5–22
      benefits, // 23 c1_7 received dependent care benefits
      ...personFields, // 24–38
      this.l3(), // 39 f1_27 line 3
      this.l4(), // 40 f1_28 line 4
      this.l5(), // 41 f1_29 line 5
      this.l6(), // 42 f1_30 line 6
      this.l7(), // 43 f1_31 line 7
      String(this.l8Percent()).padStart(2, '0'), // 44 f1_32 line 8 decimal digits
      this.l9a(), // 45 f1_33 line 9a
      this.l9b(), // 46 f1_34 line 9b
      this.l9c(), // 47 f1_35 line 9c
      this.l10(), // 48 f1_36 line 10
      this.l11(), // 49 f1_37 line 11
      // Page 2, Part III
      part3(this.l12()), // 50 f2_1 line 12
      part3(this.l13()), // 51 f2_2 line 13
      part3(this.l14()), // 52 f2_3 line 14
      part3(this.l15()), // 53 f2_4 line 15
      part3(this.l16()), // 54 f2_5 line 16
      part3(this.l17()), // 55 f2_6 line 17
      part3(this.l18()), // 56 f2_7 line 18
      part3(this.l19()), // 57 f2_8 line 19
      part3(this.l20()), // 58 f2_9 line 20
      part3(this.l21()), // 59 f2_10 line 21
      benefits, // 60 c2_1[0] line 22 No
      false, // 61 c2_1[1] line 22 Yes
      part3(this.l22()), // 62 f2_11 line 22
      part3(this.l23()), // 63 f2_12 line 23
      part3(this.l24()), // 64 f2_13 line 24
      part3(this.l25()), // 65 f2_14 line 25
      this.l26(), // 66 f2_15 line 26
      part3(this.l27()), // 67 f2_16 line 27
      part3(this.l28()), // 68 f2_17 line 28
      part3(this.l29()), // 69 f2_18 line 29
      part3(this.l30()), // 70 f2_19 line 30
      part3(this.l31()) // 71 f2_20 line 31
    ]
  }
}
