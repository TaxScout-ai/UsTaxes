import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { ScheduleFData } from 'ustaxes/core/data'
import { sumFields } from 'ustaxes/core/irsForms/util'
import F1040 from './F1040'
import { roundLine } from './rounding'

/**
 * Schedule F — Profit or Loss from Farming
 *
 * Reports income and expenses from farming operations.
 * Net profit/loss flows to Schedule 1 line 6.
 *
 * Reference: IRS TY2025 Schedule F and printed PDF line labels
 */
export default class ScheduleF extends F1040Attachment {
  tag: FormTag = 'f1040sf'
  sequenceIndex = 15

  readonly data: ScheduleFData

  constructor(f1040: F1040, data: ScheduleFData) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.f1040.info.scheduleFData !== undefined &&
    this.f1040.info.scheduleFData.length > 0

  // --- Part I: Farm Income (Cash Method) ---

  // Line 1a: Sales of livestock bought for resale
  l1a = (): number => this.data.salesLivestock

  // Line 1b: Cost of livestock bought for resale
  l1b = (): number => this.data.costLivestock

  // Line 1c: Subtract line 1b from line 1a
  l1c = (): number => this.l1a() - this.l1b()

  // Line 2: Sales of livestock, produce, grains, etc. raised
  l2 = (): number => 0 // Simplified — included in l1a

  // Line 3a: Cooperative distributions
  l3a = (): number => this.data.cooperativeDistributions

  // Line 4a: Agricultural program payments
  l4a = (): number => this.data.agriculturePayments

  // Line 5a: CCC loans
  l5a = (): number => this.data.cccLoans

  // Line 6: Crop insurance proceeds
  l6 = (): number => this.data.cropInsurance

  // Line 7: Custom hire (machine work) income
  l7 = (): number => this.data.customHireIncome ?? 0

  // Line 8: Other farm income
  l8 = (): number => this.data.otherFarmIncome

  // Line 9: Gross farm income
  l9 = (): number =>
    sumFields([
      this.l1c(),
      this.l2(),
      this.l3a(),
      this.l4a(),
      this.l5a(),
      this.l6(),
      this.l7(),
      this.l8()
    ])

  // --- Part II: Farm Expenses ---

  l10 = (): number => this.data.carAndTruck
  l11 = (): number => this.data.chemicals ?? 0
  l12 = (): number => this.data.conservation
  l13 = (): number => this.data.customHire
  l14 = (): number => this.data.depreciation ?? 0
  l15 = (): number => this.data.employeeBenefits
  l16 = (): number => this.data.feed
  l17 = (): number => this.data.fertilizers
  l18 = (): number => this.data.freight
  l19 = (): number => this.data.fuel
  l20 = (): number => this.data.insurance
  l21a = (): number => this.data.interestMortgage ?? 0
  l21b = (): number => this.data.interestOther ?? 0
  l22 = (): number => this.data.labor
  l23 = (): number => this.data.pensionProfitSharing
  l24a = (): number => this.data.rentVehicles
  l24b = (): number => this.data.rentOther
  l25 = (): number => this.data.repairs
  l26 = (): number => this.data.seeds
  l27 = (): number => this.data.storage
  l28 = (): number => this.data.supplies ?? 0
  l29 = (): number => this.data.taxes ?? 0
  l30 = (): number => this.data.utilities ?? 0
  l31 = (): number => this.data.veterinary
  l32 = (): number => this.data.otherExpenses ?? 0

  // Line 33: Total expenses
  l33 = (): number =>
    sumFields([
      this.l10(),
      this.l11(),
      this.l12(),
      this.l13(),
      this.l14(),
      this.l15(),
      this.l16(),
      this.l17(),
      this.l18(),
      this.l19(),
      this.l20(),
      this.l21a(),
      this.l21b(),
      this.l22(),
      this.l23(),
      this.l24a(),
      this.l24b(),
      this.l25(),
      this.l26(),
      this.l27(),
      this.l28(),
      this.l29(),
      this.l30(),
      this.l31(),
      this.l32()
    ])

  // Line 34: Net farm profit or (loss)
  l34 = (): number => this.l9() - this.l33()

  // Net profit/loss for Schedule 1
  netProfitOrLoss = (): number => this.l34()

  namedFields = (): Record<string, Field> => {
    const d = this.data
    const values: Record<string, Field> = {
      'f1_1[0]': this.f1040.namesString(),
      'f1_2[0]': this.f1040.info.taxPayer.primaryPerson.ssid,
      'f1_3[0]': d.farmName,
      'f1_4[0]': d.activityCode,
      'f1_5[0]': d.ein,
      'c1_1[0]': d.accountingMethod === 'Cash',
      'c1_1[1]': d.accountingMethod === 'Accrual',
      'c1_2[0]': d.materiallyParticipated === true,
      'c1_2[1]': d.materiallyParticipated === false,
      'c1_3[0]': d.paymentsRequiringForms1099 === true,
      'c1_3[1]': d.paymentsRequiringForms1099 === false,
      'c1_4[0]':
        d.paymentsRequiringForms1099 === true && d.forms1099Filed === true,
      'c1_4[1]':
        d.paymentsRequiringForms1099 === true && d.forms1099Filed === false,
      'f1_47[0]': d.otherExpensesDescription,
      'f1_48[0]': roundLine(this.l32()),
      'f1_17[0]': roundLine(this.l6()),
      'f1_18[0]': roundLine(this.l6()),
      'f1_11[0]': roundLine(this.l3a()),
      'f1_13[0]': roundLine(this.l4a()),
      'f1_6[0]': roundLine(this.l1a()),
      'f1_7[0]': roundLine(this.l1b()),
      'f1_8[0]': roundLine(this.l1c()),
      'f1_9[0]': roundLine(this.l2()),
      'f1_10[0]': roundLine(this.l3a()),
      'f1_12[0]': roundLine(this.l4a()),
      'f1_14[0]': roundLine(this.l5a()),
      'f1_20[0]': roundLine(this.l7()),
      'f1_21[0]': roundLine(this.l8()),
      'f1_22[0]': roundLine(this.l9()),
      'f1_23[0]': roundLine(this.l10()),
      'f1_24[0]': roundLine(this.l11()),
      'f1_25[0]': roundLine(this.l12()),
      'f1_26[0]': roundLine(this.l13()),
      'f1_27[0]': roundLine(this.l14()),
      'f1_28[0]': roundLine(this.l15()),
      'f1_29[0]': roundLine(this.l16()),
      'f1_30[0]': roundLine(this.l17()),
      'f1_31[0]': roundLine(this.l18()),
      'f1_32[0]': roundLine(this.l19()),
      'f1_33[0]': roundLine(this.l20()),
      'f1_36[0]': roundLine(this.l22()),
      'f1_37[0]': roundLine(this.l23()),
      'f1_40[0]': roundLine(this.l25()),
      'f1_41[0]': roundLine(this.l26()),
      'f1_42[0]': roundLine(this.l27()),
      'f1_43[0]': roundLine(this.l28()),
      'f1_44[0]': roundLine(this.l29()),
      'f1_45[0]': roundLine(this.l30()),
      'f1_46[0]': roundLine(this.l31()),
      'f1_59[0]': roundLine(this.l33()),
      'f1_60[0]': roundLine(this.l34()),
      'f1_34[0]': roundLine(this.l21a()),
      'f1_35[0]': roundLine(this.l21b()),
      'f1_38[0]': roundLine(this.l24a()),
      'f1_39[0]': roundLine(this.l24b())
    }
    return values
  }

  fields = (): Field[] => {
    const named = this.namedFields()
    // Official TY2025 widget order; monetary placement is owned by namedFields.
    const order = [
      'f1_1[0]',
      'f1_2[0]',
      'f1_3[0]',
      'f1_4[0]',
      'c1_1[0]',
      'c1_1[1]',
      'f1_5[0]',
      'c1_2[0]',
      'c1_2[1]',
      'c1_3[0]',
      'c1_3[1]',
      'c1_4[0]',
      'c1_4[1]',
      'f1_6[0]',
      'f1_7[0]',
      'f1_8[0]',
      'f1_9[0]',
      'f1_10[0]',
      'f1_11[0]',
      'f1_12[0]',
      'f1_13[0]',
      'f1_14[0]',
      'f1_15[0]',
      'f1_16[0]',
      'f1_17[0]',
      'f1_18[0]',
      'c1_5[0]',
      'f1_19[0]',
      'f1_20[0]',
      'f1_21[0]',
      'f1_22[0]',
      'f1_23[0]',
      'f1_24[0]',
      'f1_25[0]',
      'f1_26[0]',
      'f1_27[0]',
      'f1_28[0]',
      'f1_29[0]',
      'f1_30[0]',
      'f1_31[0]',
      'f1_32[0]',
      'f1_33[0]',
      'f1_34[0]',
      'f1_35[0]',
      'f1_36[0]',
      'f1_37[0]',
      'f1_38[0]',
      'f1_39[0]',
      'f1_40[0]',
      'f1_41[0]',
      'f1_42[0]',
      'f1_43[0]',
      'f1_44[0]',
      'f1_45[0]',
      'f1_46[0]',
      'f1_47[0]',
      'f1_48[0]',
      'f1_49[0]',
      'f1_50[0]',
      'f1_51[0]',
      'f1_52[0]',
      'f1_53[0]',
      'f1_54[0]',
      'f1_55[0]',
      'f1_56[0]',
      'f1_57[0]',
      'f1_58[0]',
      'f1_59[0]',
      'f1_60[0]',
      'c1_6[0]',
      'c1_6[1]',
      'f2_1[0]',
      'f2_2[0]',
      'f2_3[0]',
      'f2_4[0]',
      'f2_5[0]',
      'f2_6[0]',
      'f2_7[0]',
      'f2_8[0]',
      'f2_9[0]',
      'f2_10[0]',
      'f2_11[0]',
      'f2_12[0]',
      'f2_13[0]',
      'f2_14[0]',
      'f2_15[0]',
      'f2_16[0]',
      'f2_17[0]',
      'f2_18[0]'
    ]
    return order.map((name) => named[name])
  }

  copies = (): ScheduleF[] => {
    const list = this.f1040._scheduleFList ?? []
    return list.slice(1)
  }
}
