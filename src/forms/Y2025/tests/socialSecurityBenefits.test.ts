import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { FilingStatus, PersonRole, Supported1099 } from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './fixtures/atsRehearsal'

/**
 * Social Security Benefits Worksheet—Lines 6a and 6b (2025 Instructions for
 * Form 1040) and Pub. 915, Repayments More Than Gross Benefits. Expected
 * lines are worked by hand from the worksheet, one whole dollar per line.
 */

const ssa = (netBenefits: number, personRole = PersonRole.PRIMARY) =>
  ({
    payer: 'Social Security Administration',
    type: 'SSA',
    personRole,
    form: { netBenefits, federalIncomeTaxWithheld: 0 }
  } as Supported1099)

const spouse = {
  firstName: 'Synthetic',
  lastName: 'Spouse',
  ssid: '000000001',
  dateOfBirth: new Date('1960-01-01T00:00:00Z'),
  isBlind: false,
  isTaxpayerDependent: false,
  role: PersonRole.SPOUSE
}

const returnWith = (
  wages: number,
  f1099s: Supported1099[],
  filingStatus = FilingStatus.S,
  liveApart?: boolean
): F1040 => {
  const base = rehearsalInformation(wages)
  const info: ValidatedInformation = {
    ...base,
    taxPayer: {
      ...base.taxPayer,
      filingStatus,
      ...(filingStatus === FilingStatus.S ? {} : { spouse })
    },
    questions:
      liveApart === undefined
        ? base.questions
        : { ...base.questions, LIVE_APART_FROM_SPOUSE: liveApart },
    f1099s
  }
  return new F1040(info, [])
}

describe('Social Security Benefits Worksheet (TY2025)', () => {
  it('adds box 5 cents before rounding and rounds each 50 % and 85 % line', () => {
    const f = returnWith(30000, [ssa(20001.37)])
    const ss = calculationSnapshot(f).worksheets.socialSecurityBenefits
    expect(ss?.lines).toEqual({
      '1': 20001,
      '2': 10001,
      '3': 30000,
      '4': 0,
      '5': 40001,
      '6': 0,
      '7': 40001,
      '8': 25000,
      '9': 15001,
      '10': 9000,
      '11': 6001,
      '12': 9000,
      '13': 4500,
      '14': 4500,
      '15': 5101,
      '16': 9601,
      '17': 17001,
      '18': 9601,
      taxable: 9601
    })
    expect(f.l6a()).toBe(20001)
    expect(f.l6b()).toBe(9601)
  })

  it('offsets a negative box 5 against the other spouse on a joint return', () => {
    // Pub. 915: $3,000 less ($500) is $2,500 of net benefits.
    const f = returnWith(
      40000,
      [ssa(3000), ssa(-500, PersonRole.SPOUSE)],
      FilingStatus.MFJ
    )
    const ss = calculationSnapshot(f).worksheets.socialSecurityBenefits
    expect(ss?.lines).toMatchObject({
      '1': 2500,
      '2': 1250,
      '5': 41250,
      '8': 32000,
      '9': 9250,
      '10': 12000,
      '11': 0,
      '13': 4625,
      '14': 1250,
      '15': 0,
      '16': 1250,
      '17': 2125,
      '18': 1250,
      taxable: 1250
    })
    expect(f.l6a()).toBe(2500)
  })

  it('does not use the worksheet when repayments exceed the benefits', () => {
    const f = returnWith(30000, [ssa(1000), ssa(-3500.25)])
    const { lines, worksheets } = calculationSnapshot(f)
    const ss = worksheets.socialSecurityBenefits
    expect(ss).not.toBeNull()
    expect(
      Object.entries(ss?.lines ?? {}).filter(
        ([k, v]) => k !== 'taxable' && v !== null
      )
    ).toEqual([])
    expect(ss?.lines.taxable).toBe(0)
    expect(lines['6a']).toBe(0)
    expect(lines['6b']).toBe(0)
  })

  it('takes 85 % of line 7 for a separate filer who lived with the spouse', () => {
    const f = returnWith(5000, [ssa(10000)], FilingStatus.MFS, false)
    const ss = calculationSnapshot(f).worksheets.socialSecurityBenefits
    expect(ss?.lines).toEqual({
      '1': 10000,
      '2': 5000,
      '3': 5000,
      '4': 0,
      '5': 10000,
      '6': 0,
      '7': 10000,
      '8': null,
      '9': null,
      '10': null,
      '11': null,
      '12': null,
      '13': null,
      '14': null,
      '15': null,
      '16': 8500,
      '17': 8500,
      '18': 8500,
      taxable: 8500
    })
    expect(f.l6d()).toBe(false)
    expect(f.namedFields()['c1_42']).toBe(false)
  })

  it('checks line 6d for a separate filer who lived apart all year', () => {
    const f = returnWith(5000, [ssa(10000)], FilingStatus.MFS, true)
    expect(calculationSnapshot(f).indicators.mfsLivedApartAllYear).toBe(true)
    expect(f.namedFields()['c1_42']).toBe(true)
    expect(f.namedFields()['c1_41']).toBe(false)
    const single = returnWith(5000, [ssa(10000)])
    expect(calculationSnapshot(single).indicators.mfsLivedApartAllYear).toBe(
      false
    )
  })
})
