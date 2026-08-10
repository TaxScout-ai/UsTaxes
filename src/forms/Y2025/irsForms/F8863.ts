import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { FilingStatus, Form8863Data, Student8863 } from 'ustaxes/core/data'
import F1040 from './F1040'
import { sumFields } from 'ustaxes/core/irsForms/util'

/**
 * Form 8863 — Education Credits
 * (American Opportunity and Lifetime Learning Credits)
 *
 * Part III is calculated per student, then results feed Parts I and II.
 * - AOTC (Part III → Part I): Up to $2,500/student, 40% refundable
 * - LLC (Part III → Part II): 20% of up to $10,000 total expenses, nonrefundable
 *
 * The refundable portion flows to F1040 line 29.
 * The nonrefundable portion flows to Schedule 3 line 3.
 *
 * Reference: 2025 Form 8863 instructions
 */
export default class F8863 extends F1040Attachment {
  tag: FormTag = 'f8863'
  sequenceIndex = 86

  readonly data: Form8863Data

  constructor(f1040: F1040, data: Form8863Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.form8863 !== undefined &&
    this.f1040.info.form8863.students.length > 0

  // Index of the student shown in Part III on this copy (0 for first copy)
  _studentIndex = 0

  // Multi-student support: additional copies for Part III pages
  copies = (): F8863[] => {
    if (this.data.students.length <= 1) return []
    return this.data.students.slice(1).map((_, i) => {
      const copy = new F8863(this.f1040, this.data)
      copy._studentIndex = i + 1
      return copy
    })
  }

  // --- Part III per-student calculations ---

  // Determine which students qualify for AOTC
  qualifiesForAOTC = (student: Student8863): boolean =>
    student.wasAtLeastHalfTime &&
    student.wasFirstFourYears &&
    !student.hasCompletedFourYears &&
    !student.hasBeenConvictedOfFelonyDrug &&
    student.receivedAOTCPriorYears < 4

  // Part III line 27: Adjusted qualified expenses per student (max $4,000 for AOTC)
  studentAOTCExpenses = (student: Student8863): number => {
    if (
      student.creditElection !== 'aotc' ||
      student.eligibility.aotc !== 'eligible' ||
      !this.qualifiesForAOTC(student)
    ) return 0
    return Math.min(student.qualifiedExpenses, 4000)
  }

  // Part III line 28: Subtract $2,000 from line 27
  studentLine28 = (student: Student8863): number =>
    Math.max(0, this.studentAOTCExpenses(student) - 2000)

  // Part III line 29: Multiply line 28 by 25%
  studentLine29 = (student: Student8863): number =>
    Math.round(this.studentLine28(student) * 0.25 * 100) / 100

  // Part III line 30: If line 27 <= $2,000, enter line 27. Otherwise add
  // $2,000 to line 29. This is the tentative AOTC for the student.
  studentLine30 = (student: Student8863): number => {
    const expenses = this.studentAOTCExpenses(student)
    return expenses <= 2000 ? expenses : 2000 + this.studentLine29(student)
  }

  // Part III line 30 is the tentative AOTC per student.
  studentAOTC = (student: Student8863): number => this.studentLine30(student)

  // --- LLC per-student amounts ---

  // Line 31 LLC expenses are included only when the CPA explicitly elected LLC.
  studentLLCExpenses = (student: Student8863): number => {
    if (
      student.creditElection !== 'llc' ||
      student.eligibility.llc !== 'eligible'
    ) return 0
    return student.qualifiedExpenses
  }

  // --- Part I: Refundable American Opportunity Credit ---

  // Line 1: Total tentative AOTC from all students (sum of Part III line 31)
  l1 = (): number =>
    this.data.students.reduce((sum, s) => sum + this.studentAOTC(s), 0)

  // Line 2: AOTC AGI phaseout
  // MFJ: phaseout $160,000-$180,000
  // Others: phaseout $80,000-$90,000
  aotcPhaseoutFactor = (): number => {
    const agi = this.f1040.l11()
    const fs = this.f1040.info.taxPayer.filingStatus

    let lower: number
    let upper: number
    if (fs === FilingStatus.MFJ) {
      lower = 160000
      upper = 180000
    } else {
      lower = 80000
      upper = 90000
    }

    if (agi <= lower) return 1
    if (agi >= upper) return 0

    // Line 3: agi - lower
    const excess = agi - lower
    // Line 4: $20,000 (MFJ) or $10,000 (others)
    const range = upper - lower
    // Line 5: divide line 3 by line 4 (3 decimal places)
    const ratio = Math.floor((excess / range) * 1000) / 1000
    // Line 6: 1 - line 5
    return Math.max(0, 1 - ratio)
  }

  // Line 7: Tentative AOTC after phaseout = line 1 * phaseout factor
  l7 = (): number => Math.round(this.l1() * this.aotcPhaseoutFactor() * 100) / 100

  // Line 8: Refundable portion = 40% of line 7 (flows to F1040 line 29)
  l8 = (): number | undefined => {
    const amount = Math.round(this.l7() * 0.4 * 100) / 100
    return amount > 0 ? amount : undefined
  }

  // Line 9: Nonrefundable portion of AOTC = line 7 - line 8
  l9 = (): number => this.l7() - (this.l8() ?? 0)

  // --- Part II: Nonrefundable Education Credits ---

  // Line 10: Total LLC expenses (from all LLC-eligible students, max $10,000)
  l10TotalExpenses = (): number => {
    const totalLLC = this.data.students.reduce(
      (sum, s) => sum + this.studentLLCExpenses(s),
      0
    )
    return Math.min(totalLLC, 10000)
  }

  // Line 10: LLC = 20% of expenses
  l10 = (): number =>
    Math.round(this.l10TotalExpenses() * 0.2 * 100) / 100

  // LLC AGI phaseout (2025 values)
  // MFJ: phaseout $160,000-$180,000
  // Others: phaseout $80,000-$90,000
  llcPhaseoutFactor = (): number => {
    const agi = this.f1040.l11()
    const fs = this.f1040.info.taxPayer.filingStatus

    let lower: number
    let upper: number
    if (fs === FilingStatus.MFJ) {
      lower = 160000
      upper = 180000
    } else {
      lower = 80000
      upper = 90000
    }

    if (agi <= lower) return 1
    if (agi >= upper) return 0

    const excess = agi - lower
    const range = upper - lower
    const ratio = Math.floor((excess / range) * 1000) / 1000
    return Math.max(0, 1 - ratio)
  }

  // Line 17: LLC after phaseout
  l17 = (): number =>
    Math.round(this.l10() * this.llcPhaseoutFactor() * 100) / 100

  // Line 18: Nonrefundable AOTC from line 9
  l18 = (): number => this.l9()

  // Line 19: Total nonrefundable credit = line 17 + line 18
  // Limited to tax liability minus prior credits (F1116, F2441)
  // This flows to Schedule 3 line 3
  l19 = (): number | undefined => {
    const total = this.l17() + this.l18()
    if (total <= 0) return undefined

    // Tax liability limit: F1040 line 18 minus Schedule 3 lines 1-2
    const tax = this.f1040.l18()
    const sch3 = this.f1040.schedule3
    const priorCredits = sumFields([sch3.l1(), sch3.l2()])
    const limit = Math.max(0, tax - priorCredits)
    return Math.min(total, limit)
  }

  // Raw LLC total expenses before the $10,000 cap (for PDF line 10)
  llcRawTotal = (): number =>
    this.data.students.reduce((sum, s) => sum + this.studentLLCExpenses(s), 0)

  // Helper: split an SSN string (9 digits) into 3 parts for PDF
  private ssnParts = (ssn: string): [string, string, string] => {
    const clean = ssn.replace(/-/g, '')
    return [clean.slice(0, 3), clean.slice(3, 5), clean.slice(5)]
  }

  // Helper: split an EIN string (9 digits) into individual digit fields
  private einDigits = (ein: string): string[] => {
    const clean = ein.replace(/-/g, '')
    const digits: string[] = []
    for (let i = 0; i < 9; i++) {
      digits.push(i < clean.length ? clean[i] : '')
    }
    return digits
  }

  fields = (): Field[] => {
    const fs = this.f1040.info.taxPayer.filingStatus
    const isMFJ = fs === FilingStatus.MFJ
    const agi = this.f1040.l11()
    const ssn = this.ssnParts(
      this.f1040.info.taxPayer.primaryPerson.ssid
    )

    // AOTC phaseout intermediate values
    const aotcThreshold = isMFJ ? 160000 : 80000
    const aotcRange = isMFJ ? 20000 : 10000
    const aotcExcess = Math.max(0, agi - aotcThreshold)
    const aotcRatio =
      aotcExcess >= aotcRange
        ? 1
        : aotcRange > 0
          ? Math.floor((aotcExcess / aotcRange) * 1000) / 1000
          : 0
    const aotcComplement = Math.max(0, 1 - aotcRatio)
    // Checkbox: true when line 4 >= line 5 (phaseout fully reached)
    const aotcFullPhaseout = aotcExcess >= aotcRange

    // LLC phaseout intermediate values
    const llcRaw = this.llcRawTotal()
    const llcCapped = Math.min(llcRaw, 10000) // Line 11
    const llcTwentyPct =
      Math.round(llcCapped * 0.2 * 100) / 100 // Line 12
    const llcThreshold = isMFJ ? 160000 : 80000
    const llcRange = isMFJ ? 20000 : 10000
    const llcExcess = Math.max(0, agi - llcThreshold)
    const llcRatio =
      llcExcess >= llcRange
        ? 1
        : llcRange > 0
          ? Math.floor((llcExcess / llcRange) * 1000) / 1000
          : 0
    const llcComplement = Math.max(0, 1 - llcRatio)
    // LLC after phaseout = Line 12 * complement
    const llcAfterPhaseout =
      Math.round(llcTwentyPct * llcComplement * 100) / 100

    // Part III: student for this copy (one student per PDF page)
    const s = this.data.students[this._studentIndex] as Student8863 | undefined
    const studentSsn = s ? this.ssnParts(s.ssn) : ['', '', '']
    const einA: string[] = s
      ? this.einDigits(s.institutionEIN)
      : Array<string>(9).fill('')

    // Determine AOTC or LLC values for Part III lines 27-31
    const isAOTC = s?.creditElection === 'aotc'
    const isLLC = s?.creditElection === 'llc'
    const l27 = isAOTC ? this.studentAOTCExpenses(s) : undefined
    const l28 = isAOTC ? this.studentLine28(s) : undefined
    const l29 = isAOTC ? this.studentLine29(s) : undefined
    const l30 = isAOTC ? this.studentLine30(s) : undefined
    const l31 = isLLC ? this.studentLLCExpenses(s) : undefined

    return [
      // ===== Page 1 (indices 0-25) =====

      // Header
      this.f1040.namesString(),                       // 0: f1_1 — Name
      ssn[0],                                          // 1: f1_2 — SSN part 1
      ssn[1],                                          // 2: f1_3 — SSN part 2
      ssn[2],                                          // 3: f1_4 — SSN part 3

      // Part I: Refundable American Opportunity Credit (lines 1-8)
      this.l1(),                                       // 4: f1_5 — Line 1
      agi,                                             // 5: f1_6 — Line 2 (MAGI)
      aotcThreshold,                                   // 6: f1_7 — Line 3
      aotcExcess,                                      // 7: f1_8 — Line 4
      aotcRange,                                       // 8: f1_9 — Line 5
      aotcRatio,                                       // 9: f1_10 — Line 6 (decimal)
      aotcComplement,                                  // 10: f1_11 — 1.000 − Line 6
      aotcFullPhaseout,                                // 11: c1_1 — Checkbox
      this.l7(),                                       // 12: f1_12 — Line 7
      this.l8() ?? 0,                                  // 13: f1_13 — Line 8

      // Part II: Nonrefundable Education Credits (lines 9-19)
      this.l9(),                                       // 14: f1_14 — Line 9
      llcRaw,                                          // 15: f1_15 — Line 10 (LLC total)
      llcCapped,                                       // 16: f1_16 — Line 11 (≤ $10,000)
      llcTwentyPct,                                    // 17: f1_17 — Line 12 (20%)
      agi,                                             // 18: f1_18 — Line 13 (MAGI)
      llcThreshold,                                    // 19: f1_19 — Line 14
      llcExcess,                                       // 20: f1_20 — Line 15
      llcRange,                                        // 21: f1_21 — Line 16
      llcRatio,                                        // 22: f1_22 — Line 17 (decimal)
      llcComplement,                                   // 23: f1_23 — 1.000 − Line 17
      llcAfterPhaseout,                                // 24: f1_24 — Line 18
      this.l19() ?? 0,                                 // 25: f1_25 — Line 19

      // ===== Page 2 (indices 26-76) =====

      // Page 2 header
      this.f1040.namesString(),                        // 26: f2_1 — Name
      ssn[0],                                          // 27: f2_2 — SSN part 1
      ssn[1],                                          // 28: f2_3 — SSN part 2
      ssn[2],                                          // 29: f2_4 — SSN part 3

      // Part III: Student and Institution Information
      // Student identification (lines 20-21)
      s?.name ?? '',                                   // 30: f2-5 — Line 20 student name
      studentSsn[0],                                   // 31: f2_6 — Line 21 SSN part 1
      studentSsn[1],                                   // 32: f2_7 — Line 21 SSN part 2
      studentSsn[2],                                   // 33: f2_8 — Line 21 SSN part 3

      // Institution A — Line 22 column (a)
      s?.institutionName ?? '',                        // 34: f2_9 — Institution A name
      s?.institutionAddress ?? '',                     // 35: f2_10 — Institution A address
      undefined,                                       // 36: c2_1[0] — 1098-T question A (Yes)
      undefined,                                       // 37: c2_1[1] — 1098-T question A (No)
      undefined,                                       // 38: c2_2[0] — 1098-T question 2 A (Yes)
      undefined,                                       // 39: c2_2[1] — 1098-T question 2 A (No)
      // Institution A EIN (9 individual digits)
      einA[0],                                         // 40: f2_11
      einA[1],                                         // 41: f2_12
      einA[2],                                         // 42: f2_13
      einA[3],                                         // 43: f2_14
      einA[4],                                         // 44: f2_15
      einA[5],                                         // 45: f2_16
      einA[6],                                         // 46: f2_17
      einA[7],                                         // 47: f2_18
      einA[8],                                         // 48: f2_19

      // Institution B — Line 22 column (b) (unused — one institution per student)
      undefined,                                       // 49: f2_20 — Institution B name
      undefined,                                       // 50: f2_21 — Institution B address
      undefined,                                       // 51: c2_3[0] — 1098-T question B (Yes)
      undefined,                                       // 52: c2_3[1] — 1098-T question B (No)
      undefined,                                       // 53: c2_4[0] — 1098-T question 2 B (Yes)
      undefined,                                       // 54: c2_4[1] — 1098-T question 2 B (No)
      // Institution B EIN (9 individual digits, blank)
      undefined,                                       // 55: f2_22
      undefined,                                       // 56: f2_23
      undefined,                                       // 57: f2_24
      undefined,                                       // 58: f2_25
      undefined,                                       // 59: f2_26
      undefined,                                       // 60: f2_27
      undefined,                                       // 61: f2_28
      undefined,                                       // 62: f2_29
      undefined,                                       // 63: f2_30

      // Lines 23-26: Student-level Yes/No questions
      // Each pair [0]=[Yes/StudentA], [1]=[No/StudentB]
      isAOTC ? (s.receivedAOTCPriorYears >= 4) : undefined, // 64: c2_5[0] — Line 23 Yes
      isAOTC ? (s.receivedAOTCPriorYears < 4) : undefined,  // 65: c2_5[1] — Line 23 No
      isAOTC ? s.wasAtLeastHalfTime : undefined,            // 66: c2_6[0] — Line 24 Yes
      isAOTC ? !s.wasAtLeastHalfTime : undefined,           // 67: c2_6[1] — Line 24 No
      isAOTC ? !s.hasCompletedFourYears : undefined,        // 68: c2_7[0] — Line 25 Yes
      isAOTC ? s.hasCompletedFourYears : undefined,         // 69: c2_7[1] — Line 25 No
      isAOTC ? s.hasBeenConvictedOfFelonyDrug : undefined,  // 70: c2_8[0] — Line 26 Yes
      isAOTC ? !s.hasBeenConvictedOfFelonyDrug : undefined, // 71: c2_8[1] — Line 26 No

      // Lines 27-31: AOTC / LLC calculation
      l27,                                             // 72: f2_31 — Line 27
      l28,                                             // 73: f2_32 — Line 28
      l29,                                             // 74: f2_33 — Line 29
      l30,                                             // 75: f2_34 — Line 30
      l31                                              // 76: f2_35 — Line 31
    ]
  }
}
