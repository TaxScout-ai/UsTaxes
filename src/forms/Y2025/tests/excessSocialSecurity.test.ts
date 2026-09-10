import * as fc from 'fast-check'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import F1040 from '../irsForms/F1040'
import { TaxFormInputError } from '../irsForms/formInput'
import {
  payroll,
  payrollCases,
  payrollInformation
} from './fixtures/excessSocialSecurity'

describe('Schedule 3 excess Social Security from prepared W-2 facts', () => {
  it('keeps Forms 4137 and 8919 on their separate Schedule 2 source lines', () => {
    const info = payrollInformation([
      payroll('111111111'),
      payroll('222222222')
    ])
    info.form4137 = { employerAllocatedTips: 10000, tipsReportedToEmployer: 0 }
    info.form8919 = {
      employers: [
        {
          employerName: 'Synthetic',
          employerEIN: '333333333',
          reasonCode: 'H',
          wages: 10000,
          federalIncomeTaxWithheld: 0
        }
      ]
    }
    const f = new F1040(info, [])
    expect([f.schedule2.l5(), f.schedule2.l6(), f.schedule2.l7()]).toEqual([
      145, 145, 290
    ])
    const fields = f.schedule2.namedFields()
    expect([fields.f1_16, fields.f1_17, fields.f1_18]).toEqual([145, 145, 290])
  })
  it.each(payrollCases)(
    '$id follows the IRS per-employer/per-person worksheet',
    (c) => {
      const f = new F1040(c.info, [])
      expect([
        f.schedule3.l11(),
        f.schedule2.l13() ?? 0,
        f.l24(),
        f.l33(),
        f.l37()
      ]).toEqual([c.ssCredit, c.uncollected, c.totalTax, c.payments, c.owed])
      expect(f.schedules().some((x) => x.tag === 'f1040s3')).toBe(
        c.ssCredit > 0
      )
    }
  )

  it('reproduces seed 49317589 without manufacturing a second employer', () => {
    const f = new F1040(
      payrollInformation([
        payroll('000000000', 2978, PersonRole.PRIMARY, {
          income: 1,
          ssWages: 0
        }),
        payroll('000000000', 7941, PersonRole.PRIMARY, {
          income: 11,
          ssWages: 0
        })
      ]),
      []
    )
    expect(f.schedule3.l11()).toBe(0)
  })

  it('does not combine two spouses who are each below the annual limit', () => {
    const f = new F1040(
      payrollInformation(
        [payroll('111111111'), payroll('222222222', 6200, PersonRole.SPOUSE)],
        FilingStatus.MFJ
      ),
      []
    )
    expect(f.schedule3.l11()).toBe(0)
  })

  it('uses only the primary taxpayer on a separate return', () => {
    const f = new F1040(
      payrollInformation(
        [
          payroll('111111111'),
          payroll('222222222'),
          payroll('333333333', 10918.2, PersonRole.SPOUSE)
        ],
        FilingStatus.MFS
      ),
      []
    )
    expect(f.schedule3.l11()).toBe(1482)
  })

  it.each([
    [0.49, 0],
    [0.5, 1],
    [0.51, 1]
  ])('rounds exact excess %s only at line 11', (extra, expected) => {
    const f = new F1040(
      payrollInformation([
        payroll('111111111', 10918.2),
        payroll('222222222', extra)
      ]),
      []
    )
    expect(f.schedule3.l11()).toBe(expected)
  })

  it('combines the two exact person credits before rounding the common line', () => {
    const f = new F1040(
      payrollInformation(
        [
          payroll('111111111', 10918.2),
          payroll('222222222', 0.25),
          payroll('111111111', 10918.2, PersonRole.SPOUSE),
          payroll('222222222', 0.25, PersonRole.SPOUSE)
        ],
        FilingStatus.MFJ
      ),
      []
    )
    expect(f.schedule3.l11()).toBe(1)
  })

  it('needs employer identity when eligibility cannot otherwise be established', () => {
    const f = new F1040(
      payrollInformation([
        payroll('111111111'),
        payroll('222222222', 6200, PersonRole.PRIMARY, { employer: undefined })
      ]),
      []
    )
    expect(() => f.schedule3.l11()).toThrow(TaxFormInputError)
    try {
      f.schedule3.l11()
    } catch (e) {
      expect(e).toMatchObject({ code: 'needs_facts' })
    }
  })

  it.each([-1, 1.001, Number.NaN, Number.POSITIVE_INFINITY])(
    'refuses invalid withholding %s at the form boundary',
    (amount) => {
      const f = new F1040(
        payrollInformation([payroll('111111111', amount)]),
        []
      )
      expect(() => f.schedule3.l11()).toThrow(TaxFormInputError)
    }
  )

  it('is invariant to document order and splitting one employer into multiple documents', () => {
    // Integer-cent source generator; an independent algebraic oracle uses the
    // published $10,918.20 limit, not the engine constants or its rounding helper.
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 1500000 }), { minLength: 1, maxLength: 6 }),
        (amounts) => {
          const w2s = amounts.map((a, i) =>
            payroll(String(111111111 + i), a / 100)
          )
          const expectedCents =
            amounts.length > 1
              ? Math.max(
                  0,
                  amounts.reduce((sum, a) => sum + Math.min(a, 1091820), 0) -
                    1091820
                )
              : 0
          const expected = Math.floor((expectedCents + 50) / 100)
          for (const source of [
            w2s,
            [...w2s].reverse(),
            w2s.flatMap((w, i) => [
              { ...w, ssWithholding: Math.floor(amounts[i] / 2) / 100 },
              {
                ...w,
                ssWithholding: (amounts[i] - Math.floor(amounts[i] / 2)) / 100
              }
            ])
          ])
            expect(
              new F1040(payrollInformation(source), []).schedule3.l11()
            ).toBe(expected)
        }
      ),
      { seed: 4706, numRuns: 300 }
    )
  })
})
