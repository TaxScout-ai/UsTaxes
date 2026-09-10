import { TaxYear } from 'ustaxes/core/data'

/** Runtime boundary: TypeScript types do not establish the source of a path. */
export function templateYear(value: unknown): TaxYear {
  switch (value) {
    case 'Y2019':
      return 'Y2019'
    case 'Y2020':
      return 'Y2020'
    case 'Y2021':
      return 'Y2021'
    case 'Y2022':
      return 'Y2022'
    case 'Y2023':
      return 'Y2023'
    case 'Y2024':
      return 'Y2024'
    case 'Y2025':
      return 'Y2025'
    case 'Y2026':
      return 'Y2026'
    default:
      throw new Error('Unsupported PDF template year')
  }
}

/** Only bundled IRS/state templates and the developer's labeled equivalents.
 * No URLs, dot segments, encodings, query strings, fragments or alternate separators.
 */
export function relativeTemplatePath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !value.endsWith('.pdf') ||
    !/^(?:irs|labeled|states\/[A-Z]{2})\/[A-Za-z0-9][A-Za-z0-9_-]{0,127}\.pdf$/.test(
      value
    )
  ) {
    throw new Error('Invalid bundled PDF template path')
  }
  return value
}

export function bundledTemplateUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/forms/'))
    throw new Error('Only bundled PDF templates may be fetched')
  const slash = value.indexOf('/', '/forms/'.length)
  if (slash < 0) throw new Error('Invalid bundled PDF template URL')
  const year = templateYear(value.slice('/forms/'.length, slash))
  const path = relativeTemplatePath(value.slice(slash + 1))
  // Rebuild a root-relative URL. The caller can never supply an origin or protocol.
  return `/forms/${year}/${path}`
}
