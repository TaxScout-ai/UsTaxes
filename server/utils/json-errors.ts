import { ErrorRequestHandler } from 'express'
import { USTAXES_HTTP_CONTRACT_VERSION } from 'ustaxes/core/data'

/** Body-parser failures use the same machine-readable boundary as route errors. */
export const jsonErrors: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  next
) => {
  const type =
    typeof error === 'object' && error !== null && 'type' in error
      ? error.type
      : undefined
  if (type === 'entity.parse.failed' || type === 'entity.too.large') {
    res.status(type === 'entity.too.large' ? 413 : 400).json({
      success: false,
      contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
      error: type === 'entity.too.large' ? 'request_too_large' : 'invalid_json'
    })
    return
  }
  next(error)
}
