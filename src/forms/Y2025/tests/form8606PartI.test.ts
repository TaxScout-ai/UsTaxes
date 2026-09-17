import { readFileSync } from 'fs'
import { PDFDocument } from 'pdf-lib'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import F1040 from '../irsForms/F1040'
import F8606 from '../irsForms/F8606'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import {
  FilingStatus,
  Form8606Data,
  Ira,
  IraPlanType,
  PersonRole
} from 'ustaxes/core/data'
import { blankState } from 'ustaxes/redux/reducer'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { validateCalculationRequest } from '../../../../server/utils/calculation-contract'

/**
 * Form 8606 Part I on the 2025 form and instructions (TAX-4862). Every
 * expected value is worked by hand from the form's own arithmetic, not read
 * from the engine:
 *   line 10 "Divide line 5 by line 9 … rounded to at least 3 places. If the
 *   result is 1.000 or more, enter 1.000"; lines 11 and 12 multiply by it;
 *   "No" to the question after line 3 puts line 3 on line 14 and ends Part I.
 */

const ira = (
  personRole: PersonRole.PRIMARY | PersonRole.SPOUSE,
  grossDistribution: number,
  taxableAmount = grossDistribution
): Ira => ({
  payer: 'Synthetic IRA Custodian',
  personRole,
  grossDistribution,
  taxableAmount,
  taxableAmountNotDetermined: true,
  totalDistribution: false,
  federalIncomeTaxWithheld: 0,
  planType: IraPlanType.IRA,
  contributions: 0,
  rolloverContributions: 0,
  rothIraConversion: 0,
  recharacterizedContributions: 0,
  requiredMinimumDistributions: 0,
  lateContributions: 0,
  repayments: 0
})

const form8606 = (parts: Partial<Form8606Data>): Form8606Data => ({
  personRole: PersonRole.PRIMARY,
  nondeductibleContributions: 0,
  totalBasisPriorYears: 0,
  valueOfAllTraditionalIRAs: 0,
  distributionsFromTraditional: 0,
  amountConverted: 0,
  ...parts
})

const person = (role: PersonRole.PRIMARY | PersonRole.SPOUSE) => ({
  address: { address: '', city: '' },
  firstName: role,
  isTaxpayerDependent: false,
  lastName: 'Synthetic',
  role,
  ssid: role === PersonRole.PRIMARY ? '900000001' : '900000002',
  isBlind: false,
  dateOfBirth: new Date('1960-01-01')
})

const formFor = (
  iras: Ira[],
  form8606s: Form8606Data[],
  filingStatus = FilingStatus.S
): F1040 =>
  new F1040(
    {
      ...blankState,
      individualRetirementArrangements: iras,
      form8606s,
      taxPayer: {
        dependents: [],
        filingStatus,
        primaryPerson: person(PersonRole.PRIMARY),
        ...(filingStatus === FilingStatus.MFJ
          ? {
              spouse: {
                ...person(PersonRole.SPOUSE),
                isTaxpayerDependent: false
              }
            }
          : {})
      }
    } as ValidatedInformation,
    []
  )

const only = (f: F1040): F8606 => {
  if (!f.f8606) throw new Error('expected Form 8606')
  return f.f8606
}

describe('Form 8606 Part I (TAX-4862)', () => {
  it('takes the nontaxable share of a distribution by the line 10 ratio', () => {
    // Basis 20,000; year-end value 150,000; distribution 10,000.
    // Line 9 160,000; 20,000 / 160,000 = 0.125; line 12 = 1,250.
    const f = formFor(
      [ira(PersonRole.PRIMARY, 10_000)],
      [
        form8606({
          totalBasisPriorYears: 20_000,
          valueOfAllTraditionalIRAs: 150_000,
          distributionsFromTraditional: 10_000
        })
      ]
    )
    const h = only(f)
    expect(h.tookDistributionOrConverted()).toBe(true)
    expect([h.l3(), h.l4(), h.l5(), h.l9()]).toEqual([
      20_000, 0, 20_000, 160_000
    ])
    expect(h.l10Thousandths()).toBe(125)
    expect([h.l11(), h.l12(), h.l13(), h.l14()]).toEqual([
      0, 1_250, 1_250, 18_750
    ])
    expect([h.l15a(), h.l15b(), h.l15c()]).toEqual([8_750, 0, 8_750])
    expect([h.l16(), h.l17(), h.l18()]).toEqual([
      undefined,
      undefined,
      undefined
    ])
    expect(f.l4a()).toBe(10_000)
    expect(f.l4b()).toBe(8_750)
  })

  it('rounds line 10 to three places and lines 11 and 12 to whole dollars', () => {
    // Line 7 5,000.55 enters as 5,001. Line 9 = 23,456 + 5,001 + 2,000 =
    // 30,457. 7,000 / 30,457 = 0.22983… → 0.230. Line 11 = 2,000 × 0.230 =
    // 460; line 12 = 5,001 × 0.230 = 1,150.23 → 1,150. The cents engine
    // printed 1,150.23 and used four places (0.2298).
    const f = formFor(
      [ira(PersonRole.PRIMARY, 5_000.55), ira(PersonRole.PRIMARY, 2_000)],
      [
        form8606({
          totalBasisPriorYears: 7_000,
          valueOfAllTraditionalIRAs: 23_456,
          distributionsFromTraditional: 5_000.55,
          amountConverted: 2_000
        })
      ]
    )
    const h = only(f)
    expect(h.l9()).toBe(30_457)
    expect(h.l10Thousandths()).toBe(230)
    expect([h.l11(), h.l12(), h.l13(), h.l14()]).toEqual([
      460, 1_150, 1_610, 5_390
    ])
    expect([h.l15a(), h.l15c()]).toEqual([3_851, 3_851])
    expect([h.l16(), h.l17(), h.l18()]).toEqual([2_000, 460, 1_540])
    // Line 4b = line 15c + line 18; line 4a = both 1099-R box 1 amounts.
    expect(f.l4b()).toBe(3_851 + 1_540)
    expect(f.l4a()).toBe(7_001)
    for (const v of [h.l11(), h.l12(), h.l15c(), h.l18(), f.l4b()])
      expect(Number.isInteger(v)).toBe(true)
  })

  it('enters 1.000 when the basis is at least the total', () => {
    const f = formFor(
      [ira(PersonRole.PRIMARY, 5_000)],
      [
        form8606({
          totalBasisPriorYears: 50_000,
          valueOfAllTraditionalIRAs: 10_000,
          distributionsFromTraditional: 5_000
        })
      ]
    )
    const h = only(f)
    expect(h.l10Thousandths()).toBe(1000)
    expect([h.l12(), h.l14(), h.l15c()]).toEqual([5_000, 45_000, 0])
    expect(f.l4b()).toBe(0)
  })

  it('stops after line 3 when nothing was distributed or converted', () => {
    const f = formFor(
      [],
      [
        form8606({
          nondeductibleContributions: 7_000,
          totalBasisPriorYears: 3_000
        })
      ]
    )
    const h = only(f)
    expect(h.tookDistributionOrConverted()).toBe(false)
    expect(h.l3()).toBe(10_000)
    for (const line of [
      h.l4(),
      h.l5(),
      h.l6(),
      h.l7(),
      h.l8(),
      h.l9(),
      h.l10Thousandths(),
      h.l11(),
      h.l12(),
      h.l13(),
      h.l15a(),
      h.l15b(),
      h.l15c(),
      h.l16()
    ])
      expect(line).toBeUndefined()
    expect(h.l14()).toBe(10_000)
    expect(h.taxableAmount()).toBe(0)
  })

  it('keeps line 4 contributions out of the 2025 ratio but in the basis', () => {
    // Line 1 6,000 of which 2,000 paid in 2026; basis 10,000; value 40,000;
    // distribution 8,000. Line 5 = 14,000; line 9 = 48,000; 0.29166… → 0.292;
    // line 12 = 2,336; line 14 = 16,000 − 2,336 = 13,664.
    const h = only(
      formFor(
        [ira(PersonRole.PRIMARY, 8_000)],
        [
          form8606({
            nondeductibleContributions: 6_000,
            contributionsMadeInFollowingYear: 2_000,
            totalBasisPriorYears: 10_000,
            valueOfAllTraditionalIRAs: 40_000,
            distributionsFromTraditional: 8_000
          })
        ]
      )
    )
    expect([h.l3(), h.l4(), h.l5(), h.l9()]).toEqual([
      16_000, 2_000, 14_000, 48_000
    ])
    expect(h.l10Thousandths()).toBe(292)
    expect([h.l12(), h.l14(), h.l15c()]).toEqual([2_336, 13_664, 5_664])
  })

  it('keeps a spouse without Form 8606 on line 4b', () => {
    // Before TAX-4862 line 4b took only the Form 8606 amounts: the spouse's
    // fully taxable 4,000 disappeared from the return.
    const f = formFor(
      [ira(PersonRole.PRIMARY, 10_000), ira(PersonRole.SPOUSE, 4_000)],
      [
        form8606({
          totalBasisPriorYears: 20_000,
          valueOfAllTraditionalIRAs: 150_000,
          distributionsFromTraditional: 10_000
        })
      ],
      FilingStatus.MFJ
    )
    expect(f.l4b()).toBe(8_750 + 4_000)
    expect(f.l4a()).toBe(14_000)
  })

  it('reports Form 8606 in snapshot v13', () => {
    const snap = calculationSnapshot(
      formFor(
        [ira(PersonRole.PRIMARY, 5_000.55), ira(PersonRole.PRIMARY, 2_000)],
        [
          form8606({
            totalBasisPriorYears: 7_000,
            valueOfAllTraditionalIRAs: 23_456,
            distributionsFromTraditional: 5_000.55,
            amountConverted: 2_000
          })
        ]
      )
    )
    expect(snap.schemaVersion).toBe('ustaxes-1040-line-snapshot-v13')
    const form = snap.attachments.form8606
    expect(form?.copies).toBe(1)
    expect(form?.lines).toMatchObject({
      '3q': 1,
      '10': 230,
      '12': 1_150,
      '15c': 3_851,
      '18': 1_540,
      '19': null
    })
    expect(calculationSnapshot(formFor([], [])).attachments.form8606).toBeNull()
  })

  it('prints each line in the control beside its printed label', async () => {
    const h = only(
      formFor(
        [ira(PersonRole.PRIMARY, 5_000.55), ira(PersonRole.PRIMARY, 2_000)],
        [
          form8606({
            totalBasisPriorYears: 7_000,
            valueOfAllTraditionalIRAs: 23_456,
            distributionsFromTraditional: 5_000.55,
            amountConverted: 2_000
          })
        ]
      )
    )
    const pdf = await PDFDocument.load(
      readFileSync('public/forms/Y2025/irs/f8606.pdf').toString('base64')
    )
    const form = fillPDFByName(pdf, h.namedFields(), h.tag).getForm()
    // Located independently from the 2025 PDF's printed line numbers.
    const read = (page: number, n: string) =>
      form
        .getTextField(`topmostSubform[0].Page${page}[0].f${page}_${n}[0]`)
        .getText() ?? ''
    expect(read(1, '02')).toBe('900000001')
    expect(read(1, '11')).toBe('7000') // line 3
    expect(read(1, '17')).toBe('30457') // line 9
    expect(read(1, '18')).toBe('0') // line 10, before the point
    expect(read(1, '19')).toBe('230') // line 10, after the point
    expect(read(1, '21')).toBe('1150') // line 12
    expect(read(1, '23')).toBe('5390') // line 14
    expect(read(2, '01')).toBe('3851') // line 15a
    expect(read(2, '03')).toBe('3851') // line 15c
    expect(read(2, '06')).toBe('1540') // line 18
    expect(read(2, '07')).toBe('') // line 19: no Roth distribution
    expect(read(2, '16')).toBe('') // signature date: filed with the return
  })

  it('refuses Form 8606 amounts the return cannot carry', () => {
    const request = (forms: unknown[]) => ({
      taxYear: 'Y2025',
      information: { ...blankState, form8606s: forms }
    })
    const codes = (forms: unknown[]) =>
      validateCalculationRequest(request(forms)).map(
        (i) => `${i.path} ${i.code}`
      )
    expect(codes([form8606({ totalBasisPriorYears: 100.001 })])).toContain(
      '/information/form8606s/0/totalBasisPriorYears invalid_money'
    )
    expect(codes([form8606({ distributionsFromTraditional: -1 })])).toContain(
      '/information/form8606s/0/distributionsFromTraditional invalid_money'
    )
    expect(
      codes([
        form8606({
          nondeductibleContributions: 1_000,
          contributionsMadeInFollowingYear: 1_001
        })
      ])
    ).toContain(
      '/information/form8606s/0/contributionsMadeInFollowingYear invalid_input'
    )
    expect(codes([form8606({}), form8606({})])).toContain(
      '/information/form8606s/1/personRole invalid_input'
    )
  })
})
