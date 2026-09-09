import F1040 from '../irsForms/F1040'
import { FilingStatus, IncomeW2, PersonRole } from 'ustaxes/core/data'
import { blankState } from 'ustaxes/redux/reducer'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

function form(
  wages: number[],
  withheld: number[],
  status = FilingStatus.S,
  extra: Partial<ValidatedInformation> = {}
): F1040 {
  const person = {
    firstName: 'Synthetic',
    lastName: 'Test',
    role: PersonRole.PRIMARY,
    ssid: '000000000',
    dateOfBirth: new Date('1985-01-01T12:00:00Z'),
    isBlind: false,
    isTaxpayerDependent: false,
    address: { address: '1 Test St', city: 'Test' }
  }
  const w2s: IncomeW2[] = wages.map((wage, i) => ({
    occupation: 'Tester',
    income: wage,
    medicareIncome: wage,
    medicareWithholding: withheld[i],
    fedWithholding: 9100,
    ssWages: 0,
    ssWithholding: 0,
    personRole: PersonRole.PRIMARY
  }))
  return new F1040(
    {
      ...blankState,
      ...extra,
      w2s,
      taxPayer: {
        primaryPerson: person,
        dependents: [],
        filingStatus: status,
        spouse:
          status === FilingStatus.MFJ
            ? { ...person, role: PersonRole.SPOUSE }
            : undefined
      }
    },
    []
  )
}

describe('Form 8959 reconciliation and attachments (IRS i8959)', () => {
  it('does not invent a dollar from ordinary Medicare withholding', () => {
    const f = form([75000], [1087.5])
    expect([f.f8959.l19(), f.f8959.l21(), f.f8959.l22()]).toEqual([
      1088, 1088, 0
    ])
    expect(f.f8959.isNeeded()).toBe(false)
    expect(f.l25c()).toBeUndefined()
    expect([f.l24(), f.l33(), f.l35a()]).toEqual([7955, 9100, 1145])
  })
  it.each([
    [74999, 1087.49],
    [75000, 1087.5],
    [75001, 1087.51],
    [75250, 1091.13]
  ])(
    'reconciles ordinary wage %s near rounding boundaries',
    (wage, withheld) => {
      const f = form([wage], [withheld])
      expect(f.f8959.l22()).toBe(0)
      expect(f.f8959.isNeeded()).toBe(false)
    }
  )
  it('attaches the form for a single W-2 over $200,000, even with no additional tax', () => {
    const f = form([210000], [3135], FilingStatus.MFJ)
    expect(f.f8959.l18()).toBe(0)
    expect(f.l25c()).toBe(90)
    expect(f.schedules().some((f) => f.tag === 'f8959')).toBe(true)
  })
  it('keeps the strict greater-than trigger independent of rounded line 1', () => {
    expect(form([200000], [2900], FilingStatus.MFJ).f8959.isNeeded()).toBe(
      false
    )
    expect(form([200000.01], [2900], FilingStatus.MFJ).f8959.isNeeded()).toBe(
      true
    )
  })
  it('attaches completed Form 8959 whenever its withholding credit transfers', () => {
    const f = form([75250], [1541.13])
    expect(f.l25c()).toBe(450)
    expect(f.schedules().some((f) => f.tag === 'f8959')).toBe(true)
  })
  it('does not combine Medicare wages and RRTA into one threshold', () => {
    const f = form([150000], [2175], FilingStatus.S, {
      rrtaCompensation: 150000,
      rrtaTax: 0
    })
    expect(f.f8959.l18()).toBe(0)
  })
  it('does not drop an RRTA additional withholding credit', () => {
    const f = form([50000], [725], FilingStatus.MFJ, {
      rrtaCompensation: 210000,
      rrtaTax: 90
    })
    expect(f.l25c()).toBe(90)
    expect(f.schedules().some((f) => f.tag === 'f8959')).toBe(true)
  })
  it('ignores negative self-employment income for the wage tax trigger', () => {
    const f = form([210000], [3135])
    jest.spyOn(f.scheduleSE, 'l6').mockReturnValue(-50000)
    expect(f.f8959.isNeeded()).toBe(true)
    expect(f.f8959.l18()).toBe(90)
  })
})
