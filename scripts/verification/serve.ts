import { jsonErrors } from '../../server/utils/json-errors'
// Local synthetic verification only. Never uses the production server listener.
import express from 'express'
import calculate from '../../server/routes/calculate'
import pdf from '../../server/routes/generate-pdf'
const app = express()
app.use(express.json({ limit: '2mb', strict: false }))
app.use(calculate)
app.use(pdf)
app.use(jsonErrors)
const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Listener did not bind')
  process.stdout.write(
    JSON.stringify({ ready: true, host: '127.0.0.1', port: address.port }) +
      '\n'
  )
})
process.on('SIGTERM', () => server.close(() => process.exit(0)))
