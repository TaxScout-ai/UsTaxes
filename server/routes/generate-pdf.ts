import {
  calculationRefusalCode,
  parseCalculationRequest
} from '../utils/calculation-contract'
import { Router, Request, Response } from 'express'
import { USTAXES_HTTP_CONTRACT_VERSION } from 'ustaxes/core/data'
import { isLeft } from 'ustaxes/core/util'
import { buildYearForm } from './calculate'
import { validateForm8863Contract } from '../utils/form8863-contract'
import { Schedule1AInputError } from 'ustaxes/forms/Y2025/irsForms/schedule1AInput'
import { TaxFormInputError } from 'ustaxes/forms/Y2025/irsForms/formInput'

const router = Router()

async function generatePdf(req: Request, res: Response): Promise<void> {
  try {
    const parsed = parseCalculationRequest(req.body)
    if (!parsed.ok) {
      res.status(422).json({
        success: false,
        contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
        error: calculationRefusalCode(parsed.issues),
        issues: parsed.issues
      })
      return
    }
    const { taxYear, information, assets } = parsed.value

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

    const builder = buildYearForm(taxYear, information, assets)
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
    if (
      err instanceof Schedule1AInputError ||
      err instanceof TaxFormInputError
    ) {
      res.status(422).json({
        success: false,
        contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
        error: err.code,
        issues: [{ path: err.path, code: err.code, message: err.message }]
      })
      return
    }
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({
      success: false,
      contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
      error: message
    })
  }
}

router.post('/api/generate-pdf', (req, res, next) => {
  void generatePdf(req, res).catch(next)
})

export default router
