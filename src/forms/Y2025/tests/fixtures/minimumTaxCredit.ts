import {
  Form8801Data,
  Form8801PriorYear,
  FilingStatus
} from 'ustaxes/core/data'
import { rehearsalInformation } from './atsRehearsal'

export function priorReturn(
  changes: Partial<Form8801PriorYear> = {}
): Form8801PriorYear {
  return {
    taxYear: 2024,
    filingStatus: FilingStatus.S,
    returnType: '1040',
    form6251: { line1: 50000, line2e: 0, line10: 5000, line11: 0 },
    form8801Line26: 5000,
    unallowedQualifiedElectricVehicleCredit: 0,
    netUSRealPropertyGain: 0,
    capitalGains: { method: 'ordinary' },
    foreignEarnedIncome: {
      applicable: false,
      form2555Lines45And50: 0,
      relatedDisallowedDeductions: 0
    },
    foreignTaxCreditOnExclusions: { method: 'none', amount: 0 },
    ...changes
  }
}

export function minimumTaxCreditData(
  prior = priorReturn(),
  changes: Partial<Form8801Data> = {}
): Form8801Data {
  return {
    priorYear: prior,
    priorYearAMTI: prior.form6251.line1 + prior.form6251.line2e,
    exclusionItems: 0,
    mtcNOLDeduction: 0,
    priorYearRegularTaxMinusCredits: prior.form6251.line10,
    priorYearAMTCreditCarryforward: prior.form8801Line26,
    ...changes
  }
}

export function creditInformation(
  data = minimumTaxCreditData(),
  wages = 75250
) {
  const info = rehearsalInformation(wages)
  info.w2s[0].fedWithholding = 9100
  return { ...info, form8801: data }
}
