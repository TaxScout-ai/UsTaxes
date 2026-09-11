import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { ScheduleCData, ScheduleCAccountingMethod } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'
import { standardMileageRateCents } from '../data/federal'

/**
 * Schedule C — Profit or Loss from Business (Sole Proprietorship)
 * IRS Form 1040 Schedule C
 *
 * Each instance represents one business. Multiple businesses
 * produce multiple ScheduleC instances via copies().
 */
export default class ScheduleC extends F1040Attachment {
  tag: FormTag = 'f1040sc'
  sequenceIndex = 9

  readonly data: ScheduleCData

  constructor(f1040: F1040, data: ScheduleCData) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.scheduleCBusinesses !== undefined &&
    this.f1040.info.scheduleCBusinesses.length > 0

  // Additional Schedule C forms for multiple businesses
  copies = (): ScheduleC[] => {
    const list = this.f1040.scheduleCList
    if (list.length <= 1) return []
    // Return all but the first (which is `this`)
    return list.slice(1)
  }

  // --- Part I: Income ---

  // Line 1: Gross receipts or sales; a statutory employee's W-2 wages when the box is checked.
  l1 = (): number =>
    this.data.grossReceipts +
    (this.data.statutoryEmployee
      ? this.f1040.statutoryEmployeeWages(this.data.personRole)
      : 0)

  // Line 2: Returns and allowances
  l2 = (): number => this.data.returns

  // Line 3: Subtract line 2 from line 1
  l3 = (): number => this.l1() - this.l2()

  // Line 4: Cost of goods sold (from Part III, line 42)
  l4 = (): number => this.l42()

  // Line 5: Gross profit. Subtract line 4 from line 3
  l5 = (): number => this.l3() - this.l4()

  // Line 6: Other income
  l6 = (): number => this.data.otherIncome

  // Line 7: Gross income. Add lines 5 and 6
  l7 = (): number => this.l5() + this.l6()

  // --- Part II: Expenses ---

  // Line 8: Advertising
  l8 = (): number => this.data.advertising

  // Line 9: Car and truck expenses; with Part IV, the standard mileage deduction for the business miles.
  l9 = (): number => this.data.carAndTruck + this.standardMileageDeduction()
  /** Business miles at the year's rate, whole dollars half up (Part IV line 44a). */
  standardMileageDeduction = (): number =>
    this.data.vehicle === undefined
      ? 0
      : Math.round(
          (this.data.vehicle.businessMiles * standardMileageRateCents) / 100
        )

  // Line 10: Commissions and fees
  l10 = (): number => this.data.commissions

  // Line 11: Contract labor
  l11 = (): number => this.data.contractLabor

  // Line 12: Depletion
  l12 = (): number => this.data.depletion

  // Line 13: Depreciation and section 179 expense deduction
  l13 = (): number => this.data.depreciation

  // Line 14: Employee benefit programs
  l14 = (): number => this.data.employeeBenefits

  // Line 15: Insurance (other than health)
  l15 = (): number => this.data.insurance

  // Line 16a: Interest on mortgage
  l16a = (): number => this.data.interestMortgage

  // Line 16b: Interest on other business debt
  l16b = (): number => this.data.interestOther

  // Line 17: Legal and professional services
  l17 = (): number => this.data.legal

  // Line 18: Office expense
  l18 = (): number => this.data.officeExpense

  // Line 19: Pension and profit-sharing plans
  l19 = (): number => this.data.pensionProfitSharing

  // Line 20a: Rent or lease — vehicles, machinery, equipment
  l20a = (): number => this.data.rentVehicles

  // Line 20b: Rent or lease — other business property
  l20b = (): number => this.data.rentOther

  // Line 21: Repairs and maintenance
  l21 = (): number => this.data.repairs

  // Line 22: Supplies
  l22 = (): number => this.data.supplies

  // Line 23: Taxes and licenses
  l23 = (): number => this.data.taxes

  // Line 24a: Travel
  l24a = (): number => this.data.travel

  // Line 24b: Deductible meals
  l24b = (): number => this.data.meals

  // Line 25: Utilities
  l25 = (): number => this.data.utilities

  // Line 26: Wages (less employment credits)
  l26 = (): number => this.data.wages

  // Line 27a: Other expenses (from Part V, line 48)
  l27a = (): number => this.data.otherExpenses

  // Line 27b: Reserved for future use
  l27b = (): number => 0

  // Line 28: Total expenses before expenses for business use of home.
  // Add lines 8 through 27a
  l28 = (): number =>
    sumFields([
      this.l8(),
      this.l9(),
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16a(),
      this.l16b(),
      this.l17(),
      this.l18(),
      this.l19(),
      this.l20a(),
      this.l20b(),
      this.l21(),
      this.l22(),
      this.l23(),
      this.l24a(),
      this.l24b(),
      this.l25(),
      this.l26(),
      this.l27a()
    ])

  // Line 29: Tentative profit or (loss). Subtract line 28 from line 7
  l29 = (): number => this.l7() - this.l28()

  // Line 30: Expenses for business use of your home (from Form 8829)
  // Use Form 8829's computed deduction if available, otherwise fall back to raw data
  l30 = (): number => {
    const f8829Deduction = this.f1040.f8829?.deduction()
    if (f8829Deduction !== undefined && f8829Deduction > 0) {
      if (this.l29() > 0) {
        return Math.min(f8829Deduction, this.l29())
      }
      return 0
    }
    if (this.data.homeOfficeDeduction !== undefined) {
      if (this.l29() > 0) {
        return Math.min(this.data.homeOfficeDeduction, this.l29())
      }
      return 0
    }
    return 0
  }

  // Line 31: Net profit or (loss). Subtract line 30 from line 29.
  // If a profit, enter on both Schedule 1 line 3 and Schedule SE line 2.
  // If a loss, you MUST check box 32a or 32b.
  l31 = (): number => this.l29() - this.l30()

  // Line 32a: All investment is at risk
  l32a = (): boolean => true

  // Line 32b: Some investment is not at risk
  l32b = (): boolean => false

  // --- Part III: Cost of Goods Sold ---

  // Line 33: Method used for valuing closing inventory
  // a-Cost, b-Lower of cost or market, c-Other
  l33 = (): string => 'a'

  // Line 34: Was there any change in determining quantities, costs, or valuations?
  l34 = (): boolean => false

  // Line 35: Inventory at beginning of year
  l35 = (): number => this.data.inventoryBeginning ?? 0

  // Line 36: Purchases less cost of items withdrawn for personal use
  l36 = (): number => this.data.purchases ?? 0

  // Line 37: Cost of labor
  l37 = (): number => this.data.laborCost ?? 0

  // Line 38: Materials and supplies
  l38 = (): number => this.data.materials ?? 0

  // Line 39: Other costs
  l39 = (): number => this.data.otherCosts ?? 0

  // Line 40: Add lines 35 through 39
  l40 = (): number =>
    sumFields([this.l35(), this.l36(), this.l37(), this.l38(), this.l39()])

  // Line 41: Inventory at end of year
  l41 = (): number => this.data.inventoryEnd ?? 0

  // Line 42: Cost of goods sold. Subtract line 41 from line 40
  l42 = (): number => Math.max(0, this.l40() - this.l41())

  // Statutory employee income (for Schedule 8812 earned income calculation)
  statutoryEmployeeIncome = (): number | undefined => this.l1()

  // Net profit or loss for Schedule SE
  netProfitOrLoss = (): number => this.l31()

  fields = (): Field[] => [
    // --- Page 1 header ---
    this.f1040.namesString(), // 0: Name of proprietor
    this.f1040.info.taxPayer.primaryPerson.ssid, // 1: SSN

    // --- Lines A–E ---
    this.data.businessName, // 2: A – Principal business or profession
    this.data.businessCode, // 3: B – Business code
    this.data.businessName, // 4: C – Business name
    this.data.ein ?? '', // 5: D – EIN
    '', // 6: E – Business address
    '', // 7: E – City, state, ZIP

    // --- Line F: Accounting method ---
    this.data.accountingMethod === ScheduleCAccountingMethod.Cash, // 8: F(1) Cash
    this.data.accountingMethod === ScheduleCAccountingMethod.Accrual, // 9: F(2) Accrual
    this.data.accountingMethod === ScheduleCAccountingMethod.Other, // 10: F(3) Other
    '', // 11: F – Other (specify) text

    // --- Lines G–J ---
    this.data.didMateriallyParticipate, // 12: G – Yes
    !this.data.didMateriallyParticipate, // 13: G – No
    this.data.didStartBusiness, // 14: H – checkbox
    this.data.didMakePaymentsRequiring1099, // 15: I – Yes
    !this.data.didMakePaymentsRequiring1099, // 16: I – No
    this.data.didFile1099s, // 17: J – Yes
    !this.data.didFile1099s, // 18: J – No

    // --- Part I: Income ---
    this.data.statutoryEmployee ?? false, // 19: Line 1 – Statutory employee checkbox
    this.l1(), // 20: Line 1
    this.l2(), // 21: Line 2
    this.l3(), // 22: Line 3
    this.l4(), // 23: Line 4
    this.l5(), // 24: Line 5
    this.l6(), // 25: Line 6
    this.l7(), // 26: Line 7

    // --- Part II: Expenses ---
    this.l8(), // 27: Line 8 – Advertising
    this.l9(), // 28: Line 9 – Car and truck expenses
    this.l10(), // 29: Line 10 – Commissions and fees
    this.l11(), // 30: Line 11 – Contract labor
    this.l12(), // 31: Line 12 – Depletion
    this.l13(), // 32: Line 13 – Depreciation / §179
    this.l14(), // 33: Line 14 – Employee benefit programs
    this.l15(), // 34: Line 15 – Insurance
    this.l16a(), // 35: Line 16a – Mortgage interest
    this.l16b(), // 36: Line 16b – Other interest
    this.l17(), // 37: Line 17 – Legal / professional
    this.l18(), // 38: Line 18 – Office expense
    this.l19(), // 39: Line 19 – Pension / profit-sharing
    this.l20a(), // 40: Line 20a – Rent: vehicles/equip
    this.l20b(), // 41: Line 20b – Rent: other property
    this.l21(), // 42: Line 21 – Repairs / maintenance
    this.l22(), // 43: Line 22 – Supplies
    this.l23(), // 44: Line 23 – Taxes and licenses
    this.l24a(), // 45: Line 24a – Travel
    this.l24b(), // 46: Line 24b – Deductible meals
    this.l25(), // 47: Line 25 – Utilities
    this.l26(), // 48: Line 26 – Wages
    this.l27a(), // 49: Line 27a – Energy efficient bldgs
    this.l27b(), // 50: Line 27b – Other expenses (from 48)
    this.l28(), // 51: Line 28 – Total expenses
    this.l29(), // 52: Line 29 – Tentative profit/loss

    // --- Line 30: Business use of home ---
    undefined, // 53: Simplified method – (a) total sq ft
    undefined, // 54: Simplified method – (b) business sq ft
    this.l30(), // 55: Line 30

    // --- Lines 31–32 ---
    this.l31(), // 56: Line 31 – Net profit/loss
    this.l32a(), // 57: Line 32a checkbox
    this.l32b(), // 58: Line 32b checkbox

    // --- Page 2 – Part III: Cost of Goods Sold ---
    this.l33() === 'a', // 59: Line 33a – Cost
    this.l33() === 'b', // 60: Line 33b – Lower of cost or market
    this.l33() === 'c', // 61: Line 33c – Other
    this.l34(), // 62: Line 34 – Yes
    !this.l34(), // 63: Line 34 – No
    this.l35(), // 64: Line 35
    this.l36(), // 65: Line 36
    this.l37(), // 66: Line 37
    this.l38(), // 67: Line 38
    this.l39(), // 68: Line 39
    this.l40(), // 69: Line 40
    this.l41(), // 70: Line 41
    this.l42(), // 71: Line 42

    // --- Part IV: Information on Your Vehicle ---
    this.data.vehicle?.placedInServiceDate.slice(5, 7), // 72: Line 43 – month
    this.data.vehicle?.placedInServiceDate.slice(8, 10), // 73: Line 43 – day
    this.data.vehicle?.placedInServiceDate.slice(0, 4), // 74: Line 43 – year
    this.data.vehicle?.businessMiles, // 75: Line 44a – Business miles
    this.data.vehicle?.commutingMiles, // 76: Line 44b – Commuting miles
    this.data.vehicle?.otherMiles, // 77: Line 44c – Other miles
    this.data.vehicle ? this.data.vehicle.availableForPersonalUse : undefined, // 78: Line 45 – Yes
    this.data.vehicle ? !this.data.vehicle.availableForPersonalUse : undefined, // 79: Line 45 – No
    this.data.vehicle ? this.data.vehicle.anotherVehicleAvailable : undefined, // 80: Line 46 – Yes
    this.data.vehicle ? !this.data.vehicle.anotherVehicleAvailable : undefined, // 81: Line 46 – No
    this.data.vehicle ? this.data.vehicle.hasEvidence : undefined, // 82: Line 47a – Yes
    this.data.vehicle ? !this.data.vehicle.hasEvidence : undefined, // 83: Line 47a – No
    this.data.vehicle ? this.data.vehicle.evidenceIsWritten : undefined, // 84: Line 47b – Yes
    this.data.vehicle ? !this.data.vehicle.evidenceIsWritten : undefined, // 85: Line 47b – No

    // --- Part V: Other Expenses (9 rows of description + amount) ---
    undefined, // 86: Row 1 description
    undefined, // 87: Row 1 amount
    undefined, // 88: Row 2 description
    undefined, // 89: Row 2 amount
    undefined, // 90: Row 3 description
    undefined, // 91: Row 3 amount
    undefined, // 92: Row 4 description
    undefined, // 93: Row 4 amount
    undefined, // 94: Row 5 description
    undefined, // 95: Row 5 amount
    undefined, // 96: Row 6 description
    undefined, // 97: Row 6 amount
    undefined, // 98: Row 7 description
    undefined, // 99: Row 7 amount
    undefined, // 100: Row 8 description
    undefined, // 101: Row 8 amount
    undefined, // 102: Row 9 description
    undefined, // 103: Row 9 amount
    undefined // 104: Line 48 – Total other expenses
  ]
}
