import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { F4835Data } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { TaxFormInputError } from './formInput'
import F1040 from './F1040'

/**
 * Form 4835 — Farm Rental Income and Expenses (TY2025).
 *
 * A landowner (or sub-lessor) who receives crop or livestock shares and does
 * not materially participate reports the rental here; the net result goes to
 * Schedule E line 40 and is not subject to self-employment tax. Line 42 of
 * Schedule E reconciles the gross farm rental income (line 7).
 */
export default class F4835 extends F1040Attachment {
  tag: FormTag = 'f4835'
  sequenceIndex = 37

  readonly data: F4835Data

  constructor(f1040: F1040, data: F4835Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => true

  // --- Part I: Gross farm rental income, based on production ---
  l1 = (): number => this.data.productionIncome
  l2a = (): number => this.data.cooperativeDistributions
  l2b = (): number => this.data.cooperativeDistributionsTaxable
  l3a = (): number => this.data.agriculturePayments
  l3b = (): number => this.data.agriculturePaymentsTaxable
  l4a = (): number => this.data.cccLoansReportedUnderElection
  l4b = (): number => this.data.cccLoansForfeited
  l4c = (): number => this.data.cccLoansForfeitedTaxable
  l5a = (): number => this.data.cropInsuranceProceeds
  l5b = (): number => this.data.cropInsuranceProceedsTaxable
  l5d = (): number => this.data.cropInsuranceDeferredFromPriorYear
  l6 = (): number => this.data.otherIncome

  /** Line 7: the right-column amounts of lines 1 through 6. */
  l7 = (): number =>
    sumFields([
      this.l1(),
      this.l2b(),
      this.l3b(),
      this.l4a(),
      this.l4c(),
      this.l5b(),
      this.l5d(),
      this.l6()
    ])

  // --- Part II: Expenses ---
  l8 = (): number => this.data.carAndTruck
  l9 = (): number => this.data.chemicals
  l10 = (): number => this.data.conservation
  l11 = (): number => this.data.customHire
  l12 = (): number => this.data.depreciation
  l13 = (): number => this.data.employeeBenefits
  l14 = (): number => this.data.feed
  l15 = (): number => this.data.fertilizers
  l16 = (): number => this.data.freight
  l17 = (): number => this.data.fuel
  l18 = (): number => this.data.insurance
  l19a = (): number => this.data.interestMortgage
  l19b = (): number => this.data.interestOther
  l20 = (): number => this.data.labor
  l21 = (): number => this.data.pensionProfitSharing
  l22a = (): number => this.data.rentVehicles
  l22b = (): number => this.data.rentOther
  l23 = (): number => this.data.repairs
  l24 = (): number => this.data.seeds
  l25 = (): number => this.data.storage
  l26 = (): number => this.data.supplies
  l27 = (): number => this.data.taxes
  l28 = (): number => this.data.utilities
  l29 = (): number => this.data.veterinary
  /** Lines 30a–30g: the form has seven rows. */
  otherExpenses = (): Array<{ description: string; amount: number }> => {
    if (this.data.otherExpenses.length > 7)
      throw new TaxFormInputError(
        'unsupported',
        '/information/f4835s/otherExpenses',
        'Form 4835 line 30 has seven rows; more other expenses need a statement'
      )
    return this.data.otherExpenses
  }
  l30 = (): number => sumFields(this.otherExpenses().map((e) => e.amount))

  /** Line 31: total expenses, lines 8 through 30g. */
  l31 = (): number =>
    sumFields([
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19a(),
      this.l19b(),
      this.l20(),
      this.l21(),
      this.l22a(),
      this.l22b(),
      this.l23(),
      this.l24(),
      this.l25(),
      this.l26(),
      this.l27(),
      this.l28(),
      this.l29(),
      this.l30()
    ])

  /** Line 32: net farm rental income or loss. */
  l32 = (): number => this.l7() - this.l31()

  l34a = (): boolean => this.l32() < 0 && this.data.allInvestmentAtRisk
  l34b = (): boolean => this.l32() < 0 && !this.data.allInvestmentAtRisk

  /** Line 34c: the deductible loss. With an amount not at risk, Form 6198 decides it — not supported. */
  l34c = (): number | undefined => {
    if (this.l32() >= 0) return undefined
    if (!this.data.allInvestmentAtRisk)
      throw new TaxFormInputError(
        'unsupported',
        '/information/f4835s/allInvestmentAtRisk',
        'A Form 4835 loss with an amount not at risk needs Form 6198, which is not supported'
      )
    return this.l32()
  }

  /** What Schedule E line 40 receives: the income, or the deductible loss. */
  toScheduleE40 = (): number => this.l34c() ?? this.l32()

  namedFields = (): Record<string, Field> => {
    const f: Record<string, Field> = {
      f1_01: this.f1040.namesString(),
      f1_02: this.f1040.info.taxPayer.primaryPerson.ssid,
      f1_03: this.data.ein ?? '',
      'c1_1[0]': this.data.activelyParticipated,
      'c1_1[1]': !this.data.activelyParticipated
    }
    const put = (n: number, value: Field) => {
      f[`f1_${String(n).padStart(2, '0')}`] = value
    }
    const money = (v: number | undefined): Field =>
      v === undefined || v === 0 ? undefined : v
    put(4, money(this.l1()))
    put(5, money(this.l2a()))
    put(6, money(this.l2b()))
    put(7, money(this.l3a()))
    put(8, money(this.l3b()))
    put(9, money(this.l4a()))
    put(10, money(this.l4b()))
    put(11, money(this.l4c()))
    put(12, money(this.l5a()))
    put(13, money(this.l5b()))
    f['c1_2[0]'] = false // line 5c: no election to defer crop insurance proceeds
    put(14, money(this.l5d()))
    put(15, money(this.l6()))
    put(16, this.l7())
    const left: Array<number> = [
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19a(),
      this.l19b(),
      this.l20()
    ]
    left.forEach((v, i) => put(17 + i, money(v)))
    const right: Array<number> = [
      this.l21(),
      this.l22a(),
      this.l22b(),
      this.l23(),
      this.l24(),
      this.l25(),
      this.l26(),
      this.l27(),
      this.l28(),
      this.l29()
    ]
    right.forEach((v, i) => put(31 + i, money(v)))
    const other = this.otherExpenses()
    for (let i = 0; i < 7; i++) {
      put(41 + 2 * i, other[i]?.description)
      put(42 + 2 * i, money(other[i]?.amount))
    }
    put(55, this.l31())
    put(56, this.l32())
    f['c1_4[0]'] = this.l34a()
    f['c1_4[1]'] = this.l34b()
    put(58, this.l34c())
    return f
  }

  fields = (): Field[] => Object.values(this.namedFields())
}
