import F1040 from '../F1040'
import { roundLine } from '../rounding'

/**
 * 28% Rate Gain Worksheet — Line 18 (2025 Instructions for Schedule D).
 *
 * Line for line as printed. The sources this engine does not model are zero
 * and say so: collectibles on Form 8949 Part II (line 1), the section 1202
 * exclusion (line 2), Forms 4684/6252/6781/8824 (line 3) and Form 2439
 * (part of line 4).
 */
export default class SDRateGainWorksheet {
  f1040: F1040

  constructor(f1040: F1040) {
    this.f1040 = f1040
  }

  /** 1. Collectibles gain or (loss) reported on Form 8949, Part II. */
  l1 = (): number => 0

  /** 2. The section 1202 exclusion, as a positive number. */
  l2 = (): number => 0

  /** 3. Collectibles gain or (loss) from Forms 4684, 6252, 6781 and 8824. */
  l3 = (): number => 0

  /** 4. Collectibles gain reported on Form 1099-DIV box 2d, Form 2439 box 1d and Schedule K-1. */
  l4 = (): number =>
    roundLine(
      this.f1040
        .f1099Divs()
        .reduce((sum, f) => sum + (f.form.collectibles28PctGain ?? 0), 0) +
        this.f1040.info.scheduleK1Form1065s.reduce(
          (sum, k1) => sum + (k1.collectibles28PctGain ?? 0),
          0
        )
    )

  /** 5. Long-term capital loss carryovers from Schedule D line 14, as a (loss). */
  l5 = (): number => {
    const carryover = this.f1040.info.longTermCapitalLossCarryover ?? 0
    return carryover > 0 ? -carryover : 0
  }

  /** 6. Schedule D line 7 when it is a (loss); otherwise -0-. */
  l6 = (): number => Math.min(0, this.f1040.scheduleD.l7())

  /**
   * 7. Combine lines 1 through 6. If zero or less, -0-; if more than zero,
   * also Schedule D line 18.
   */
  l7 = (): number =>
    Math.max(
      0,
      this.l1() + this.l2() + this.l3() + this.l4() + this.l5() + this.l6()
    )

  /** Lines 1 through 4, which the Unrecaptured Section 1250 Gain Worksheet line 14 takes. */
  linesOneThroughFour = (): number =>
    this.l1() + this.l2() + this.l3() + this.l4()
}
