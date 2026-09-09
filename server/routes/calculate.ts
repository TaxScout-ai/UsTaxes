import F1040For2025 from 'ustaxes/forms/Y2025/irsForms/F1040'
import { calculationSnapshot } from 'ustaxes/forms/Y2025/irsForms/calculationSnapshot'
import { parseCalculationRequest } from '../utils/calculation-contract'
import { Router, Request, Response } from 'express'
import {
  Information,
  Asset,
  TaxYear,
  USTAXES_HTTP_CONTRACT_VERSION
} from 'ustaxes/core/data'
import { Either, run } from 'ustaxes/core/util'
import {
  deserializeInformation,
  deserializeAssets
} from '../utils/date-serializer'
import { yearFormBuilder } from 'ustaxes/forms/YearForms'
import { createPdfDownloader } from '../utils/pdf-downloader'
import { F1040Error } from 'ustaxes/forms/errors'
import Form from 'ustaxes/core/irsForms/Form'
import { validateForm8863Contract } from '../utils/form8863-contract'
import { Schedule1AInputError } from 'ustaxes/forms/Y2025/irsForms/schedule1AInput'

// Direct imports for each year's create1040 to access the typed F1040
import { create1040 as create1040For2020 } from 'ustaxes/forms/Y2020/irsForms/Main'
import { create1040 as create1040For2021 } from 'ustaxes/forms/Y2021/irsForms/Main'
import { create1040 as create1040For2022 } from 'ustaxes/forms/Y2022/irsForms/Main'
import { create1040 as create1040For2023 } from 'ustaxes/forms/Y2023/irsForms/Main'
import { create1040 as create1040For2024 } from 'ustaxes/forms/Y2024/irsForms/Main'
import { create1040 as create1040For2025 } from 'ustaxes/forms/Y2025/irsForms/Main'
import { create1040 as create1040For2026 } from 'ustaxes/forms/Y2026/irsForms/Main'

/**
 * All F1040 classes share these methods but they're not in the base class.
 * This interface lets us extract summary data from any year's F1040.
 */
interface F1040WithSummary {
  l11(): number // AGI
  l12(): number // Deductions (standard or itemized)
  l15(): number // Taxable income
  l24(): number // Total tax
  l32(): number // Total credits (other payments + refundable)
  l33(): number // Total payments
  l35a(): number // Refund amount
  l37(): number // Amount owed
  standardDeduction(): number | undefined
  totalForeignTaxCredit(): number // Sum of all F1116 Line 24
}

function extractSummary(f1040: unknown, forms: Form[]) {
  const f = f1040 as F1040WithSummary
  return {
    success: true as const,
    contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
    summary: {
      agi: f.l11(),
      taxableIncome: f.l15(),
      totalTax: f.l24(),
      refundAmount: f.l35a(),
      amountOwed: f.l37(),
      standardDeduction: f.standardDeduction() ?? 0,
      deductions: f.l12(),
      totalCredits: f.l32() + f.totalForeignTaxCredit(),
      foreignTaxCredit: f.totalForeignTaxCredit(),
      totalPayments: f.l33()
    },
    ...(f1040 instanceof F1040For2025
      ? { returnLines: calculationSnapshot(f1040) }
      : {}),
    forms: forms.map((form) => ({
      tag: form.tag,
      sequenceIndex: form.sequenceIndex
    }))
  }
}

/**
 * Calls the year-specific create1040 and extracts summary.
 * Using a switch avoids type incompatibility between year-specific F1040 classes.
 */
function calculateForYear(
  taxYear: TaxYear,
  information: Information<Date>,
  assets: Asset<Date>[]
):
  | {
      success: true
      summary: ReturnType<typeof extractSummary>['summary']
      forms: { tag: string; sequenceIndex: number }[]
    }
  | { success: false; errors: F1040Error[] } {
  let result: Either<F1040Error[], [unknown, Form[]]>

  switch (taxYear) {
    case 'Y2020':
      result = create1040For2020(information, assets)
      break
    case 'Y2021':
      result = create1040For2021(information, assets)
      break
    case 'Y2022':
      result = create1040For2022(information, assets)
      break
    case 'Y2023':
      result = create1040For2023(information, assets)
      break
    case 'Y2024':
      result = create1040For2024(information, assets)
      break
    case 'Y2025':
      result = create1040For2025(information, assets)
      break
    case 'Y2026':
      result = create1040For2026(information, assets)
      break
    default:
      return { success: false, errors: [F1040Error.unsupportedTaxYear] }
  }

  return run(result).fold(
    (errors) => ({ success: false as const, errors }),
    ([f1040, forms]) => extractSummary(f1040, forms)
  )
}

const router = Router()

router.post('/api/calculate', (req: Request, res: Response) => {
  try {
    const parsed = parseCalculationRequest(req.body)
    if (!parsed.ok) {
      res.status(422).json({
        success: false,
        contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
        error: 'invalid_input',
        issues: parsed.issues
      })
      return
    }
    const { taxYear, information: rawInfo, assets: rawAssets } = parsed.value

    const contractIssues = validateForm8863Contract(req.body)
    if (contractIssues.length > 0) {
      res.status(422).json({
        success: false,
        contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
        error: 'form8863_contract_invalid',
        issues: contractIssues
      })
      return
    }

    const information = deserializeInformation(rawInfo)
    const assets = deserializeAssets(rawAssets)
    const response = calculateForYear(taxYear, information, assets)

    res.json(response)
  } catch (err) {
    if (err instanceof Schedule1AInputError) {
      res.status(422).json({
        success: false,
        contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
        error: err.code,
        issues: [{ path: err.path, code: err.code, message: err.message }]
      })
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(
      'Calculate error:',
      err instanceof Error ? err.stack : message
    )
    res.status(500).json({
      success: false,
      contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
      error: message
    })
  }
})

export default router

/**
 * Exported for reuse by generate-pdf route.
 * Returns the YearCreateForm builder with filesystem PDF downloader.
 */
export function buildYearForm(
  taxYear: TaxYear,
  rawInfo: Information<string>,
  rawAssets: Asset<string>[]
) {
  const information = deserializeInformation(rawInfo)
  const assets = deserializeAssets(rawAssets)

  const builder = yearFormBuilder(taxYear)
    .setDownloader(createPdfDownloader(taxYear))
    .build(information, assets)

  return builder
}
