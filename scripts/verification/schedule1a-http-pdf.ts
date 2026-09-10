/** Synthetic qualified worksheet inputs, actual HTTP routes, independent IRS table.
 * Expected deductions/critical worksheet cells are hand-derived from the pinned
 * 2025 Schedule 1-A. The Python reader checks the resulting PDF independently.
 */
import express from 'express'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'
import calculate from '../../server/routes/calculate'
import pdf from '../../server/routes/generate-pdf'
import {
  FilingStatus,
  Information,
  PersonRole,
  Schedule1AData
} from 'ustaxes/core/data'
import { readOracle } from './oracle'
import { create1040 } from 'ustaxes/forms/Y2025/irsForms/Main'

const living = {
  ssnValidForEmployment: true,
  ssnIssuedByReturnDeadline: true,
  dateOfDeath: null
}
const base = (): Schedule1AData => ({
  incomeExclusions: { puertoRico: 0, form4563: 0 },
  people: { primary: { ...living }, spouse: { ...living } },
  tipRecipients: ['primary'],
  overtimeRecipients: ['primary']
})
const vehicle = {
  vin: '1HGCM82633A004352',
  interestDeductedOnSchedule: 250,
  interestForSchedule1A: 4000
}
interface Case {
  id: string
  wages: number[]
  deduction: number
  standard: number
  data: Schedule1AData
  status?: FilingStatus
  birth?: string
  cells: Record<string, number | string>
  senior?: boolean
  blind?: boolean
}
const cases: Case[] = [
  {
    id: 'senior-and-blind',
    wages: [75250],
    birth: '1960-01-01',
    deduction: 5985,
    standard: 19750,
    senior: true,
    blind: true,
    data: base(),
    cells: { f2_20: 5985, f2_22: 5985 }
  },
  {
    id: 'car-first-phaseout-dollar',
    wages: [100001],
    deduction: 3800,
    standard: 15750,
    data: { ...base(), vehicleInterest: [vehicle] },
    cells: {
      f2_02: 250,
      f2_03: 4000,
      f2_11: 1,
      f2_12: 1,
      f2_13: 200,
      f2_14: 3800
    }
  },
  {
    id: 'two-vehicles-rounded-rows',
    wages: [75250],
    deduction: 6001,
    standard: 15750,
    data: {
      ...base(),
      vehicleInterest: [
        vehicle,
        {
          vin: '2HGCM82633A004352',
          interestDeductedOnSchedule: 0,
          interestForSchedule1A: 2000.5
        }
      ]
    },
    cells: { f2_03: 4000, f2_06: 2001, f2_07: 6001, f2_14: 6001 }
  },
  {
    id: 'overtime',
    wages: [75250],
    deduction: 4000,
    standard: 15750,
    data: { ...base(), qualifiedOvertimeW2: 4000 },
    cells: { f1_22: 4000, f1_24: 4000, f1_31: 4000 }
  },
  {
    id: 'two-employer-tips',
    wages: [40000, 35250],
    deduction: 8000,
    standard: 15750,
    data: {
      ...base(),
      employeeTips: [
        { reportedTips: 5000, form4137Tips: 0 },
        { reportedTips: 3000, form4137Tips: 0 }
      ]
    },
    cells: { f1_10: 0, f1_11: 0, f1_12: 8000, f1_21: 8000 }
  },
  {
    id: 'two-seniors-mfj',
    wages: [120000],
    status: FilingStatus.MFJ,
    birth: '1960-01-01',
    deduction: 12000,
    standard: 34700,
    senior: true,
    data: base(),
    cells: { f2_20: 6000, f2_21: 6000, f2_22: 12000 }
  },
  {
    id: 'senior-birthday-jan1',
    wages: [75250],
    birth: '1961-01-01',
    deduction: 5985,
    standard: 17750,
    senior: true,
    data: base(),
    cells: { f2_17: 250, f2_18: 15, f2_20: 5985, f2_22: 5985 }
  },
  {
    id: 'not-senior-birthday-jan2',
    wages: [75250],
    birth: '1961-01-02',
    deduction: 0,
    standard: 15750,
    data: base(),
    cells: {}
  },
  {
    id: 'senior-invalid-ssn',
    wages: [75250],
    birth: '1960-01-01',
    deduction: 0,
    standard: 17750,
    senior: true,
    data: {
      ...base(),
      people: { primary: { ...living, ssnValidForEmployment: false } }
    },
    cells: {}
  }
]
function requestFor(c: Case) {
  const person = {
    firstName: 'Synthetic',
    lastName: 'Verification',
    ssid: '000000000',
    isBlind: c.blind ?? false,
    isTaxpayerDependent: false,
    dateOfBirth: `${c.birth ?? '1985-01-01'}T00:00:00Z`
  }
  const information: Information<string> = {
    w2s: c.wages.map((income, i) => ({
      occupation: 'Synthetic',
      income,
      medicareIncome: income,
      ssWages: Math.min(income, 176100),
      ssWithholding: 0,
      fedWithholding: i === 0 ? 9100 : 0,
      medicareWithholding: 0,
      personRole: PersonRole.PRIMARY
    })),
    f1099s: [],
    realEstate: [],
    estimatedTaxes: [],
    f1098es: [],
    f3921s: [],
    scheduleK1Form1065s: [],
    credits: [],
    stateResidencies: [],
    healthSavingsAccounts: [],
    individualRetirementArrangements: [],
    questions: {},
    itemizedDeductions: undefined,
    taxPayer: {
      filingStatus: c.status ?? FilingStatus.S,
      dependents: [],
      primaryPerson: {
        ...person,
        role: PersonRole.PRIMARY,
        address: {
          address: '1 Synthetic St',
          city: 'Test',
          state: 'TX',
          zip: '00000'
        }
      },
      spouse:
        c.status === FilingStatus.MFJ
          ? { ...person, role: PersonRole.SPOUSE, ssid: '000000001' }
          : undefined
    },
    schedule1AData: c.data
  }
  return { taxYear: 'Y2025', information, assets: [] }
}
async function main() {
  const output = process.argv[2]
  if (!output || process.argv.length !== 3)
    throw new Error('Required: new output directory')
  mkdirSync(output) // Refuse an existing directory; never overwrite evidence.
  const authority = JSON.parse(
    readFileSync(
      'scripts/verification/authority/schedule1a-sources.json',
      'utf8'
    )
  ) as { sources: Array<{ path: string; sha256: string }> }
  for (const source of authority.sources) {
    if (
      createHash('sha256').update(readFileSync(source.path)).digest('hex') !==
      source.sha256
    )
      throw new Error(`Authority checksum mismatch: ${source.path}`)
  }
  const table = readOracle(
    resolve('scripts/verification/authority/independent-tax-table.json.gz')
  )
  const app = express()
  app.use(express.json())
  app.use(calculate)
  app.use(pdf)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing local port')
  const url = `http://127.0.0.1:${address.port}`
  const post = (route: string, request: unknown) =>
    fetch(url + route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    })
  const results = []
  try {
    for (const c of cases) {
      const request = requestFor(c)
      const taxable =
        c.wages.reduce((sum, n) => sum + n, 0) - c.standard - c.deduction
      const row = table.rows.find(
        (r) => r.values[0] <= taxable && taxable < r.values[1]
      )
      if (!row) throw new Error('Fixture outside pinned IRS Tax Table')
      const tax = row.values[c.status === FilingStatus.MFJ ? 3 : 2]
      const expected1040 = {
        '12e': c.standard,
        '13b': c.deduction,
        '14': c.standard + c.deduction,
        '15': taxable,
        '16': tax,
        '24': tax,
        '25a': 9100,
        '33': 9100,
        '35a': Math.max(0, 9100 - tax),
        '37': Math.max(0, tax - 9100)
      }
      const response = await post('/api/calculate', request)
      const result = (await response.json()) as {
        success: boolean
        returnLines?: { lines: Record<string, number> }
        forms: Array<{ tag: string }>
      }
      if (response.status !== 200 || !result.success)
        throw new Error(`${c.id}: ${JSON.stringify(result)}`)
      for (const [line, expected] of Object.entries(expected1040)) {
        if (result.returnLines?.lines[line] !== expected)
          throw new Error(
            `${c.id}: 1040 ${line} got ${String(
              result.returnLines?.lines[line]
            )}, expected ${expected}`
          )
      }
      const attached = result.forms.some((f) => f.tag === 'f1040s1a')
      if (attached !== c.deduction > 0)
        throw new Error(`${c.id}: wrong attachment set`)
      const pdfResponse = await post('/api/generate-pdf', request)
      if (
        pdfResponse.status !== 200 ||
        !pdfResponse.headers.get('content-type')?.includes('application/pdf')
      )
        throw new Error(`${c.id}: PDF failed: ${await pdfResponse.text()}`)
      const file = `${c.id}.pdf`
      writeFileSync(
        resolve(output, file),
        Buffer.from(await pdfResponse.arrayBuffer())
      )
      writeFileSync(
        resolve(output, `${c.id}.request.json`),
        JSON.stringify(request, null, 2) + '\n'
      )
      results.push({
        id: c.id,
        file,
        expected1040,
        attached,
        senior: c.senior ?? false,
        spouseSenior: c.status === FilingStatus.MFJ && (c.senior ?? false),
        blind: c.blind ?? false,
        spouseBlind: c.status === FilingStatus.MFJ && (c.blind ?? false),
        vins: (c.data.vehicleInterest ?? []).map((v) => v.vin),
        inactiveParts:
          c.deduction === 0
            ? []
            : [
                ...((c.data.qualifiedTipsW2 ?? 0) === 0 &&
                !c.data.employeeTips?.length &&
                !c.data.businessTips?.length
                  ? ['tips']
                  : []),
                ...((c.data.qualifiedOvertimeW2 ?? 0) === 0 &&
                (c.data.qualifiedOvertime1099 ?? 0) === 0
                  ? ['overtime']
                  : []),
                ...(!c.data.vehicleInterest?.length ? ['car'] : []),
                ...(!c.senior ? ['senior'] : [])
              ],
        cells: { ...c.cells, ...(attached ? { f2_23: c.deduction } : {}) }
      })
    }
    // Verify EVERY named field is present in the actual IRS template. This is
    // a full-map check beyond the generic filler, which now rejects unknown names.
    const sample = requestFor(cases[0])
    const input = {
      ...sample.information,
      taxPayer: {
        ...sample.information.taxPayer,
        primaryPerson: {
          ...sample.information.taxPayer.primaryPerson,
          dateOfBirth: new Date('1985-01-01')
        },
        spouse: undefined
      },
      healthSavingsAccounts: []
    }
    const made = create1040(input as unknown as Information<Date>, [])
    if ('left' in made || !made.right[0].schedule1A)
      throw new Error('Fixture validation failed')
    const template = await PDFDocument.load(
      readFileSync(resolve('public/forms/Y2025/irs/f1040s1a.pdf'))
    )
    const actualKeys = template
      .getForm()
      .getFields()
      .map((f) => f.getName())
      .sort()
    const mappedKeys = Object.keys(
      made.right[0].schedule1A.namedFields()
    ).sort()
    if (JSON.stringify(actualKeys) !== JSON.stringify(mappedKeys))
      throw new Error('Schedule 1-A field map does not match IRS template')

    const negatives = [
      {
        id: 'exclusions-unknown',
        data: { ...base(), incomeExclusions: undefined },
        code: 'needs_facts'
      },
      {
        id: 'legacy-age',
        data: { ...base(), primaryBornBefore1962: true },
        code: 'invalid_input'
      },
      {
        id: 'overtime-recipients-unknown',
        data: {
          ...base(),
          qualifiedOvertimeW2: 1000,
          overtimeRecipients: undefined
        },
        code: 'needs_facts'
      },
      {
        id: 'ssn-unknown',
        data: { ...base(), qualifiedTipsW2: 1000, people: undefined },
        code: 'needs_facts'
      },
      {
        id: 'fractional-cent',
        data: { ...base(), qualifiedOvertimeW2: 1.001 },
        code: 'invalid_input'
      },
      {
        id: 'third-vehicle',
        data: {
          ...base(),
          vehicleInterest: [
            vehicle,
            { ...vehicle, vin: '2HGCM82633A004352' },
            { ...vehicle, vin: '3HGCM82633A004352' }
          ]
        },
        code: 'unsupported'
      },
      {
        id: 'business-limit-unknown',
        data: { ...base(), qualifiedTipsSelfEmployed: 1000 },
        code: 'needs_facts'
      }
    ]
    const negativeResults = []
    for (const c of negatives)
      for (const route of ['/api/calculate', '/api/generate-pdf']) {
        const request = requestFor({ ...cases[0], data: c.data })
        const response = await post(route, request)
        const body = (await response.json()) as {
          success: boolean
          error: string
        }
        if (
          response.status !== 422 ||
          body.success !== false ||
          body.error !== c.code
        )
          throw new Error(`${c.id}${route}: ${JSON.stringify(body)}`)
        negativeResults.push({ id: c.id, route, status: response.status, body })
      }
    writeFileSync(
      resolve(output, 'schedule1a-results.json'),
      JSON.stringify(
        {
          source: '2025 IRS Schedule 1-A + i1040gi + pinned i1040tt',
          results,
          negativeResults,
          mappedFields: actualKeys.length
        },
        null,
        2
      ) + '\n'
    )
    console.log(
      JSON.stringify({
        returns: results.length,
        negativeRequests: negativeResults.length,
        mappedFields: actualKeys.length,
        status: 'PASS',
        output
      })
    )
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve()))
    )
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
