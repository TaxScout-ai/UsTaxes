import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Schedule1AData } from 'ustaxes/core/data'
import F1040 from './F1040'
import {
  MoneyInputError,
  rateToWholeDollars,
  roundLine,
  sumToWholeDollars
} from './rounding'
import {
  Schedule1AInputError,
  seniorAtDeath,
  seniorAtYearEnd,
  validateSchedule1AInput
} from './schedule1AInput'

/** 2025 Schedule 1-A, https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf.
 * Qualified amounts are prepared worksheet inputs. Classification of tips,
 * overtime, the loan/vehicle and business allocations remains a caller duty.
 * All line arithmetic uses the existing exact-money module, not another engine.
 */
export default class Schedule1A extends F1040Attachment {
  tag: FormTag = 'f1040s1a'
  sequenceIndex = 1.5
  readonly data: Schedule1AData | undefined

  constructor(f1040: F1040) {
    super(f1040)
    validateSchedule1AInput(f1040.info)
    this.data = f1040.info.schedule1AData
  }

  private sum = (...amounts: number[]): number => {
    try {
      return sumToWholeDollars(amounts, 'Schedule 1-A')
    } catch (error) {
      if (error instanceof MoneyInputError)
        throw new Schedule1AInputError(
          'invalid_input',
          '/information/schedule1AData',
          'Combined Schedule 1-A amounts exceed the exact monetary range'
        )
      throw error
    }
  }
  private amount = (amount: number | undefined): number => this.sum(amount ?? 0)
  isNeeded = (): boolean => this.data !== undefined && this.l38() > 0
  isMFJ = (): boolean =>
    this.f1040.info.taxPayer.filingStatus === FilingStatus.MFJ

  l1 = (): number => roundLine(this.f1040.l11())
  l2a = (): number => this.amount(this.data?.incomeExclusions?.puertoRico)
  l2b = (): number => roundLine(this.f1040.f2555?.l45() ?? 0)
  l2c = (): number => roundLine(this.f1040.f2555?.l50() ?? 0)
  l2d = (): number => this.amount(this.data?.incomeExclusions?.form4563)
  l2e = (): number => this.sum(this.l2a(), this.l2b(), this.l2c(), this.l2d())
  l3 = (): number => this.sum(this.l1(), this.l2e())

  // One employer uses lines 4a/b. More than one uses the worksheet on i1040gi.
  l4a = (): number => {
    const tips = this.data?.employeeTips
    return tips === undefined
      ? this.amount(this.data?.qualifiedTipsW2)
      : tips.length === 1
      ? this.amount(tips[0].reportedTips)
      : 0
  }
  l4b = (): number => {
    const tips = this.data?.employeeTips
    return tips === undefined
      ? this.amount(this.data?.qualifiedTipsF4137)
      : tips.length === 1
      ? this.amount(tips[0].form4137Tips)
      : 0
  }
  l4c = (): number =>
    this.data?.employeeTips !== undefined && this.data.employeeTips.length > 1
      ? this.sum(
          ...this.data.employeeTips.map((t) =>
            Math.max(t.reportedTips, t.form4137Tips)
          )
        )
      : Math.max(this.l4a(), this.l4b())
  l5 = (): number =>
    this.sum(
      ...(this.data?.businessTips ?? []).map((t) =>
        Math.min(t.qualifiedTips, Math.max(0, t.netIncome))
      )
    )
  l6 = (): number => this.sum(this.l4c(), this.l5())
  l7 = (): number => Math.min(this.l6(), 25000)
  l8 = (): number => this.l3()
  l9 = (): number => (this.isMFJ() ? 300000 : 150000)
  l10 = (): number => Math.max(0, this.l8() - this.l9())
  // The printed form explicitly rounds DOWN here, unlike car loan line 28.
  l11 = (): number => Math.floor(this.l10() / 1000)
  l12 = (): number => this.l11() * 100
  l13 = (): number => Math.max(0, this.l7() - this.l12())
  tipsPhaseout = (): number => this.l13()

  l14a = (): number => this.amount(this.data?.qualifiedOvertimeW2)
  l14b = (): number => this.amount(this.data?.qualifiedOvertime1099)
  l14c = (): number => this.sum(this.l14a(), this.l14b())
  l15 = (): number => Math.min(this.l14c(), this.isMFJ() ? 25000 : 12500)
  l16 = (): number => this.l3()
  l17 = (): number => (this.isMFJ() ? 300000 : 150000)
  l18 = (): number => Math.max(0, this.l16() - this.l17())
  l19 = (): number => Math.floor(this.l18() / 1000)
  l20 = (): number => this.l19() * 100
  l21 = (): number => Math.max(0, this.l15() - this.l20())
  overtimePhaseout = (): number => this.l21()

  l22 = (index: number): [Field, number, number] => {
    const vehicle = this.data?.vehicleInterest?.[index]
    return [
      vehicle?.vin,
      this.amount(vehicle?.interestDeductedOnSchedule),
      this.amount(vehicle?.interestForSchedule1A)
    ]
  }
  // These are already allocated column (iii) amounts: do not subtract column
  // (ii) again. Each row is rounded on line 22 before adding those form lines.
  l23 = (): number =>
    this.sum(
      ...(this.data?.vehicleInterest ?? []).map((_, i) => this.l22(i)[2])
    )
  l24 = (): number => Math.min(this.l23(), 10000)
  l25 = (): number => this.l3()
  l26 = (): number => (this.isMFJ() ? 200000 : 100000)
  l27 = (): number => Math.max(0, this.l25() - this.l26())
  l28 = (): number => Math.ceil(this.l27() / 1000)
  l29 = (): number => this.l28() * 200
  l30 = (): number => Math.max(0, this.l24() - this.l29())
  carLoanPhaseout = (): number => this.l30()

  l31 = (): number => this.l3()
  l32 = (): number => (this.isMFJ() ? 150000 : 75000)
  l33 = (): number => Math.max(0, this.l31() - this.l32())
  l34 = (): number =>
    rateToWholeDollars(this.l33(), 6, 100, 'Schedule 1-A line 34')
  l35 = (): number => Math.max(0, 6000 - this.l34())
  seniorBase = (): number => this.l35()
  private seniorEligible = (role: 'primary' | 'spouse'): boolean => {
    if (
      this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS ||
      (role === 'spouse' && !this.isMFJ())
    )
      return false
    const person =
      role === 'primary'
        ? this.f1040.info.taxPayer.primaryPerson
        : this.f1040.info.taxPayer.spouse
    const facts = this.data?.people?.[role]
    return (
      person !== undefined &&
      facts !== undefined &&
      seniorAtYearEnd(person.dateOfBirth) &&
      facts.ssnValidForEmployment &&
      facts.ssnIssuedByReturnDeadline &&
      seniorAtDeath(person.dateOfBirth, facts)
    )
  }
  l36a = (): number => (this.seniorEligible('primary') ? this.l35() : 0)
  l36b = (): number => (this.seniorEligible('spouse') ? this.l35() : 0)
  l37 = (): number => this.sum(this.l36a(), this.l36b())
  l38 = (): number => this.sum(this.l13(), this.l21(), this.l30(), this.l37())
  deduction = (): number => this.l38()

  namedFields = (): Record<string, Field> => {
    // Actual IRS names, including upstream ad67cf6's page-2 fix for line 38.
    const page1: Field[] = [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      this.l1(),
      this.l2a(),
      this.l2b(),
      this.l2c(),
      this.l2d(),
      this.l2e(),
      this.l3(),
      this.l4a(),
      this.l4b(),
      this.l4c(),
      this.l5(),
      this.l6(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14a(),
      this.l14b(),
      this.l14c(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19(),
      this.l20(),
      this.l21()
    ]
    const page2: Field[] = [
      this.l23(),
      this.l24(),
      this.l25(),
      this.l26(),
      this.l27(),
      this.l28(),
      this.l29(),
      this.l30(),
      this.l31(),
      this.l32(),
      this.l33(),
      this.l34(),
      this.l35(),
      this.l36a(),
      this.l36b(),
      this.l37(),
      this.l38()
    ]
    const fields: Record<string, Field> = {}
    page1.forEach((value, i) => {
      const active = i < 9 || (i < 21 ? this.l7() > 0 : this.l15() > 0)
      fields[`form1[0].Page1[0].f1_${String(i + 1).padStart(2, '0')}[0]`] =
        active ? value : undefined
    })
    page2.forEach((value, i) => {
      const active =
        i === 16 ||
        (i < 8
          ? (this.data?.vehicleInterest?.length ?? 0) > 0
          : this.seniorEligible('primary') || this.seniorEligible('spouse'))
      fields[`form1[0].Page2[0].f2_${String(i + 7).padStart(2, '0')}[0]`] =
        active ? value : undefined
    })
    for (const [index, row] of ['a', 'b'].entries()) {
      const prefix = `form1[0].Page2[0].Table_Line22[0].Line22${row}[0]`
      const values = this.l22(index)
      const present = this.data?.vehicleInterest?.[index] !== undefined
      const n = index * 3 + 1
      fields[
        `${prefix}.VIN-${index + 1}_Comb[0].f2_${String(n).padStart(2, '0')}[0]`
      ] = values[0]
      fields[`${prefix}.f2_${String(n + 1).padStart(2, '0')}[0]`] = present
        ? values[1]
        : undefined
      fields[`${prefix}.f2_${String(n + 2).padStart(2, '0')}[0]`] = present
        ? values[2]
        : undefined
    }
    return fields
  }
  fields = (): Field[] => Object.values(this.namedFields())
}
