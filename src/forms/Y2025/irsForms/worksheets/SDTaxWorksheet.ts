import { Worksheet } from '../F1040Attachment'
import federalBrackets from '../../data/federal'
import { computeOrdinaryTax } from '../TaxTable'
import { roundLine } from '../rounding'

/**
 * Schedule D Tax Worksheet — Line 16 (Schedule D instructions)
 *
 * Used instead of the Qualified Dividends and Capital Gain Tax Worksheet
 * when Schedule D line 18 (28% rate gain) or line 19 (unrecaptured section 1250 gain)
 * is more than zero, or when Form 4952 line 4g is more than zero.
 *
 * This worksheet computes tax using the 0%/15%/20%/25%/28% rate tiers
 * for long-term capital gains, unrecaptured section 1250 gain, and 28% rate gain.
 */
export default class SDTaxWorksheet extends Worksheet {
  isNeeded = (): boolean => {
    const sd = this.f1040.scheduleD
    const f4952 = this.f1040.f4952

    const sdCondition =
      sd.isNeeded() &&
      ((sd.l18() ?? 0) > 0 || (sd.l19() ?? 0) > 0) &&
      sd.l15() > 0 &&
      sd.l16() > 0

    const f4952Condition = f4952 !== undefined && (f4952.l4g() ?? 0) > 0

    return sdCondition || f4952Condition
  }

  // Line 1: Taxable income from Form 1040, line 15
  // (If filing Form 2555, use line 3 of Foreign Earned Income Tax Worksheet)
  l1 = (): number => {
    if (this.f1040.f2555 !== undefined) {
      return this.f1040.f2555.l3() ?? 0
    }
    return this.f1040.l15()
  }

  // Line 2: Qualified dividends from Form 1040, line 3a
  l2 = (): number => this.f1040.l3a() ?? 0

  // Line 3: Form 4952, line 4g
  l3 = (): number => this.f1040.f4952?.l4g() ?? 0

  // Line 4: Form 4952, line 4e
  l4 = (): number => this.f1040.f4952?.l4e() ?? 0

  // Line 5: Subtract line 4 from line 3. If zero or less, enter 0.
  l5 = (): number => Math.max(0, this.l3() - this.l4())

  // Line 6: Subtract line 5 from line 2. If zero or less, enter 0.
  l6 = (): number => Math.max(0, this.l2() - this.l5())

  // Line 7: Smaller of Schedule D line 15 or line 16
  l7 = (): number =>
    Math.min(this.f1040.scheduleD.l15(), this.f1040.scheduleD.l16())

  // Line 8: Smaller of line 3 or line 4
  l8 = (): number => Math.min(this.l3(), this.l4())

  // Line 9: Subtract line 8 from line 7. If zero or less, enter 0.
  l9 = (): number => Math.max(0, this.l7() - this.l8())

  // Line 10: Add lines 6 and 9
  l10 = (): number => this.l6() + this.l9()

  // Line 11: Add Schedule D lines 18 and 19
  l11 = (): number =>
    (this.f1040.scheduleD.l18() ?? 0) + (this.f1040.scheduleD.l19() ?? 0)

  // Line 12: Smaller of line 9 or line 11
  l12 = (): number => Math.min(this.l9(), this.l11())

  // Line 13: Subtract line 12 from line 10
  l13 = (): number => this.l10() - this.l12()

  // Line 14: Subtract line 13 from line 1. If zero or less, enter 0.
  l14 = (): number => Math.max(0, this.l1() - this.l13())

  /**
   * 15. The 0% bracket ceiling: $48,350 single or married filing separately,
   * $96,700 joint or qualifying surviving spouse, $64,750 head of household.
   */
  l15 = (): number =>
    federalBrackets.longTermCapGains.status[
      this.f1040.info.taxPayer.filingStatus
    ].brackets[0]

  /** 16. The smaller of line 1 or line 15. */
  l16 = (): number => Math.min(this.l1(), this.l15())

  /** 17. The smaller of line 14 or line 16. */
  l17 = (): number => Math.min(this.l14(), this.l16())

  /** 18. Subtract line 10 from line 1. If zero or less, -0-. */
  l18 = (): number => Math.max(0, this.l1() - this.l10())

  /**
   * 19. The smaller of line 1 or the top of the 24% ordinary bracket:
   * $197,300 single, separate or head of household, $394,600 joint. This is
   * not the long-term capital gain bracket, which line 26 takes.
   */
  l19 = (): number =>
    Math.min(
      this.l1(),
      federalBrackets.ordinary.status[this.f1040.info.taxPayer.filingStatus]
        .brackets[3]
    )

  /** 20. The smaller of line 14 or line 19. */
  l20 = (): number => Math.min(this.l14(), this.l19())

  /** 21. The larger of line 18 or line 20. */
  l21 = (): number => Math.max(this.l18(), this.l20())

  /** 22. Subtract line 17 from line 16. This amount is taxed at 0%. */
  l22 = (): number => this.l16() - this.l17()

  /** "If lines 1 and 16 are the same, skip lines 23 through 43." */
  private skipsTwentyThree = (): boolean => this.l1() === this.l16()

  /** 23. The smaller of line 1 or line 13. */
  l23 = (): number | undefined =>
    this.skipsTwentyThree() ? undefined : Math.min(this.l1(), this.l13())

  /** 24. The amount from line 22; blank is -0-. */
  l24 = (): number | undefined =>
    this.skipsTwentyThree() ? undefined : this.l22()

  /** 25. Subtract line 24 from line 23. If zero or less, -0-. */
  l25 = (): number | undefined =>
    this.skipsTwentyThree()
      ? undefined
      : Math.max(0, (this.l23() ?? 0) - (this.l24() ?? 0))

  /**
   * 26. The 15% bracket ceiling: $533,400 single, $300,000 separate,
   * $600,050 joint or qualifying surviving spouse, $566,700 head of
   * household.
   */
  l26 = (): number | undefined =>
    this.skipsTwentyThree()
      ? undefined
      : federalBrackets.longTermCapGains.status[
          this.f1040.info.taxPayer.filingStatus
        ].brackets[1]

  /** 27. The smaller of line 1 or line 26. */
  l27 = (): number | undefined =>
    this.skipsTwentyThree() ? undefined : Math.min(this.l1(), this.l26() ?? 0)

  /** 28. Add lines 21 and 22. */
  l28 = (): number | undefined =>
    this.skipsTwentyThree() ? undefined : this.l21() + this.l22()

  /** 29. Subtract line 28 from line 27. If zero or less, -0-. */
  l29 = (): number | undefined =>
    this.skipsTwentyThree()
      ? undefined
      : Math.max(0, (this.l27() ?? 0) - (this.l28() ?? 0))

  /** 30. The smaller of line 25 or line 29. */
  l30 = (): number | undefined =>
    this.skipsTwentyThree()
      ? undefined
      : Math.min(this.l25() ?? 0, this.l29() ?? 0)

  /** 31. Multiply line 30 by 15%; a form line, so whole dollars. */
  l31 = (): number | undefined =>
    this.skipsTwentyThree() ? undefined : roundLine((this.l30() ?? 0) * 0.15)

  /** 32. Add lines 24 and 30. */
  l32 = (): number | undefined =>
    this.skipsTwentyThree() ? undefined : (this.l24() ?? 0) + (this.l30() ?? 0)

  /** "If lines 1 and 32 are the same, skip lines 33 through 43." */
  private skipsThirtyThree = (): boolean =>
    this.skipsTwentyThree() || this.l1() === this.l32()

  /** 33. Subtract line 32 from line 23. */
  l33 = (): number | undefined =>
    this.skipsThirtyThree() ? undefined : (this.l23() ?? 0) - (this.l32() ?? 0)

  /** 34. Multiply line 33 by 20%; a form line, so whole dollars. */
  l34 = (): number | undefined =>
    this.skipsThirtyThree() ? undefined : roundLine((this.l33() ?? 0) * 0.2)

  /** "If Schedule D, line 19, is zero or blank, skip lines 35 through 40." */
  private skipsThirtyFive = (): boolean =>
    this.skipsThirtyThree() || (this.f1040.scheduleD.l19() ?? 0) === 0

  /** 35. The smaller of line 9 or Schedule D line 19. */
  l35 = (): number | undefined =>
    this.skipsThirtyFive()
      ? undefined
      : Math.min(this.l9(), this.f1040.scheduleD.l19() ?? 0)

  /** 36. Add lines 10 and 21. */
  l36 = (): number | undefined =>
    this.skipsThirtyFive() ? undefined : this.l10() + this.l21()

  /** 37. The amount from line 1. */
  l37 = (): number | undefined =>
    this.skipsThirtyFive() ? undefined : this.l1()

  /** 38. Subtract line 37 from line 36. If zero or less, -0-. */
  l38 = (): number | undefined =>
    this.skipsThirtyFive()
      ? undefined
      : Math.max(0, (this.l36() ?? 0) - (this.l37() ?? 0))

  /** 39. Subtract line 38 from line 35. If zero or less, -0-. */
  l39 = (): number | undefined =>
    this.skipsThirtyFive()
      ? undefined
      : Math.max(0, (this.l35() ?? 0) - (this.l38() ?? 0))

  /** 40. Multiply line 39 by 25%; a form line, so whole dollars. */
  l40 = (): number | undefined =>
    this.skipsThirtyFive() ? undefined : roundLine((this.l39() ?? 0) * 0.25)

  /** "If Schedule D, line 18, is zero or blank, skip lines 41 through 43." */
  private skipsFortyOne = (): boolean =>
    this.skipsThirtyThree() || (this.f1040.scheduleD.l18() ?? 0) === 0

  /** 41. Add lines 21, 22, 30, 33 and 39. */
  l41 = (): number | undefined =>
    this.skipsFortyOne()
      ? undefined
      : this.l21() +
        this.l22() +
        (this.l30() ?? 0) +
        (this.l33() ?? 0) +
        (this.l39() ?? 0)

  /** 42. Subtract line 41 from line 1. */
  l42 = (): number | undefined =>
    this.skipsFortyOne() ? undefined : this.l1() - (this.l41() ?? 0)

  /** 43. Multiply line 42 by 28%; a form line, so whole dollars. */
  l43 = (): number | undefined =>
    this.skipsFortyOne() ? undefined : roundLine((this.l42() ?? 0) * 0.28)

  /** 44. The tax on line 21, from the Tax Table or the Tax Computation Worksheet. */
  l44 = (): number =>
    computeOrdinaryTax(this.f1040.info.taxPayer.filingStatus, this.l21())

  /** 45. Add lines 31, 34, 40, 43 and 44. */
  l45 = (): number =>
    (this.l31() ?? 0) +
    (this.l34() ?? 0) +
    (this.l40() ?? 0) +
    (this.l43() ?? 0) +
    this.l44()

  /** 46. The tax on line 1, from the Tax Table or the Tax Computation Worksheet. */
  l46 = (): number =>
    computeOrdinaryTax(this.f1040.info.taxPayer.filingStatus, this.l1())

  /** 47. The smaller of line 45 or line 46; also Form 1040 line 16. */
  l47 = (): number => Math.min(this.l45(), this.l46())

  /** Tax result for Form 1040 line 16. */
  tax = (): number => this.l47()
}
