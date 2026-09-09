// Synthetic, local review harness. Imports the inspected engine, never mocks it.
// See REPORT.md for the pinned snapshot, build command and limits of this probe.
import express from 'express'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { readOracle } from './oracle'
import calculateRouter from '../../server/routes/calculate'
import pdfRouter from '../../server/routes/generate-pdf'
import { create1040 } from 'ustaxes/forms/Y2025/irsForms/Main'
import { FilingStatus, PersonRole, Information } from 'ustaxes/core/data'

const output = process.argv[2]
const table = readOracle(process.argv[3])
const manifest: unknown = JSON.parse(readFileSync(process.argv[4], 'utf8'))
const wholeDollars = (cents: number[]) =>
  Number(
    (cents.reduce((sum, value) => sum + BigInt(value), BigInt(0)) +
      BigInt(50)) /
      BigInt(100)
  )
const centProduct = (cents: number, numerator: number, denominator: number) =>
  Number(
    (BigInt(cents) * BigInt(numerator) + BigInt(denominator / 2)) /
      BigInt(denominator)
  ) / 100

const cases = [
  { id: 'original', wages: [7525000], withholding: [910000] },
  { id: 'ordinary-med-half-dollar', wages: [7500000], withholding: [910000] },
  {
    id: 'mfj-single-w2-210000',
    wages: [21000000],
    withholding: [3000000],
    status: FilingStatus.MFJ,
    extraMedicareCents: 9000,
    expectedTax: 29098,
    expected8959: true
  },
  {
    id: 'two-w2-cents',
    wages: [2000049, 2000049],
    withholding: [250000, 250000]
  },
  {
    id: 'wage-half-forward',
    wages: [6603101, 813556, 108293],
    withholding: [700000, 180000, 30000]
  },
  {
    id: 'wage-half-reverse',
    wages: [108293, 813556, 6603101],
    withholding: [30000, 180000, 700000]
  },
  {
    id: 'withholding-half-forward',
    wages: [3000000, 4000000, 525000],
    withholding: [392174, 456479, 61397]
  },
  {
    id: 'withholding-half-reverse',
    wages: [525000, 4000000, 3000000],
    withholding: [61397, 456479, 392174]
  },
  { id: 'balance-due', wages: [7525000], withholding: [710000] },
  { id: 'explicit-zero-withholding', wages: [7525000], withholding: [0] }
]

async function main() {
  mkdirSync(output, { recursive: true })
  const app = express()
  app.use(express.json())
  app.use(calculateRouter)
  app.use(pdfRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Missing local address')
  const url = `http://127.0.0.1:${address.port}`
  const results = []
  try {
    for (const fixture of cases) {
      // No unlisted income, deductions or credits. The MFJ fixture explicitly
      // includes employer Additional Medicare withholding. Admission is not tested.
      const information: Information<Date> = {
        f1099s: [],
        w2s: fixture.wages.map((cents, index) => ({
          occupation: 'Synthetic tester',
          income: cents / 100,
          medicareIncome: cents / 100,
          ssWages: Math.min(cents, 17610000) / 100,
          fedWithholding: fixture.withholding[index] / 100,
          ssWithholding: centProduct(Math.min(cents, 17610000), 62, 1000),
          medicareWithholding:
            centProduct(cents, 145, 10000) +
            (index === 0 ? (fixture.extraMedicareCents ?? 0) / 100 : 0),
          personRole: PersonRole.PRIMARY
        })),
        estimatedTaxes: [],
        realEstate: [],
        questions: {},
        f1098es: [],
        f3921s: [],
        scheduleK1Form1065s: [],
        stateResidencies: [],
        healthSavingsAccounts: [],
        credits: [],
        individualRetirementArrangements: [],
        taxPayer: {
          filingStatus: fixture.status ?? FilingStatus.S,
          dependents: [],
          spouse:
            fixture.status === FilingStatus.MFJ
              ? {
                  firstName: 'Synthetic',
                  lastName: 'Spouse',
                  ssid: '000000001',
                  role: PersonRole.SPOUSE,
                  isBlind: false,
                  dateOfBirth: new Date('1985-01-01T12:00:00Z'),
                  isTaxpayerDependent: false
                }
              : undefined,
          primaryPerson: {
            firstName: 'Synthetic',
            lastName: 'Review',
            ssid: '000000000',
            role: PersonRole.PRIMARY,
            isBlind: false,
            dateOfBirth: new Date('1985-01-01T12:00:00Z'),
            isTaxpayerDependent: false,
            address: {
              address: '1 Synthetic Street',
              city: 'Test City',
              state: 'TX',
              zip: '00000'
            }
          }
        }
      }
      const request = { taxYear: 'Y2025', information, assets: [] }
      const wages = wholeDollars(fixture.wages)
      const withholding = wholeDollars(fixture.withholding)
      const taxable = Math.max(
        0,
        wages - (fixture.status === FilingStatus.MFJ ? 31500 : 15750)
      )
      const row = table.rows.find(
        (r: { values: number[] }) =>
          taxable >= r.values[0] && taxable < r.values[1]
      )
      if (!row && fixture.expectedTax === undefined)
        throw new Error('Fixture is outside the independent table')
      // MFJ $178,500 taxable: IRS Rev. Proc. 2024-40, $11,157 + 22% of $81,550 = $29,098.
      const tax = fixture.expectedTax ?? row?.values[2]
      if (tax === undefined) throw new Error('Missing expected tax')
      const payments =
        withholding + wholeDollars([fixture.extraMedicareCents ?? 0])
      const expected = {
        wages,
        taxable,
        tax,
        withholding,
        payments,
        refund: Math.max(0, payments - tax),
        owed: Math.max(0, tax - payments)
      }
      const made = create1040(information, [])
      if ('left' in made) throw new Error(JSON.stringify(made.left))
      const f = made.right[0]
      const lines = {
        wages: f.wages(),
        taxable: f.l15(),
        line16: f.l16(),
        tax: f.l24(),
        withholding: f.l25a(),
        line25c: f.l25c(),
        payments: f.l33(),
        refund: f.l35a(),
        owed: f.l37()
      }
      const calculate = await fetch(`${url}/api/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      const httpResult: unknown = await calculate.json()
      const httpSummary =
        typeof httpResult === 'object' &&
        httpResult !== null &&
        'summary' in httpResult
          ? httpResult.summary
          : null
      const expectedSummary = {
        agi: wages,
        taxableIncome: taxable,
        totalTax: tax,
        totalPayments: payments,
        refundAmount: expected.refund,
        amountOwed: expected.owed
      }
      const httpAgreement =
        calculate.status === 200 &&
        typeof httpSummary === 'object' &&
        httpSummary !== null &&
        Object.entries(expectedSummary).every(
          ([key, value]) =>
            key in httpSummary &&
            (httpSummary as Record<string, unknown>)[key] === value
        )
      const pdf = await fetch(`${url}/api/generate-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request)
      })
      let pdfFile: string | undefined
      let pdfError: unknown
      if (
        pdf.ok &&
        pdf.headers.get('content-type')?.includes('application/pdf')
      ) {
        pdfFile = `${fixture.id}.pdf`
        writeFileSync(
          `${output}/${pdfFile}`,
          Buffer.from(await pdf.arrayBuffer())
        )
      } else {
        pdfError = await pdf.text()
      }
      const form8959 = {
        isNeeded: f.f8959.isNeeded(),
        hasCreditableWithholding: f.f8959.hasCreditableWithholding(),
        line19: f.f8959.l19(),
        line20: f.f8959.l20(),
        line21: f.f8959.l21(),
        line22: f.f8959.l22(),
        attached: made.right[1].some((form) => form.tag === 'f8959')
      }
      const attachmentAgreement =
        form8959.attached === (fixture.expected8959 ?? false)
      const entry = {
        ...fixture,
        expected,
        lines,
        form8959,
        attachmentAgreement,
        httpStatus: calculate.status,
        httpResult,
        httpAgreement,
        pdfStatus: pdf.status,
        pdfFile,
        pdfError,
        exactLineAgreement: Object.entries(expected).every(
          ([key, value]) => lines[key as keyof typeof lines] === value
        )
      }
      results.push(entry)
      writeFileSync(
        `${output}/${fixture.id}.request.json`,
        JSON.stringify(request, null, 2) + '\n'
      )
      console.log(JSON.stringify(entry))
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    )
  }
  writeFileSync(
    `${output}/results.json`,
    JSON.stringify(
      {
        manifest,
        source:
          'IRS TY2025 i1040tt independent geometry extraction; integer-cent fixture sums; Rev. Proc. 2024-40 for the MFJ high-income case',
        scope:
          'Eight prior synthetic Single/W-2 cases and two new Form 8959 probes through actual UsTaxes form and HTTP/PDF routes. No TaxScout admission, deployed-service verification, MeF or ATS approval.',
        results
      },
      null,
      2
    ) + '\n'
  )
  process.exitCode = results.some(
    (result) =>
      !result.exactLineAgreement ||
      !result.attachmentAgreement ||
      !result.httpAgreement ||
      result.pdfStatus !== 200 ||
      !result.pdfFile
  )
    ? 1
    : 0
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
