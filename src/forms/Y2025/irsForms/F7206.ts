import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form7206Data, PersonRole } from 'ustaxes/core/data'
import { nonnegativeMoney, TaxFormInputError } from './formInput'
import F1040 from './F1040'
import { rateToWholeDollars, roundLine, sumToWholeDollars } from './rounding'

/**
 * Form 7206 — Self-Employed Health Insurance Deduction (TY2025), one per
 * trade or business under which the plan is established. Line 14 goes to
 * Schedule 1 line 17. Lines 11–12 (S corporation wages, Form 2555) are not
 * carried: those inputs are not part of this data model.
 */
export default class F7206 extends F1040Attachment {
  tag: FormTag = 'f7206'
  sequenceIndex = 206

  readonly data: Form7206Data

  constructor(f1040: F1040, data: Form7206Data) {
    super(f1040)
    const path = '/information/form7206s'
    this.data = {
      ...data,
      healthInsurancePremiums: nonnegativeMoney(
        data.healthInsurancePremiums,
        `${path}/healthInsurancePremiums`
      ),
      longTermCarePremiums: nonnegativeMoney(
        data.longTermCarePremiums,
        `${path}/longTermCarePremiums`
      )
    }
    if (
      !Number.isSafeInteger(data.scheduleCIndex) ||
      data.scheduleCIndex < 0 ||
      data.scheduleCIndex >= f1040.scheduleCList.length
    )
      throw new TaxFormInputError(
        'invalid_input',
        `${path}/scheduleCIndex`,
        'Form 7206 requires an integer index of an existing Schedule C business'
      )
    if (
      data.personRole !== PersonRole.PRIMARY ||
      f1040.scheduleCList.some(
        (b) => b.data.personRole !== PersonRole.PRIMARY
      ) ||
      f1040.scheduleFList.some((b) => b.data.personRole !== PersonRole.PRIMARY)
    )
      throw new TaxFormInputError(
        'unsupported',
        `${path}/personRole`,
        'Form 7206 requires separate owner-specific self-employment tax before spouse businesses can be included'
      )
    if (
      (f1040.info.form7206s ?? []).filter(
        (p) => p.scheduleCIndex === data.scheduleCIndex
      ).length > 1
    )
      throw new TaxFormInputError(
        'invalid_input',
        path,
        'Combine eligible premiums into one Form 7206 per business to share its deduction limit'
      )
    if (
      f1040.info.scheduleSEOptions?.farmOptionalMethod ||
      f1040.info.scheduleK1Form1065s.length ||
      (f1040.info.form2555s ?? []).length
    )
      throw new TaxFormInputError(
        'unsupported',
        path,
        'Optional-method, partnership and foreign-income earnings require separate Form 7206 coordination'
      )
    if (data.retirementContributions !== undefined)
      nonnegativeMoney(
        data.retirementContributions,
        `${path}/retirementContributions`
      )
  }

  isNeeded = (): boolean => this.l3() > 0

  business = () => {
    const list = this.f1040.scheduleCList
    if (this.data.scheduleCIndex < 0 || this.data.scheduleCIndex >= list.length)
      throw new TaxFormInputError(
        'invalid_input',
        '/information/form7206s/scheduleCIndex',
        'Form 7206 names a Schedule C business that is not in the return'
      )
    return list[this.data.scheduleCIndex]
  }

  l1 = (): number =>
    sumToWholeDollars([this.data.healthInsurancePremiums], 'Form7206:1')
  l2 = (): number =>
    sumToWholeDollars([this.data.longTermCarePremiums], 'Form7206:2')
  l3 = (): number => this.l1() + this.l2()
  /** Line 4: net profit of the business the plan is under (regular method). */
  l4 = (): number => Math.max(0, roundLine(this.business().netProfitOrLoss()))
  /** Line 5: total net profits of every business with a profit (no losses). */
  l5 = (): number =>
    sumToWholeDollars(
      [...this.f1040.scheduleCList, ...this.f1040.scheduleFList].map((b) =>
        Math.max(0, roundLine(b.netProfitOrLoss()))
      ),
      'Form7206:5'
    )
  /** Line 6: line 4 over line 5, to five decimals as the form prints it. */
  private allocationUnits = (): number => {
    const l5 = this.l5()
    if (l5 <= 0) return 0
    const numerator = BigInt(this.l4()) * BigInt(100000)
    const denominator = BigInt(l5)
    return Number(
      (numerator * BigInt(2) + denominator) / (denominator * BigInt(2))
    )
  }
  l6 = (): number => this.allocationUnits() / 100000
  /** Line 7: the deductible half of SE tax (Schedule 1 line 15) times line 6, whole dollars. */
  l7 = (): number =>
    rateToWholeDollars(
      this.f1040.schedule1.l15() ?? 0,
      this.allocationUnits(),
      100000,
      'Form7206:7'
    )
  l8 = (): number => Math.max(0, this.l4() - this.l7())
  /** Line 9 is the business's actual retirement deduction, not a profit-ratio allocation. */
  l9 = (): number => {
    const total = this.f1040.schedule1.l16() ?? 0
    const plans = this.f1040.info.form7206s ?? []
    const explicitTotal = sumToWholeDollars(
      plans.map((p) => p.retirementContributions ?? 0),
      'Form7206:retirement allocations'
    )
    if (explicitTotal > roundLine(total))
      throw new TaxFormInputError(
        'invalid_input',
        '/information/form7206s/retirementContributions',
        'Combined business retirement allocations exceed Schedule 1 line 16'
      )
    if (this.data.retirementContributions !== undefined) {
      const attributable = sumToWholeDollars(
        [this.data.retirementContributions],
        'Form7206:9'
      )
      if (
        attributable > roundLine(total) ||
        (this.f1040.scheduleCList.length + this.f1040.scheduleFList.length ===
          1 &&
          attributable !== roundLine(total))
      )
        throw new TaxFormInputError(
          'invalid_input',
          '/information/form7206s/retirementContributions',
          'The attributable retirement deduction exceeds or fails to reconcile with Schedule 1 line 16'
        )
      return attributable
    }
    if (
      total > 0 &&
      this.f1040.scheduleCList.length + this.f1040.scheduleFList.length > 1
    )
      throw new TaxFormInputError(
        'needs_facts',
        '/information/form7206s/retirementContributions',
        'Establish the retirement deduction attributable to this business'
      )
    return sumToWholeDollars([total], 'Form7206:9')
  }
  l10 = (): number => Math.max(0, this.l8() - this.l9())
  l11 = (): number | undefined => undefined
  l12 = (): number | undefined => undefined
  l13 = (): number => this.l10()
  /** Line 14: the deduction, the smaller of lines 3 and 13. */
  l14 = (): number => Math.min(this.l3(), this.l13())

  namedFields = (): Record<string, Field> => {
    const money = (v: number | undefined): Field =>
      v === undefined || v === 0 ? undefined : v
    return {
      f1_1: this.f1040.namesString(),
      f1_2: this.f1040.info.taxPayer.primaryPerson.ssid,
      f1_3: money(this.l1()),
      f1_4: money(this.l2()),
      f1_5: this.l3(),
      f1_6: this.l4(),
      f1_7: this.l5(),
      f1_8: this.l6().toFixed(5),
      f1_9: this.l7(),
      f1_10: this.l8(),
      f1_11: money(this.l9()),
      f1_12: this.l10(),
      f1_13: money(this.l11()),
      f1_14: money(this.l12()),
      f1_15: this.l13(),
      f1_16: this.l14()
    }
  }

  fields = (): Field[] => Object.values(this.namedFields())
}
