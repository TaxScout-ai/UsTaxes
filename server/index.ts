import { jsonErrors } from './utils/json-errors'
import express from 'express'
import healthRouter from './routes/health'
import calculateRouter from './routes/calculate'
import generatePdfRouter from './routes/generate-pdf'

const app = express()
const PORT = parseInt(process.env.PORT ?? '3001', 10)

// JSON body parsing with generous limit for large tax data
app.use(express.json({ limit: '5mb', strict: false }))

// Routes
app.use(healthRouter)
app.use(calculateRouter)
app.use(generatePdfRouter)
app.use(jsonErrors)

app.listen(PORT, () => {
  console.log(`UsTaxes API server running on port ${PORT}`)
})
