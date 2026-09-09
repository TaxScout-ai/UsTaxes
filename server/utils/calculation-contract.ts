import { Information, Asset, TaxYear } from 'ustaxes/core/data'
import {
  information as validateInformation,
  assetString as validateAsset,
  taxYear as validateTaxYear
} from 'ustaxes/core/data/validate'
import {
  sumExactCents,
  toExactCents
} from 'ustaxes/forms/Y2025/irsForms/rounding'

export interface ContractIssue {
  path: string
  code: string
  message: string
}
const object = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
const arrays = [
  'f1099s',
  'w2s',
  'realEstate',
  'estimatedTaxes',
  'f1098es',
  'f3921s',
  'scheduleK1Form1065s',
  'credits',
  'stateResidencies',
  'individualRetirementArrangements',
  'healthSavingsAccounts'
]

/** Validate raw JSON before date conversion/defaulting can hide invalid fields.
 * This establishes shape and numeric integrity, not tax-fact completeness.
 * The TaxScout admission layer separately establishes the supported scope.
 */
export function validateCalculationRequest(raw: unknown): ContractIssue[] {
  const issues: ContractIssue[] = []
  const issue = (path: string, code: string, message: string) =>
    issues.push({ path, code, message })
  if (!object(raw))
    return [
      { path: '/', code: 'invalid_input', message: 'Request must be an object' }
    ]
  if (!validateTaxYear(raw.taxYear) || raw.taxYear === 'Y2019')
    issue('/taxYear', 'invalid_input', 'Unrecognized tax year')
  if (!object(raw.information))
    return [
      ...issues,
      {
        path: '/information',
        code: 'invalid_input',
        message: 'Information must be an object'
      }
    ]
  // Empty arrays are the documented optional HTTP defaults. Explicit null is invalid.
  const normalized = normalizeInformation(raw.information)
  if (!validateInformation(normalized)) {
    for (const e of validateInformation.errors ?? [])
      issue(
        `/information${e.instancePath}`,
        'invalid_input',
        e.message ?? 'Invalid information'
      )
  }
  const assets = raw.assets === undefined ? [] : raw.assets
  if (!Array.isArray(assets))
    issue('/assets', 'invalid_input', 'Assets must be an array')
  else
    for (const [i, asset] of assets.entries())
      if (!validateAsset(asset))
        issue(`/assets/${i}`, 'invalid_input', 'Invalid asset')
  if (issues.length) return issues
  const validateDates = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((v, i) => validateDates(v, `${path}/${i}`))
      return
    }
    if (!object(value)) return
    for (const [key, v] of Object.entries(value)) {
      if (/Date$|dateOfBirth/.test(key) && v !== undefined) {
        if (
          typeof v !== 'string' ||
          !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) ||
          !Number.isFinite(Date.parse(v)) ||
          new Date(v).toISOString().slice(0, 10) !== v.slice(0, 10)
        )
          issue(
            `${path}/${key}`,
            'invalid_date',
            'Expected a valid ISO calendar date'
          )
      } else validateDates(v, `${path}/${key}`)
    }
  }
  validateDates(normalized, '/information')
  validateDates(assets, '/assets')
  if (raw.taxYear === 'Y2025' && Array.isArray(normalized.w2s)) {
    const moneyKeys = [
      'income',
      'medicareIncome',
      'fedWithholding',
      'ssWages',
      'ssWithholding',
      'medicareWithholding',
      'stateWages',
      'stateWithholding'
    ]
    for (const key of moneyKeys) {
      const amounts: number[] = []
      for (const [i, w2] of normalized.w2s.entries()) {
        if (!object(w2) || w2[key] === undefined) continue
        const amount = w2[key]
        try {
          if (typeof amount !== 'number' || amount < 0)
            throw new Error('Expected nonnegative money')
          toExactCents(amount, `W-2 ${key}`)
          amounts.push(amount)
        } catch {
          issue(
            `/information/w2s/${i}/${key}`,
            'invalid_money',
            'Expected nonnegative exact cents within the safe range'
          )
        }
      }
      try {
        sumExactCents(amounts, `W-2 ${key}`)
      } catch {
        issue(
          `/information/w2s/${key}`,
          'money_overflow',
          'Aggregate exceeds the exact range'
        )
      }
    }
  }
  return issues
}

function normalizeInformation(
  information: Record<string, unknown>
): Record<string, unknown> {
  const normalized = { ...information }
  for (const key of arrays)
    if (normalized[key] === undefined) normalized[key] = []
  if (normalized.questions === undefined) normalized.questions = {}
  if (object(normalized.taxPayer))
    normalized.taxPayer = {
      ...normalized.taxPayer,
      dependents:
        normalized.taxPayer.dependents === undefined
          ? []
          : normalized.taxPayer.dependents
    }
  return normalized
}

export interface CalculationRequest {
  taxYear: TaxYear
  information: Information<string>
  assets: Asset<string>[]
}

/** The assertion is confined to this AJV-validated boundary. */
export function parseCalculationRequest(
  raw: unknown
):
  | { ok: true; value: CalculationRequest }
  | { ok: false; issues: ContractIssue[] } {
  const issues = validateCalculationRequest(raw)
  if (issues.length) return { ok: false, issues }
  if (!object(raw) || !object(raw.information))
    throw new Error('Validated request lost its object shape')
  return {
    ok: true,
    value: {
      taxYear: raw.taxYear as TaxYear,
      information: normalizeInformation(
        raw.information
      ) as unknown as Information<string>,
      assets: (raw.assets === undefined ? [] : raw.assets) as Asset<string>[]
    }
  }
}
