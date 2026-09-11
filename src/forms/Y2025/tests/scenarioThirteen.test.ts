import { readFileSync } from 'fs'
import { PDFCheckBox, PDFDocument, PDFTextField } from 'pdf-lib'
import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { TaxFormInputError } from '../irsForms/formInput'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import {
  electricCharger,
  refuelingCredit,
  scenarioThirteenInformation
} from './fixtures/scenarioThirteen'

const loadTemplate = (tag: string) =>
  PDFDocument.load(
    readFileSync(`public/forms/Y2025/irs/${tag}.pdf`).toString('base64')
  )

const fieldReader = (pdf: PDFDocument) => {
  const find = (suffix: string) =>
    pdf
      .getForm()
      .getFields()
      .find((x) => x.getName().endsWith(suffix))
  return {
    text: (name: string) => {
      const f = find(`${name}[0]`)
      return f instanceof PDFTextField ? f.getText() : undefined
    },
    box: (name: string) => {
      const f = find(name)
      return f instanceof PDFCheckBox ? f.isChecked() : undefined
    }
  }
}

describe('ATS Scenario 13 (MFJ W-2, Form 8911 Schedule A, Form 6251)', () => {
  const f1040 = (over = {}) => new F1040(scenarioThirteenInformation(over), [])
  const snapshot = (over = {}) => calculationSnapshot(f1040(over))

  it('figures the personal-use credit on Schedule A (Form 8911)', () => {
    const s = snapshot()
    expect(s.attachments.f8911ScheduleA?.lines).toEqual({
      '6a': 1,
      '8': 1000,
      '9': 0,
      '10': 0,
      '11': null,
      '12': null,
      '13': null,
      '14': null,
      '15': 100000,
      '16': null,
      '17': 1,
      '18': 1000,
      '19': 300,
      '20': 1000,
      '21': 300
    })
  })

  it('limits the credit on Form 8911 Part II to the net regular tax over the tentative minimum tax', () => {
    const s = snapshot()
    expect(s.attachments.f8911?.lines).toEqual({
      A: 1,
      '1': 0,
      '2': null,
      '3': 0,
      '4': 300,
      // The PDF prints 162 from a 30,000 standard deduction (TY2024); TY2025 is
      // 31,500, and the tax table on 120 of taxable income is 11 (the 100–125 row).
      '5': 11,
      '6a': null,
      '6b': 0,
      '6c': 0,
      '7': 11,
      '8': 0,
      '9': 11,
      '10': 11
    })
    expect(s.attachments.schedule3.lines).toMatchObject({
      '6j': 11,
      '7': 11,
      '8': 11
    })
  })

  it('carries Form 6251 with zero AMT because the personal-use credit is claimed', () => {
    const s = snapshot()
    expect(s.attachments.f6251?.lines).toMatchObject({
      '1a': 31500,
      '1b': 120,
      '2a': 31500,
      '4': 31620,
      '5': 137000,
      '6': 0,
      '7': 0,
      '9': 0,
      '10': 11,
      '11': 0
    })
    expect(s.attachments.schedule2.lines['21']).toBe(0)
  })

  it('settles the return: tax 11, credit 11, total tax 0, refund 609', () => {
    const { lines } = snapshot()
    expect(lines['1a']).toBe(31620)
    expect(lines['9']).toBe(31620)
    expect(lines['11b']).toBe(31620)
    expect(lines['12e']).toBe(31500)
    expect(lines['15']).toBe(120)
    expect(lines['16']).toBe(11)
    expect(lines['20']).toBe(11)
    expect(lines['22']).toBe(0)
    expect(lines['24']).toBe(0)
    expect(lines['25a']).toBe(609)
    expect(lines['34']).toBe(609)
  })

  it('is v6 and reports the absent attachments as null', () => {
    const s = snapshot()
    expect(s.schemaVersion).toBe('ustaxes-1040-line-snapshot-v6')
    expect(s.indicators).toMatchObject({
      primary65OrOlder: false,
      spouse65OrOlder: false,
      spouseBlind: false
    })
    expect(s.attachments.scheduleC).toBeNull()
    expect(s.attachments.f7206).toBeNull()
    expect(s.attachments.schedule1).toBeNull()
  })

  it('leaves Form 6251 and Form 8911 out of a return without the credit', () => {
    const s = snapshot({ form8911: undefined })
    expect(s.attachments.f8911).toBeNull()
    expect(s.attachments.f8911ScheduleA).toBeNull()
    expect(s.attachments.f6251).toBeNull()
    expect(s.attachments.schedule3.lines['6j']).toBeNull()
    expect(s.lines['20']).toBeNull()
  })

  it('allows the whole credit when the tax covers it and caps line 21 at $1,000', () => {
    const s = snapshot({
      w2s: [
        {
          income: 80000,
          medicareIncome: 80000,
          ssWages: 80000,
          ssWithholding: 4960,
          medicareWithholding: 1160,
          fedWithholding: 6000,
          personRole: 'PRIMARY',
          occupation: 'Clerk'
        }
      ],
      form8911: refuelingCredit([electricCharger({ cost: 5000 })])
    })
    expect(s.attachments.f8911ScheduleA?.lines).toMatchObject({
      '18': 5000,
      '19': 1500,
      '21': 1000
    })
    expect(s.attachments.f8911?.lines).toMatchObject({ '4': 1000, '10': 1000 })
    expect(s.lines['20']).toBe(1000)
  })

  it('sums two properties on Form 8911 line 4 and reports the first on Schedule A', () => {
    const s = snapshot({
      form8911: refuelingCredit([
        electricCharger(),
        electricCharger({ description: 'SECOND CHARGER', cost: 2000 })
      ])
    })
    expect(s.attachments.f8911?.lines).toMatchObject({ A: 2, '4': 900 })
    expect(s.attachments.f8911ScheduleA?.lines['21']).toBe(300)
  })

  it.each([
    ['a business/investment fraction', { businessUseFraction: 0.5 }],
    ['an ineligible census tract', { eligibleCensusTract: false }],
    ['a GEOID that is not 11 digits', { censusTractGeoid: '4820110000' }],
    [
      'a property placed in service in another year',
      { placedInServiceDate: '2024-03-01' }
    ],
    ['a zero cost', { cost: 0 }]
  ])('refuses %s', (_label, over) => {
    expect(() =>
      snapshot({ form8911: refuelingCredit([electricCharger(over)]) })
    ).toThrow(TaxFormInputError)
  })

  it('fills the Form 8911 template by field name', async () => {
    const form = f1040().f8911
    expect(form).toBeDefined()
    if (form === undefined) return
    const pdf = fillPDFByName(
      await loadTemplate('f8911'),
      form.namedFields(),
      form.tag
    )
    const { text } = fieldReader(pdf)
    expect(text('f1_03')).toBe('1')
    expect(text('f1_04')).toBeUndefined()
    expect(text('f1_07')).toBe('300')
    expect(text('f1_08')).toBe('11')
    expect(text('f1_12')).toBe('11')
    expect(text('f1_13')).toBe('0')
    expect(text('f1_15')).toBe('11')
  })

  it('fills the Schedule A (Form 8911) template by field name', async () => {
    const [schedule] = f1040().f8911?.schedules ?? []
    const pdf = fillPDFByName(
      await loadTemplate('f8911sa'),
      schedule.namedFields(),
      schedule.tag
    )
    const { text, box } = fieldReader(pdf)
    expect(text('f1_04')).toBe('ELECTRIC CHARGER')
    expect(text('f1_07')).toBe('1 Synthetic Street, Test OH 00000')
    expect(text('f1_14')).toBe('03/01/2025')
    expect(text('f1_15')).toBe('03/01/2025')
    expect(box('c1_1[0]')).toBe(true)
    expect(box('c1_1[1]')).toBe(false)
    expect(text('f1_16')).toBe('48201100000')
    expect(text('f1_18')).toBe('1000')
    expect(text('f1_19')).toBeUndefined()
    expect(box('c1_3[0]')).toBe(true)
    expect(text('f1_26')).toBe('1000')
    expect(text('f1_27')).toBe('300')
    expect(text('f1_29')).toBe('300')
  })

  it('fills the Form 6251 template by field name', async () => {
    const form = f1040().f6251
    expect(form.isNeeded()).toBe(true)
    const pdf = fillPDFByName(
      await loadTemplate('f6251'),
      form.namedFields(),
      form.tag
    )
    const { text } = fieldReader(pdf)
    expect(text('f1_3')).toBe('31500')
    expect(text('f1_4')).toBe('120')
  })
})
