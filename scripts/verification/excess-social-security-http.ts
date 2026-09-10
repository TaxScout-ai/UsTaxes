/** Real local routes, synthetic payroll only; never transmits to IRS. */
import express from 'express'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import calculate from '../../server/routes/calculate'
import pdf from '../../server/routes/generate-pdf'
import { sourceManifest } from './source-manifest'
import { payrollCases } from 'ustaxes/forms/Y2025/tests/fixtures/excessSocialSecurity'

type Result = {
  success: boolean
  error?: string
  issues?: { code: string }[]
  returnLines: { lines: Record<string, number | null> }
  forms: { tag: string }[]
}
async function main() {
  const output = process.argv[2]
  if (!output || process.argv.length !== 3)
    throw new Error('Required: new output directory')
  mkdirSync(output)
  const identity = sourceManifest()
  const sources = JSON.parse(
    readFileSync(
      'scripts/verification/authority/excess-social-security-sources.json',
      'utf8'
    )
  ) as { path: string; sha256: string }[]
  for (const s of sources)
    if (
      createHash('sha256').update(readFileSync(s.path)).digest('hex') !==
      s.sha256
    )
      throw new Error('Authority changed: ' + s.path)
  const app = express()
  app.use(express.json())
  app.use(calculate)
  app.use(pdf)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((done) => server.once('listening', done))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('No local port')
  const post = (route: string, body: unknown) =>
    fetch(`http://127.0.0.1:${address.port}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    })
  const results = []
  const refusals = []
  try {
    for (const c of payrollCases) {
      const request = { taxYear: 'Y2025', information: c.info, assets: [] }
      const r = await post('/api/calculate', request)
      const result = (await r.json()) as Result
      if (r.status !== 200 || !result.success)
        throw new Error(c.id + ': ' + JSON.stringify(result))
      const expected = {
        '24': c.totalTax,
        // An absent Schedule 3 leaves this optional form line blank.
        '31': c.ssCredit || null,
        '33': c.payments,
        '37': c.owed
      }
      for (const [line, value] of Object.entries(expected))
        if (result.returnLines.lines[line] !== value)
          throw new Error(
            c.id +
              ':1040:' +
              line +
              ' ' +
              String(result.returnLines.lines[line]) +
              ' != ' +
              String(value)
          )
      const produced = await post('/api/generate-pdf', request)
      if (
        produced.status !== 200 ||
        !produced.headers.get('content-type')?.includes('application/pdf')
      )
        throw new Error(c.id + ': PDF ' + (await produced.text()))
      writeFileSync(
        resolve(output, c.id + '.request.json'),
        JSON.stringify(request, null, 2)
      )
      writeFileSync(
        resolve(output, c.id + '.response.json'),
        JSON.stringify(result, null, 2)
      )
      writeFileSync(
        resolve(output, c.id + '.pdf'),
        Buffer.from(await produced.arrayBuffer())
      )
      results.push({ id: c.id, forms: result.forms.map((f) => f.tag) })
    }
    const base = payrollCases[0]
    const bad = [
      {
        id: 'missing-employer',
        code: 'needs_facts',
        information: {
          ...base.info,
          w2s: base.info.w2s.map((w, i) =>
            i === 0 ? { ...w, employer: undefined } : w
          )
        }
      },
      {
        id: 'fractional-cent',
        code: 'invalid_input',
        information: {
          ...base.info,
          w2s: base.info.w2s.map((w, i) =>
            i === 0 ? { ...w, ssWithholding: 1.001 } : w
          )
        }
      },
      {
        id: 'negative-withholding',
        code: 'invalid_input',
        information: {
          ...base.info,
          w2s: base.info.w2s.map((w, i) =>
            i === 0 ? { ...w, ssWithholding: -1 } : w
          )
        }
      },
      {
        id: 'incomplete-rrta',
        code: 'unsupported',
        information: { ...base.info, rrtaCompensation: 210000, rrtaTax: 90 }
      }
    ]
    for (const c of bad)
      for (const route of ['/api/calculate', '/api/generate-pdf']) {
        const response = await post(route, {
          taxYear: 'Y2025',
          information: c.information,
          assets: []
        })
        const body = (await response.json()) as Result
        if (
          response.status !== 422 ||
          body.success !== false ||
          body.error !== c.code
        )
          throw new Error(c.id + route + JSON.stringify(body))
        refusals.push({
          id: c.id,
          route,
          status: response.status,
          code: body.error
        })
      }
    if (sourceManifest().treeSha256 !== identity.treeSha256)
      throw new Error('Source changed during verification')
    writeFileSync(
      resolve(output, 'payroll-results.json'),
      JSON.stringify(
        { status: 'PASS', identity, results, refusals, irsApproval: false },
        null,
        2
      )
    )
    console.log(
      JSON.stringify({
        status: 'PASS',
        httpCases: results.length,
        pdfs: results.length,
        refusals: refusals.length,
        irsApproval: false
      })
    )
  } finally {
    await new Promise<void>((done) => server.close(() => done()))
  }
}
main().catch((e: unknown) => {
  console.error(e)
  process.exitCode = 1
})
