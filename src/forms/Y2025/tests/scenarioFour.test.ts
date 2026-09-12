import { readFileSync } from 'fs'
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib'
import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { TaxFormInputError } from '../irsForms/formInput'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import {
  bmwI4,
  cleanVehicleCredit,
  scenarioFourInformation,
  solarFacility
} from './fixtures/scenarioFour'

const loadTemplate = (tag: string) =>
  PDFDocument.load(
    readFileSync(`public/forms/Y2025/irs/${tag}.pdf`).toString('base64')
  )

const reader = (pdf: PDFDocument) => (suffix: string) => {
  const f = pdf
    .getForm()
    .getFields()
    .find((x) => x.getName().endsWith(suffix))
  if (f instanceof PDFCheckBox) return f.isChecked()
  if (f instanceof PDFTextField) return f.getText()
  return undefined
}

describe('ATS Scenario 4 (Single W-2, Form 3800 with a bought Form 8835 credit and a business-use Form 8936 credit)', () => {
  const f1040 = (over = {}) => new F1040(scenarioFourInformation(over), [])
  const snapshot = (over = {}) => calculationSnapshot(f1040(over))
  // Single, taxable income 20,264: the Tax Table row 20,250–20,300.
  const TAX = 2195

  it('figures the renewable electricity credit on Form 8835 Part II', () => {
    const s = snapshot()
    expect(s.attachments.f8835?.lines).toEqual({
      '1d': 440000,
      '1dc': 2640,
      '2': 2640,
      '3': 0,
      '4': 2640,
      '5d': 0,
      '6': 2640,
      '7g': 0,
      '8': 2640,
      '9': 13200,
      '10': 0,
      '11': 0,
      '12': 13200,
      '13': 13200,
      '14': null,
      '15': 13200
    })
  })

  it('figures the business/investment use part of the clean vehicle credit on Schedule A (Form 8936)', () => {
    const s = snapshot()
    expect(s.attachments.f8936ScheduleA?.lines).toEqual({
      '1a': 2024,
      '4a': 0,
      '5': 1,
      '8a': 0,
      '8b': 1,
      '8c': 0,
      '8d': null,
      '8e': 1,
      '9': 130,
      '10': 100000,
      '11': 130,
      '12': null
    })
    expect(s.attachments.f8936?.lines).toEqual({
      '1a': 36014,
      '2': 36014,
      '3a': 0,
      '4': 0,
      '6': 130,
      '7': null,
      '8': 130,
      '9': 0,
      '10': null,
      '11': null,
      '12': null,
      '13': null
    })
  })

  it('limits the general business credit on Form 3800 to the regular tax and applies it to the Form 8835 line first', () => {
    const s = snapshot()
    expect(s.attachments.f3800?.lines).toEqual({
      Bi: 1,
      Bii: 1,
      '1': 13330,
      '2': 0,
      '3': 0,
      '6': 13330,
      '7': TAX,
      '8': 0,
      '9': TAX,
      '10a': null,
      '10b': 0,
      '10c': 0,
      '11': TAX,
      '12': TAX,
      '13': 0,
      '14': 0,
      '15': 0,
      '16': TAX,
      '17': TAX,
      '26': 0,
      '27': TAX,
      '28': TAX,
      '29': 0,
      '30': 0,
      '36': 0,
      '37': 0,
      '38': TAX,
      '1fe': 0,
      '1ff': 13200,
      '1fg': 13200,
      '1fi': TAX,
      '1ye': 130,
      '1yf': 0,
      '1yg': 130,
      '1yi': 0,
      '2e': 130,
      '2f': 13200,
      '2g': 13330,
      '2i': TAX
    })
    expect(s.attachments.schedule3.lines).toMatchObject({
      '6a': TAX,
      '6f': null,
      '7': TAX,
      '8': TAX
    })
  })

  it('carries Form 6251 with no tentative minimum tax because a general business credit is claimed', () => {
    const s = snapshot()
    expect(s.attachments.f6251?.lines).toMatchObject({
      '9': 0,
      '11': 0
    })
  })

  it('settles the return: tax equals the credit, total tax 0, refund 4,581', () => {
    const { lines, indicators } = snapshot()
    expect(lines['1a']).toBe(36014)
    expect(lines['11b']).toBe(36014)
    expect(lines['12e']).toBe(15750)
    expect(lines['15']).toBe(20264)
    expect(lines['16']).toBe(TAX)
    expect(lines['20']).toBe(TAX)
    expect(lines['22']).toBe(0)
    expect(lines['24']).toBe(0)
    expect(lines['25a']).toBe(4581)
    expect(lines['33']).toBe(4581)
    expect(lines['34']).toBe(4581)
    expect(lines['35a']).toBe(4581)
    expect(indicators).toMatchObject({
      primaryBlind: false,
      primary65OrOlder: false
    })
  })

  it('splits the personal use part to Form 8936 Part III when the vehicle is not wholly business', () => {
    const s = snapshot({
      form8936: cleanVehicleCredit([
        bmwI4({ tentativeCredit: 7500, businessUseFraction: 0.6 })
      ])
    })
    expect(s.attachments.f8936ScheduleA?.lines).toMatchObject({
      '9': 7500,
      '10': 60000,
      '11': 4500,
      '12': 3000
    })
    // The personal part is limited to the tax after the other personal
    // credits, before the general business credit; the business part then
    // finds no tax left on Form 3800.
    expect(s.attachments.f8936?.lines).toMatchObject({
      '8': 4500,
      '9': 3000,
      '10': TAX,
      '11': 0,
      '12': TAX,
      '13': TAX
    })
    expect(s.attachments.schedule3.lines).toMatchObject({
      '6a': null,
      '6f': TAX
    })
    expect(s.attachments.f3800?.lines).toMatchObject({
      '1': 17700,
      '10b': TAX,
      '11': 0,
      '16': 0,
      '38': 0
    })
  })

  it('treats the credit as the filer’s own in column (e) when it was not bought', () => {
    const s = snapshot({
      form8835: solarFacility({ purchasedUnderTransferElection: false }),
      form3800: undefined
    })
    expect(s.attachments.f3800?.lines).toMatchObject({
      Bi: 0,
      Bii: null,
      '1fe': 13200,
      '1ff': 0,
      '1fi': TAX
    })
  })

  it('refuses a facility placed in service before 2022, a transferred vehicle credit and a vehicle that is not new', () => {
    const refusal = (over: object) => {
      try {
        f1040(over)
      } catch (e) {
        if (e instanceof TaxFormInputError) return [e.code, e.path]
        throw e
      }
      return undefined
    }
    expect(
      refusal({
        form8835: solarFacility({ placedInServiceDate: '2021-12-31' })
      })
    ).toEqual(['unsupported', '/information/form8835/placedInServiceDate'])
    expect(
      refusal({
        form8936: cleanVehicleCredit([bmwI4({ transferredToDealer: true })])
      })
    ).toEqual([
      'unsupported',
      '/information/form8936/vehicles/0/transferredToDealer'
    ])
    expect(
      refusal({
        form8936: cleanVehicleCredit([bmwI4({ kind: 'previouslyOwned' })])
      })
    ).toEqual(['unsupported', '/information/form8936/vehicles/0/kind'])
    expect(
      refusal({
        form8936: cleanVehicleCredit([bmwI4({ tentativeCredit: 0 })])
      })
    ).toEqual([
      'needs_facts',
      '/information/form8936/vehicles/0/tentativeCredit'
    ])
  })

  it('fills the four templates: every named field resolves and the boxes land where the package prints them', async () => {
    const f = f1040()
    if (f.f3800 === undefined || f.f8835 === undefined || f.f8936 === undefined)
      throw new Error('forms missing')
    const f3800 = reader(
      fillPDFByName(await loadTemplate('f3800'), f.f3800.namedFields(), 'f3800')
    )
    expect(f3800('c1_1[1]')).toBe(true) // A: No
    expect(f3800('c1_2[0]')).toBe(true) // B(i): Yes
    expect(f3800('f1_3[0]')).toBe('1')
    expect(f3800('f3_52[0]')).toBe('PAZ123055555')
    expect(f3800('f3_53[0]')).toBe('APPLD FOR')
    expect(f3800('f3_56[0]')).toBe('13200')
    expect(f3800('f3_59[0]')).toBe(String(TAX))
    expect(f3800('f3_245[0]')).toBe('130')
    expect(f3800('f2_21[0]')).toBe(String(TAX))

    const f8835 = reader(
      fillPDFByName(await loadTemplate('f8835'), f.f8835.namedFields(), 'f8835')
    )
    expect(f8835('c1_1[1]')).toBe(true) // 6: No
    expect(f8835('c1_3[0]')).toBe(true)
    expect(f8835('c1_3[2]')).toBe(true)
    expect(f8835('c1_4[1]')).toBe(true) // 9b
    expect(f8835('f1_10[0]')).toBe('+')
    expect(f8835('f1_14[0]')).toBe('103')
    expect(f8835('f2_10[0]')).toBe('440000')
    expect(f8835('f2_49[0]')).toBe('13200')
    expect(f8835('f3_2[0]')).toBe('13200')

    const f8936 = reader(
      fillPDFByName(await loadTemplate('f8936'), f.f8936.namedFields(), 'f8936')
    )
    expect(f8936('f1_15[0]')).toBe('S')
    expect(f8936('f1_18[0]')).toBe('130')

    const schedA = reader(
      fillPDFByName(
        await loadTemplate('f8936sa'),
        f.f8936.schedules[0].namedFields(),
        'f8936sa'
      )
    )
    expect(schedA('c1_1[1]')).toBe(true) // 4a: No
    expect(schedA('c1_3[0]')).toBe(true) // 5: Yes
    expect(schedA('c1_8[1]')).toBe(true) // 8c: No
    expect(schedA('c2_1[0]')).toBe(true) // 8e: Yes
    expect(schedA('f1_7[0]')).toBe('01/25/2025')
    expect(schedA('f2_2[0]')).toBe('100')
  })
})
