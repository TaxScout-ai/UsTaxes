import F1040 from '../irsForms/F1040'
import {
  Schedule1AInputError,
  validateSchedule1AInput
} from '../irsForms/schedule1AInput'
import { FilingStatus, PersonRole, Schedule1AData } from 'ustaxes/core/data'
import { blankState } from 'ustaxes/redux/reducer'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

const living = {
  ssnValidForEmployment: true,
  ssnIssuedByReturnDeadline: true,
  dateOfDeath: null
}
export const dataFor1A = (
  values: Partial<Schedule1AData> = {}
): Schedule1AData => ({
  incomeExclusions: { puertoRico: 0, form4563: 0 },
  people: { primary: { ...living }, spouse: { ...living } },
  tipRecipients: ['primary'],
  overtimeRecipients: ['primary'],
  ...values
})
export function formFor1A(
  data: Schedule1AData,
  wages = 75250,
  status = FilingStatus.S,
  birth = '1985-01-01'
): F1040 {
  const person = {
    firstName: 'Synthetic',
    lastName: 'Review',
    ssid: '000000000',
    isBlind: false,
    isTaxpayerDependent: false,
    dateOfBirth: new Date(`${birth}T00:00:00Z`)
  }
  const info: ValidatedInformation = {
    ...blankState,
    taxPayer: {
      filingStatus: status,
      dependents: [],
      primaryPerson: {
        ...person,
        role: PersonRole.PRIMARY,
        address: {
          address: '1 Synthetic St',
          city: 'Test',
          state: 'TX',
          zip: '00000'
        }
      },
      spouse:
        status === FilingStatus.MFJ || status === FilingStatus.MFS
          ? { ...person, ssid: '000000001', role: PersonRole.SPOUSE }
          : undefined
    },
    w2s: [
      {
        income: wages,
        medicareIncome: wages,
        ssWages: Math.min(wages, 176100),
        ssWithholding: 0,
        fedWithholding: 9100,
        medicareWithholding: 0,
        personRole: PersonRole.PRIMARY,
        occupation: 'Synthetic'
      }
    ],
    schedule1AData: data
  }
  return new F1040(info, [])
}
const vehicle = {
  vin: '1HGCM82633A004352',
  interestDeductedOnSchedule: 0,
  interestForSchedule1A: 4000
}
const schedule = (form: F1040) => {
  if (!form.schedule1A) throw new Error('Missing Schedule 1-A')
  return form.schedule1A
}

// Independent expected results follow the printed 2025 IRS Schedule 1-A,
// not another engine. These exercise the actual 1040 attachment.
describe('TY2025 Schedule 1-A', () => {
  it.each([
    [100000, 4000],
    [100001, 3800],
    [101000, 3800],
    [101001, 3600],
    [120000, 0]
  ])(
    'car interest at MAGI %i gives %i (line 28 rounds UP)',
    (magi, expected) => {
      expect(
        formFor1A(dataFor1A({ vehicleInterest: [vehicle] }), magi).l13b()
      ).toBe(expected)
    }
  )
  it.each([
    [150999, 5000],
    [151000, 4900],
    [151999, 4900],
    [152000, 4800]
  ])(
    'tips/overtime at MAGI %i give %i each (lines 11/19 round DOWN)',
    (magi, expected) => {
      const s = schedule(
        formFor1A(
          dataFor1A({ qualifiedTipsW2: 5000, qualifiedOvertimeW2: 5000 }),
          magi
        )
      )
      expect(s.l13()).toBe(expected)
      expect(s.l21()).toBe(expected)
    }
  )
  it.each([
    ['1961-01-01', 6000],
    ['1961-01-02', 0],
    ['1961-12-31', 0]
  ])('uses the actual TY2025 birth-date cutoff: %s', (birth, expected) => {
    expect(
      formFor1A(dataFor1A(), 75000, FilingStatus.S, String(birth)).l13b()
    ).toBe(expected)
  })
  it('applies each senior phaseout separately and rounds the form line', () => {
    expect(
      formFor1A(dataFor1A(), 75025, FilingStatus.S, '1960-01-01').l13b()
    ).toBe(5998)
    expect(
      formFor1A(dataFor1A(), 175000, FilingStatus.S, '1960-01-01').l13b()
    ).toBe(0)
    expect(
      formFor1A(dataFor1A(), 175000, FilingStatus.MFJ, '1960-01-01').l13b()
    ).toBe(9000)
  })
  it('sums per-employer maxima and limits tips per business', () => {
    const s = schedule(
      formFor1A(
        dataFor1A({
          employeeTips: [
            { reportedTips: 5000, form4137Tips: 3000 },
            { reportedTips: 2000, form4137Tips: 4000 }
          ],
          businessTips: [
            { qualifiedTips: 500, netIncome: 4500 },
            { qualifiedTips: 1800, netIncome: 1000 },
            { qualifiedTips: 100, netIncome: -50 }
          ]
        })
      )
    )
    expect([s.l4a(), s.l4b(), s.l4c(), s.l5(), s.l13()]).toEqual([
      0, 0, 9000, 1500, 10500
    ])
  })
  it('uses exact cents before rounding an aggregated worksheet line', () => {
    const s = schedule(
      formFor1A(
        dataFor1A({
          employeeTips: [
            { reportedTips: 6603.01, form4137Tips: 0 },
            { reportedTips: 8135.56, form4137Tips: 0 },
            { reportedTips: 1082.93, form4137Tips: 0 }
          ]
        })
      )
    )
    expect(s.l4c()).toBe(15822)
  })
  it.each([
    ['2025-02-12', 0],
    ['2025-02-13', 6000]
  ])('checks age at death: %s', (death, expected) => {
    const data = dataFor1A({
      people: { primary: { ...living, dateOfDeath: String(death) } }
    })
    expect(formFor1A(data, 75000, FilingStatus.S, '1960-02-14').l13b()).toBe(
      expected
    )
  })
  it('does not award the senior deduction without an eligible SSN', () => {
    expect(
      formFor1A(
        dataFor1A({
          people: { primary: { ...living, ssnValidForEmployment: false } }
        }),
        75000,
        FilingStatus.S,
        '1960-01-01'
      ).l13b()
    ).toBe(0)
  })
  it('does not award the senior deduction on a separate married return', () => {
    expect(
      formFor1A(dataFor1A(), 75000, FilingStatus.MFS, '1960-01-01').l13b()
    ).toBe(0)
  })
  it('includes the territorial exclusions in MAGI', () => {
    const s = schedule(
      formFor1A(
        dataFor1A({
          incomeExclusions: { puertoRico: 1000, form4563: 1000 },
          vehicleInterest: [vehicle]
        }),
        100000
      )
    )
    expect(s.l3()).toBe(102000)
    expect(s.l30()).toBe(3600)
  })
  const invalids: Array<
    [Partial<Schedule1AData>, Schedule1AInputError['code']]
  > = [
    [{ incomeExclusions: undefined }, 'needs_facts'],
    [{ primaryBornBefore1962: true }, 'invalid_input'],
    [{ qualifiedTipsSelfEmployed: 1000 }, 'needs_facts'],
    [{ qualifiedTipsW2: 100, tipRecipients: undefined }, 'needs_facts'],
    [{ qualifiedOvertimeW2: 100, people: undefined }, 'needs_facts'],
    [{ qualifiedOvertimeW2: 1.001 }, 'invalid_input'],
    [{ qualifiedOvertimeW2: -1 }, 'invalid_input'],
    [{ qualifiedOvertimeW2: Number.NaN }, 'invalid_input'],
    [{ qualifiedOvertimeW2: Number.MAX_SAFE_INTEGER }, 'invalid_input'],
    [{ vehicleInterest: [vehicle, vehicle] }, 'invalid_input'],
    [
      {
        vehicleInterest: [
          vehicle,
          { ...vehicle, vin: '2HGCM82633A004352' },
          { ...vehicle, vin: '3HGCM82633A004352' }
        ]
      },
      'unsupported'
    ]
  ]
  const assertError = (
    run: () => unknown,
    code: Schedule1AInputError['code']
  ) => {
    let caught: unknown
    try {
      run()
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(Schedule1AInputError)
    if (caught instanceof Schedule1AInputError) expect(caught.code).toBe(code)
  }
  it.each(invalids)('refuses %j with exactly %s', (values, code) => {
    assertError(() => formFor1A(dataFor1A(values)).l13b(), code)
  })
  it('refuses an ineligible tips/overtime claim on MFS', () => {
    assertError(
      () =>
        formFor1A(
          dataFor1A({ qualifiedOvertimeW2: 1000 }),
          75250,
          FilingStatus.MFS
        ).l13b(),
      'unsupported'
    )
  })
  it('keeps the standard deduction on the same age and death boundary', () => {
    expect(
      formFor1A(
        dataFor1A(),
        75000,
        FilingStatus.S,
        '1961-01-01'
      ).standardDeduction()
    ).toBe(17750)
    expect(
      formFor1A(
        dataFor1A(),
        75000,
        FilingStatus.S,
        '1961-01-02'
      ).standardDeduction()
    ).toBe(15750)
    expect(
      formFor1A(
        dataFor1A({
          people: { primary: { ...living, dateOfDeath: '2025-02-12' } }
        }),
        75000,
        FilingStatus.S,
        '1960-02-14'
      ).standardDeduction()
    ).toBe(15750)
  })
  it('applies separate MFJ limits to tips, overtime and car interest', () => {
    const s = schedule(
      formFor1A(
        dataFor1A({
          qualifiedTipsW2: 30000,
          qualifiedOvertimeW2: 30000,
          vehicleInterest: [{ ...vehicle, interestForSchedule1A: 11000 }]
        }),
        200001,
        FilingStatus.MFJ
      )
    )
    expect([s.l13(), s.l21(), s.l30(), s.l38()]).toEqual([
      25000, 25000, 9800, 59800
    ])
  })
  it('uses the non-joint threshold for qualifying surviving spouse', () => {
    const s = schedule(
      formFor1A(
        dataFor1A({ qualifiedOvertimeW2: 30000 }),
        151000,
        FilingStatus.W
      )
    )
    expect(s.l21()).toBe(12400)
  })
  it('does not silently drop a second foreign-exclusion form', () => {
    const info = formFor1A(dataFor1A()).info
    // This validator must reject the multiplicity before reading worksheet
    // contents, which the legacy 1040 currently reads from element zero only.
    const raw = {
      ...info,
      form2555s: [{}, {}]
    } as unknown as ValidatedInformation
    assertError(() => validateSchedule1AInput(raw), 'unsupported')
  })
  it('reports combined MAGI overflow as a structured input error', () => {
    const f = formFor1A(
      dataFor1A({ incomeExclusions: { puertoRico: 1000, form4563: 0 } })
    )
    f.l11 = () => 90071992547400
    assertError(() => f.l13b(), 'invalid_input')
  })
  it('does not set spouse age/blindness boxes on a separate married return', () => {
    const f = formFor1A(dataFor1A(), 75000, FilingStatus.MFS, '1960-01-01')
    expect(f.namedFields().c2_5).toBe(true)
    expect(f.namedFields().c2_7).toBe(false)
    expect(f.namedFields().c2_8).toBe(false)
  })
})
