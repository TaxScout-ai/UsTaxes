import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'
import { SCHEDULE2_FIELDS } from '../fieldMaps'

export default class Schedule2 extends F1040Attachment {
  tag: FormTag = 'f1040s2'
  sequenceIndex = 2

  isNeeded = (): boolean => this.l3() > 0 || this.l21() > 0

  // Part I: Tax
  l1a = (): number | undefined => this.f1040.f8962?.excessAdvancePTC()
  l1b = (): number | undefined => undefined // TODO: Form 8936
  l1c = (): number | undefined => undefined // TODO: Form 8936
  l1d = (): number | undefined => undefined //TODO: Form 4255 line 2a column i
  l1ei = (): boolean | undefined => undefined
  l1eii = (): boolean | undefined => undefined
  l1eiii = (): boolean | undefined => undefined
  l1eiv = (): boolean | undefined => undefined
  l1e = (): number | undefined => undefined
  l1fi = (): boolean | undefined => undefined
  l1fii = (): boolean | undefined => undefined
  l1fiii = (): boolean | undefined => undefined
  l1fiv = (): boolean | undefined => undefined
  l1f = (): number | undefined => undefined
  l1y = (): number | undefined => undefined
  l1z = (): number =>
    sumFields([
      this.l1a(),
      this.l1b(),
      this.l1c(),
      this.l1d(),
      this.l1e(),
      this.l1f()
    ])

  l2 = (): number | undefined => this.f1040.f6251.l11()
  l3 = (): number => sumFields([this.l1z(), this.l2()])

  // Part II: Other Tax
  l4 = (): number | undefined => this.f1040.scheduleSE.l12() // self-employment tax (schedule SE)
  l5 = (): number | undefined => {
    const total = sumFields([this.f1040.f4137?.l13(), this.f1040.f8919?.l6()])
    return total > 0 ? total : undefined
  }
  l6 = (): number | undefined => undefined // TODO: additional tax on retirement accounts
  l7 = (): number | undefined => sumFields([this.l5(), this.l6()])
  l8box = (): boolean => false // TODO: implement this after l8 is implemented.
  l8 = (): number | undefined => undefined // TODO: additional tax on IRAs or other tax favored accoutns, form 5329
  l9 = (): number | undefined => this.f1040.scheduleH?.toSchedule2()
  l10 = (): number | undefined => undefined // repayment of firsttime homebuyer credit, form 5405
  l11 = (): number | undefined =>
    this.f1040.f8959.isNeeded() ? this.f1040.f8959.toSchedule2l11() : undefined
  l12 = (): number | undefined => this.f1040.f8960.toSchedule2l12()
  // Line 13: Uncollected SS/Medicare from W-2 box 12 codes A and B
  l13 = (): number | undefined => {
    const w2s = this.f1040.validW2s()
    let total = 0
    for (const w2 of w2s) {
      if (w2.box12) {
        total += w2.box12.A ?? 0
        total += w2.box12.B ?? 0
      }
    }
    return total > 0 ? total : undefined
  }
  l14 = (): number | undefined => undefined // TODO - interest on tax due on installment income from the sale of residential lots and timeshares
  l15 = (): number | undefined => undefined //interest on the deferred tax on gain from certain installment sales with a sales price over 150000.
  l16 = (): number | undefined => undefined // recapture of low-income housing credit, form 8611

  // Other additional taxes:
  // TODO: Recapture of other credits. List type, form number, and
  // amount ▶
  l17aDesc = (): string | undefined => undefined
  l17a = (): number | undefined => undefined
  // TODO: Recapture of federal mortgage subsidy. If you sold your home in
  // 2021, see instructions
  l17b = (): number | undefined => undefined

  l17c = (): number | undefined =>
    sumFields([this.f1040.f8889.l17b(), this.f1040.f8889Spouse?.l17b()])

  l17d = (): number | undefined =>
    sumFields([this.f1040.f8889.l21(), this.f1040.f8889Spouse?.l21()])
  // TODO: Additional tax on Archer MSA distributions. Attach Form 8853
  l17e = (): number | undefined => undefined
  // TODO: Additional tax on Medicare Advantage MSA distributions. Attach
  // Form 8853
  l17f = (): number | undefined => undefined
  // TODO: Recapture of a charitable contribution deduction related to a
  // fractional interest in tangible personal property...17g
  l17g = (): number | undefined => undefined
  // TODO: Income you received from a nonqualified deferred compensation
  // plan that fails to meet the requirements of section 409A.17h
  l17h = (): number | undefined => undefined
  // TODO Compensation you received from a nonqualified deferred
  // compensation plan described in section 457A
  l17i = (): number | undefined => undefined
  // Section 72(m)(5) excess benefits tax
  l17j = (): number | undefined => undefined
  // TODO: Golden parachute payments
  l17k = (): number | undefined => undefined
  // Tax on accumulation distribution of trusts
  l17l = (): number | undefined => undefined
  // m Excise tax on insider stock compensation from an expatriated
  // corporation
  l17m = (): number | undefined => undefined
  // n Look-back interest under section 167(g) or 460(b) from Form
  // 8697 or 8866
  l17n = (): number | undefined => undefined
  // o Tax on non-effectively connected income for any part of the
  // year you were a nonresident alien from Form 1040-NR
  l17o = (): number | undefined => undefined
  // p Any interest from Form 8621, line 16f, relating to distributions
  // from, and disassets of, stock of a section 1291 fund.. 17p
  l17p = (): number | undefined => undefined
  // q Any interest from Form 8621, line 24
  l17q = (): number | undefined => undefined
  // z Any other taxes. List type and amount ▶
  l17zDesc = (): string | undefined => undefined
  l17z = (): number | undefined => undefined
  // 18Total additional taxes. Add lines 17a through 17z.......18
  l18 = (): number =>
    sumFields([
      this.l17a(),
      this.l17b(),
      this.l17c(),
      this.l17d(),
      this.l17e(),
      this.l17f(),
      this.l17g(),
      this.l17h(),
      this.l17i(),
      this.l17j(),
      this.l17k(),
      this.l17l(),
      this.l17m(),
      this.l17n(),
      this.l17o(),
      this.l17p(),
      this.l17q(),
      this.l17z()
    ])

  // Recapture of net EPE from Form 4255, line 1d, column (l)
  l19 = (): number | undefined => undefined

  // TODO: Section 965 net tax liability installment from Form 965-A. .
  l20 = (): number | undefined => undefined

  // Add lines 4, 7 through 16, 18, 19, and 20. These are your total other taxes.
  l21 = (): number =>
    sumFields([
      this.l4(),
      this.l7(),
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l18(),
      this.l19(),
      this.l20()
    ])

  to1040l23 = (): number => this.l21()
  // and on Form 1040 or 1040-SR, line 23, or Form 1040-NR, line 23b

  namedFields = (): Record<string, Field> => {
    const fm = SCHEDULE2_FIELDS
    const vals: Record<string, Field> = {}
    const set = (key: string, value: Field) => {
      const f = fm[key]
      if (f && value !== undefined && value !== null) vals[f] = value
    }
    set('name', this.f1040.namesString())
    set('ssn', this.f1040.info.taxPayer.primaryPerson.ssid)
    // Part I
    set('line_1a', this.l1a())
    set('line_1b', this.l1b())
    set('line_1c', this.l1c())
    set('line_1d', this.l1d())
    set('line_1e', this.l1e())
    set('line_1f', this.l1f())
    set('line_1y', this.l1y())
    set('line_1z', this.l1z())
    set('line_2', this.l2())
    set('line_3', this.l3())
    // Part II
    set('line_4', this.l4())
    set('line_5', this.l5())
    set('line_6', this.l6())
    set('line_7', this.l7())
    set('line_8', this.l8())
    set('line_9', this.l9())
    set('line_11', this.l11())
    set('line_12', this.l12())
    set('line_13', this.l13())
    // Page 2
    set('line_17a_desc', this.l17aDesc())
    set('line_17a', this.l17a())
    set('line_17b', this.l17b())
    set('line_17c', this.l17c())
    set('line_17d', this.l17d())
    set('line_17e', this.l17e())
    set('line_17f', this.l17f())
    set('line_17g', this.l17g())
    set('line_17h', this.l17h())
    set('line_17z_desc', this.l17zDesc())
    set('line_17z', this.l17z())
    set('line_18', this.l18())
    set('line_20', this.l20())
    set('line_21', this.l21())
    return vals
  }

  // 2025 Schedule 2 — 63 fields (12 checkboxes interspersed)
  fields = (): Field[] => [
    this.f1040.namesString(), // [ 0] f1_01 name
    this.f1040.info.taxPayer.primaryPerson.ssid, // [ 1] f1_02 SSN
    this.l1a(), // [ 2] f1_03 line 1a AMT
    this.l1b(), // [ 3] f1_04 line 1b excess premium tax
    this.l1c(), // [ 4] f1_05 line 1c
    this.l1d(), // [ 5] f1_06 line 1d
    this.l1ei(), // [ 6] c1_1  line 1e checkbox i
    this.l1eii(), // [ 7] c1_1[1] line 1e checkbox ii
    this.l1eiii(), // [ 8] c1_1[2] line 1e checkbox iii
    this.l1eiv(), // [ 9] c1_1[3] line 1e checkbox iv
    this.l1e(), // [10] f1_07 line 1e amount
    this.l1fi(), // [11] c1_2  line 1f checkbox i
    this.l1fii(), // [12] c1_2[1] line 1f checkbox ii
    this.l1fiii(), // [13] c1_2[2] line 1f checkbox iii
    this.l1fiv(), // [14] c1_2[3] line 1f checkbox iv
    this.l1f(), // [15] f1_08 line 1f amount
    this.l1y(), // [16] f1_09 line 1y
    this.l1z(), // [17] f1_10 line 1z
    this.l2(), // [18] f1_11 line 2
    this.l3(), // [19] f1_12 line 3
    this.l4(), // [20] f1_13 line 4
    false, // [21] c1_3  line 4 checkbox (8959)
    false, // [22] c1_4  line 4 checkbox (8960)
    false, // [23] c1_5  line 4 checkbox (other)
    this.l5(), // [24] f1_14 line 5
    this.l6(), // [25] f1_15 line 6
    this.l7(), // [26] f1_16 line 7
    this.l8(), // [27] f1_17 line 8
    this.l9(), // [28] f1_18 line 9
    this.l8box(), // [29] c1_6  line 8 checkbox
    this.l10(), // [30] f1_19 line 10
    this.l11(), // [31] f1_20 line 11
    this.l12(), // [32] f1_21 line 12
    this.l13(), // [33] f1_22 line 13
    this.l14(), // [34] f1_23 line 14
    this.l15(), // [35] f1_24 line 15
    this.l16(), // [36] f1_25 line 16
    this.l17aDesc(), // [37] f1_26 line 17a desc
    this.l17a(), // [38] f1_27 line 17a
    // Page 2
    this.l17b(), // [39] f2_01 line 17b (17a desc cont)
    this.l17b(), // [40] f2_02 line 17b
    this.l17c(), // [41] f2_03
    this.l17d(), // [42] f2_04
    this.l17e(), // [43] f2_05
    this.l17f(), // [44] f2_06
    this.l17g(), // [45] f2_07
    this.l17h(), // [46] f2_08
    this.l17i(), // [47] f2_09
    this.l17j(), // [48] f2_10
    this.l17k(), // [49] f2_11
    this.l17l(), // [50] f2_12
    this.l17m(), // [51] f2_13
    this.l17n(), // [52] f2_14
    this.l17o(), // [53] f2_15
    this.l17p(), // [54] f2_16
    this.l17q(), // [55] f2_17
    this.l17zDesc(), // [56] f2_18
    this.l17z(), // [57] f2_19 line 17z
    this.l18(), // [58] f2_20 line 18
    undefined, // [59] f2_21 line 19
    this.l20(), // [60] f2_22 line 20
    this.l21(), // [61] f2_23 line 21
    undefined // [62] f2_24
  ]
}
