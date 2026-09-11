import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import {
  establishedBoolean,
  nonnegativeMoney,
  TaxFormInputError
} from './formInput'
import { rateToWholeDollars, roundLine, sumToWholeDollars } from './rounding'

/** IRS TY2025 Form 8995 / instructions: the simplified form includes the threshold. */
export function getF8995PhaseOutIncome(status: FilingStatus): number {
  return status === FilingStatus.MFJ ? 394600 : 197300
}

export function hasQbiSources(f: F1040): boolean {
  return (
    f.info.scheduleCQbi !== undefined ||
    f.info.scheduleK1Form1065s.some(
      (k) =>
        k.section199AQBI !== 0 ||
        (k.qualifiedReitDividends ?? 0) !== 0 ||
        (k.publiclyTradedPartnershipIncome ?? 0) !== 0
    ) ||
    f.f1099Divs().some((d) => (d.form.section199ADividends ?? 0) !== 0)
  )
}

/** A Schedule C is not automatically qualified; a blank 13a is not an election. */
export function validateScheduleCQbi(f: F1040): void {
  const q = f.info.scheduleCQbi
  if (!q) return
  const path = '/information/scheduleCQbi'
  if (
    !Number.isSafeInteger(q.scheduleCIndex) ||
    q.scheduleCIndex < 0 ||
    q.scheduleCIndex >= f.scheduleCList.length
  )
    throw new TaxFormInputError(
      'invalid_input',
      `${path}/scheduleCIndex`,
      'QBI requires an existing Schedule C business'
    )
  const qualified = establishedBoolean(
    q.businessIsQualified,
    `${path}/businessIsQualified`
  )
  const adjustments = establishedBoolean(
    q.hasOtherQbiAdjustments,
    `${path}/hasOtherQbiAdjustments`
  )
  const cooperative = establishedBoolean(
    q.cooperativePatron,
    `${path}/cooperativePatron`
  )
  nonnegativeMoney(
    q.qualifiedLossCarryforward,
    `${path}/qualifiedLossCarryforward`
  )
  nonnegativeMoney(q.reitPtpLossCarryforward, `${path}/reitPtpLossCarryforward`)
  if (
    !qualified ||
    adjustments ||
    cooperative ||
    f.scheduleCList.length !== 1 ||
    f.scheduleFList.length ||
    f.info.scheduleK1Form1065s.length ||
    f.info.taxPayer.filingStatus !== FilingStatus.S ||
    f.scheduleCList[0].data.personRole !== PersonRole.PRIMARY
  )
    throw new TaxFormInputError(
      'unsupported',
      path,
      'This Schedule C QBI path requires one qualified sole proprietorship, Single, with no other QBI adjustments or cooperative allocation'
    )
  if (
    roundLine(f.l11()) - roundLine(f.l12()) - roundLine(f.l13b() ?? 0) >
    getF8995PhaseOutIncome(f.info.taxPayer.filingStatus)
  )
    throw new TaxFormInputError(
      'unsupported',
      path,
      'Schedule C QBI above the simplified-form threshold needs Form 8995-A wages/UBIA calculations'
    )
}

/** IRS Form 8995 (2025), lines 1–17: losses and REIT/PTP are separate components. */
export default class F8995 extends F1040Attachment {
  tag: FormTag = 'f8995'
  sequenceIndex = 55
  applicableK1s = () =>
    this.f1040.info.scheduleK1Form1065s.filter((k) => k.section199AQBI !== 0)
  businessRows = (): Array<{ name: string; tin: string; qbi: number }> => {
    const rows = this.applicableK1s().map((k) => ({
      name: k.partnershipName,
      tin: k.partnershipEin,
      qbi: sumToWholeDollars([k.section199AQBI], 'Form8995:1')
    }))
    const q = this.f1040.info.scheduleCQbi
    if (q) {
      const b = this.f1040.scheduleCList[q.scheduleCIndex]
      // IRS i8995: attributable deductions include half SE tax, health insurance and retirement plans.
      const adjusted =
        roundLine(b.netProfitOrLoss()) -
        roundLine(this.f1040.schedule1.l15() ?? 0) -
        roundLine(this.f1040.schedule1.l16() ?? 0) -
        roundLine(this.f1040.schedule1.l17() ?? 0)
      rows.push({
        name: b.data.businessName,
        tin: b.data.ein || this.f1040.info.taxPayer.primaryPerson.ssid,
        qbi: roundLine(adjusted)
      })
    }
    return rows
  }
  netCapitalGains = (): number => {
    const f = this.f1040
    const gain = f.scheduleD.isNeeded()
      ? Math.max(
          0,
          Math.min(roundLine(f.scheduleD.l15()), roundLine(f.scheduleD.l16()))
        )
      : Math.max(0, roundLine(f.l7() ?? 0))
    return sumToWholeDollars([roundLine(f.l3a() ?? 0), gain], 'Form8995:12')
  }
  l2 = (): number =>
    sumToWholeDollars(
      this.businessRows().map((r) => r.qbi),
      'Form8995:2'
    )
  /** Negative operands, positive magnitudes inside printed parentheses. */
  l3 = (): number =>
    -sumToWholeDollars(
      [this.f1040.info.scheduleCQbi?.qualifiedLossCarryforward ?? 0],
      'Form8995:3'
    ) || 0
  l4 = (): number => Math.max(0, this.l2() + this.l3())
  l5 = (): number => rateToWholeDollars(this.l4(), 1, 5, 'Form8995:5')
  l6 = (): number =>
    sumToWholeDollars(
      [
        ...this.f1040.info.scheduleK1Form1065s.flatMap((k) => [
          k.qualifiedReitDividends ?? 0,
          k.publiclyTradedPartnershipIncome ?? 0
        ]),
        ...this.f1040.f1099Divs().map((d) => d.form.section199ADividends ?? 0)
      ],
      'Form8995:6'
    )
  l7 = (): number =>
    -sumToWholeDollars(
      [this.f1040.info.scheduleCQbi?.reitPtpLossCarryforward ?? 0],
      'Form8995:7'
    ) || 0
  l8 = (): number => Math.max(0, this.l6() + this.l7())
  l9 = (): number => rateToWholeDollars(this.l8(), 1, 5, 'Form8995:9')
  l10 = (): number => this.l5() + this.l9()
  l11 = (): number =>
    Math.max(
      0,
      roundLine(this.f1040.l11()) -
        roundLine(this.f1040.l12()) -
        roundLine(this.f1040.l13b() ?? 0)
    )
  l12 = (): number => this.netCapitalGains()
  l13 = (): number => Math.max(0, this.l11() - this.l12())
  l14 = (): number => rateToWholeDollars(this.l13(), 1, 5, 'Form8995:14')
  l15 = (): number => Math.min(this.l10(), this.l14())
  l16 = (): number => Math.min(0, this.l2() + this.l3())
  l17 = (): number => Math.min(0, this.l6() + this.l7())
  deductions = (): number => this.l15()
  fields = (): Field[] => {
    const rows = this.businessRows()
    if (rows.length > 5)
      throw new TaxFormInputError(
        'unsupported',
        '/information/scheduleK1Form1065s',
        'More than five Form 8995 businesses require an additional statement'
      )
    return [
      this.f1040.namesString(),
      this.f1040.info.taxPayer.primaryPerson.ssid,
      ...Array.from({ length: 5 }, (_, i) => [
        rows[i]?.name,
        rows[i]?.tin,
        rows[i]?.qbi
      ]).flat(),
      this.l2(),
      Math.abs(this.l3()),
      this.l4(),
      this.l5(),
      this.l6(),
      Math.abs(this.l7()),
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      Math.abs(this.l16()),
      Math.abs(this.l17())
    ]
  }
}
