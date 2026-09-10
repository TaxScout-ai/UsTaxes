/** Synthetic local HTTP/PDF verification. No IRS connection or real taxpayer data. */
import express from 'express'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import calculate from '../../server/routes/calculate'
import pdf from '../../server/routes/generate-pdf'
import { sourceManifest } from './source-manifest'
import { Form8801Data } from 'ustaxes/core/data'
import {
  creditInformation,
  minimumTaxCreditData,
  priorReturn
} from 'ustaxes/forms/Y2025/tests/fixtures/minimumTaxCredit'
import goldens from 'ustaxes/forms/Y2025/tests/fixtures/minimum-tax-goldens.json'

type Response = {
  success: boolean
  error?: string
  returnLines: { lines: Record<string, number | null> }
  forms: { tag: string }[]
}
async function main() {
  const output = process.argv[2]
  if (!output || process.argv.length !== 3)
    throw new Error('Required: a new evidence directory')
  mkdirSync(output)
  const identityBefore = sourceManifest()
  const sources = JSON.parse(
    readFileSync(
      'scripts/verification/authority/minimum-tax-sources.json',
      'utf8'
    )
  ) as { path: string; sha256: string }[]
  for (const source of sources)
    if (
      createHash('sha256').update(readFileSync(source.path)).digest('hex') !==
      source.sha256
    )
      throw new Error('Authority mismatch: ' + source.path)
  const app = express()
  app.use(express.json())
  app.use(calculate)
  app.use(pdf)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((done, fail) => {
    server.once('listening', done)
    server.once('error', fail)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No local port')
  const post = (route: string, body: unknown) =>
    fetch(`http://127.0.0.1:${address.port}${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    })
  const results = []
  const refusals = []
  const pdfIds = new Set([
    'ordinary-S--1000',
    'ordinary-S-318301',
    'ordinary-MFJ-1218700',
    'ordinary-MFS-875951',
    'ordinary-HOH-709350',
    'ordinary-W-133300',
    'qdcg-S-200000-30000',
    'qdcg-S-800000-450000',
    'schedule-d-S-200000-30000',
    'foreign-ordinary-150000-250000',
    'foreign-qdcg-150000-180000',
    'foreign-schedule-d-refigure',
    'foreign-credit-prepared_mtftce',
    'NR-floor',
    'negative-exclusions-and-NOL'
  ])
  const cases = goldens.cases.map((c) => ({
    id: c.id,
    data: c.data as Form8801Data,
    credit: c.lines['25'],
    pdf: pdfIds.has(c.id)
  }))
  cases.push({
    id: 'carryforward-anchor',
    data: minimumTaxCreditData(),
    credit: 5000,
    pdf: true
  })
  const noCredit = minimumTaxCreditData(
    priorReturn({
      form6251: { line1: 150000, line2e: 0, line10: 10000, line11: 2000 },
      form8801Line26: 0
    })
  )
  cases.push({
    id: 'negative-available-credit',
    data: noCredit,
    credit: 0,
    pdf: true
  })
  try {
    for (const c of cases) {
      const request = {
        taxYear: 'Y2025',
        information: creditInformation(c.data),
        assets: []
      }
      const response = await post('/api/calculate', request)
      const actual = (await response.json()) as Response
      if (response.status !== 200 || !actual.success)
        throw new Error(`${c.id}: ${JSON.stringify(actual)}`)
      const expected = {
        '1a': 75250,
        '15': 59500,
        '16': 8010,
        '20': c.credit || null,
        '24': 8010 - c.credit,
        '25a': 9100,
        '35a': 1090 + c.credit
      }
      for (const [line, value] of Object.entries(expected))
        if (actual.returnLines.lines[line] !== value)
          throw new Error(
            `${c.id}: 1040:${line} ${String(
              actual.returnLines.lines[line]
            )} != ${String(value)}`
          )
      const forms = actual.forms.map((f) => f.tag)
      if (
        c.credit > 0 &&
        (!forms.includes('f8801') || !forms.includes('f6251'))
      )
        throw new Error(c.id + ': required credit forms omitted')
      if (c.id === 'negative-available-credit' && forms.includes('f8801'))
        throw new Error('Nonpositive line 21 must not attach Form 8801')
      let file: string | undefined
      if (c.pdf) {
        const generated = await post('/api/generate-pdf', request)
        if (
          generated.status !== 200 ||
          !generated.headers.get('content-type')?.includes('application/pdf')
        )
          throw new Error(`${c.id}: PDF ${await generated.text()}`)
        file = c.id + '.pdf'
        writeFileSync(
          resolve(output, file),
          Buffer.from(await generated.arrayBuffer())
        )
      }
      writeFileSync(
        resolve(output, c.id + '.request.json'),
        JSON.stringify(request, null, 2) + '\n'
      )
      writeFileSync(
        resolve(output, c.id + '.response.json'),
        JSON.stringify(actual, null, 2) + '\n'
      )
      results.push({ id: c.id, file, forms, expected })
    }
    const base = minimumTaxCreditData()
    const p = base.priorYear
    if (!p) throw new Error('Missing synthetic prior source')
    const bad: { id: string; data: unknown; year?: string; code: string }[] = [
      {
        id: 'legacy-only',
        data: { ...base, priorYear: undefined },
        code: 'needs_facts'
      },
      {
        id: 'missing-NOL-zero',
        data: { ...base, mtcNOLDeduction: undefined },
        code: 'needs_facts'
      },
      {
        id: 'aggregate-conflict',
        data: { ...base, priorYearAMTI: 50001 },
        code: 'invalid_input'
      },
      {
        id: 'fractional-cent',
        data: { ...base, exclusionItems: 1.001 },
        code: 'invalid_input'
      },
      {
        id: 'negative-NOL',
        data: { ...base, mtcNOLDeduction: -1 },
        code: 'invalid_input'
      },
      {
        id: 'overflow',
        data: {
          ...base,
          priorYearAMTI: 90071992547410,
          priorYear: {
            ...p,
            form6251: { ...p.form6251, line1: 90071992547409, line2e: 1 }
          }
        },
        code: 'invalid_input'
      },
      {
        id: 'source-year-conflict',
        data: { ...base, priorYear: { ...p, taxYear: 2025 } },
        code: 'invalid_input'
      },
      {
        id: 'missing-foreign-source',
        data: { ...base, priorYear: { ...p, foreignEarnedIncome: undefined } },
        code: 'invalid_input'
      },
      {
        id: 'foreign-credit-unreferenced',
        data: {
          ...base,
          priorYear: {
            ...p,
            foreignTaxCreditOnExclusions: {
              method: 'prepared_mtftce',
              amount: 100,
              worksheetReference: ''
            }
          }
        },
        code: 'needs_facts'
      },
      {
        id: 'silent-year-fallback',
        data: base,
        year: 'Y2026',
        code: 'invalid_input'
      }
    ]
    for (const c of bad)
      for (const route of ['/api/calculate', '/api/generate-pdf']) {
        const response = await post(route, {
          taxYear: c.year ?? 'Y2025',
          information: { ...creditInformation(), form8801: c.data },
          assets: []
        })
        const actual = (await response.json()) as Response
        if (
          response.status !== 422 ||
          actual.success !== false ||
          actual.error !== c.code
        )
          throw new Error(
            `${c.id} ${route}: ${response.status} ${JSON.stringify(actual)}`
          )
        refusals.push({
          id: c.id,
          route,
          status: response.status,
          code: actual.error
        })
      }
    const identityAfter = sourceManifest()
    if (identityBefore.treeSha256 !== identityAfter.treeSha256)
      throw new Error('Source changed during verification')
    const report = {
      status: 'PASS',
      irsSubmission: false,
      source: identityAfter,
      results,
      refusals
    }
    writeFileSync(
      resolve(output, 'minimum-tax-results.json'),
      JSON.stringify(report, null, 2) + '\n'
    )
    console.log(
      JSON.stringify({
        status: 'PASS',
        httpCases: results.length,
        pdfs: results.filter((r) => r.file).length,
        refusals: refusals.length,
        source: identityAfter.treeSha256
      })
    )
  } finally {
    await new Promise<void>((done, fail) =>
      server.close((error) => (error ? fail(error) : done()))
    )
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
