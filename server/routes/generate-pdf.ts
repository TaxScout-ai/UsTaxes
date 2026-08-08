import { Router, Request, Response } from 'express'
import { TaxYear, USTAXES_HTTP_CONTRACT_VERSION } from 'ustaxes/core/data'
import { isLeft } from 'ustaxes/core/util'
import { buildYearForm } from './calculate'
import { validateForm8863Contract } from '../utils/form8863-contract'

const VALID_YEARS: TaxYear[] = [
  'Y2020', 'Y2021', 'Y2022', 'Y2023', 'Y2024', 'Y2025', 'Y2026'
]

const router = Router()

router.post('/api/generate-pdf', async (req: Request, res: Response) => {
  try {
    const { taxYear, information, assets = [] } = req.body

    if (!taxYear || !information) {
      res.status(400).json({
        success: false,
        contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
        error: 'Missing required fields: taxYear, information'
      })
      return
    }

    if (!VALID_YEARS.includes(taxYear)) {
      res.status(400).json({
        success: false,
        contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
        error: `Invalid taxYear. Must be one of: ${VALID_YEARS.join(', ')}`
      })
      return
    }

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

    const builder = buildYearForm(taxYear as TaxYear, information, assets)
    const bytesResult = await builder.f1040Bytes()

    if (isLeft(bytesResult)) {
      res.status(422).json({
        success: false,
        contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
        errors: bytesResult.left
      })
      return
    }

    const pdfBytes = bytesResult.right
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="1040-${taxYear}.pdf"`,
      'Content-Length': pdfBytes.length.toString(),
      'X-UsTaxes-Contract-Version': USTAXES_HTTP_CONTRACT_VERSION
    })
    res.send(Buffer.from(pdfBytes))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({
      success: false,
      contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
      error: message
    })
  }
})

export default router
