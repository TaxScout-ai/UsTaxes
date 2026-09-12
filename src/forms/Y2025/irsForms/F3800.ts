import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form3800Data, Form3800LineDetail } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { roundLine } from './rounding'
import F1040 from './F1040'

/** Line 13: individuals enter 25% of the net regular tax over $25,000. */
const LINE_13_THRESHOLD = 25000
const LINE_13_RATE = 0.25

/** A current-year credit line of Part III as the return carries it. */
export interface F3800PartIIILine {
  line: '1f' | '1y'
  /** Column (b). */
  registrationNumber?: string
  /** Column (c): the EIN, or "APPLD FOR". */
  entityEin?: string
  /** Column (e): credits not subject to the passive activity limits. */
  notPassive: number
  /** Column (f): the credit transfer election amount (bought credits are positive). */
  transferElection: number
  /** Column (g). */
  combined: number
  /** Column (i): the amount applied against tax in Part II. */
  applied: number
}

/**
 * Form 3800 (2025) — General Business Credit for an individual whose
 * credits are Form 8835 (line 1f, bought under a transfer election or the
 * filer's own) and the business/investment use part of Form 8936 (line
 * 1y). No passive activity credits, carryovers (Part IV), empowerment zone
 * credit (Section B) or specified credits (Section C) are carried, so the
 * credit allowed is the section 38(c)(1) limit on Part II, line 17, and it
 * is applied to the Part III lines in the order the instructions list the
 * credits (Form 8835 before Form 8936). Line 38 goes to Schedule 3 line 6a.
 */
export default class F3800 extends F1040Attachment {
  tag: FormTag = 'f3800'
  sequenceIndex = 22

  readonly data: Form3800Data

  constructor(f1040: F1040, data: Form3800Data = {}) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean => this.l6() > 0

  detail = (line: '1f' | '1y'): Form3800LineDetail | undefined =>
    this.data.lineDetails?.find((d) => d.line === line)

  private entityEin = (line: '1f' | '1y'): string | undefined => {
    const d = this.detail(line)
    return d?.entityEinAppliedFor ? 'APPLD FOR' : d?.entityEin
  }

  /** Part III current-year lines before the tax is applied, in the order the credits are used. */
  private rows = (): Omit<F3800PartIIILine, 'applied'>[] => {
    const rows: Omit<F3800PartIIILine, 'combined' | 'applied'>[] = []
    const f8835 = this.f1040.f8835
    if (f8835 !== undefined && f8835.l15() > 0) {
      const purchased = f8835.purchased()
      rows.push({
        line: '1f',
        registrationNumber:
          this.detail('1f')?.registrationNumber ??
          f8835.data.registrationNumber,
        entityEin: this.entityEin('1f'),
        notPassive: purchased ? 0 : f8835.l15(),
        transferElection: purchased ? f8835.l15() : 0
      })
    }
    const f8936 = this.f1040.f8936
    if (f8936 !== undefined && f8936.l8() > 0) {
      rows.push({
        line: '1y',
        registrationNumber: this.detail('1y')?.registrationNumber,
        entityEin: this.entityEin('1y'),
        notPassive: f8936.l8(),
        transferElection: 0
      })
    }
    return rows.map((r) => ({
      ...r,
      combined: r.notPassive + r.transferElection
    }))
  }

  /** Part III with column (i): the credit allowed (line 38) applied to the lines in order. */
  partIII = (): F3800PartIIILine[] => {
    let remaining = this.l38()
    return this.rows().map((r) => {
      const applied = Math.min(r.combined, remaining)
      remaining -= applied
      return { ...r, applied }
    })
  }

  /** Line B(i): a column (f) entry was made. */
  lBi = (): boolean => this.rows().some((r) => r.transferElection !== 0)
  /** Line B(ii): the transfer election statements attached. */
  lBii = (): number | undefined =>
    !this.lBi()
      ? undefined
      : this.data.transferElectionStatementCount ??
        this.rows().filter((r) => r.transferElection > 0).length

  // Part III totals (line 2 = line 6: no lines 3–5)
  l2e = (): number => sumFields(this.rows().map((r) => r.notPassive))
  l2f = (): number => sumFields(this.rows().map((r) => r.transferElection))
  l2g = (): number => sumFields(this.rows().map((r) => r.combined))
  l2i = (): number => sumFields(this.partIII().map((r) => r.applied))

  // Part I
  /** Line 1: column (e) with the non-passive amounts of column (f). */
  l1 = (): number => this.l2e() + this.l2f()
  l2 = (): number => 0
  l3 = (): number => 0
  l4 = (): number | undefined => undefined
  l5 = (): number | undefined => undefined
  l6 = (): number => sumFields([this.l1(), this.l3(), this.l4(), this.l5()])

  // Part II, Section A
  /** Line 7: Form 1040 line 16 plus Schedule 2 line 1z. */
  l7 = (): number => (this.f1040.l16() ?? 0) + this.f1040.schedule2.l1z()
  /** Line 8: Form 6251 line 11. */
  l8 = (): number => this.f1040.f6251.l11()
  l9 = (): number => this.l7() + this.l8()
  l10a = (): number | undefined => this.f1040.schedule3.l1()
  /**
   * Line 10b: Form 1040 line 19 and Schedule 3 lines 2 through 4, 5a, 5b
   * and 7 — the latter without this credit (6a), the prior-year minimum tax
   * credit (6b) and the tax credit bond credit (6k).
   */
  l10b = (): number => {
    const s3 = this.f1040.schedule3
    return sumFields([
      this.f1040.l19(),
      s3.l2(),
      s3.l3(),
      s3.l4(),
      s3.l5a(),
      s3.l5b(),
      s3.l6c(),
      s3.l6d(),
      s3.l6e(),
      s3.l6f(),
      s3.l6g(),
      s3.l6h(),
      s3.l6i(),
      s3.l6j(),
      s3.l6l(),
      s3.l6m(),
      s3.l6z()
    ])
  }
  l10c = (): number => (this.l10a() ?? 0) + this.l10b()
  /** Line 11: net income tax. */
  l11 = (): number => Math.max(0, this.l9() - this.l10c())
  /** Line 12: net regular tax. */
  l12 = (): number | undefined =>
    this.l11() === 0 ? undefined : Math.max(0, this.l7() - this.l10c())
  l13 = (): number | undefined =>
    this.l11() === 0
      ? undefined
      : Math.max(
          0,
          roundLine(((this.l12() ?? 0) - LINE_13_THRESHOLD) * LINE_13_RATE)
        )
  /** Line 14: tentative minimum tax, Form 6251 line 9. */
  l14 = (): number | undefined =>
    this.l11() === 0 ? undefined : this.f1040.f6251.l9()
  l15 = (): number | undefined =>
    this.l11() === 0 ? undefined : Math.max(this.l13() ?? 0, this.l14() ?? 0)
  l16 = (): number =>
    this.l11() === 0 ? 0 : Math.max(0, this.l11() - (this.l15() ?? 0))
  /** Line 17: the credit allowed after the section 38(c)(1) limitation. */
  l17 = (): number => Math.min(this.l6(), this.l16())

  // Section B: no empowerment zone credit, so lines 18–25 are skipped.
  l26 = (): number => 0

  // Section C: no specified credits.
  l27 = (): number => Math.max(0, this.l11() - (this.l13() ?? 0))
  l28 = (): number => this.l17() + this.l26()
  l29 = (): number => Math.max(0, this.l27() - this.l28())
  l30 = (): number => 0
  l32 = (): number => 0
  l33 = (): number => 0
  l34 = (): number => 0
  l35 = (): number => 0
  l36 = (): number => this.l30() + this.l33() + this.l34() + this.l35()
  l37 = (): number => Math.min(this.l29(), this.l36())

  // Section D
  /** Line 38: the credit allowed for the year, to Schedule 3 line 6a. */
  l38 = (): number => this.l28() + this.l37()

  namedFields = (): Record<string, Field> => {
    const money = (v: number | undefined): Field =>
      v === undefined || v === 0 ? undefined : v
    const rows: Record<string, Field> = {}
    const base: Record<'1f' | '1y', number> = { '1f': 51, '1y': 241 }
    for (const r of this.partIII()) {
      const b = base[r.line]
      rows[`f3_${b + 1}`] = r.registrationNumber
      rows[`f3_${b + 2}`] = r.entityEin
      rows[`f3_${b + 4}`] = money(r.notPassive)
      rows[`f3_${b + 5}`] = money(r.transferElection)
      rows[`f3_${b + 6}`] = money(r.combined)
      rows[`f3_${b + 8}`] = money(r.applied)
    }
    return {
      f1_1: this.f1040.namesString(),
      f1_2: this.f1040.info.taxPayer.primaryPerson.ssid,
      'c1_1[1]': true,
      'c1_2[0]': this.lBi(),
      'c1_2[1]': !this.lBi(),
      f1_3: this.lBii(),
      f1_4: this.l1(),
      f1_5: money(this.l2()),
      f1_6: this.l3(),
      f1_7: money(this.l4()),
      f1_8: money(this.l5()),
      f1_9: this.l6(),
      f1_10: this.l7(),
      f1_11: money(this.l8()),
      f1_12: this.l9(),
      f1_13: money(this.l10a()),
      f1_14: money(this.l10b()),
      f1_15: this.l10c(),
      f1_16: this.l11(),
      f1_17: this.l12(),
      f1_18: this.l13(),
      f1_19: this.l14(),
      f1_20: this.l15(),
      f1_21: this.l16(),
      f1_22: this.l17(),
      f2_9: this.l26(),
      f2_10: this.l27(),
      f2_11: this.l28(),
      f2_12: this.l29(),
      f2_13: this.l30(),
      f2_15: this.l32(),
      f2_16: this.l33(),
      f2_17: this.l34(),
      f2_18: this.l35(),
      f2_19: this.l36(),
      f2_20: this.l37(),
      f2_21: this.l38(),
      ...rows,
      f3_365: money(this.l2e()),
      f3_366: money(this.l2f()),
      f3_367: this.l2g(),
      f3_369: this.l2i(),
      f4_165: money(this.l2e()),
      f4_166: money(this.l2f()),
      f4_167: this.l2g(),
      f4_169: this.l2i()
    }
  }

  fields = (): Field[] => Object.values(this.namedFields())
}
