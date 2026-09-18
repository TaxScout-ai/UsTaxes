/**
 * Capital Loss Carryover Worksheet — Lines 6 and 14 (2025 Instructions for
 * Schedule D; the same worksheet is Pub. 550 Worksheet 4-1).
 *
 * The worksheet takes one year's return and gives the carryovers into the
 * next: the 2025 instructions run it on the 2024 return for 2025 lines 6 and
 * 14, and the instructions for line 21 say the carryover out of 2025 is
 * figured the same way from the 2025 return ("see Pub. 550").
 */
export interface CapitalLossCarryoverInputs {
  /**
   * Form 1040 line 15 as it would be if a negative amount could be entered:
   * line 11 minus line 14. Worksheet line 1.
   */
  taxableIncomeBeforeFloor: number
  /** Schedule D line 21, the allowed loss (zero or negative); undefined when blank. */
  scheduleDLine21: number | undefined
  /** Schedule D line 7, the net short-term gain or loss. */
  scheduleDLine7: number
  /** Schedule D line 15, the net long-term gain or loss. */
  scheduleDLine15: number
}

export interface CapitalLossCarryover {
  /** Worksheet line 8: next year's Schedule D line 6, as a positive amount. */
  shortTerm: number
  /** Worksheet line 13: next year's Schedule D line 14, as a positive amount. */
  longTerm: number
  /**
   * Lines 1–13 as figured; a line the worksheet says to skip is null. The
   * whole worksheet is null when line 21 carries no loss.
   */
  lines: Record<string, number | null> | null
}

export const capitalLossCarryover = (
  i: CapitalLossCarryoverInputs
): CapitalLossCarryover => {
  // No loss on line 21 means no carryover: every line below starts from it.
  if (i.scheduleDLine21 === undefined || i.scheduleDLine21 >= 0) {
    return { shortTerm: 0, longTerm: 0, lines: null }
  }
  const l1 = i.taxableIncomeBeforeFloor
  const l2 = -i.scheduleDLine21
  const l3 = Math.max(0, l1 + l2)
  const l4 = Math.min(l2, l3)
  // "If line 7 ... is a loss, go to line 5; otherwise, enter -0- on line 5
  // and go to line 9."
  const shortLoss = i.scheduleDLine7 < 0
  const l5 = shortLoss ? -i.scheduleDLine7 : 0
  const l6 = shortLoss ? Math.max(0, i.scheduleDLine15) : null
  const l7 = l6 === null ? null : l4 + l6
  const l8 = l7 === null ? null : Math.max(0, l5 - l7)
  // "If line 15 ... is a loss, go to line 9; otherwise, skip lines 9
  // through 13."
  const longLoss = i.scheduleDLine15 < 0
  const l9 = longLoss ? -i.scheduleDLine15 : null
  const l10 = longLoss ? Math.max(0, i.scheduleDLine7) : null
  const l11 = longLoss ? Math.max(0, l4 - l5) : null
  const l12 = l10 === null || l11 === null ? null : l10 + l11
  const l13 = l9 === null || l12 === null ? null : Math.max(0, l9 - l12)
  return {
    shortTerm: l8 ?? 0,
    longTerm: l13 ?? 0,
    lines: {
      '1': l1,
      '2': l2,
      '3': l3,
      '4': l4,
      '5': l5,
      '6': l6,
      '7': l7,
      '8': l8,
      '9': l9,
      '10': l10,
      '11': l11,
      '12': l12,
      '13': l13
    }
  }
}
