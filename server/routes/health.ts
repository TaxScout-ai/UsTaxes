import { Router, Request, Response } from 'express'
import { USTAXES_HTTP_CONTRACT_VERSION } from 'ustaxes/core/data'

const router = Router()

router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
    timestamp: new Date().toISOString()
  })
})

export default router
