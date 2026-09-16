/**
 * OBBBA (P.L. 119-21) TY2025 deductions cross-checked against an independent
 * implementation (TAX-4843).
 *
 * The cases are the TY2025 fixtures of edyda99/us-tax-engines
 * `test/test-obbba.js` at edfb6c2 (tips, overtime, senior, car loan and SALT).
 * Its inputs are reused; every expected value here is taken from the 2025 IRS
 * forms — Schedule 1-A (f1040s1a.pdf, sha256 64f97b38…) and the State and Local
 * Tax Deduction Worksheet in the 2025 Instructions for Schedule A (i1040sca.pdf,
 * sha256 b0999b12…) — not from that project. Where the two disagree the case
 * says so and follows the IRS form:
 *
 * - Schedule 1-A lines 11 and 19 round the tips and overtime phase-out DOWN to
 *   a whole thousand; us-tax-engines rounds up ("or fraction thereof"), which
 *   the form reserves for the car loan (line 28).
 * - The SALT worksheet halves only its final result for married filing
 *   separately (line 10); us-tax-engines, like this engine before TAX-4843,
 *   halves the $40,000 cap and applies the full 30% reduction to it.
 * - The SALT worksheet adds excluded Puerto Rico, Form 2555 and Form 4563
 *   income to line 11b; this engine used AGI alone before TAX-4843.
 *
 * us-tax-engines is MIT licensed:
 *   Copyright (c) 2026 Tools Berry (tools-berry.com). Permission is hereby
 *   granted, free of charge, to any person obtaining a copy of this software
 *   and associated documentation files, to deal in the Software without
 *   restriction, subject to the condition that the above copyright notice and
 *   this permission notice shall be included in all copies or substantial
 *   portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT
 *   WARRANTY OF ANY KIND.
 */
import F1040 from '../irsForms/F1040'
import { FilingStatus, ItemizedDeductions, PersonRole } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { dataFor1A, formFor1A } from './Schedule1A.test'
import { rehearsalInformation } from './fixtures/atsRehearsal'

const statuses = {
  single: FilingStatus.S,
  mfj: FilingStatus.MFJ,
  hoh: FilingStatus.HOH,
  mfs: FilingStatus.MFS
} as const
type Status = keyof typeof statuses

const schedule1A = (form: F1040) => {
  if (!form.schedule1A) throw new Error('Missing Schedule 1-A')
  return form.schedule1A
}

describe('OBBBA cross-check: overtime (Schedule 1-A lines 14a–21)', () => {
  it.each<[string, number, Status, number, number]>([
    ['below the cap', 5000, 'single', 60000, 5000],
    ['capped at $12,500', 20000, 'single', 80000, 12500],
    ['phase-out at MAGI 200,000', 30000, 'single', 200000, 7500],
    ['fully phased out at 280,000', 30000, 'single', 280000, 0],
    // us-tax-engines: 12,400 (rounds 0.001 thousand up). Line 19 rounds down.
    [
      '$1 over the threshold (line 19 rounds down)',
      20000,
      'single',
      150001,
      12500
    ],
    ['joint cap $25,000', 30000, 'mfj', 120000, 25000],
    ['head of household uses $12,500', 30000, 'hoh', 90000, 12500]
  ])('%s', (_label, overtime, status, magi, expected) => {
    const form = formFor1A(
      dataFor1A({ qualifiedOvertimeW2: overtime }),
      magi,
      statuses[status]
    )
    expect(schedule1A(form).l21()).toBe(expected)
  })
})

describe('OBBBA cross-check: tips (Schedule 1-A lines 4a–13)', () => {
  it.each<[string, number, Status, number, number]>([
    ['capped at $25,000', 30000, 'single', 60000, 25000],
    ['joint cap is not doubled', 40000, 'mfj', 120000, 25000],
    ['fully phased out at 400,000', 40000, 'single', 400000, 0],
    // Line 11 boundaries, not in us-tax-engines.
    ['$999 over the threshold reduces nothing', 30000, 'single', 150999, 25000],
    ['$1,000 over the threshold reduces $100', 30000, 'single', 151000, 24900]
  ])('%s', (_label, tips, status, magi, expected) => {
    const form = formFor1A(
      dataFor1A({ qualifiedTipsW2: tips }),
      magi,
      statuses[status]
    )
    expect(schedule1A(form).l13()).toBe(expected)
  })
})

describe('OBBBA cross-check: senior deduction (Schedule 1-A lines 31–37)', () => {
  it.each<[string, Status, string, number, number]>([
    ['single, 65, MAGI 50,000', 'single', '1955-06-01', 50000, 6000],
    ['joint, both 65, MAGI 100,000', 'mfj', '1955-06-01', 100000, 12000],
    ['head of household uses $75,000', 'hoh', '1955-06-01', 100000, 4500],
    ['joint, both 65, MAGI 200,000', 'mfj', '1955-06-01', 200000, 6000],
    ['single fully phased out at 175,000', 'single', '1955-06-01', 175000, 0],
    ['64 at year end', 'single', '1961-01-02', 40000, 0],
    ['born January 1, 1961 qualifies', 'single', '1961-01-01', 60000, 6000]
  ])('%s', (_label, status, birth, magi, expected) => {
    const form = formFor1A(dataFor1A(), magi, statuses[status], birth)
    expect(schedule1A(form).l37()).toBe(expected)
  })
})

describe('OBBBA cross-check: car loan interest (Schedule 1-A lines 22–30)', () => {
  const vehicle = (interest: number) => ({
    vin: '1HGCM82633A004352',
    interestDeductedOnSchedule: 0,
    interestForSchedule1A: interest
  })
  it.each<[string, Status, number, number, number]>([
    // us-tax-engines keeps cents (2,393.96); Schedule 1-A lines are whole dollars.
    ['below the threshold', 'single', 80000, 2393.96, 2394],
    ['capped at $10,000', 'single', 95000, 12500, 10000],
    ['phase-out midpoint', 'single', 125000, 11000, 5000],
    [
      'a portion of $1,000 counts (line 28 rounds up)',
      'single',
      110500,
      3000,
      800
    ],
    ['edge at 149,000', 'single', 149000, 10000, 200],
    ['fully phased out at 150,000', 'single', 150000, 10000, 0],
    ['joint fully phased out at 250,000', 'mfj', 250000, 8000, 0]
  ])('%s', (_label, status, magi, interest, expected) => {
    const form = formFor1A(
      dataFor1A({ vehicleInterest: [vehicle(interest)] }),
      magi,
      statuses[status]
    )
    expect(schedule1A(form).l30()).toBe(expected)
  })
})

describe('OBBBA cross-check: SALT limit (Schedule A line 5e worksheet)', () => {
  const itemized = (salt: number): ItemizedDeductions => ({
    medicalAndDental: 0,
    stateAndLocalTaxes: salt,
    isSalesTax: false,
    stateAndLocalRealEstateTaxes: 0,
    stateAndLocalPropertyTaxes: 0,
    interest8a: 0,
    interest8b: 0,
    interest8c: 0,
    interest8d: 0,
    investmentInterest: 0,
    charityCashCheck: 0,
    charityOther: 0
  })
  const line5e = (
    status: Status,
    agi: number,
    salt: number,
    extra: Partial<ValidatedInformation> = {}
  ): number => {
    const base = rehearsalInformation(agi)
    const info: ValidatedInformation = {
      ...base,
      taxPayer: {
        ...base.taxPayer,
        filingStatus: statuses[status],
        spouse:
          status === 'mfj' || status === 'mfs'
            ? {
                ...base.taxPayer.primaryPerson,
                ssid: '000000001',
                role: PersonRole.SPOUSE
              }
            : undefined
      },
      itemizedDeductions: itemized(salt),
      ...extra
    }
    const form = new F1040(info, [])
    expect(form.l11()).toBe(agi)
    return form.scheduleA.l5e()
  }

  it.each<[string, Status, number, number, number]>([
    ['joint, full $40,000', 'mfj', 300000, 48000, 40000],
    ['single, between $10,000 and $40,000', 'single', 150000, 18000, 18000],
    ['joint phase-down midpoint', 'mfj', 550000, 45000, 25000],
    ['joint reaches the floor at 600,000', 'mfj', 600000, 55000, 10000],
    ['joint deep past the floor', 'mfj', 900000, 85000, 10000],
    // us-tax-engines and the engine before TAX-4843: 17,000.
    // Worksheet: 40,000 − 30% × 10,000 = 37,000; line 10 halves it.
    ['separate return halves only the result', 'mfs', 260000, 25000, 18500],
    ['separate return floor is half of $10,000', 'mfs', 400000, 25000, 5000],
    ['single below the old cap', 'single', 200000, 8000, 8000]
  ])('%s', (_label, status, agi, salt, expected) => {
    expect(line5e(status, agi, salt)).toBe(expected)
  })

  it('adds excluded income to line 11b before the phase-down (worksheet lines 3a–4)', () => {
    // AGI 480,000 + 40,000 excluded Puerto Rico income = 520,000.
    // 40,000 − 30% × 20,000 = 34,000. AGI alone would leave the full 40,000.
    const exclusions = {
      schedule1AData: dataFor1A({
        incomeExclusions: { puertoRico: 40000, form4563: 0 }
      })
    }
    expect(line5e('single', 480000, 45000, exclusions)).toBe(34000)
  })
})
