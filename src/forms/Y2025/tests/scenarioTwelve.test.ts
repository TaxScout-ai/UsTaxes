import { readFileSync } from 'fs'
import { PDFDocument, PDFTextField } from 'pdf-lib'
import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { TaxFormInputError } from '../irsForms/formInput'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import {
  designBusiness,
  healthPlan,
  scenarioTwelveInformation
} from './fixtures/scenarioTwelve'

describe('ATS Scenario 12 (W-2, Schedule C, Schedule SE, Form 7206)', () => {
  const f1040 = () => new F1040(scenarioTwelveInformation(), [])
  const snapshot = () => calculationSnapshot(f1040())

  it('reports Schedule C and carries the profit to Schedule 1 and Schedule SE', () => {
    const s = snapshot()
    expect(s.attachments.scheduleC?.lines).toMatchObject({
      '1': 35235,
      '7': 35235,
      '15': 550,
      '17': 125,
      '18': 1000,
      '20b': 2500,
      '22': 6532,
      '23': 200,
      '28': 10907,
      '29': 24328,
      '31': 24328
    })
    expect(s.attachments.schedule1?.lines).toMatchObject({
      '3': 24328,
      '10': 24328,
      '15': 1719,
      '17': 1000,
      '26': 2719
    })
    expect(s.attachments.scheduleSE?.lines).toMatchObject({
      '2': 24328,
      '3': 24328,
      '4a': 22467,
      '4c': 22467,
      '6': 22467,
      '8a': 105878,
      '8d': 105878,
      // The PDF prints 62,722 (the TY2024 wage base 168,600 less wages); TY2025 is 176,100.
      '9': 70222,
      '10': 2786,
      '11': 652,
      '12': 3438,
      '13': 1719
    })
    expect(s.attachments.schedule2.lines['4']).toBe(3438)
  })

  it('figures the self-employed health insurance deduction on Form 7206', () => {
    const s = snapshot()
    expect(s.attachments.f7206?.lines).toEqual({
      '1': 1000,
      '2': 0,
      '3': 1000,
      '4': 24328,
      '5': 24328,
      '6': 100000,
      '7': 1719,
      '8': 22609,
      '9': 0,
      '10': 22609,
      '11': null,
      '12': null,
      '13': 22609,
      '14': 1000
    })
  })

  it('settles the return with the TY2025 standard deduction and the rate schedule above $100,000', () => {
    const { lines } = snapshot()
    expect(lines['1a']).toBe(100836)
    expect(lines['8']).toBe(24328)
    expect(lines['9']).toBe(125164)
    expect(lines['10']).toBe(2719)
    expect(lines['11b']).toBe(122445)
    expect(lines['12e']).toBe(15750)
    expect(lines['13a'] ?? 0).toBe(0)
    expect(lines['15']).toBe(106695)
    // 17,651 through the 22% bracket plus 24% of 3,345 = 18,453.80.
    expect(lines['16']).toBe(18454)
    expect(lines['23']).toBe(3438)
    expect(lines['24']).toBe(21892)
    expect(lines['25a']).toBe(14444)
    expect(lines['37']).toBe(7448)
  })

  it('is v7 and reports the absent attachments as null', () => {
    const s = snapshot()
    expect(s.schemaVersion).toBe('ustaxes-1040-line-snapshot-v9')
    expect(s.attachments.scheduleF).toBeNull()
    expect(s.attachments.f4835).toBeNull()
    expect(s.attachments.scheduleD).toBeNull()
    expect(s.worksheets.qualifiedDividendsCapitalGains).toBeNull()
  })

  it('caps the deduction at the business net profit less the SE-tax half', () => {
    const s = calculationSnapshot(
      new F1040(
        scenarioTwelveInformation({
          form7206s: [healthPlan({ healthInsurancePremiums: 30000 })]
        }),
        []
      )
    )
    expect(s.attachments.f7206?.lines['14']).toBe(22609)
    expect(s.attachments.schedule1?.lines['17']).toBe(22609)
  })

  it('refuses a Form 7206 that names a business the return does not carry', () => {
    const info = scenarioTwelveInformation({
      form7206s: [healthPlan({ scheduleCIndex: 3 })]
    })
    expect(() => calculationSnapshot(new F1040(info, []))).toThrow(
      TaxFormInputError
    )
  })

  it('splits line 7 between two businesses by their share of the profits', () => {
    const s = calculationSnapshot(
      new F1040(
        scenarioTwelveInformation({
          scheduleCBusinesses: [
            designBusiness(),
            designBusiness({
              businessName: 'Second',
              grossReceipts: 10907 + 24328
            })
          ]
        }),
        []
      )
    )
    // Two equal profits: line 6 is 0.50000 and line 7 half of Schedule 1 line 15.
    expect(s.attachments.f7206?.lines['6']).toBe(50000)
    const half = Math.round((s.attachments.schedule1?.lines['15'] ?? 0) * 0.5)
    expect(s.attachments.f7206?.lines['7']).toBe(half)
  })

  it('fills the Form 7206 template by field name', async () => {
    const [form] = f1040().f7206s()
    const template = await PDFDocument.load(
      readFileSync('public/forms/Y2025/irs/f7206.pdf').toString('base64')
    )
    const pdf = fillPDFByName(template, form.namedFields(), form.tag)
    const text = (suffix: string) => {
      const field = pdf
        .getForm()
        .getFields()
        .find((x) => x.getName().endsWith(`${suffix}[0]`))
      return field instanceof PDFTextField ? field.getText() : undefined
    }
    expect(text('f1_3')).toBe('1000')
    expect(text('f1_6')).toBe('24328')
    expect(text('f1_8')).toBe('1.00000')
    expect(text('f1_9')).toBe('1719')
    expect(text('f1_16')).toBe('1000')
  })
})
