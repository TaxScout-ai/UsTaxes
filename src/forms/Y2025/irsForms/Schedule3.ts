import F1040Attachment from './F1040Attachment'
import { sumFields } from 'ustaxes/core/irsForms/util'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import { excessSocialSecurity } from './excessSocialSecurity'

export default class Schedule3 extends F1040Attachment {
  tag: FormTag = 'f1040s3'
  sequenceIndex = 3

  claimableExcessSSTaxWithholding = (): number =>
    excessSocialSecurity(this.f1040.validW2s())

  isNeeded = (): boolean =>
    this.claimableExcessSSTaxWithholding() > 0 ||
    this.f1040.totalForeignTaxCredit() > 0 ||
    (this.f1040.f2441?.credit() ?? 0) > 0 ||
    (this.f1040.f8863?.l19() ?? 0) > 0 ||
    (this.f1040.f8880?.credit() ?? 0) > 0 ||
    (this.f1040.f5695?.credit() ?? 0) > 0 ||
    (this.f1040.scheduleR?.l22() ?? 0) > 0 ||
    (this.f1040.f8801?.credit() ?? 0) > 0 ||
    this.l15() > 0

  deductions = (): number => 0
  // Part I: Nonrefundable credits
  l1 = (): number | undefined => {
    const credit = this.f1040.totalForeignTaxCredit()
    return credit > 0 ? credit : undefined
  }
  l2 = (): number | undefined => this.f1040.f2441?.credit()
  l3 = (): number | undefined => this.f1040.f8863?.l19()
  l4 = (): number | undefined => this.f1040.f8880?.credit()
  l5a = (): number | undefined => this.f1040.f5695?.pdfL15()
  l5b = (): number | undefined => this.f1040.f5695?.pdfL32()
  // Compatibility total; PDF and worksheet bindings use 5a and 5b separately.
  l5 = (): number => sumFields([this.l5a(), this.l5b()])
  l6a = (): number | undefined => undefined // TODO: other credits
  l6b = (): number | undefined => this.f1040.f8801?.credit()
  l6c = (): number | undefined => undefined // TODO: other credits
  l6d = (): number | undefined => this.f1040.scheduleR?.l22()
  l6e = (): number | undefined => undefined // TODO: other credits
  l6f = (): number | undefined => undefined // TODO: other credits
  l6g = (): number | undefined => undefined // TODO: other credits
  l6h = (): number | undefined => undefined // District of Columbia first-time homebuyer
  l6i = (): number | undefined => undefined // TODO: other credits
  l6j = (): number | undefined => undefined // TODO: other credits
  l6k = (): number | undefined => undefined // TODO: other credits
  l6l = (): number | undefined => undefined // TODO: other credits
  l6m = (): number | undefined => undefined // Previously owned clean vehicles
  l6zDesc1 = (): string | undefined => undefined
  l6zDesc2 = (): string | undefined => undefined
  l6z = (): number | undefined => undefined // TODO: other credits

  l7 = (): number =>
    sumFields([
      this.l6a(),
      this.l6b(),
      this.l6c(),
      this.l6d(),
      this.l6e(),
      this.l6f(),
      this.l6g(),
      this.l6h(),
      this.l6i(),
      this.l6j(),
      this.l6k(),
      this.l6l(),
      this.l6m(),
      this.l6z()
    ])

  l8 = (): number =>
    sumFields([
      this.l1(),
      this.l2(),
      this.l3(),
      this.l4(),
      this.l5(),
      this.l7()
    ])

  // Part II: Other payments and refundable credits
  l9 = (): number | undefined => this.f1040.f8962?.credit()

  // Line 10: Amount paid with extension for time to file
  l10 = (): number | undefined =>
    this.f1040.info.extensionPaymentAmount ?? undefined

  l11 = (): number =>
    // TODO: also applies to RRTA tax
    this.claimableExcessSSTaxWithholding()

  l12 = (): number | undefined => this.f1040.f4136?.credit()

  l13a = (): number | undefined => this.f1040.f2439?.credit()
  // TODO: qualified sick and family leave credits
  // Schedule H and form 7202 pre 4/1/21
  l13b = (): number | undefined => undefined

  // reserved!
  l13c = (): number | undefined => undefined

  // TODO: Credit for repayment of amounts included in income from earlier years
  l13d = (): number | undefined => undefined // TODO: 'other' box

  // reserved!
  l13e = (): number | undefined => undefined

  // deferred amount of net 965 tax liability
  l13f = (): number | undefined => undefined

  // reserved!
  l13g = (): number | undefined => undefined

  // TODO: qualified sick and family leave credits
  // Schedule H and form 7202 post 3/31/21
  l13h = (): number | undefined => undefined

  l13zDesc1 = (): string | undefined => undefined
  l13zDesc2 = (): string | undefined => undefined
  l13z = (): number | undefined => undefined

  l14 = (): number =>
    sumFields([
      this.l13a(),
      this.l13b(),
      this.l13c(),
      this.l13d(),
      this.l13e(),
      this.l13f(),
      this.l13g(),
      this.l13h(),
      this.l13z()
    ])

  l15 = (): number =>
    sumFields([this.l9(), this.l10(), this.l11(), this.l12(), this.l14()])

  // Credit for child and dependent care expenses form 2441, line 10

  namedFields = (): Record<string, Field> => ({
    f1_01: this.f1040.namesString(),
    f1_02: this.f1040.info.taxPayer.primaryPerson.ssid,
    f1_03: this.l1(),
    f1_04: this.l2(),
    f1_05: this.l3(),
    f1_06: this.l4(),
    f1_07: this.l5a(),
    f1_08: this.l5b(),
    f1_09: this.l6a(),
    f1_10: this.l6b(),
    f1_11: this.l6c(),
    f1_12: this.l6d(),
    f1_13: this.l6e(),
    f1_14: this.l6f(),
    f1_15: this.l6g(),
    f1_16: this.l6h(),
    f1_17: this.l6i(),
    f1_18: this.l6j(),
    f1_19: this.l6k(),
    f1_20: this.l6l(),
    f1_21: this.l6m(),
    f2_22: this.l6zDesc1(),
    f1_23: this.l6z(),
    f1_24: this.l7(),
    f1_25: this.l8(),
    f1_26: this.l9(),
    f1_27: this.l10(),
    f1_28: this.l11(),
    f1_29: this.l12(),
    f1_30: this.l13a(),
    // TY2025 13b repayment credit, 13c elective payment, 13d deferred section 965.
    f1_31: this.l13d(),
    f1_32: undefined,
    f1_33: this.l13f(),
    f1_34: this.l13zDesc1(),
    f1_35: this.l13z(),
    f1_36: this.l14(),
    f1_37: this.l15()
  })
  fields = (): Field[] => Object.values(this.namedFields())
}
