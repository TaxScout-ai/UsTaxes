import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8606Data, PersonRole } from 'ustaxes/core/data'
import { rateToWholeDollars, sumToWholeDollars } from './rounding'
import F1040 from './F1040'

/**
 * Form 8606 — Nondeductible IRAs
 *
 * Part I:  Nondeductible contributions to traditional IRAs and
 *          basis determination for distributions/conversions
 * Part II: Conversions from traditional, SEP, or SIMPLE IRAs to Roth IRAs
 * Part III: Distributions from Roth IRAs
 *
 * Each spouse files a separate Form 8606 if both have nondeductible IRA activity.
 * The taxable IRA amount flows to F1040 lines 4a/4b.
 *
 * Source: 2025 Form 8606 and its instructions (TAX-4862).
 */
export default class F8606 extends F1040Attachment {
  tag: FormTag = 'f8606'
  sequenceIndex = 48

  readonly data: Form8606Data

  constructor(f1040: F1040, data: Form8606Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.form8606s !== undefined &&
    this.f1040.info.form8606s.length > 0

  // Additional Form 8606 for spouse
  copies = (): F8606[] => {
    const list = this.f1040.f8606List
    if (list.length <= 1) return []
    return list.slice(1)
  }

  // --- Part I: Nondeductible Contributions to Traditional IRAs
  //             and Distributions From Traditional IRAs ---
  // Every line is a whole dollar (2025 Instructions for Form 1040, "Rounding
  // Off to Whole Dollars"); a single stated amount is rounded where it enters.
  private dollars = (amount: number, line: string): number =>
    sumToWholeDollars([amount], `Form 8606 line ${line}`)

  // Line 1: nondeductible contributions for 2025, including those made
  // from January 1, 2026, through April 15, 2026
  l1 = (): number => this.dollars(this.data.nondeductibleContributions, '1')

  // Line 2: total basis in traditional IRAs (Total Basis Chart)
  l2 = (): number => this.dollars(this.data.totalBasisPriorYears, '2')

  // Line 3: add lines 1 and 2
  l3 = (): number => this.l1() + this.l2()

  /**
   * The question between lines 3 and 4: "In 2025, did you take a distribution
   * from a traditional IRA, or make a Roth IRA conversion?" No — enter line 3
   * on line 14 and do not complete the rest of Part I.
   */
  tookDistributionOrConverted = (): boolean =>
    this.l7raw() > 0 || this.l8raw() > 0

  private l7raw = (): number =>
    this.dollars(this.data.distributionsFromTraditional, '7')
  private l8raw = (): number => this.dollars(this.data.amountConverted, '8')
  private partI = <T>(value: () => T): T | undefined =>
    this.tookDistributionOrConverted() ? value() : undefined

  // Line 4: contributions included on line 1 made from January 1, 2026,
  // through April 15, 2026. They are basis for 2025 but do not reduce the
  // taxable part of a 2025 distribution.
  l4 = (): number | undefined =>
    this.partI(() => {
      const late = this.dollars(
        this.data.contributionsMadeInFollowingYear ?? 0,
        '4'
      )
      if (late > this.l1())
        throw new Error('Form 8606 line 4 cannot exceed line 1')
      return late
    })

  // Line 5: subtract line 4 from line 3
  l5 = (): number | undefined => this.partI(() => this.l3() - (this.l4() ?? 0))

  // Line 6: value of all traditional IRAs on December 31, 2025, plus
  // outstanding rollovers
  l6 = (): number | undefined =>
    this.partI(() => this.dollars(this.data.valueOfAllTraditionalIRAs, '6'))

  // Line 7: distributions from traditional IRAs in 2025, excluding rollovers,
  // conversions, QCDs, HSA funding and returned contributions
  l7 = (): number | undefined => this.partI(this.l7raw)

  // Line 8: net amount converted to Roth IRAs in 2025
  l8 = (): number | undefined => this.partI(this.l8raw)

  // Line 9: add lines 6, 7 and 8
  l9 = (): number | undefined =>
    this.partI(() => (this.l6() ?? 0) + this.l7raw() + this.l8raw())

  /**
   * Line 10 in thousandths: "Divide line 5 by line 9. Enter the result as a
   * decimal rounded to at least 3 places. If the result is 1.000 or more,
   * enter 1.000." Three places, as the form prints the box; lines 11 and 12
   * multiply by the decimal as entered. Whole-dollar integers, so the ratio is
   * exact (half up), with no binary division.
   */
  l10Thousandths = (): number | undefined =>
    this.partI(() => {
      const l5 = this.l5() ?? 0
      const l9 = this.l9() ?? 0
      // Line 9 is positive whenever Part I is completed (line 7 or 8 > 0).
      const thousandths = Math.floor((l5 * 2000 + l9) / (2 * l9))
      return Math.min(1000, thousandths)
    })

  l10 = (): number | undefined => {
    const t = this.l10Thousandths()
    return t === undefined ? undefined : t / 1000
  }

  // Line 11: multiply line 8 by line 10 (nontaxable part of the conversion)
  l11 = (): number | undefined =>
    this.partI(() =>
      rateToWholeDollars(
        this.l8raw(),
        this.l10Thousandths() ?? 0,
        1000,
        'Form 8606 line 11'
      )
    )

  // Line 12: multiply line 7 by line 10 (nontaxable part of distributions)
  l12 = (): number | undefined =>
    this.partI(() =>
      rateToWholeDollars(
        this.l7raw(),
        this.l10Thousandths() ?? 0,
        1000,
        'Form 8606 line 12'
      )
    )

  // Line 13: add lines 11 and 12
  l13 = (): number | undefined =>
    this.partI(() => (this.l11() ?? 0) + (this.l12() ?? 0))

  // Line 14: subtract line 13 from line 3 — the basis carried to 2026. With
  // no distribution or conversion, line 3.
  l14 = (): number => this.l3() - (this.l13() ?? 0)

  // Line 15a: subtract line 12 from line 7
  l15a = (): number | undefined =>
    this.partI(() => this.l7raw() - (this.l12() ?? 0))

  // Line 15b: the part of line 15a from qualified disaster distributions
  // (Form 8915-F). Not modelled: always zero.
  l15b = (): number | undefined => this.partI(() => 0)

  // Line 15c: taxable amount, line 15a less line 15b; to Form 1040 line 4b
  l15c = (): number | undefined =>
    this.partI(() => (this.l15a() ?? 0) - (this.l15b() ?? 0))

  // --- Part II: 2025 conversions from traditional IRAs to Roth IRAs ---
  // Completed only when something was converted.
  private partII = <T>(value: () => T): T | undefined =>
    this.l8raw() > 0 ? value() : undefined

  // Line 16: line 8 (Part I completed)
  l16 = (): number | undefined => this.partII(this.l8raw)

  // Line 17: line 11 (Part I completed)
  l17 = (): number | undefined => this.partII(() => this.l11() ?? 0)

  // Line 18: taxable conversion, line 16 less line 17; to Form 1040 line 4b
  l18 = (): number | undefined =>
    this.partII(() => this.l8raw() - (this.l11() ?? 0))

  // --- Part III: distributions from Roth IRAs ---
  // Completed only for a nonqualified Roth distribution.
  private partIII = <T>(value: () => T): T | undefined =>
    (this.data.rothDistributions ?? 0) > 0 ? value() : undefined

  // Line 19: total nonqualified distributions from Roth IRAs
  l19 = (): number | undefined =>
    this.partIII(() => this.dollars(this.data.rothDistributions ?? 0, '19'))

  // Line 20: qualified first-time homebuyer expenses (not modelled)
  l20 = (): number | undefined => this.partIII(() => 0)

  // Line 21: subtract line 20 from line 19
  l21 = (): number | undefined =>
    this.partIII(() => Math.max(0, (this.l19() ?? 0) - (this.l20() ?? 0)))

  // Line 22: basis in Roth IRA contributions
  l22 = (): number | undefined =>
    this.partIII(() => this.dollars(this.data.rothContributionBasis ?? 0, '22'))

  // Line 23: subtract line 22 from line 21
  l23 = (): number | undefined =>
    this.partIII(() => Math.max(0, (this.l21() ?? 0) - (this.l22() ?? 0)))

  // Line 24: basis in conversions and rollovers (not modelled)
  l24 = (): number | undefined => this.partIII(() => 0)

  // Line 25a: subtract line 24 from line 23
  l25a = (): number | undefined =>
    this.partIII(() => Math.max(0, (this.l23() ?? 0) - (this.l24() ?? 0)))

  // Line 25b: qualified disaster distributions (not modelled)
  l25b = (): number | undefined => this.partIII(() => 0)

  // Line 25c: taxable amount; to Form 1040 line 4b
  l25c = (): number | undefined =>
    this.partIII(() => (this.l25a() ?? 0) - (this.l25b() ?? 0))

  // This form's share of Form 1040 line 4b: lines 15c, 18 and 25c
  taxableAmount = (): number =>
    (this.l15c() ?? 0) + (this.l18() ?? 0) + (this.l25c() ?? 0)

  /** The template's controls in the order `fields()` fills them. */
  static readonly FIELD_NAMES: readonly string[] = [
    ...Array.from(
      { length: 23 },
      (_, i) => `f1_${String(i + 1).padStart(2, '0')}`
    ),
    ...Array.from(
      { length: 16 },
      (_, i) => `f2_${String(i + 1).padStart(2, '0')}`
    ),
    'c2_1',
    ...Array.from({ length: 5 }, (_, i) => `f2_${String(i + 17)}`)
  ]

  // Filled by name, so a reordered template cannot shift a line (the
  // positional map printed page 2 two lines low).
  namedFields = (): Record<string, Field> => {
    const values = this.fields()
    if (values.length !== F8606.FIELD_NAMES.length)
      throw new Error('Form 8606 fields and names disagree')
    return Object.fromEntries(
      F8606.FIELD_NAMES.map((name, i) => [name, values[i]])
    )
  }

  fields = (): Field[] => {
    // Line 10 is printed as a whole digit before the decimal point (f1_18,
    // one character) and three places after it (f1_19).
    const t = this.l10Thousandths()
    return [
      // Page 1. Positions checked against the printed line labels of the
      // official 2025 PDF (f1_09 line 1 … f1_23 line 14).
      this.f1040.namesString(), // f1_01 Name
      this.data.personRole === PersonRole.SPOUSE
        ? this.f1040.info.taxPayer.spouse?.ssid
        : this.f1040.info.taxPayer.primaryPerson.ssid, // f1_02 SSN
      undefined, // f1_03 Home address (only when filed by itself)
      undefined, // f1_04 Apt. no.
      undefined, // f1_05 City, state, ZIP
      undefined, // f1_06 Foreign country
      undefined, // f1_07 Foreign province
      undefined, // f1_08 Foreign postal code
      this.l1(), // f1_09 Line 1
      this.l2(), // f1_10 Line 2
      this.l3(), // f1_11 Line 3
      this.l4(), // f1_12 Line 4
      this.l5(), // f1_13 Line 5
      this.l6(), // f1_14 Line 6
      this.l7(), // f1_15 Line 7
      this.l8(), // f1_16 Line 8
      this.l9(), // f1_17 Line 9
      t === undefined ? undefined : String(Math.floor(t / 1000)), // f1_18 Line 10 whole
      t === undefined ? undefined : String(t % 1000).padStart(3, '0'), // f1_19 Line 10 places
      this.l11(), // f1_20 Line 11
      this.l12(), // f1_21 Line 12
      this.l13(), // f1_22 Line 13
      this.l14(), // f1_23 Line 14
      // Page 2 (f2_01 line 15a … f2_15 line 25c)
      this.l15a(), // f2_01 Line 15a
      this.l15b(), // f2_02 Line 15b
      this.l15c(), // f2_03 Line 15c
      this.l16(), // f2_04 Line 16
      this.l17(), // f2_05 Line 17
      this.l18(), // f2_06 Line 18
      this.l19(), // f2_07 Line 19
      this.l20(), // f2_08 Line 20
      this.l21(), // f2_09 Line 21
      this.l22(), // f2_10 Line 22
      this.l23(), // f2_11 Line 23
      this.l24(), // f2_12 Line 24
      this.l25a(), // f2_13 Line 25a
      this.l25b(), // f2_14 Line 25b
      this.l25c(), // f2_15 Line 25c
      // Signature block, used only when the form is filed by itself.
      undefined, // f2_16 Your signature date
      false, // c2_1 Paid preparer self-employed box
      undefined, // f2_17 Preparer PTIN
      undefined, // f2_18 Preparer firm name
      undefined, // f2_19 Firm EIN
      undefined, // f2_20 Firm address
      undefined // f2_21 Phone no.
    ]
  }
}
