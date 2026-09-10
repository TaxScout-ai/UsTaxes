/** Local microbenchmark of named-field filling, excluding PDF load/save time. */
import { readFileSync, writeFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import F1040 from 'ustaxes/forms/Y2025/irsForms/F1040'
import { rehearsalInformation } from 'ustaxes/forms/Y2025/tests/fixtures/atsRehearsal'

async function main() {
  const output = process.argv[2]
  if (!output || process.argv.length !== 3)
    throw new Error('Provide a new output JSON path')
  const bytes = readFileSync('public/forms/Y2025/irs/f1040.pdf')
  const values = new F1040(rehearsalInformation(75250), []).namedFields()
  const timings: number[] = []
  for (let i = 0; i < 30; i++) {
    const pdf = await PDFDocument.load(bytes)
    const start = performance.now()
    fillPDFByName(pdf, values, 'f1040')
    timings.push(performance.now() - start)
  }
  const measured = timings.slice(5)
  const result = {
    scope: 'Named-field fill only, not total HTTP/PDF latency',
    node: process.version,
    sampleCount: measured.length,
    warmup: 5,
    meanMilliseconds: measured.reduce((a, b) => a + b, 0) / measured.length,
    minMilliseconds: Math.min(...measured),
    values: Object.keys(values).length
  }
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' })
  console.log(JSON.stringify(result))
}
main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
