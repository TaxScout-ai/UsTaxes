import { rateToWholeDollars } from '../irsForms/rounding'
import { FilingStatus } from 'ustaxes/core/data'
import { linear, Piecewise } from 'ustaxes/core/util'

export const CURRENT_YEAR = 2025

interface TaggedAmount {
  name: string
  amount: number
}

interface Brackets {
  brackets: number[]
}

interface Deductions {
  deductions: TaggedAmount[]
  exemptions: TaggedAmount[]
}

interface Rates {
  rates: number[]
}

interface FederalBrackets {
  ordinary: Rates & { status: { [key in FilingStatus]: Brackets & Deductions } }
  longTermCapGains: Rates & { status: { [key in FilingStatus]: Brackets } }
}

// Tax brackets can be most easily found via google
// The standard deduction amounts with the allowances can be most
// easily found at the end of 1040-SR
const federalBrackets: FederalBrackets = {
  ordinary: {
    rates: [10, 12, 22, 24, 32, 35, 37],
    status: {
      [FilingStatus.S]: {
        brackets: [11925, 48475, 103350, 197300, 250525, 626350],
        deductions: [
          {
            name: 'Standard Deduction (Single)',
            amount: 15750
          },
          {
            name: 'Standard Deduction (Single) with 1 age or blindness allowance',
            amount: 17750
          },
          {
            name: 'Standard Deduction (Single) with 2 age or blindness allowances',
            amount: 19750
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Single)',
            amount: 0
          }
        ]
      },
      [FilingStatus.MFJ]: {
        brackets: [23850, 96950, 206700, 394600, 501050, 751600],
        deductions: [
          {
            name: 'Standard Deduction (Married)',
            amount: 31500
          },
          {
            name: 'Standard Deduction (Married) with 1 age or blindness allowance',
            amount: 33100
          },
          {
            name: 'Standard Deduction (Married) with 2 age or blindness allowances',
            amount: 34700
          },
          {
            name: 'Standard Deduction (Married) with 3 age or blindness allowances',
            amount: 36300
          },
          {
            name: 'Standard Deduction (Married) with 4 age or blindness allowances',
            amount: 37900
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Single)',
            amount: 0
          }
        ]
      },
      [FilingStatus.W]: {
        brackets: [23850, 96950, 206700, 394600, 501050, 751600],
        deductions: [
          {
            name: 'Standard Deduction (Widowed)',
            amount: 31500
          },
          {
            name: 'Standard Deduction (Widowed) with 1 age or blindness allowance',
            amount: 33100
          },
          {
            name: 'Standard Deduction (Widowed) with 2 age or blindness allowances',
            amount: 34700
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Widowed)',
            amount: 0
          }
        ]
      },
      [FilingStatus.MFS]: {
        brackets: [11925, 48475, 103350, 197300, 250525, 375800],
        deductions: [
          {
            name: 'Standard Deduction (Married Filing Separately)',
            amount: 15750
          },
          {
            name: 'Standard Deduction (Married Filing Separately) with 1 age or blindness allowance',
            amount: 17350
          },
          {
            name: 'Standard Deduction (Married Filing Separately) with 2 age or blindness allowances',
            amount: 18950
          },
          {
            name: 'Standard Deduction (Married Filing Separately) with 3 age or blindness allowances',
            amount: 20550
          },
          {
            name: 'Standard Deduction (Married Filing Separately) with 4 age or blindness allowances',
            amount: 22150
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Single)',
            amount: 0
          }
        ]
      },
      [FilingStatus.HOH]: {
        brackets: [17000, 64850, 103350, 197300, 250500, 626350],
        deductions: [
          {
            name: 'Standard Deduction (Head of Household)',
            amount: 23625
          },
          {
            name: 'Standard Deduction (Head of Household) with 1 age or blindness allowance',
            amount: 25625
          },
          {
            name: 'Standard Deduction (Head of Household) with 2 age or blindness allowances',
            amount: 27625
          }
        ],
        exemptions: [
          {
            name: 'Standard Exemption (Single)',
            amount: 0
          }
        ]
      }
    }
  },
  longTermCapGains: {
    rates: [0, 15, 20],
    status: {
      [FilingStatus.S]: {
        brackets: [48350, 533400]
      },
      [FilingStatus.MFJ]: {
        brackets: [96700, 600050]
      },
      [FilingStatus.W]: {
        brackets: [96700, 600050]
      },
      [FilingStatus.MFS]: {
        brackets: [48350, 300000]
      },
      [FilingStatus.HOH]: {
        brackets: [64750, 566700]
      }
    }
  }
}

/** Schedule SE Part II optional methods, TY2025 (2025 Schedule SE, lines 14–15 and their conditions). */
export const seOptionalMethod = {
  /** Line 14: maximum income for the optional methods. */
  maxNetEarnings: 7240,
  /** Farm optional method: gross farm income not more than this, or … */
  farmGrossIncomeLimit: 10860,
  /** … net farm profits less than this. */
  farmNetProfitLimit: 7840
}

export const fica = {
  maxSSTax: 10918.2,
  maxIncomeSSTaxApplies: 176100,

  regularMedicareTaxRate: 1.45 / 100,
  additionalMedicareTaxRate: 0.9 / 100,
  additionalMedicareTaxThreshold: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ: {
        return 250000
      }
      case FilingStatus.MFS: {
        return 125000
      }
      default: {
        return 200000 // Single, Head of Household, Windower
      }
    }
  }
}

// Net Investment Income Tax calculated on form 8960
export const netInvestmentIncomeTax = {
  taxRate: 0.038, // 3.8%
  taxThreshold: (filingStatus: FilingStatus): number => {
    switch (filingStatus) {
      case FilingStatus.MFJ: {
        return 250000
      }
      case FilingStatus.W: {
        return 250000
      }
      case FilingStatus.MFS: {
        return 125000
      }
      default: {
        return 200000 // Single, Head of Household
      }
    }
  }
}

export const healthSavingsAccounts = {
  contributionLimit: {
    'self-only': 4300,
    family: 8550
  }
}
// https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2025
// https://www.irs.gov/instructions/i6251
export const amt = {
  // Retain the historical public spelling; all amounts are whole form lines.
  excemption: (filingStatus: FilingStatus, income: number): number => {
    const joint =
      filingStatus === FilingStatus.MFJ || filingStatus === FilingStatus.W
    const exemption = joint
      ? 137000
      : filingStatus === FilingStatus.MFS
      ? 68500
      : 88100
    const start = joint ? 1252700 : 626350
    return Math.max(
      0,
      exemption -
        rateToWholeDollars(
          Math.max(0, income - start),
          25,
          100,
          'Form 6251 exemption worksheet'
        )
    )
  },
  cap: (filingStatus: FilingStatus): number =>
    filingStatus === FilingStatus.MFS ? 119550 : 239100
}

// https://www.irs.gov/credits-deductions/individuals/earned-income-tax-credit/earned-income-and-earned-income-tax-credit-eitc-tables#EITC%20Tables
// line 11 caps based on step one in instructions
const line11Caps = [19104, 50434, 57310, 61555]
const line11MfjCaps = [26214, 57554, 64430, 68675]

type Point = [number, number]

// Provided a list of points, create a piecewise function
// that makes linear segments through the list of points.
const toPieceWise = (points: Point[]): Piecewise =>
  points
    .slice(0, points.length - 1)
    .map((point, idx) => [point, points[idx + 1]])
    .map(([[x1, y1], [x2, y2]]) => ({
      // starting point     slope              intercept
      lowerBound: x1,
      f: linear((y2 - y1) / (x2 - x1), y1 - (x1 * (y2 - y1)) / (x2 - x1))
    }))

/**
 * IRS Rev. Proc. 2024-40 §2.06, tax year 2025: the EIC parameters by number of
 * qualifying children (0, 1, 2, 3 or more). The published EIC Table (2025
 * Instructions for Form 1040) is generated from these: each $50 band is
 * figured at its midpoint with the phase-in rate up to the maximum credit,
 * then the phase-out rate from the phase-out threshold, rounded to the
 * nearest dollar; the band that straddles the point where the maximum is
 * reached, and the band that straddles the phase-out threshold, carry the
 * maximum. Both facts are verified against every row of the table in
 * ScheduleEIC.test.ts.
 */
export interface EICParameters {
  /** Phase-in rate in hundredths of a percent (7.65% = 765). */
  phaseInRateBps: number
  maxCredit: number
  /** Earned income at which the maximum credit is reached. */
  phaseInEnd: number
  /** Phase-out threshold (unmarried / joint). */
  phaseOutStart: number
  phaseOutStartMfj: number
  /** Phase-out rate in hundredths of a percent (21.06% = 2106). */
  phaseOutRateBps: number
}

export const eicParameters: EICParameters[] = [
  {
    phaseInRateBps: 765,
    maxCredit: 649,
    phaseInEnd: 8490,
    phaseOutStart: 10620,
    phaseOutStartMfj: 17730,
    phaseOutRateBps: 765
  },
  {
    phaseInRateBps: 3400,
    maxCredit: 4328,
    phaseInEnd: 12730,
    phaseOutStart: 23350,
    phaseOutStartMfj: 30470,
    phaseOutRateBps: 1598
  },
  {
    phaseInRateBps: 4000,
    maxCredit: 7152,
    phaseInEnd: 17880,
    phaseOutStart: 23350,
    phaseOutStartMfj: 30470,
    phaseOutRateBps: 2106
  },
  {
    phaseInRateBps: 4500,
    maxCredit: 8046,
    phaseInEnd: 17880,
    phaseOutStart: 23350,
    phaseOutStartMfj: 30470,
    phaseOutRateBps: 2106
  }
]

/**
 * The credit the EIC Table shows for the $50 band containing `income`.
 * `married` selects the joint phase-out threshold.
 */
export const eicTableCredit = (
  income: number,
  children: number,
  married: boolean
): number => {
  if (income < 1) return 0
  const p = eicParameters[Math.min(children, eicParameters.length - 1)]
  const bandStart = Math.floor(Math.round(income) / 50) * 50
  const bandEnd = bandStart + 50
  const midpoint = bandStart + 25
  const phaseOutStart = married ? p.phaseOutStartMfj : p.phaseOutStart
  // A band that reaches the plateau on either side carries the maximum.
  if (bandEnd > p.phaseInEnd && bandStart < phaseOutStart) return p.maxCredit
  const credit =
    midpoint <= p.phaseInEnd
      ? Math.min((p.phaseInRateBps * midpoint) / 10000, p.maxCredit)
      : p.maxCredit - (p.phaseOutRateBps * (midpoint - phaseOutStart)) / 10000
  return Math.max(0, Math.floor(credit + 0.5))
}

const eicPoints = (married: boolean): Point[][] =>
  eicParameters.map((p) => {
    const start = married ? p.phaseOutStartMfj : p.phaseOutStart
    const end = start + Math.ceil((p.maxCredit * 10000) / p.phaseOutRateBps)
    return [
      [0, 0],
      [p.phaseInEnd, p.maxCredit],
      [start, p.maxCredit],
      [end, 0]
    ]
  })

/** The same parameters as linear segments (kept for the property tests). */
const unmarriedFormulas: Piecewise[] = eicPoints(false).map(toPieceWise)
const marriedFormulas: Piecewise[] = eicPoints(true).map(toPieceWise)

interface EICDef {
  caps: { [k in FilingStatus]: number[] | undefined }
  maxInvestmentIncome: number
  formulas: { [k in FilingStatus]: Piecewise[] | undefined }
}

export const QualifyingDependents = {
  childMaxAge: 17,
  qualifyingDependentMaxAge: 19,
  qualifyingStudentMaxAge: 24
}

export const EIC: EICDef = {
  // credit caps for number of children (0, 1, 2, 3 or more):
  // Step 1
  caps: {
    [FilingStatus.S]: line11Caps,
    [FilingStatus.W]: line11Caps,
    [FilingStatus.HOH]: line11Caps,
    [FilingStatus.MFS]: undefined,
    [FilingStatus.MFJ]: line11MfjCaps
  },
  maxInvestmentIncome: 11950,
  formulas: {
    [FilingStatus.S]: unmarriedFormulas,
    [FilingStatus.W]: unmarriedFormulas,
    [FilingStatus.HOH]: unmarriedFormulas,
    [FilingStatus.MFS]: undefined,
    [FilingStatus.MFJ]: marriedFormulas
  }
}

export default federalBrackets

// Constants used in the social security benefits worksheet
interface SocialSecurityBenefitsDef {
  caps: { [k in FilingStatus]: { l8: number; l10: number } }
}

// TODO: update for Y2023
export const SSBenefits: SocialSecurityBenefitsDef = {
  caps: {
    [FilingStatus.S]: { l8: 25000, l10: 9000 },
    [FilingStatus.W]: { l8: 25000, l10: 9000 },
    [FilingStatus.HOH]: { l8: 25000, l10: 9000 },
    [FilingStatus.MFS]: { l8: 25000, l10: 9000 },
    [FilingStatus.MFJ]: { l8: 32000, l10: 12000 }
  }
}

/** Schedule C line 9 standard mileage rate for 2025, cents per business mile (Notice 2025-5). */
export const standardMileageRateCents = 70
