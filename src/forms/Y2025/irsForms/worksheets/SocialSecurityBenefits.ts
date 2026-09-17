import { FilingStatus } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { SSBenefits } from '../../data/federal'
import { Worksheet } from '../F1040Attachment'
import { rateToWholeDollars, roundLine, sumToWholeDollars } from '../rounding'

/**
 * Social Security Benefits Worksheet—Lines 6a and 6b (2025 Instructions for
 * Form 1040). Every line is a whole dollar: line 1 adds the box 5 cents
 * before rounding, and each 50 % or 85 % line rounds its own result.
 *
 * Two paths skip lines:
 * - A total box 5 of zero or less (repayments over benefits) is not run
 *   through the worksheet at all; none of the benefits are taxable
 *   (Pub. 915, Repayments More Than Gross Benefits). Every line is then
 *   undefined and line 6a is 0.
 * - Married filing separately and living with the spouse at any time skips
 *   lines 8 through 15; line 16 is 85 % of line 7.
 */
export default class SocialSecurityBenefitsWorksheet extends Worksheet {
  /** Box 5 of every SSA-1099 and RRB-1099, a negative box offsetting a positive one. */
  totalNetBenefits = (): number =>
    sumToWholeDollars(
      this.f1040.f1099ssas().map((f) => f.form.netBenefits),
      'SSA-1099 box 5'
    )

  /** The worksheet is used only when the net benefits are positive. */
  isUsed = (): boolean => this.totalNetBenefits() > 0

  /** Married filing separately and lived with the spouse at some time in the year. */
  livedWithSpouse = (): boolean =>
    this.f1040.info.taxPayer.filingStatus === FilingStatus.MFS &&
    !this.f1040.info.questions.LIVE_APART_FROM_SPOUSE

  private used = <T>(line: () => T): T | undefined =>
    this.isUsed() ? line() : undefined

  private base = <T>(line: () => T): T | undefined =>
    this.isUsed() && !this.livedWithSpouse() ? line() : undefined

  /** Form 1040 line 6a: the net benefits, 0 when repayments exceed them. */
  line6a = (): number => Math.max(this.totalNetBenefits(), 0)

  // Line 1: the total of box 5 (also Form 1040 line 6a).
  l1 = (): number | undefined => this.used(() => this.totalNetBenefits())
  // Line 2: line 1 × 50 %.
  l2 = (): number | undefined =>
    this.used(() => rateToWholeDollars(this.totalNetBenefits(), 1, 2, 'SSB 2'))
  // Line 3: Form 1040 lines 1z, 2b, 3b, 4b, 5b, 7 and 8.
  l3 = (): number | undefined =>
    this.used(() =>
      roundLine(
        sumFields([
          this.f1040.l1z(),
          this.f1040.l2b(),
          this.f1040.l3b(),
          this.f1040.l4b(),
          this.f1040.l5b(),
          this.f1040.l7(),
          this.f1040.l8()
        ])
      )
    )
  // Line 4: Form 1040 line 2a.
  l4 = (): number | undefined =>
    this.used(() => roundLine(this.f1040.l2a() ?? 0))
  // Line 5: lines 2, 3 and 4.
  l5 = (): number | undefined =>
    this.used(() => sumFields([this.l2(), this.l3(), this.l4()]))
  // Line 6: Schedule 1 adjustments.
  l6 = (): number | undefined =>
    this.used(() =>
      roundLine(
        sumFields([
          this.f1040.schedule1.l10(),
          this.f1040.schedule1.l11(),
          this.f1040.schedule1.l12(),
          this.f1040.schedule1.l13(),
          this.f1040.schedule1.l14(),
          this.f1040.schedule1.l15(),
          this.f1040.schedule1.l16(),
          this.f1040.schedule1.l17(),
          this.f1040.schedule1.l18(),
          this.f1040.schedule1.l19a(),
          this.f1040.schedule1.l20()
        ])
      )
    )
  // Line 7: line 5 less line 6, or 0 when line 6 is not less than line 5.
  l7 = (): number | undefined =>
    this.used(() => Math.max((this.l5() ?? 0) - (this.l6() ?? 0), 0))
  // Line 8: 32,000 joint; 25,000 otherwise (skipped when living with the spouse).
  l8 = (): number | undefined =>
    this.base(() => SSBenefits.caps[this.f1040.info.taxPayer.filingStatus].l8)
  // Line 9: line 7 less line 8, or 0.
  l9 = (): number | undefined =>
    this.base(() => Math.max((this.l7() ?? 0) - (this.l8() ?? 0), 0))
  // Line 10: 12,000 joint; 9,000 otherwise.
  l10 = (): number | undefined =>
    this.base(() => SSBenefits.caps[this.f1040.info.taxPayer.filingStatus].l10)
  // Line 11: line 9 less line 10, or 0.
  l11 = (): number | undefined =>
    this.base(() => Math.max((this.l9() ?? 0) - (this.l10() ?? 0), 0))
  // Line 12: the smaller of lines 9 and 10.
  l12 = (): number | undefined =>
    this.base(() => Math.min(this.l9() ?? 0, this.l10() ?? 0))
  // Line 13: line 12 × 50 %.
  l13 = (): number | undefined =>
    this.base(() => rateToWholeDollars(this.l12() ?? 0, 1, 2, 'SSB 13'))
  // Line 14: the smaller of lines 2 and 13.
  l14 = (): number | undefined =>
    this.base(() => Math.min(this.l13() ?? 0, this.l2() ?? 0))
  // Line 15: line 11 × 85 %.
  l15 = (): number | undefined =>
    this.base(() => rateToWholeDollars(this.l11() ?? 0, 85, 100, 'SSB 15'))
  // Line 16: lines 14 and 15; line 7 × 85 % when living with the spouse.
  l16 = (): number | undefined =>
    this.used(() =>
      this.livedWithSpouse()
        ? rateToWholeDollars(this.l7() ?? 0, 85, 100, 'SSB 16')
        : (this.l14() ?? 0) + (this.l15() ?? 0)
    )
  // Line 17: line 1 × 85 %.
  l17 = (): number | undefined =>
    this.used(() =>
      rateToWholeDollars(this.totalNetBenefits(), 85, 100, 'SSB 17')
    )
  // Line 18: the smaller of lines 16 and 17.
  l18 = (): number | undefined =>
    this.used(() => Math.min(this.l16() ?? 0, this.l17() ?? 0))

  /**
   * Form 1040 line 6b. None is taxable when the worksheet is not used, when
   * line 7 is 0, or (with the base amounts) when line 9 is 0.
   */
  taxableAmount = (): number => {
    if (!this.isUsed() || this.l7() === 0) return 0
    if (!this.livedWithSpouse() && this.l9() === 0) return 0
    return this.l18() ?? 0
  }
}
