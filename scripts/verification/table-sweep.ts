import { existsSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { readOracle } from './oracle'
import { computeOrdinaryTax } from 'ustaxes/forms/Y2025/irsForms/TaxTable'
import F1040 from 'ustaxes/forms/Y2025/irsForms/F1040'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { blankState } from 'ustaxes/redux/reducer'
const { values } = parseArgs({
  options: { output: { type: 'string' } },
  strict: true,
  allowPositionals: false
})
if (!values.output) throw new Error('Required: --output <new report file>')
if (existsSync(values.output))
  throw new Error('Output already exists; preserve prior evidence')
const table = readOracle(
  'scripts/verification/authority/independent-tax-table.json.gz'
)
const statuses = [
  FilingStatus.S,
  FilingStatus.MFJ,
  FilingStatus.MFS,
  FilingStatus.HOH
]
const mismatches: unknown[] = []
let checks = 0
for (const [column, status] of statuses.entries()) {
  for (const row of table.rows) {
    // Use the actual F1040 line, not a test-side Math.round wrapper.
    const f = new F1040(
      {
        ...blankState,
        taxPayer: {
          ...blankState.taxPayer,
          filingStatus: status,
          primaryPerson: {
            firstName: 'Synthetic',
            lastName: 'Sweep',
            ssid: '000000000',
            isBlind: false,
            isTaxpayerDependent: false,
            role: PersonRole.PRIMARY,
            dateOfBirth: new Date('1985-01-01'),
            address: { address: '', city: '' }
          }
        }
      },
      []
    )
    let taxable = 0
    // Isolate the published line-16 method across its whole domain. Full-return
    // aggregation and method applicability are checked separately by the CLI.
    f.l15 = () => taxable
    for (taxable = row.values[0]; taxable < row.values[1]; taxable++) {
      const actual = f.l16()
      checks++
      if (actual !== row.values[column + 2] && mismatches.length < 20)
        mismatches.push({
          status,
          taxable,
          actual,
          expected: row.values[column + 2]
        })
    }
  }
}
// Published TY2025 rate-schedule boundaries beyond the Tax Table.
const high: Array<[FilingStatus, number, number]> = [
  [FilingStatus.S, 197300, 40199],
  [FilingStatus.S, 250525, 57231],
  [FilingStatus.MFJ, 394600, 80398],
  [FilingStatus.MFS, 197300, 40199],
  [FilingStatus.MFJ, 178500, 29098]
]
for (const [status, income, expected] of high) {
  checks++
  if (computeOrdinaryTax(status, income) !== expected)
    mismatches.push({
      status,
      income,
      actual: computeOrdinaryTax(status, income),
      expected
    })
}
const result = {
  checks,
  mismatches,
  tableSource: table.source,
  tablePdfSha256: table.sha256,
  scope:
    'Line 16 Tax Table: every whole dollar for four columns; five explicit rate-schedule goldens. Does not prove other lines or all filing-status eligibility.'
}
writeFileSync(values.output, JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx'
})
console.log(JSON.stringify(result))
process.exitCode = mismatches.length ? 1 : 0
