import { FilingStatus } from 'ustaxes/core/data'
import { CURRENT_YEAR } from '../data/federal'
import { computeOrdinaryTax } from '../irsForms/TaxTable'
import fs from 'fs/promises'
import { parseCsvOrThrow } from 'ustaxes/data/csvImport'

const getTaxTable = async (): Promise<number[][]> => {
  // The TY2025 fixture sits beside this test. Reading the TY2024 copy meant a
  // change to the previous year's file would silently move these expectations.
  const path = './src/forms/Y2025/tests/taxTable.csv'
  const taxTableCsv = (await fs.readFile(path)).toString('utf-8')
  return parseCsvOrThrow(taxTableCsv, (r: string[], rowNum) =>
    // ignore heading row.
    rowNum > 0 ? [r.map((s) => Number(s))] : []
  )
}

const expectTax = (status: FilingStatus, amount: number, tax: number) => {
  const computedTax = Math.round(computeOrdinaryTax(status, amount))
  expect(computedTax).toEqual(tax)
}

const expectTaxUnder100KRange = (
  status: FilingStatus,
  min: number,
  max: number,
  tax: number
) => {
  const diff = max - min
  const quarter = Math.round((diff / 4) * 100) / 100
  expectTax(status, min, tax)
  expectTax(status, min + quarter, tax)
  expectTax(status, min + 2 * quarter, tax)
  expectTax(status, min + 3 * quarter, tax)
  expectTax(status, max, tax)
}

describe('Tax rates', () => {
  it('test should be updated for new year', () => {
    // WARNING! Do not just change the year. Also update the CSV and expected tax amounts below!
    expect(CURRENT_YEAR).toEqual(2025)
  })
  it('ordinary taxes for single status should be correct', async () => {
    const rows = await getTaxTable()
    rows.forEach(([min, lessThan, tax]) => {
      expectTaxUnder100KRange(FilingStatus.S, min, lessThan - 0.01, tax)
    })

    // Over $100,000
    const amounts = [
      [100000, 16914], // *0.22-5211.50
      [100001, 16914],
      [103350, 17651], // *0.24-7153.00
      [103351, 17651],
      [197300, 40199], // *0.32-22897.00
      [197301, 40199],
      [250525, 57231], // *0.35-30402.75
      [250526, 57231],
      [626350, 188770], // *0.37-42737.75
      [626351, 188770]
    ]
    amounts.forEach(([amount, tax]) => {
      expectTax(FilingStatus.S, amount, tax)
    })
  })

  it('ordinary taxes for married filing jointly status should be correct', async () => {
    const rows = await getTaxTable()
    rows.forEach(([min, lessThan, , tax]) => {
      expectTaxUnder100KRange(FilingStatus.MFJ, min, lessThan - 0.01, tax)
    })

    // Over $100,000
    const amounts = [
      [100000, 11828], // *0.22-10172.00
      [100001, 11828],
      [206700, 35302], // *0.24-14306.00
      [206701, 35302],
      [394600, 80398], // *0.32-45874.00
      [394601, 80398],
      [501050, 114462], // *0.35-60905.50
      [501051, 114462],
      [751600, 202155], // *0.37-75717.50
      [751601, 202155]
    ]
    amounts.forEach(([amount, tax]) => {
      expectTax(FilingStatus.MFJ, amount, tax)
    })
  })

  it('ordinary taxes for married filing separately status should be correct', async () => {
    const rows = await getTaxTable()
    rows.forEach(([min, lessThan, , , tax]) => {
      expectTaxUnder100KRange(FilingStatus.MFS, min, lessThan - 0.01, tax)
    })

    // Over $100,000
    const amounts = [
      [100000, 16914], // *0.22-5211.50
      [100001, 16914],
      [103350, 17651], // *0.24-7153.00
      [103351, 17651],
      [197300, 40199], // *0.32-22897.00
      [197301, 40199],
      [250525, 57231], // *0.35-30402.75
      [250526, 57231],
      [375800, 101077], // *0.37-37868.75
      [375801, 101078]
    ]
    amounts.forEach(([amount, tax]) => {
      expectTax(FilingStatus.MFS, amount, tax)
    })
  })

  it('ordinary taxes for head of household status should be correct', async () => {
    const rows = await getTaxTable()
    rows.forEach(([min, lessThan, , , , tax]) => {
      expectTaxUnder100KRange(FilingStatus.HOH, min, lessThan - 0.01, tax)
    })

    // Over $100,000
    const amounts = [
      [100000, 15175], // *0.22-6825.00
      [100001, 15175],
      [103350, 15912], // *0.24-8892.00
      [103351, 15912],
      [197300, 38460], // *0.32-24636.00
      [197301, 38460],
      [250500, 55484], // *0.35-32191.00
      [250501, 55484],
      [626350, 187032], // *0.37-44416.00
      [626351, 187032]
    ]
    amounts.forEach(([amount, tax]) => {
      expectTax(FilingStatus.HOH, amount, tax)
    })
  })
})
