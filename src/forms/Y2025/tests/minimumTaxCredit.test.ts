import F1040 from '../irsForms/F1040'
import {
  FilingStatus,
  Form8801Data,
  Income1099Type,
  PersonRole
} from 'ustaxes/core/data'
import { TaxFormInputError } from '../irsForms/formInput'
import {
  creditInformation,
  minimumTaxCreditData,
  priorReturn
} from './fixtures/minimumTaxCredit'
import { energyData } from './fixtures/atsRehearsal'
import { amt } from '../data/federal'
import goldens from './fixtures/minimum-tax-goldens.json'

const form = (data = minimumTaxCreditData(), wages = 75250) =>
  new F1040(creditInformation(data, wages), [])
const credit = (f: F1040) => {
  if (!f.f8801) throw new Error('Missing minimum tax credit attachment')
  return f.f8801
}
const invalid = (data: unknown, code: TaxFormInputError['code']) => {
  try {
    form(data as Form8801Data)
    throw new Error('Invalid input computed')
  } catch (error) {
    expect(error).toBeInstanceOf(TaxFormInputError)
    expect((error as TaxFormInputError).code).toBe(code)
  }
}

describe('2025 Form 8801 from actual 2024 source lines', () => {
  it('claims carryforward without recursing through its own Schedule 3 total', () => {
    const f = form()
    expect([
      credit(f).l21(),
      credit(f).l22(),
      credit(f).l23(),
      credit(f).l25(),
      credit(f).l26()
    ]).toEqual([5000, 8010, 0, 5000, 0])
    expect([f.schedule3.l6b(), f.l20(), f.l24(), f.l35a()]).toEqual([
      5000, 5000, 3010, 6090
    ])
    expect(f.schedules().map((x) => x.tag)).toEqual(
      expect.arrayContaining(['f8801', 'f6251'])
    )
    expect(credit(f).fields()).toHaveLength(57)
    expect(f.f6251.fields()).toHaveLength(62)
  })
  it('limits credit by current tentative minimum tax and preserves the remainder', () => {
    const f = form(minimumTaxCreditData(), 200000)
    // 1040 taxable 184250 => 37067; current AMTI 200000 - 88100 => 111900, *26% = 29094.
    expect([
      f.l16(),
      f.f6251.l9(),
      credit(f).l24(),
      credit(f).l25(),
      credit(f).l26()
    ]).toEqual([37067, 29094, 7973, 5000, 0])
    const limited = form(
      minimumTaxCreditData(priorReturn({ form8801Line26: 20000 })),
      200000
    )
    expect([credit(limited).l25(), credit(limited).l26()]).toEqual([
      7973, 12027
    ])
  })
  it('subtracts the earlier energy credits before computing the minimum tax credit', () => {
    const info = creditInformation()
    const f = new F1040(
      { ...info, form5695: energyData({ solarElectric: 10000 }) },
      []
    )
    expect([
      f.schedule3.l5a(),
      credit(f).l22(),
      credit(f).l25(),
      f.l24()
    ]).toEqual([3000, 5010, 5000, 10])
  })
  it('preserves negative line 18 rather than clamping it and overclaiming credit', () => {
    const f = form(
      minimumTaxCreditData(
        priorReturn({
          form6251: { line1: 150000, line2e: 0, line10: 10000, line11: 2000 },
          form8801Line26: 10000
        })
      )
    )
    const c = credit(f)
    // Exclusion-only tentative tax (150000 - 85700)*26% = 16718.
    expect([c.l15(), c.l18(), c.l21(), c.l25()]).toEqual([
      6718, -4718, 5282, 5282
    ])
    const notNeeded = form(
      minimumTaxCreditData(
        priorReturn({
          form6251: { line1: 150000, line2e: 0, line10: 10000, line11: 2000 },
          form8801Line26: 0
        })
      )
    )
    expect(credit(notNeeded).isNeeded()).toBe(false)
    expect(credit(notNeeded).credit()).toBe(0)
    expect(notNeeded.schedules().map((x) => x.tag)).not.toContain('f8801')
  })
  it('uses the prior status even when the current status changed', () => {
    const c = credit(
      form(
        minimumTaxCreditData(
          priorReturn({
            filingStatus: FilingStatus.MFJ,
            form6251: { line1: 200000, line2e: 0, line10: 25000, line11: 1000 }
          })
        )
      )
    )
    expect([c.l5(), c.l10(), c.l11(), c.l25()]).toEqual([
      133300, 66700, 17342, 6000
    ])
  })
  it('uses the 2024 upper AMT bracket and prior MFS adjustment', () => {
    const c = credit(
      form(
        minimumTaxCreditData(
          priorReturn({
            form6251: { line1: 400000, line2e: 0, line10: 90000, line11: 0 }
          })
        )
      )
    )
    expect([c.l10(), c.l11()]).toEqual([314300, 83352])
    const mfs = credit(
      form(
        minimumTaxCreditData(
          priorReturn({
            filingStatus: FilingStatus.MFS,
            form6251: { line1: 895950, line2e: 0, line10: 300000, line11: 0 }
          })
        )
      )
    )
    expect([mfs.l4(), mfs.l9(), mfs.l11()]).toEqual([900950, 0, 249940])
  })
  it('includes the prior NR real-property minimum and foreign worksheet instead of assuming zero', () => {
    const c = credit(
      form(
        minimumTaxCreditData(
          priorReturn({ returnType: '1040-NR', netUSRealPropertyGain: 40000 })
        )
      )
    )
    expect([c.l10(), c.l11()]).toEqual([40000, 10400])
    const foreign = credit(
      form(
        minimumTaxCreditData(
          priorReturn({
            form6251: { line1: 200000, line2e: 0, line10: 30000, line11: 2000 },
            foreignEarnedIncome: {
              applicable: true,
              form2555Lines45And50: 180000,
              relatedDisallowedDeductions: 0
            }
          })
        )
      )
    )
    // tax(294300) - tax(180000) = 77752 - 46800.
    expect(foreign.l11()).toBe(30952)
    expect(foreign.supportingStatements()).toHaveLength(1)
  })
  it('computes 0/15/20/25 percent capital gain lines and the ordinary-tax ceiling', () => {
    const c = credit(
      form(
        minimumTaxCreditData(
          priorReturn({
            form6251: { line1: 200000, line2e: 0, line10: 30000, line11: 0 },
            capitalGains: {
              method: 'qualified_dividends',
              qualifiedDividends: 60000,
              netCapitalGain: 0,
              ordinaryIncome: 30000
            }
          })
        )
      )
    )
    expect([c.part3()[38], c.part3()[46], c.part3()[55]]).toEqual([
      17025, 6446, 20564
    ])
    const d = credit(
      form(
        minimumTaxCreditData(
          priorReturn({
            form6251: { line1: 200000, line2e: 0, line10: 30000, line11: 0 },
            capitalGains: {
              method: 'schedule_d',
              preferentialGain: 50000,
              netCapitalGain: 80000,
              ordinaryIncome: 100000,
              ordinaryIncomeFor20PercentLimit: 100000,
              unrecaptured1250Gain: 20000
            }
          })
        )
      )
    )
    expect([d.part3()[52], d.l11()]).toEqual([5000, 24018])
  })
  it('rounds exact aggregate source cents before entering line 1', () => {
    const data = minimumTaxCreditData(
      priorReturn({
        form6251: { line1: 20000.49, line2e: 20000.49, line10: 0, line11: 0 }
      }),
      { priorYearAMTI: 40000.98 }
    )
    expect(credit(form(data)).l1()).toBe(40001)
  })
  it.each([
    [{ priorYear: undefined }, 'needs_facts'],
    [{ mtcNOLDeduction: undefined }, 'needs_facts'],
    [{ priorYearAMTI: 123 }, 'invalid_input'],
    [{ exclusionItems: 1.001 }, 'invalid_input'],
    [{ exclusionItems: NaN }, 'invalid_input'],
    [{ exclusionItems: Infinity }, 'invalid_input'],
    [{ mtcNOLDeduction: -1 }, 'invalid_input']
  ] as const)('refuses missing or invalid source facts %j', (patch, code) =>
    invalid({ ...minimumTaxCreditData(), ...patch }, code)
  )
  it('refuses a different source year and unsupported current AMT refigures', () => {
    const data = minimumTaxCreditData()
    invalid(
      { ...data, priorYear: { ...data.priorYear, taxYear: 2025 } },
      'unsupported'
    )
    const info = creditInformation()
    expect(
      () =>
        new F1040(
          {
            ...info,
            form4952: { investmentInterestPaid: 1000 }
          } as unknown as typeof info,
          []
        )
    ).toThrow(TaxFormInputError)
  })
})

describe('current-year AMT constants and senior adjustment', () => {
  it('uses the published Tax Table inside the dividend worksheet, not its midpoint fraction', () => {
    const info = creditInformation()
    info.f1099s = [
      {
        payer: 'Synthetic',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 57,
          qualifiedDividends: 57,
          totalCapitalGainsDistributions: 0
        }
      }
    ]
    const f = new F1040(info, [])
    // IRS table tax on ordinary taxable income 59500 is 8010; 15% of $57 is
    // $8.55. The final line is 8019, never round(8009.5 + 8.55) = 8018.
    // Line 24 is 8021, so the ordinary-tax ceiling does not hide the defect.
    expect([
      f.qualifiedAndCapGainsWorksheet.l22(),
      f.l16(),
      f.l24(),
      f.l35a()
    ]).toEqual([8010, 8019, 3019, 6081])
    expect(f.f6251.part3()).toEqual({})
  })
  it('adds back the senior deduction and aligns both new line-1 PDF fields', () => {
    const info = creditInformation(minimumTaxCreditData(), 70000)
    info.taxPayer.primaryPerson.dateOfBirth = new Date('1960-01-01T00:00:00Z')
    const f = new F1040(
      {
        ...info,
        schedule1AData: {
          incomeExclusions: { puertoRico: 0, form4563: 0 },
          people: {
            primary: {
              ssnValidForEmployment: true,
              ssnIssuedByReturnDeadline: true,
              dateOfDeath: null
            }
          }
        }
      },
      []
    )
    expect([
      f.l14(),
      f.schedule1A?.l37(),
      f.f6251.l1a(),
      f.f6251.l1b(),
      f.f6251.l4()
    ]).toEqual([23750, 6000, 17750, 52250, 70000])
    expect([
      f.f6251.namedFields().f1_3,
      f.f6251.namedFields().f1_4,
      f.f6251.namedFields().f1_26
    ]).toEqual([17750, 52250, 70000])
  })
  it('calculates current qualified dividends at 15% using TY2025 bands', () => {
    const info = creditInformation(minimumTaxCreditData(), 150000)
    info.f1099s = [
      {
        payer: 'Synthetic',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 50000,
          qualifiedDividends: 50000,
          totalCapitalGainsDistributions: 0
        }
      }
    ]
    const f = new F1040(info, [])
    expect([
      f.l16(),
      f.f6251.l6(),
      f.f6251.part3().l18,
      f.f6251.part3().l31,
      f.f6251.l9(),
      credit(f).l24()
    ]).toEqual([32567, 111900, 16094, 7500, 23594, 8973])
  })
  it('uses current high-income exemption phaseout and the 20% band', () => {
    const info = creditInformation(minimumTaxCreditData(), 600000)
    info.f1099s = [
      {
        payer: 'Synthetic',
        type: Income1099Type.DIV,
        personRole: PersonRole.PRIMARY,
        form: {
          dividends: 200000,
          qualifiedDividends: 200000,
          totalCapitalGainsDistributions: 0
        }
      }
    ]
    const f = new F1040(info, [])
    expect([
      f.f6251.l5(),
      f.f6251.l6(),
      f.f6251.part3().l25,
      f.f6251.part3().l34,
      f.f6251.l7()
    ]).toEqual([44687, 755313, 533400, 40000, 190706])
    f.l16()
    expect(f.f6251.l7()).toBe(190706) // reading regular tax must not change AMT
  })
  it('applies the current MFS additional amount from the IRS line-4 example', () => {
    const info = creditInformation(minimumTaxCreditData(), 920350)
    info.taxPayer.filingStatus = FilingStatus.MFS
    const f = new F1040(info, [])
    expect([f.f6251.l4(), f.f6251.l5()]).toEqual([925350, 0])
  })
  it.each([
    [FilingStatus.S, 626350, 88100],
    [FilingStatus.S, 726350, 63100],
    [FilingStatus.S, 978750, 0],
    [FilingStatus.MFS, 100000, 68500],
    [FilingStatus.MFS, 826350, 18500],
    [FilingStatus.MFS, 900350, 0],
    [FilingStatus.MFJ, 1252700, 137000],
    [FilingStatus.W, 1252700, 137000],
    [FilingStatus.W, 1800700, 0]
  ] as const)('phaseout %s / %i gives %i', (status, income, expected) =>
    expect(amt.excemption(status, income)).toBe(expected)
  )
  it('uses a distinct prior-year rate cap and the corrected TY2025 cap', () => {
    expect([amt.cap(FilingStatus.S), amt.cap(FilingStatus.MFS)]).toEqual([
      239100, 119550
    ])
    const f = form(minimumTaxCreditData(), 327201)
    expect(f.f6251.l7()).toBe(62166)
  })
})

describe('prior-year foreign worksheet refusals', () => {
  it('requires the modified Schedule D worksheet when AMT capital gain excess exists', () => {
    const prior = priorReturn({
      form6251: { line1: 150000, line2e: 0, line10: 30000, line11: 0 },
      foreignEarnedIncome: {
        applicable: true,
        form2555Lines45And50: 180000,
        relatedDisallowedDeductions: 0
      },
      capitalGains: {
        method: 'schedule_d',
        preferentialGain: 100000,
        netCapitalGain: 150000,
        ordinaryIncome: 30000,
        ordinaryIncomeFor20PercentLimit: 30000,
        unrecaptured1250Gain: 20000
      }
    })
    invalid(minimumTaxCreditData(prior), 'needs_facts')
  })
  it('refuses a foreign credit greater than exclusion-only tentative tax', () => {
    invalid(
      minimumTaxCreditData(
        priorReturn({
          form6251: { line1: 100000, line2e: 0, line10: 0, line11: 0 },
          foreignTaxCreditOnExclusions: {
            method: 'prepared_mtftce',
            amount: 5000,
            worksheetReference: 'synthetic-source'
          }
        })
      ),
      'invalid_input'
    )
  })
})

describe('independent Python Decimal / IRS-form oracle', () => {
  it.each(goldens.cases.map((c) => [c.id, c] as const))(
    '%s',
    (_id, fixture) => {
      const f = form(fixture.data as Form8801Data)
      const c = credit(f)
      const lines = [
        c.l1(),
        c.l2(),
        c.l3(),
        c.l4(),
        c.l5(),
        c.l6(),
        c.l7(),
        c.l8(),
        c.l9(),
        c.l10(),
        c.l11(),
        c.l12(),
        c.l13(),
        c.l14(),
        c.l15(),
        c.l16(),
        c.l17(),
        c.l18(),
        c.l19(),
        c.l20(),
        c.l21(),
        c.l22(),
        c.l23(),
        c.l24(),
        c.l25(),
        c.l26()
      ]
      for (const [line, expected] of Object.entries(fixture.lines))
        expect(lines[Number(line) - 1]).toBe(expected)
      expect(c.part3()).toEqual(fixture.part3)
      expect(f.l24()).toBe(8010 - c.l25())
    }
  )
})
