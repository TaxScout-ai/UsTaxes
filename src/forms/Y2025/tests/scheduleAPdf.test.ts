import { readFileSync } from 'fs'
import { PDFDocument } from 'pdf-lib'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import F1040 from '../irsForms/F1040'
import { rehearsalInformation } from './fixtures/atsRehearsal'

it('places other deductions, total and election in their actual Schedule A controls', async () => {
  const info = rehearsalInformation(75250)
  info.itemizedDeductions = {
    ...new F1040(info, []).scheduleA.itemizedDeductions,
    charityCashCheck: 20000,
    otherItemizedDeductions: 123
  }
  const f = new F1040(info, []).scheduleA
  const pdf = fillPDFByName(
    await PDFDocument.load(
      readFileSync('public/forms/Y2025/irs/f1040sa.pdf').toString('base64')
    ),
    f.namedFields(),
    f.tag
  )
  const form = pdf.getForm()
  expect(form.getTextField('form1[0].Page1[0].f1_28[0]').getText() ?? '').toBe(
    ''
  )
  expect(form.getTextField('form1[0].Page1[0].f1_29[0]').getText()).toBe('123')
  expect(form.getTextField('form1[0].Page1[0].f1_30[0]').getText()).toBe(
    '20123'
  )
  // The election applies when itemizing despite a smaller total. Larger
  // deductions do not authorize setting this taxpayer-election checkbox.
  expect(
    form
      .getCheckBox('form1[0].Page1[0].Line18_ReadOrder[0].c1_3[0]')
      .isChecked()
  ).toBe(false)
})
