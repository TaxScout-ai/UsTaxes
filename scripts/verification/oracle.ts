import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
export interface OracleRow {
  values: [number, number, number, number, number, number]
  pdf_page: number
}
export function readOracle(path: string): {
  rows: OracleRow[]
  source: string
  sha256: string
} {
  const bytes = readFileSync(path)
  if (
    createHash('sha256').update(bytes).digest('hex') !==
    '1736a062373d298f0f4e0b61154f6a5c25efb5977eb8470becef41ac9b2e8e72'
  )
    throw new Error(
      'Unreviewed oracle bytes; run the source regeneration check'
    )
  // The checksum pins the complete reviewed schema and all rows.
  return JSON.parse(gunzipSync(bytes).toString()) as {
    rows: OracleRow[]
    source: string
    sha256: string
  }
}
