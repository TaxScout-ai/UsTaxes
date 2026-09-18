import F1040 from '../F1040'
import { roundLine } from '../rounding'

/**
 * Unrecaptured Section 1250 Gain Worksheet — Line 19 (2025 Instructions for
 * Schedule D).
 *
 * Line for line as printed. Lines 1 through 9 are the Form 4797 chain, which
 * this engine carries only as the form's own unrecaptured amount; the
 * partnership-interest gain (line 10) and the sales outside Form 4797 Part I
 * (line 12) are not modeled and say so.
 */
export default class SDUnrecaptured1250 {
  f1040: F1040

  constructor(f1040: F1040) {
    this.f1040 = f1040
  }

  /** 1–8. The Form 4797 chain; this engine takes its unrecaptured amount whole. */
  l1 = (): number => 0
  l2 = (): number => 0
  l3 = (): number => 0
  l4 = (): number => 0
  l5 = (): number => 0
  l6 = (): number => 0
  l7 = (): number => 0
  l8 = (): number => 0

  /** 9. Subtract line 8 from line 7. If zero or less, -0-. */
  l9 = (): number =>
    roundLine(Math.max(0, this.f1040.f4797?.unrecapturedSection1250Gain() ?? 0))

  /** 10. Gain on an interest in a partnership attributable to unrecaptured section 1250 gain. */
  l10 = (): number => 0

  /**
   * 11. Amounts reported as "unrecaptured section 1250 gain" on a Schedule
   * K-1, Form 1099-DIV box 2b, Form 2439 or with a Form 1099-R.
   */
  l11 = (): number =>
    roundLine(
      this.f1040
        .f1099Divs()
        .reduce(
          (sum, f) => sum + (f.form.unrecapturedSection1250Gain ?? 0),
          0
        ) +
        this.f1040.info.scheduleK1Form1065s.reduce(
          (sum, k1) => sum + (k1.unrecapturedSection1250Gain ?? 0),
          0
        )
    )

  /** 12. Sales of section 1250 property outside Form 4797 Part I. */
  l12 = (): number => 0

  /** 13. Add lines 9 through 12. */
  l13 = (): number => this.l9() + this.l10() + this.l11() + this.l12()

  /**
   * 14. With any section 1202 gain or collectibles gain or (loss), the total
   * of lines 1 through 4 of the 28% Rate Gain Worksheet; otherwise -0-.
   */
  l14 = (): number =>
    this.f1040.scheduleD.rateGainWorksheet.linesOneThroughFour()

  /** 15. Schedule D line 7 when it is a (loss); zero or a gain, -0-. */
  l15 = (): number => Math.min(0, this.f1040.scheduleD.l7())

  /** 16. Long-term capital loss carryovers from Schedule D line 14, as a (loss). */
  l16 = (): number => {
    const carryover = this.f1040.info.longTermCapitalLossCarryover ?? 0
    return carryover > 0 ? -carryover : 0
  }

  /**
   * 17. Combine lines 14 through 16. A (loss) is entered as a positive
   * amount; zero or a gain is -0-.
   */
  l17 = (): number => Math.max(0, -(this.l14() + this.l15() + this.l16()))

  /**
   * 18. Subtract line 17 from line 13. If zero or less, -0-; if more than
   * zero, also Schedule D line 19.
   */
  l18 = (): number => Math.max(0, this.l13() - this.l17())
}
