import { FormTag } from 'ustaxes/core/irsForms/Form'
import {
  Asset,
  Form8949AcquiredCode,
  Form8949Category,
  Form8949Row,
  form8949LongTermCategories,
  form8949ShortTermCategories,
  isSold,
  SoldAsset
} from 'ustaxes/core/data'
import F1040Attachment from './F1040Attachment'
import F1040 from './F1040'
import { CURRENT_YEAR } from '../data/federal'
import { Field } from 'ustaxes/core/pdfFiller'
import { roundLine } from './rounding'

type EmptyLine = [
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined
]

type Line =
  | [string, string, string, number, number, undefined, undefined, number]
  | EmptyLine
const emptyLine: EmptyLine = [
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  undefined
]

const showDate = (date: Date): string =>
  `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`

/**
 * Columns (b) and (c) of a reported row print the calendar date the broker
 * stated. A date-only ISO string parses to midnight UTC, so reading it back
 * in local time would print the day before it west of Greenwich.
 */
const showUtcDate = (date: Date): string =>
  `${date.getUTCMonth() + 1}/${date.getUTCDate()}/${date.getUTCFullYear()}`

/**
 * One row as this form prints it. Columns (d), (e) and (h) are whole dollars:
 * the 2025 Instructions for Form 8949 say "If you round to whole dollars,
 * round all amounts", and each row is its own printed entry, so column (h) is
 * the difference of the rounded entries rather than the rounded difference.
 */
export interface PrintedRow {
  description: string
  acquired: string
  sold: string
  proceeds: number
  costBasis: number
  gain: number
  category: Form8949Category
}

const printedRow = (
  row: Form8949Row<Date>,
  format: (date: Date) => string = showUtcDate
): PrintedRow => {
  const proceeds = roundLine(row.proceeds)
  const costBasis = roundLine(row.costBasis)
  return {
    description: row.description,
    acquired:
      row.acquiredDate !== undefined
        ? format(row.acquiredDate)
        : (row.acquiredCode as Form8949AcquiredCode),
    sold: format(row.soldDate),
    proceeds,
    costBasis,
    gain: proceeds - costBasis,
    category: row.category
  }
}

const toLine = (row: PrintedRow): Line => [
  row.description,
  row.acquired,
  row.sold,
  row.proceeds,
  row.costBasis,
  undefined,
  undefined,
  row.gain
]

/** The TY2025 form prints eleven rows in each part. */
const NUM_SHORT_LINES = 11
const NUM_LONG_LINES = 11

const padUntil = <A, B>(xs: A[], v: B, n: number): (A | B)[] => {
  if (xs.length >= n) {
    return xs
  }
  return [...xs, ...Array.from(Array(n - xs.length)).map(() => v)]
}

const chunk = <A>(xs: A[], n: number): A[][] => {
  if (xs.length === 0) return []
  const out: A[][] = []
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n))
  return out
}

/** One printed part: the box checked at its top and the rows under it. */
export interface Part {
  category: Form8949Category
  rows: PrintedRow[]
}

export default class F8949 extends F1040Attachment {
  tag: FormTag = 'f8949'
  sequenceIndex = 12.1

  index = 0

  constructor(f1040: F1040, index = 0) {
    super(f1040)
    this.index = index
  }

  isNeeded = (): boolean =>
    this.shortTermParts().length > 0 || this.longTermParts().length > 0

  /**
   * "Check only one box on each Part I" (2025 Instructions for Form 8949), so
   * each category gets its own part, and a category with more than eleven rows
   * continues on another copy.
   */
  private parts = (categories: Form8949Category[]): Part[] =>
    categories.flatMap((category) =>
      chunk(
        this.printedRows().filter((r) => r.category === category),
        NUM_SHORT_LINES
      ).map((rows) => ({ category, rows }))
    )

  shortTermParts = (): Part[] => this.parts(form8949ShortTermCategories)
  longTermParts = (): Part[] => this.parts(form8949LongTermCategories)

  /** The part printed on this copy, if this copy prints one. */
  shortTermPart = (): Part | undefined => this.shortTermParts()[this.index]
  longTermPart = (): Part | undefined => this.longTermParts()[this.index]

  copies = (): F8949[] => {
    if (this.index === 0) {
      const extraCopiesNeeded = Math.max(
        0,
        this.shortTermParts().length - 1,
        this.longTermParts().length - 1
      )
      return Array.from(Array(extraCopiesNeeded)).map(
        (_, i) => new F8949(this.f1040, i + 1)
      )
    }
    return []
  }

  private shortTermBox = (category: Form8949Category): boolean =>
    this.shortTermPart()?.category === category

  private longTermBox = (category: Form8949Category): boolean =>
    this.longTermPart()?.category === category

  // Part I: transactions on a 1099-B (A, B, C) or a 1099-DA (G, H, I).
  part1BoxA = (): boolean => this.shortTermBox('A')
  part1BoxB = (): boolean => this.shortTermBox('B')
  part1BoxC = (): boolean => this.shortTermBox('C')
  part1BoxG = (): boolean => this.shortTermBox('G')
  part1BoxH = (): boolean => this.shortTermBox('H')
  part1BoxI = (): boolean => this.shortTermBox('I')

  // Part II: the same six categories for transactions held more than a year.
  part2BoxD = (): boolean => this.longTermBox('D')
  part2BoxE = (): boolean => this.longTermBox('E')
  part2BoxF = (): boolean => this.longTermBox('F')
  part2BoxJ = (): boolean => this.longTermBox('J')
  part2BoxK = (): boolean => this.longTermBox('K')
  part2BoxL = (): boolean => this.longTermBox('L')

  thisYearSales = (): SoldAsset<Date>[] =>
    this.f1040.assets.filter(
      (p) => isSold(p) && p.closeDate.getFullYear() === CURRENT_YEAR
    ) as SoldAsset<Date>[]

  /**
   * Every row this form reports: the rows a broker reported, plus the legacy
   * portfolio assets. An asset carries no category, so it keeps the category
   * this form used before rows existed — "not reported on a 1099-B", box C or
   * box F.
   */
  private printedRows = (): PrintedRow[] => [
    // Not `.map(printedRow)`: the index would arrive as the date formatter.
    ...this.f1040.form8949Rows.map((row) => printedRow(row)),
    // A portfolio asset's dates were entered locally, not parsed from a
    // date-only string, so they print in local time as they always have.
    ...this.thisYearSales().map((p) =>
      printedRow(
        {
          description: p.name,
          category: this.isLongTerm(p) ? 'F' : 'C',
          acquiredDate: p.openDate,
          soldDate: p.closeDate,
          proceeds: p.closePrice * p.quantity - (p.closeFee ?? 0),
          costBasis: p.openPrice * p.quantity + p.openFee
        },
        showDate
      )
    )
  ]

  // in milliseconds
  oneDay = 1000 * 60 * 60 * 24

  isLongTerm = (p: Asset<Date>): boolean => {
    if (p.closeDate === undefined || p.closePrice === undefined) return false
    // IRS rule: "held more than 1 year" means close date is after
    // the 1-year anniversary of the open date.
    const oneYearLater = new Date(
      p.openDate.getFullYear() + 1,
      p.openDate.getMonth(),
      p.openDate.getDate()
    )
    return p.closeDate > oneYearLater
  }

  /** The short-term rows printed on this copy. */
  shortTermSales = (): PrintedRow[] => this.shortTermPart()?.rows ?? []

  /** The long-term rows printed on this copy. */
  longTermSales = (): PrintedRow[] => this.longTermPart()?.rows ?? []

  shortTermLines = (): Line[] =>
    padUntil(
      this.shortTermSales().map((p) => toLine(p)),
      emptyLine,
      NUM_SHORT_LINES
    )
  longTermLines = (): Line[] =>
    padUntil(
      this.longTermSales().map((p) => toLine(p)),
      emptyLine,
      NUM_LONG_LINES
    )

  shortTermTotalProceeds = (): number =>
    this.shortTermSales().reduce((acc, p) => acc + p.proceeds, 0)

  shortTermTotalCost = (): number =>
    this.shortTermSales().reduce((acc, p) => acc + p.costBasis, 0)

  shortTermTotalGain = (): number =>
    this.shortTermSales().reduce((acc, p) => acc + p.gain, 0)

  // TODO: handle adjustments column.
  shortTermTotalAdjustments = (): number | undefined => undefined

  longTermTotalProceeds = (): number =>
    this.longTermSales().reduce((acc, p) => acc + p.proceeds, 0)

  longTermTotalCost = (): number =>
    this.longTermSales().reduce((acc, p) => acc + p.costBasis, 0)

  longTermTotalGain = (): number =>
    this.longTermSales().reduce((acc, p) => acc + p.gain, 0)

  // TODO: handle adjustments column.
  longTermTotalAdjustments = (): number | undefined => undefined

  fields = (): Field[] => [
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.part1BoxA(),
    this.part1BoxB(),
    this.part1BoxC(),
    this.part1BoxG(),
    this.part1BoxH(),
    this.part1BoxI(),
    ...this.shortTermLines().flat(),
    this.shortTermTotalProceeds(),
    this.shortTermTotalCost(),
    undefined, // greyed out field
    this.shortTermTotalAdjustments(),
    this.shortTermTotalGain(),
    this.f1040.namesString(),
    this.f1040.info.taxPayer.primaryPerson.ssid,
    this.part2BoxD(),
    this.part2BoxE(),
    this.part2BoxF(),
    this.part2BoxJ(),
    this.part2BoxK(),
    this.part2BoxL(),
    ...this.longTermLines().flat(),
    this.longTermTotalProceeds(),
    this.longTermTotalCost(),
    undefined, // greyed out field
    this.longTermTotalAdjustments(),
    this.longTermTotalGain()
  ]
}
