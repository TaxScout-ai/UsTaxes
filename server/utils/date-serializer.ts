import { Information, Asset } from 'ustaxes/core/data'

/**
 * Converts ISO date strings in the incoming JSON payload
 * to JavaScript Date objects, as required by UsTaxes core.
 *
 * Also ensures all required array fields default to [] so
 * that callers don't need to pass every empty array.
 */

type DateStringInformation = Information<string>

const toDate = (s: string | undefined | null): Date | undefined => {
  if (!s) return undefined
  const d = new Date(s)
  return isNaN(d.getTime()) ? undefined : d
}

export function deserializeInformation(
  rawInput: DateStringInformation
): Information<Date> {
  // The HTTP boundary has validated the shape before this conversion.
  const raw = rawInput

  return {
    // Preserve every validated non-date field. A manual passthrough allowlist
    // silently discarded new forms even after their HTTP schema accepted them.
    ...rawInput,
    // Required array fields - default to [] if missing
    f1099s: raw.f1099s ?? [],
    w2s: raw.w2s ?? [],
    realEstate: raw.realEstate ?? [],
    estimatedTaxes: raw.estimatedTaxes ?? [],
    f1098es: raw.f1098es ?? [],
    f3921s: raw.f3921s ?? [],
    scheduleK1Form1065s: raw.scheduleK1Form1065s ?? [],
    credits: raw.credits ?? [],
    stateResidencies: raw.stateResidencies ?? [],
    individualRetirementArrangements:
      raw.individualRetirementArrangements ?? [],

    // Required non-array fields
    itemizedDeductions: raw.itemizedDeductions ?? undefined,
    questions: raw.questions ?? {},

    // TaxPayer - deserialize date fields
    taxPayer: {
      ...raw.taxPayer,
      dependents: (raw.taxPayer.dependents ?? []).map((dep) => ({
        ...dep,
        dateOfBirth: toDate(dep.dateOfBirth) as Date
      })),
      primaryPerson: raw.taxPayer.primaryPerson
        ? {
            ...raw.taxPayer.primaryPerson,
            dateOfBirth: toDate(raw.taxPayer.primaryPerson.dateOfBirth) as Date
          }
        : undefined,
      spouse: raw.taxPayer.spouse
        ? {
            ...raw.taxPayer.spouse,
            dateOfBirth: toDate(raw.taxPayer.spouse.dateOfBirth) as Date
          }
        : undefined
    },

    // Required array with Date fields
    healthSavingsAccounts: (raw.healthSavingsAccounts ?? []).map((hsa) => ({
      ...hsa,
      startDate: toDate(hsa.startDate) as Date,
      endDate: toDate(hsa.endDate) as Date
    }))
  }
}

export function deserializeAssets(raw: Array<Asset<string>>): Asset<Date>[] {
  return (raw ?? []).map((asset) => ({
    ...asset,
    openDate: toDate(asset.openDate) as Date,
    closeDate: toDate(asset.closeDate),
    giftedDate: toDate(asset.giftedDate)
  }))
}
