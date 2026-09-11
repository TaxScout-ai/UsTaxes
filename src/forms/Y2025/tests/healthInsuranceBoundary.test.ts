import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { PersonRole } from 'ustaxes/core/data'
import {
  designBusiness,
  healthPlan,
  scenarioTwelveInformation
} from './fixtures/scenarioTwelve'

describe('Form7206 actual form boundary', () => {
  it.each([-1, NaN, Infinity, 1000.001])(
    'rejects invalid premium %s before constructing a return',
    (amount) => {
      expect(
        () =>
          new F1040(
            scenarioTwelveInformation({
              form7206s: [healthPlan({ healthInsurancePremiums: amount })]
            }),
            []
          )
      ).toThrow()
    }
  )
  it.each([-1, 0.5, NaN, Infinity, 10])(
    'rejects invalid business index %s',
    (scheduleCIndex) => {
      expect(
        () =>
          new F1040(
            scenarioTwelveInformation({
              form7206s: [healthPlan({ scheduleCIndex })]
            }),
            []
          )
      ).toThrow()
    }
  )
  it('rounds premium form lines before they reach adjustments and the snapshot', () => {
    const s = calculationSnapshot(
      new F1040(
        scenarioTwelveInformation({
          form7206s: [
            healthPlan({
              healthInsurancePremiums: 1000.5,
              longTermCarePremiums: 100.49
            })
          ]
        }),
        []
      )
    )
    expect(s.attachments.f7206?.lines).toMatchObject({
      '1': 1001,
      '2': 100,
      '3': 1101,
      '14': 1101
    })
    expect(s.attachments.schedule1?.lines['17']).toBe(1101)
  })
  it('does not allow two plans to independently consume the same business earnings limit', () => {
    expect(
      () =>
        new F1040(
          scenarioTwelveInformation({
            form7206s: [
              healthPlan({ healthInsurancePremiums: 20000 }),
              healthPlan({ healthInsurancePremiums: 20000 })
            ]
          }),
          []
        )
    ).toThrow(/one Form 7206 per business/)
  })
  it('requires the actual business retirement allocation instead of inventing a profit ratio', () => {
    const info = scenarioTwelveInformation({
      scheduleCBusinesses: [
        designBusiness(),
        designBusiness({ businessName: 'Second' })
      ],
      selfEmploymentRetirementContributions: 10000
    })
    expect(() => calculationSnapshot(new F1040(info, []))).toThrow(
      /attributable/
    )
    const f = new F1040(
      { ...info, form7206s: [healthPlan({ retirementContributions: 7000 })] },
      []
    )
    expect(f.f7206s()[0].l9()).toBe(7000)
    expect(f.f7206s()[0].l9()).not.toBe(5000)
  })
  it('refuses an allocation greater than the retirement deduction', () => {
    expect(() =>
      calculationSnapshot(
        new F1040(
          scenarioTwelveInformation({
            selfEmploymentRetirementContributions: 1000,
            form7206s: [healthPlan({ retirementContributions: 2000 })]
          }),
          []
        )
      )
    ).toThrow(/exceed/)
  })
  it('reconciles combined retirement allocations, not just each individual plan', () => {
    expect(() =>
      calculationSnapshot(
        new F1040(
          scenarioTwelveInformation({
            scheduleCBusinesses: [
              designBusiness(),
              designBusiness({ businessName: 'Second' })
            ],
            selfEmploymentRetirementContributions: 10000,
            form7206s: [
              healthPlan({ retirementContributions: 7000 }),
              healthPlan({ scheduleCIndex: 1, retirementContributions: 7000 })
            ]
          }),
          []
        )
      )
    ).toThrow(/Combined/)
  })
  it('cannot omit an attributable retirement deduction in a one-business return', () => {
    expect(() =>
      calculationSnapshot(
        new F1040(
          scenarioTwelveInformation({
            selfEmploymentRetirementContributions: 1000,
            form7206s: [healthPlan({ retirementContributions: 0 })]
          }),
          []
        )
      )
    ).toThrow(/reconcile/)
  })
  it('does not use the primary taxpayer SE tax to compute a spouse health deduction', () => {
    expect(
      () =>
        new F1040(
          scenarioTwelveInformation({
            form7206s: [healthPlan({ personRole: PersonRole.SPOUSE })]
          }),
          []
        )
    ).toThrow(/owner-specific/)
  })
})
