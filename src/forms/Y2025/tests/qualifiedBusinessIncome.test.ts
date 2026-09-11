import F1040 from '../irsForms/F1040'
import F8995, { getF8995PhaseOutIncome } from '../irsForms/F8995'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import {
  FilingStatus,
  PersonRole,
  ScheduleCQbiData,
  ScheduleK1Form1065
} from 'ustaxes/core/data'
import { scenarioTwelveInformation } from './fixtures/scenarioTwelve'
import { rehearsalInformation } from './fixtures/atsRehearsal'

const qualified = (): ScheduleCQbiData => ({
  scheduleCIndex: 0,
  businessIsQualified: true,
  hasOtherQbiAdjustments: false,
  cooperativePatron: false,
  qualifiedLossCarryforward: 0,
  reitPtpLossCarryforward: 0
})
const partner = (qbi: number, reit = 0, ptp = 0): ScheduleK1Form1065 => ({
  personRole: PersonRole.PRIMARY,
  partnershipName: 'Synthetic',
  partnershipEin: '000000000',
  partnerOrSCorp: 'P',
  isForeign: false,
  isPassive: false,
  ordinaryBusinessIncome: 0,
  interestIncome: 0,
  guaranteedPaymentsForServices: 0,
  guaranteedPaymentsForCapital: 0,
  selfEmploymentEarningsA: 0,
  selfEmploymentEarningsB: 0,
  selfEmploymentEarningsC: 0,
  distributionsCodeAAmount: 0,
  section199AQBI: qbi,
  qualifiedReitDividends: reit,
  publiclyTradedPartnershipIncome: ptp
})

describe('TY2025 Form8995 from actual F1040', () => {
  it('includes Schedule C after attributable deductions, given explicit qualification facts', () => {
    const f = new F1040(
      scenarioTwelveInformation({ scheduleCQbi: qualified() }),
      []
    )
    const q = f.f8995 as F8995
    // IRS i8995: 24,328 profit minus half SE tax 1,719 and health deduction 1,000.
    expect(q.l2()).toBe(21609)
    expect(q.l5()).toBe(4322)
    expect(q.l15()).toBe(4322)
    const s = calculationSnapshot(f)
    // Independent 2025 Tax Computation Worksheet: 102,373 x 22% - 5,086.
    expect(s.lines).toMatchObject({
      '13a': 4322,
      '15': 102373,
      '16': 17436,
      '24': 20874,
      '37': 6430
    })
    expect(q.fields()).toHaveLength(33)
    expect(q.fields()[4]).toBe(21609)
    expect(q.fields()[30]).toBe(4322)
  })
  it('identifies the Schedule C business by its EIN when present', () => {
    const info = scenarioTwelveInformation({ scheduleCQbi: qualified() })
    if (!info.scheduleCBusinesses)
      throw new Error('Fixture requires Schedule C')
    info.scheduleCBusinesses[0].ein = '000000001'
    const q = new F1040(info, []).f8995 as F8995
    expect(q.businessRows()[0].tin).toBe('000000001')
    expect(q.fields()[3]).toBe('000000001')
    info.scheduleCBusinesses[0].ein = undefined
    expect((new F1040(info, []).f8995 as F8995).businessRows()[0].tin).toBe(
      info.taxPayer.primaryPerson.ssid
    )
  })
  it.each([[-4000], [10000, -4000]])(
    'refuses above-threshold losses without the required Form 8995-A Schedule C',
    (...amounts) => {
      const info = {
        ...rehearsalInformation(300000),
        scheduleK1Form1065s: amounts.map((amount) => ({
          ...partner(amount),
          ordinaryBusinessIncome: amount
        }))
      }
      expect(() => new F1040(info, [])).toThrow(/loss netting and carryforward/)
    }
  )
  it('carries a prior qualified loss as a reduction and reports unused loss', () => {
    const f = new F1040(
      scenarioTwelveInformation({
        scheduleCQbi: { ...qualified(), qualifiedLossCarryforward: 25000 }
      }),
      []
    )
    const q = f.f8995 as F8995
    expect([q.l2(), q.l3(), q.l4(), q.l15(), q.l16()]).toEqual([
      21609, -25000, 0, 0, -3391
    ])
    expect(q.fields()[18]).toBe(25000)
    expect(q.fields()[31]).toBe(3391)
  })
  it('does not include REIT/PTP twice or put income in the loss carryforward line', () => {
    const f = new F1040(
      {
        ...rehearsalInformation(100000),
        scheduleK1Form1065s: [partner(10000, 1000, 2000)]
      },
      []
    )
    const q = f.f8995 as F8995
    expect([q.l2(), q.l3(), q.l5(), q.l6(), q.l7(), q.l9(), q.l15()]).toEqual([
      10000, 0, 2000, 3000, 0, 600, 2600
    ])
  })
  it('recognizes REIT/PTP-only income even with no ordinary QBI', () => {
    const f = new F1040(
      {
        ...rehearsalInformation(100000),
        scheduleK1Form1065s: [partner(0, 1000, 2000)]
      },
      []
    )
    expect(f.l13()).toBe(600)
  })
  it('keeps REIT/PTP income in its own component above the simplified threshold', () => {
    const f = new F1040(
      {
        ...rehearsalInformation(300000),
        scheduleK1Form1065s: [partner(0, 1000, 2000)]
      },
      []
    )
    expect(f.f8995?.tag).toBe('f8995a')
    expect(f.l13()).toBe(600)
  })
  it('uses whole return-line operands even when their raw difference has a floating residual', () => {
    const info = rehearsalInformation(15750)
    info.f1099s = [
      {
        type: 'B',
        payer: 'Synthetic',
        personRole: PersonRole.PRIMARY,
        form: {
          shortTermProceeds: 0,
          shortTermCostBasis: 0,
          longTermProceeds: 0.01,
          longTermCostBasis: 0
        }
      }
    ]
    info.scheduleK1Form1065s = [partner(0.01)]
    const f = new F1040(info, [])
    expect((f.f8995 as F8995).l11()).toBe(0)
    expect(f.l13()).toBe(0)
  })
  it('nets current qualified business losses instead of filtering them away', () => {
    const f = new F1040(
      {
        ...rehearsalInformation(100000),
        scheduleK1Form1065s: [partner(10000), partner(-4000)]
      },
      []
    )
    expect((f.f8995 as F8995).l2()).toBe(6000)
    expect(f.l13()).toBe(1200)
  })
  it('uses the actual 2025 thresholds, including the boundary itself', () => {
    expect(getF8995PhaseOutIncome(FilingStatus.S)).toBe(197300)
    expect(getF8995PhaseOutIncome(FilingStatus.MFJ)).toBe(394600)
    const f = new F1040(
      {
        ...rehearsalInformation(213050),
        scheduleK1Form1065s: [partner(10000)]
      },
      []
    )
    expect(f.f8995?.tag).toBe('f8995')
  })
  it.each([
    'businessIsQualified',
    'hasOtherQbiAdjustments',
    'cooperativePatron',
    'qualifiedLossCarryforward',
    'reitPtpLossCarryforward'
  ] as const)('does not infer missing %s', (key) => {
    const q = {
      ...qualified(),
      [key]: undefined
    } as unknown as ScheduleCQbiData
    expect(
      () => new F1040(scenarioTwelveInformation({ scheduleCQbi: q }), [])
    ).toThrow()
  })
  it('refuses above-threshold Schedule C before using an unimplemented wages/UBIA shortcut', () => {
    const info = scenarioTwelveInformation({ scheduleCQbi: qualified() })
    info.w2s[0].income = 250000
    expect(() => new F1040(info, [])).toThrow(/8995-A/)
  })
})
