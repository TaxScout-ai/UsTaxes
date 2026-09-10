import {
  FilingStatus,
  IncomeW2,
  Information,
  PersonRole
} from 'ustaxes/core/data'
import { creditInformation } from './minimumTaxCredit'

export function payroll(
  ein: string,
  ssWithholding = 6200,
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE = PersonRole.PRIMARY,
  changes: Partial<IncomeW2> = {}
): IncomeW2 {
  return {
    occupation: 'Synthetic employee',
    employer: { EIN: ein, employerName: 'Synthetic employer' },
    personRole,
    income: 100000,
    medicareIncome: 100000,
    fedWithholding: 10000,
    ssWages: 100000,
    ssWithholding,
    medicareWithholding: 1450,
    box12: {},
    ...changes
  }
}

export function payrollInformation(w2s: IncomeW2[], status = FilingStatus.S) {
  const base = creditInformation()
  const info: Information = base
  delete info.form8801
  info.w2s = w2s
  info.taxPayer.filingStatus = status
  if (status === FilingStatus.MFJ || status === FilingStatus.MFS)
    info.taxPayer.spouse = {
      role: PersonRole.SPOUSE,
      firstName: 'Synthetic spouse',
      lastName: 'Test',
      ssid: '000000002',
      dateOfBirth: base.taxPayer.primaryPerson.dateOfBirth,
      isBlind: false,
      isTaxpayerDependent: false
    }
  return info
}

export const payrollCases = [
  {
    id: 'two-employers',
    info: payrollInformation([payroll('111111111'), payroll('222222222')]),
    ssCredit: 1482,
    totalTax: 37067,
    payments: 21482,
    owed: 15585,
    uncollected: 0
  },
  {
    id: 'same-employer-two-forms',
    info: payrollInformation([payroll('111111111'), payroll('11-1111111')]),
    ssCredit: 0,
    totalTax: 37067,
    payments: 20000,
    owed: 17067,
    uncollected: 0
  },
  {
    id: 'box1-is-not-ss-wages',
    info: payrollInformation([
      payroll('111111111', 6200, PersonRole.PRIMARY, { income: 75000 }),
      payroll('222222222', 6200, PersonRole.PRIMARY, { income: 75000 })
    ]),
    ssCredit: 1482,
    totalTax: 25067,
    payments: 21482,
    owed: 3585,
    uncollected: 0
  },
  {
    id: 'exclude-employer-overcollection',
    info: payrollInformation([
      payroll('111111111', 12000),
      payroll('222222222', 6000)
    ]),
    ssCredit: 6000,
    totalTax: 37067,
    payments: 26000,
    owed: 11067,
    uncollected: 0
  },
  {
    id: 'uncollected-ss-and-medicare',
    info: payrollInformation([
      payroll('111111111', 6200, PersonRole.PRIMARY, {
        box12: { A: 50, B: 2, M: 10, N: 1 }
      }),
      payroll('222222222')
    ]),
    ssCredit: 1542,
    totalTax: 37130,
    payments: 21542,
    owed: 15588,
    uncollected: 63
  },
  {
    id: 'separate-spouse-limits',
    info: payrollInformation(
      [
        payroll('111111111'),
        payroll('222222222'),
        payroll('111111111', 6200, PersonRole.SPOUSE),
        payroll('222222222', 6200, PersonRole.SPOUSE)
      ],
      FilingStatus.MFJ
    ),
    ssCredit: 2964,
    totalTax: 75484,
    payments: 42964,
    owed: 32520,
    uncollected: 0
  }
]
