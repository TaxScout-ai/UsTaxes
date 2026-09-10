/** Synthetic local rehearsal through the actual HTTP routes. Not an ATS submission. */
import express from 'express'
import { sourceManifest } from './source-manifest'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import calculate from '../../server/routes/calculate'
import pdf from '../../server/routes/generate-pdf'
import { PersonRole } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import {
  energyData,
  energyDetails,
  householdData,
  rehearsalInformation,
  scenarioOneVariation
} from 'ustaxes/forms/Y2025/tests/fixtures/atsRehearsal'
import { readOracle } from './oracle'

type Cells = Record<string, string | number | boolean>
interface Case {
  id: string
  info: ValidatedInformation
  expected: Record<string, number>
  cells: Record<string, Cells>
  statements?: string[]
}
const cases: Case[] = [
  {
    id: 'scenario-1-completed-synthetic-variation',
    info: scenarioOneVariation(),
    expected: {
      '1a': 42470,
      '15': 26720,
      '16': 2969,
      '20': 1200,
      '23': 474,
      '24': 2243,
      '25a': 2713,
      '33': 2713,
      '35a': 470
    },
    cells: {
      f1040sh: {
        f1_3: '000000029',
        f1_4: 3100,
        f1_5: 384,
        f1_6: 3100,
        f1_7: 90,
        f1_11: 474,
        'c1_4[1]': true,
        'c1_4[0]': false
      },
      f1040s2: { f1_18: 474 },
      f1040s3: { f1_07: 0, f1_08: 1200, f1_25: 1200 },
      f5695: {
        f2_10: 1020,
        f2_11: 'A1B2',
        f2_14: 1720,
        f2_15: 'A1B3',
        f2_17: 920,
        f2_18: 'A1B4',
        f2_20: 800,
        f2_21: 2740,
        f2_22: 4460,
        f2_24: 500,
        f2_25: 600,
        f2_26: 'A1B5',
        f2_28: 600,
        f2_40: 180,
        f3_21: 2100,
        f3_22: 'A1B6',
        f3_24: 400,
        f3_25: 2500,
        f3_26: 600,
        f4_03: 1280,
        f4_04: 1200,
        f4_20: 2969,
        f4_21: 1200,
        'c2_1[0]': true,
        'c2_4[1]': true,
        'c3_1[0]': true,
        'c4_1[1]': true
      }
    },
    statements: [
      'Form 5695 line 19e',
      'QMID T001',
      'QMID T004',
      'Form 5695 line 22b',
      'QMID T005'
    ]
  },
  {
    id: 'energy-credit-order',
    info: {
      ...rehearsalInformation(20000),
      form5695: energyData({ solarElectric: 1000, insulationMaterials: 1000 })
    },
    expected: { '15': 4250, '16': 428, '20': 428, '24': 0 },
    cells: {
      f1040s3: { f1_07: 128, f1_08: 300, f1_25: 428 },
      f5695: {
        f1_08: 1000,
        f1_14: 300,
        f1_28: 128,
        f1_29: 128,
        f1_30: 172,
        f4_20: 428,
        f4_21: 300
      }
    }
  },
  {
    id: 'two-water-heaters-duplicate-template-leaf',
    info: {
      ...rehearsalInformation(),
      form5695: energyData({
        details: energyDetails({
          waterHeaters: [
            { qmid: 'T010', cost: 500 },
            { qmid: 'T011', cost: 400 }
          ]
        })
      })
    },
    expected: { '16': 2969, '20': 270, '24': 2699, '35a': 14 },
    cells: {
      f5695: {
        f3_27: 900,
        f3_28: 'T010',
        'topmostSubform[0].Page3[0].f3_30[0]': 500,
        'topmostSubform[0].Page3[0].Ln23aii[0].Box1-4[0].f3_30[0]': 'T011',
        f3_32: 400,
        f3_34: 900,
        f3_35: 270,
        f4_21: 270
      }
    }
  },
  {
    id: 'fuel-cell-capacity-and-carryforward',
    info: {
      ...rehearsalInformation(),
      form5695: energyData({
        fuelCell: 10000,
        details: energyDetails({
          fuelCellCapacityKw: 0.5,
          fuelCellMainHomeInUS: true,
          cleanEnergyCarryforward: 100
        })
      })
    },
    expected: { '16': 2969, '20': 600, '24': 2369, '35a': 344 },
    cells: {
      f5695: {
        f1_20: 10000,
        f1_21: 3000,
        f1_22: 0,
        f1_23: '5',
        f1_24: 500,
        f1_25: 500,
        f1_26: 100,
        f1_27: 600,
        f1_29: 600
      }
    }
  }
]
const child = rehearsalInformation(75250)
child.taxPayer.dependents = [
  {
    firstName: 'Synthetic',
    lastName: 'Child',
    ssid: '000000001',
    dateOfBirth: new Date('2015-01-01T00:00:00Z'),
    role: PersonRole.DEPENDENT,
    relationship: 'child',
    isBlind: false
  }
]
child.form5695 = energyData({ solarElectric: 30000, insulationMaterials: 4000 })
cases.push({
  id: 'energy-child-credit-worksheet-b',
  info: child,
  expected: {
    '16': 8010,
    '19': 500,
    '20': 7510,
    '24': 0,
    '28': 1700,
    '33': 4413,
    '35a': 4413
  },
  cells: {
    f1040s3: { f1_07: 6310, f1_08: 1200, f1_25: 7510 },
    f5695: { f1_27: 9000, f1_28: 6310, f1_29: 6310, f1_30: 2690, f4_21: 1200 },
    f1040s8: {
      f1_9: 1,
      f1_10: 2200,
      f1_19: 500,
      f2_2: 1700,
      f2_4: 1700,
      f2_16: 1700,
      'c2_1[1]': true,
      'c2_2[0]': true
    }
  }
})
for (const [state, late, expected] of [
  ['OH', 0, 42],
  ['CA', 100, 136],
  ['VI', 0, 357]
] as const) {
  const info = {
    ...rehearsalInformation(),
    scheduleH: householdData({
      quarterlyFutaThresholdMet: true,
      futa: {
        taxableWages: 7000,
        allWagesSubjectToStateTax: true,
        allContributionsPaidByDueDate: late === 0,
        states: [
          {
            state,
            taxableWages: 7000,
            experienceRatePpm: 27000,
            periodStart: '2025-01-01',
            periodEnd: '2025-12-31',
            contributionsOnTime: 189 - late,
            contributionsLate: late,
            futaWagesSubjectToStateTax: 7000
          }
        ]
      }
    })
  }
  cases.push({
    id: `household-futa-${state.toLowerCase()}`,
    info,
    expected: {
      '16': 2969,
      '23': 474 + expected,
      '24': 3443 + expected,
      '37': 730 + expected
    },
    cells: {
      f1040sh:
        state === 'OH'
          ? {
              f2_1: 'OH',
              f2_2: 189,
              f2_3: 7000,
              f2_4: 42,
              f2_31: 474,
              f2_32: 516
            }
          : {
              f2_5: state,
              f2_9: '0.027',
              f2_10: 378,
              f2_11: 189,
              f2_12: 189,
              f2_13: 189 - late,
              f2_27: 420,
              f2_30: expected,
              f2_32: 474 + expected,
              c2_4: true
            }
    },
    statements: state === 'OH' ? [] : ['Schedule H line 23', 'Worksheet 2']
  })
}

async function main() {
  const output = process.argv[2]
  if (!output || process.argv.length !== 3)
    throw new Error('Required: new evidence directory')
  mkdirSync(output)
  const identityBefore = sourceManifest()
  const sources = JSON.parse(
    readFileSync('scripts/verification/authority/ats1-sources.json', 'utf8')
  ) as Array<{ path: string; sha256: string }>
  for (const s of sources)
    if (
      createHash('sha256').update(readFileSync(s.path)).digest('hex') !==
      s.sha256
    )
      throw new Error(`Authority checksum mismatch: ${s.path}`)
  const table = readOracle(
    resolve('scripts/verification/authority/independent-tax-table.json.gz')
  )
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
  const post = (path: string, body: unknown) =>
    fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  const results = []
  const negatives = []
  try {
    for (const c of cases) {
      const request = { taxYear: 'Y2025', information: c.info, assets: [] }
      const response = await post('/api/calculate', request)
      const actual = (await response.json()) as {
        success: boolean
        returnLines: { lines: Record<string, number> }
        forms: Array<{ tag: string }>
      }
      if (response.status !== 200 || !actual.success)
        throw new Error(`${c.id}: ${JSON.stringify(actual)}`)
      const taxable = actual.returnLines.lines['15']
      const row = table.rows.find(
        (r) => r.values[0] <= taxable && taxable < r.values[1]
      )
      if (!row || row.values[2] !== actual.returnLines.lines['16'])
        throw new Error(`${c.id}: independent IRS table mismatch`)
      for (const [line, expected] of Object.entries(c.expected))
        if (actual.returnLines.lines[line] !== expected)
          throw new Error(
            `${c.id} line ${line}: ${actual.returnLines.lines[line]} != ${expected}`
          )
      const generated = await post('/api/generate-pdf', request)
      if (
        generated.status !== 200 ||
        !generated.headers.get('content-type')?.includes('application/pdf')
      )
        throw new Error(`${c.id}: PDF ${await generated.text()}`)
      const file = `${c.id}.pdf`
      writeFileSync(
        resolve(output, file),
        Buffer.from(await generated.arrayBuffer())
      )
      writeFileSync(
        resolve(output, `${c.id}.request.json`),
        JSON.stringify(request, null, 2) + '\n'
      )
      writeFileSync(
        resolve(output, `${c.id}.response.json`),
        JSON.stringify(actual, null, 2) + '\n'
      )
      results.push({
        id: c.id,
        file,
        expected: c.expected,
        cells: c.cells,
        statements: c.statements ?? [],
        forms: actual.forms.map((f) => f.tag)
      })
    }
    const base = scenarioOneVariation()
    const baseEnergy = base.form5695
    if (!baseEnergy?.details) throw new Error('Missing synthetic details')
    const bad = [
      {
        id: 'energy-details-missing',
        info: { ...base, form5695: { ...baseEnergy, details: undefined } },
        code: 'needs_facts'
      },
      {
        id: 'door-items-do-not-reconcile',
        info: {
          ...base,
          form5695: {
            ...baseEnergy,
            details: {
              ...baseEnergy.details,
              doors: baseEnergy.details.doors.slice(0, 3)
            }
          }
        },
        code: 'invalid_input'
      },
      {
        id: 'energy-fractional-cent',
        info: { ...base, form5695: { ...baseEnergy, solarElectric: 1.001 } },
        code: 'invalid_input'
      },
      {
        id: 'shared-home-not-supported',
        info: {
          ...base,
          form5695: {
            ...baseEnergy,
            details: { ...baseEnergy.details, jointOccupancy: true }
          }
        },
        code: 'unsupported'
      },
      {
        id: 'household-bases-not-established',
        info: {
          ...base,
          scheduleH: { ...householdData(), wageBasesEstablished: false }
        },
        code: 'needs_facts'
      },
      {
        id: 'futa-details-missing',
        info: {
          ...base,
          scheduleH: { ...householdData(), quarterlyFutaThresholdMet: true }
        },
        code: 'needs_facts'
      },
      {
        id: 'household-fractional-cent',
        info: {
          ...base,
          scheduleH: { ...householdData(), federalIncomeTaxWithheld: 1.001 }
        },
        code: 'invalid_input'
      }
    ]
    for (const c of bad)
      for (const path of ['/api/calculate', '/api/generate-pdf']) {
        const response = await post(path, {
          taxYear: 'Y2025',
          information: c.info,
          assets: []
        })
        const actual = (await response.json()) as {
          success: boolean
          error: string
        }
        if (
          response.status !== 422 ||
          actual.success !== false ||
          actual.error !== c.code
        )
          throw new Error(`${c.id}${path}: ${JSON.stringify(actual)}`)
        negatives.push({
          id: c.id,
          path,
          status: response.status,
          code: actual.error
        })
      }
    const identityAfter = sourceManifest()
    if (identityBefore.treeSha256 !== identityAfter.treeSha256)
      throw new Error('Engine source changed during verification')
    const report = {
      engineIdentity: identityBefore,
      mode: 'SYNTHETIC_LOCAL_REHEARSAL_NOT_FOR_FILING',
      irsScenarioAdaptationAuthorized: false,
      results,
      negatives,
      sources
    }
    writeFileSync(
      resolve(output, 'ats-results.json'),
      JSON.stringify(report, null, 2) + '\n'
    )
    console.log(
      JSON.stringify({
        status: 'PASS',
        httpCases: results.length,
        negativeRouteChecks: negatives.length
      })
    )
  } finally {
    await new Promise<void>((done, fail) =>
      server.close((e) => (e ? fail(e) : done()))
    )
  }
}
main().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
