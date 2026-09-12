import { readFileSync } from 'fs'
import { PDFCheckBox, PDFDocument } from 'pdf-lib'
import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { TaxFormInputError } from '../irsForms/formInput'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import { PersonRole } from 'ustaxes/core/data'
import { barkerMove, scenarioFiveInformation } from './fixtures/scenarioFive'

const loadTemplate = (tag: string) =>
  PDFDocument.load(
    readFileSync(`public/forms/Y2025/irs/${tag}.pdf`).toString('base64')
  )

const boxReader = (pdf: PDFDocument) => (suffix: string) => {
  const f = pdf
    .getForm()
    .getFields()
    .find((x) => x.getName().endsWith(suffix))
  return f instanceof PDFCheckBox ? f.isChecked() : undefined
}

describe('ATS Scenario 5 (head of household, blind, two children, 2441, 8863, EIC, 8862, 3903)', () => {
  const f1040 = (over = {}) => new F1040(scenarioFiveInformation(over), [])
  const snapshot = (over = {}) => calculationSnapshot(f1040(over))

  it('deducts the move on Schedule 1 line 14 and takes the blind head-of-household standard deduction', () => {
    const s = snapshot()
    expect(s.attachments.f3903?.lines).toEqual({
      '1': null,
      '2': null,
      '3': 1475,
      '4': 0,
      '5': 1475
    })
    expect(s.attachments.schedule1?.lines).toMatchObject({
      '14': 1475,
      '26': 1475
    })
    expect(s.lines).toMatchObject({
      '1a': 31232,
      '9': 31232,
      '10': 1475,
      '11a': 29757,
      '12e': 25625,
      '15': 4132,
      '16': 413,
      '18': 413
    })
    expect(s.indicators.primaryBlind).toBe(true)
  })

  it('figures the care credit at 27% and limits it to the tax', () => {
    const s = snapshot()
    expect(s.attachments.f2441?.lines).toEqual({
      '3': 1820,
      '4': 31232,
      '5': 31232,
      '6': 1820,
      '7': 29757,
      '8': 27,
      '9a': 491,
      '9b': 0,
      '9c': 491,
      '10': 413,
      '11': 413,
      '26': null
    })
    expect(s.attachments.schedule3.lines).toMatchObject({
      '2': 413,
      '3': null,
      '8': 413
    })
    expect(s.lines).toMatchObject({ '20': 413, '22': 0, '24': 0 })
  })

  it('splits the American opportunity credit 40% refundable, the rest lost to the limit', () => {
    const s = snapshot()
    expect(s.attachments.f8863?.lines).toMatchObject({
      '1': 980,
      '2': 90000,
      '3': 29757,
      '4': 60243,
      '5': 10000,
      '6': 1000,
      '7': 980,
      '8': 392,
      '9': 588,
      '18': 588,
      '19': null,
      '27': 980,
      '28': 0,
      '29': 0,
      '30': 980
    })
    expect(s.lines['29']).toBe(392)
  })

  it('gives two children the child tax credit but no additional credit when declined', () => {
    const s = snapshot()
    expect(s.attachments.schedule8812?.lines).toMatchObject({
      '4': 2,
      '5': 4400,
      '6': 0,
      '8': 4400,
      '12': 4400,
      '13': 0,
      '14': 0,
      '16a': 4400,
      '16b': 3400,
      '17': 3400,
      '18a': 31232,
      '27': 0
    })
    expect(s.lines['19']).toBe(0)
    expect(s.lines['28']).toBe(0)
    expect(s.indicators.actcDeclined).toBe(true)
    const claimed = snapshot({
      questions: { CRYPTO: false, DECLINE_ACTC: false }
    })
    expect(claimed.attachments.schedule8812?.lines['27']).toBe(3400)
    expect(claimed.lines['28']).toBe(3400)
  })

  it('reads the earned income credit from the EIC Table, the smaller of the two lookups', () => {
    const s = snapshot()
    expect(s.attachments.scheduleEIC?.lines).toEqual({
      qualifyingChildren: 2,
      earnedIncome: 31232,
      creditOnEarnedIncome: 5494,
      agiLookupThreshold: 23350,
      creditOnAgi: 5799,
      credit: 5494
    })
    // Below the threshold the worksheet does not look up AGI: with the
    // wages on the phase-in and a large adjustment, the credit is the
    // earned-income lookup alone.
    const low = snapshot({
      w2s: [
        {
          income: 12000,
          medicareIncome: 12000,
          ssWages: 12000,
          ssWithholding: 744,
          medicareWithholding: 174,
          fedWithholding: 0,
          personRole: PersonRole.PRIMARY,
          occupation: 'Sales'
        }
      ],
      form3903: barkerMove({ totalExpenses: 3000 })
    })
    expect(low.attachments.scheduleEIC?.lines).toMatchObject({
      earnedIncome: 12000,
      creditOnEarnedIncome: 4810,
      creditOnAgi: null,
      credit: 4810
    })
    expect(s.lines).toMatchObject({
      '25a': 1754,
      '25d': 1754,
      '27a': 5494,
      '32': 5886,
      '33': 7640,
      '34': 7640,
      '35a': 7640,
      '37': 0
    })
    expect(s.attachments.f8862?.lines).toEqual({
      claimsEic: 1,
      claimsCtc: 1,
      claimsAotc: 1
    })
    expect(s.schemaVersion).toBe('ustaxes-1040-line-snapshot-v9')
  })

  it('prints the head of household, blindness and line 28 boxes on Form 1040', async () => {
    const form = f1040()
    const pdf = fillPDFByName(
      await loadTemplate('f1040'),
      form.namedFields(),
      form.tag
    )
    const box = boxReader(pdf)
    expect(box('Page1[0].c1_8[0]')).toBe(true) // head of household
    expect(box('Checkbox_ReadOrder[0].c1_8[0]')).toBe(false) // single
    expect(box('Page2[0].c2_6[0]')).toBe(true) // blind
    expect(box('Page2[0].c2_5[0]')).toBe(false) // born before 1961
    expect(box('Page2[0].c2_13[0]')).toBe(false) // line 27c
    expect(box('Line28_ReadOrder[0].c2_14[0]')).toBe(true) // line 28 declined
  })

  it('refuses a move without the Armed Forces certification and a reimbursement above the expenses', () => {
    expect(() =>
      f1040({ form3903: barkerMove({ armedForcesMoveCertified: false }) })
    ).toThrow(TaxFormInputError)
    expect(() =>
      f1040({ form3903: barkerMove({ governmentReimbursement: 2000 }) })
    ).toThrow(TaxFormInputError)
    expect(() =>
      f1040({
        form3903: barkerMove({
          transportationAndStorage: 1000,
          travelAndLodging: 400
        })
      })
    ).toThrow(TaxFormInputError)
    const split = snapshot({
      form3903: barkerMove({
        transportationAndStorage: 1000,
        travelAndLodging: 475
      })
    })
    expect(split.attachments.f3903?.lines).toMatchObject({
      '1': 1000,
      '2': 475,
      '5': 1475
    })
  })
})
