import F1040Attachment from './F1040Attachment'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Field } from 'ustaxes/core/pdfFiller'
import F1040 from './F1040'
import { roundLine, sumToWholeDollars } from './rounding'

interface PayerAmount {
  payer?: string
  amount?: number
}

export default class ScheduleB extends F1040Attachment {
  tag: FormTag = 'f1040sb'
  sequenceIndex = 8
  readonly interestPayersLimit = 14
  readonly dividendPayersLimit = 15

  index = 0

  constructor(f1040: F1040, index = 0) {
    super(f1040)
    this.index = index
  }

  copies = (): ScheduleB[] => {
    if (this.index === 0) {
      const numInterestPayers = this.l1Fields().length
      const numDivPayers = this.l5Fields().length

      const extraCopiesNeeded = Math.floor(
        Math.max(
          numInterestPayers / this.interestPayersLimit,
          numDivPayers / this.dividendPayersLimit
        )
      )

      return Array.from(Array(extraCopiesNeeded)).map(
        (_, i) => new ScheduleB(this.f1040, i + 1)
      )
    } else {
      return []
    }
  }

  /**
   * Schedule B is filed when taxable interest or ordinary dividends exceed
   * $1,500, or when Part III (foreign accounts and trusts) applies; a
   * 1099-INT or 1099-DIV below that on its own does not require it
   * (2025 Instructions for Schedule B, "Who Must File").
   */
  isNeeded = (): boolean =>
    this.l2() > 1500 ||
    this.l6() > 1500 ||
    this.f1040.info.questions.FOREIGN_ACCOUNT_EXISTS === true ||
    this.f1040.info.questions.FOREIGN_TRUST_RELATIONSHIP === true

  /** Payers with an amount; a form reporting none is not a Schedule B row. */
  l1Fields = (): PayerAmount[] =>
    this.f1040
      .f1099Ints()
      .map((v) => ({
        payer: v.payer,
        amount: v.form.income
      }))
      .concat(
        this.f1040.k1sWithInterest().map((v) => ({
          payer: v.partnershipName,
          amount: v.interestIncome
        }))
      )
      .filter(({ amount }) => amount !== 0)

  l1 = (): Array<string | undefined> => {
    const payerValues = this.l1Fields().slice(
      this.index * this.interestPayersLimit,
      (this.index + 1) * this.interestPayersLimit
    )
    const rightPad = 2 * (this.interestPayersLimit - payerValues.length)
    // ensure we return an array of length interestPayersLimit * 2.
    // This form may have multiple copies, only display the copies for this form
    // Each payer's amount prints rounded; the total adds the cents first.
    return payerValues
      .flatMap(({ payer, amount }) => [
        payer,
        amount === undefined ? undefined : roundLine(amount).toString()
      ])
      .concat(Array(rightPad).fill(undefined))
  }

  /**
   * "If you have to add two or more amounts to figure the amount to enter on
   * a line, include cents when adding the amounts and round off only the
   * total" (2025 Instructions for Form 1040, Rounding Off to Whole Dollars).
   */
  l2 = (): number =>
    sumToWholeDollars(
      this.l1Fields().flatMap(({ amount }) =>
        amount === undefined ? [] : [amount]
      ),
      'Schedule B line 1'
    )

  // TODO: Interest from tax exempt savings bonds
  l3 = (): number | undefined => undefined

  l4 = (): number => this.l2() - (this.l3() ?? 0)

  /**
   * Total interest on all schedule Bs.
   * l2()/l4() already sum ALL payers (not paginated), so only use the
   * primary copy (index 0) to avoid double-counting across copies.
   */
  to1040l2b = (): number => this.l4()

  /**
   * Payers of ordinary dividends; a 1099-DIV reporting only a capital gain
   * distribution has no Part II row.
   */
  l5Fields = (): PayerAmount[] =>
    this.f1040
      .f1099Divs()
      .map((v) => ({
        payer: v.payer,
        amount: v.form.dividends
      }))
      .filter(({ amount }) => amount !== 0)

  l5 = (): Array<string | undefined | number> => {
    const payerValues = this.l5Fields().slice(
      this.index * this.dividendPayersLimit,
      (this.index + 1) * this.dividendPayersLimit
    )

    const rightPad = 2 * (this.dividendPayersLimit - payerValues.length)
    return payerValues
      .flatMap(({ payer, amount }) => [
        payer,
        amount === undefined ? undefined : roundLine(amount)
      ])
      .concat(Array(rightPad).fill(undefined))
  }

  l6 = (): number =>
    sumToWholeDollars(
      this.l5Fields().flatMap(({ amount }) =>
        amount === undefined ? [] : [amount]
      ),
      'Schedule B line 5'
    )

  /**
   * Total dividends on all schedule Bs.
   * l6() already sums ALL payers (not paginated), so only use the
   * primary copy (index 0) to avoid double-counting across copies.
   */
  to1040l3b = (): number => this.l6()

  foreignAccount = (): boolean =>
    this.f1040.info.questions.FOREIGN_ACCOUNT_EXISTS ?? false
  fincenForm = (): boolean => this.f1040.info.questions.FINCEN_114 ?? false
  fincenCountry = (): string | undefined =>
    this.f1040.info.questions.FINCEN_114_ACCOUNT_COUNTRY
  foreignTrust = (): boolean =>
    this.f1040.info.questions.FOREIGN_TRUST_RELATIONSHIP ?? false

  l7a = (): [boolean, boolean] => [
    this.foreignAccount(),
    !this.foreignAccount()
  ]

  /** Line 7a's second question is asked only after a Yes on the first. */
  l7a2 = (): [boolean, boolean] =>
    this.foreignAccount()
      ? [this.fincenForm(), !this.fincenForm()]
      : [false, false]

  l7b = (): string | undefined => this.fincenCountry()

  l8 = (): [boolean, boolean] => [this.foreignTrust(), !this.foreignTrust()]

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    ...this.l1(),
    this.l2(),
    this.l3(),
    this.l4(),
    ...this.l5(),
    this.l6(),
    ...this.l7a(),
    ...this.l7a2(),
    this.l7b(),
    undefined, // there are two separate fields for line 7b.
    ...this.l8()
  ]
}
