import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import {
  FilingStatus,
  IraPlanType,
  PersonRole,
  PlanType1099,
  Supported1099
} from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './fixtures/atsRehearsal'

/**
 * IRS ATS Scenario 8 as the published PDF states it: married filing
 * separately, lived apart all year, born 1953-10-29, $1,000 of Social
 * Security with $0 taxable, a $7,500 REIT capital-gain distribution with no
 * Schedule D, a $35,800 qualified Roth distribution (code Q) and a code G
 * pension of $20,300 with $10,300 taxable and $2,555 withheld. No wages.
 * The PDF publishes no totals; the expectations below are derived from the
 * forms and instructions and are conditional.
 */
const scenarioEight = (): ValidatedInformation => {
  const base = rehearsalInformation()
  const f1099s: Supported1099[] = [
    {
      payer: 'REIT',
      type: 'DIV',
      personRole: PersonRole.PRIMARY,
      form: {
        dividends: 0,
        qualifiedDividends: 0,
        totalCapitalGainsDistributions: 7500
      }
    } as Supported1099,
    {
      payer: 'Social Security Administration',
      type: 'SSA',
      personRole: PersonRole.PRIMARY,
      form: { netBenefits: 1000, federalIncomeTaxWithheld: 0 }
    } as Supported1099,
    {
      payer: 'Jubilee Retirement Fund',
      type: 'R',
      personRole: PersonRole.PRIMARY,
      form: {
        grossDistribution: 20300,
        taxableAmount: 10300,
        federalIncomeTaxWithheld: 2555,
        planType: PlanType1099.Pension,
        distributionCode: 'G'
      }
    } as Supported1099
  ]
  return {
    ...base,
    taxPayer: {
      ...base.taxPayer,
      filingStatus: FilingStatus.MFS,
      primaryPerson: {
        ...base.taxPayer.primaryPerson,
        dateOfBirth: new Date('1953-10-29T00:00:00Z')
      },
      spouse: {
        firstName: 'Synthetic',
        lastName: 'Spouse',
        ssid: '000000001',
        dateOfBirth: new Date('1970-01-01T00:00:00Z'),
        isBlind: false,
        isTaxpayerDependent: false,
        role: PersonRole.SPOUSE
      }
    },
    questions: { ...base.questions, LIVE_APART_FROM_SPOUSE: true },
    w2s: [],
    f1099s,
    individualRetirementArrangements: [
      {
        payer: 'Liberty Trust Company',
        personRole: PersonRole.PRIMARY,
        grossDistribution: 35800,
        taxableAmount: 0,
        taxableAmountNotDetermined: false,
        totalDistribution: false,
        federalIncomeTaxWithheld: 0,
        planType: IraPlanType.RothIRA,
        contributions: 0,
        rolloverContributions: 0,
        rothIraConversion: 0,
        recharacterizedContributions: 0,
        requiredMinimumDistributions: 0,
        lateContributions: 0,
        repayments: 0
      }
    ]
  }
}

describe('ATS Scenario 8 (MFS lived apart, 65+, SS, capital-gain distribution, Roth Q, pension G)', () => {
  const snapshot = () => calculationSnapshot(new F1040(scenarioEight(), []))

  it('reports every income line the scenario carries', () => {
    const { lines } = snapshot()
    expect(lines['4a']).toBe(35800)
    expect(lines['4b']).toBe(0)
    expect(lines['5a']).toBe(20300)
    expect(lines['5b']).toBe(10300)
    expect(lines['6a']).toBe(1000)
    expect(lines['6b']).toBe(0)
    expect(lines['7']).toBe(7500)
    expect(lines['9']).toBe(17800)
    expect(lines['11b']).toBe(17800)
  })

  it('takes the MFS standard deduction with one age box and no Schedule 1-A', () => {
    const { lines, indicators } = snapshot()
    expect(indicators.primary65OrOlder).toBe(true)
    expect(indicators.primaryBlind).toBe(false)
    expect(lines['12e']).toBe(17350)
    expect(lines['13b']).toBeNull()
    expect(lines['14']).toBe(17350)
    expect(lines['15']).toBe(450)
  })

  it('computes the tax on the Qualified Dividends and Capital Gain Tax Worksheet', () => {
    const { lines, worksheets, indicators } = snapshot()
    expect(indicators.scheduleDNotRequired).toBe(true)
    const q = worksheets.qualifiedDividendsCapitalGains
    expect(q).not.toBeNull()
    expect(q?.lines).toMatchObject({
      '1': 450,
      '3': 7500,
      '4': 7500,
      '5': 0,
      '6': 48350,
      '7': 450,
      '8': 0,
      '9': 450,
      '25': 0
    })
    expect(lines['16']).toBe(0)
    expect(lines['24']).toBe(0)
  })

  it('leaves Social Security untaxed for a separate filer who lived apart', () => {
    const { worksheets } = snapshot()
    const ss = worksheets.socialSecurityBenefits
    expect(ss?.lines).toMatchObject({
      '1': 1000,
      '2': 500,
      '3': 17800,
      '5': 18300,
      '7': 18300,
      '8': 25000,
      taxable: 0
    })
  })

  it('carries the pension withholding to line 25b and refunds it', () => {
    const { lines } = snapshot()
    expect(lines['25b']).toBe(2555)
    expect(lines['33']).toBe(2555)
    expect(lines['35a']).toBe(2555)
  })

  it('reports the worksheets as null when the return does not use them', () => {
    const { worksheets, indicators } = calculationSnapshot(
      new F1040(rehearsalInformation(), [])
    )
    expect(worksheets.socialSecurityBenefits).toBeNull()
    expect(worksheets.qualifiedDividendsCapitalGains).toBeNull()
    expect(indicators.scheduleDNotRequired).toBe(true)
    expect(indicators.primary65OrOlder).toBe(false)
  })
})

describe('Schedule B is filed only when the instructions require it', () => {
  it('is not produced for a 1099-DIV that carries only a capital gain distribution', () => {
    const f = new F1040(scenarioEight(), [])
    expect(f.scheduleB.isNeeded()).toBe(false)
    expect(f.schedules().map((s) => s.tag)).not.toContain('f1040sb')
  })
})
