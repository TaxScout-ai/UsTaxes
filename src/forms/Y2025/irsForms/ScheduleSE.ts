import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { Field } from 'ustaxes/core/pdfFiller'
import { fica } from '../data/federal'

export default class ScheduleSE extends F1040Attachment {
  tag: FormTag = 'f1040sse'
  sequenceIndex = 14

  isNeeded = (): boolean =>
    this.f1040.info.scheduleK1Form1065s
      // Box 14 A is net SE earnings. B/C are gross amounts for optional
      // methods (Part II), not additional profit under the regular method.
      .map((k1) => k1.selfEmploymentEarningsA)
      .reduce((a, b) => a + b, 0) > 0 ||
    this.f1040.scheduleCNetProfit() !== 0 ||
    this.f1040.scheduleFNetProfit() !== 0

  postL4Field = (f: () => number | undefined): number | undefined => {
    if (this.l4c() < 400) {
      return undefined
    }
    return f()
  }

  l8aRelatedField = (f: () => number | undefined): number | undefined => {
    return this.postL4Field(() => {
      if ((this.l8a() ?? 0) >= fica.maxIncomeSSTaxApplies) {
        return undefined
      }
      return f()
    })
  }

  l1a = (): number => {
    const schFL34 = this.f1040.scheduleFNetProfit()
    return schFL34
  }

  l1b = (): number => 0

  l2 = (): number => {
    const schCL31 = this.f1040.scheduleCNetProfit()
    const k1SEA = this.f1040.info.scheduleK1Form1065s.reduce(
      (c, k1) => c + k1.selfEmploymentEarningsA,
      0
    )
    // Same regular-method source as upstream: code A, without adding C again.
    return schCL31 + k1SEA
  }

  l3 = (): number => sumFields([this.l1a(), this.l1b(), this.l2()])

  // TODO: Handle line 4A being less than 400 due to the Conservation Reserve Program
  l4a = (): number => {
    const l3 = this.l3()
    if (l3 > 0) {
      return l3 * 0.9235
    }
    return l3
  }

  l4b = (): number | undefined => undefined

  l4c = (): number => sumFields([this.l4a(), this.l4b()])

  l5a = (): number | undefined => this.postL4Field(() => 0)
  l5b = (): number | undefined =>
    this.postL4Field(() => {
      const l5a = this.l5a()
      if (l5a === undefined) {
        return undefined
      }
      return l5a * 0.9235
    })

  l6 = (): number | undefined =>
    this.postL4Field((): number => sumFields([this.l4c(), this.l5b()]))

  l7 = (): number => fica.maxIncomeSSTaxApplies

  l8a = (): number | undefined =>
    this.postL4Field((): number =>
      this.f1040.validW2s().reduce((c, w2) => c + w2.ssWages, 0)
    )

  // Line 8b: Unreported tips subject to social security tax (from Form 4137, line 10)
  l8b = (): number | undefined =>
    this.l8aRelatedField(
      (): number | undefined => this.f1040.f4137?.l10() ?? undefined
    )
  // Line 8c: Wages subject to social security tax (from Form 8919, line 10)
  l8c = (): number | undefined =>
    this.l8aRelatedField(
      (): number | undefined => this.f1040.f8919?.l10() ?? undefined
    )
  l8d = (): number | undefined =>
    this.l8aRelatedField((): number =>
      sumFields([this.l8a(), this.l8b(), this.l8c()])
    )

  l9 = (): number | undefined =>
    this.l8aRelatedField((): number =>
      Math.max(0, this.l7() - (this.l8d() ?? 0))
    )

  l10 = (): number | undefined =>
    this.l8aRelatedField(
      (): number => Math.min(this.l6() ?? 0, this.l9() ?? 0) * 0.124
    )

  l11 = (): number | undefined =>
    this.postL4Field((): number => (this.l6() ?? 0) * 0.029)

  l12 = (): number | undefined =>
    this.postL4Field((): number => sumFields([this.l10(), this.l11()]))

  l13 = (): number | undefined =>
    this.postL4Field((): number => (this.l12() ?? 0) * 0.5)

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    false, // Minister
    this.l1a(),
    this.l1b(),
    this.l2(),
    this.l3(),
    this.l4a(),
    this.l4b(),
    this.l4c(),
    this.l5a(),
    this.l5b(),
    this.l6(),
    this.l7(),
    this.l8a(),
    this.l8b(),
    this.l8c(),
    this.l8d(),
    this.l9(),
    this.l10(),
    this.l11(),
    this.l12(),
    this.l13(),
    // 2025: 4 new fields on page 2
    undefined, // [23] f2_1
    undefined, // [24] f2_2
    undefined, // [25] f2_3
    undefined // [26] f2_4
  ]
}
