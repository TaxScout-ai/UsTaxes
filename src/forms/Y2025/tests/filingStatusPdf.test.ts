import { readFileSync } from 'fs'
import { PDFCheckBox, PDFDocument } from 'pdf-lib'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import F1040 from '../irsForms/F1040'
import { rehearsalInformation } from './fixtures/atsRehearsal'

const prefix = 'topmostSubform[0].Page1[0].'
// Read independently from the official 2025 template. Two pairs share leaf names.
const names = [
  'Checkbox_ReadOrder[0].c1_8[0]',
  'Checkbox_ReadOrder[0].c1_8[1]',
  'Checkbox_ReadOrder[0].c1_8[2]',
  'c1_8[0]',
  'c1_8[1]'
]
it.each([
  FilingStatus.S,
  FilingStatus.MFJ,
  FilingStatus.MFS,
  FilingStatus.HOH,
  FilingStatus.W
])('prints the actual filing-status checkbox for %s', async (status) => {
  const info = rehearsalInformation(75250)
  info.taxPayer.filingStatus = status
  if (status === FilingStatus.MFJ || status === FilingStatus.MFS)
    info.taxPayer.spouse = {
      ...info.taxPayer.primaryPerson,
      ssid: '000000002',
      role: PersonRole.SPOUSE
    }
  const f = new F1040(info, [])
  const template = await PDFDocument.load(
    readFileSync('public/forms/Y2025/irs/f1040.pdf').toString('base64')
  )
  const pdf = fillPDFByName(template, f.namedFields(), 'f1040')
  const index = [
    FilingStatus.S,
    FilingStatus.MFJ,
    FilingStatus.MFS,
    FilingStatus.HOH,
    FilingStatus.W
  ].indexOf(status)
  names.forEach((name, i) =>
    expect(
      pdf
        .getForm()
        .getCheckBox(prefix + name)
        .isChecked()
    ).toBe(i === index)
  )
  // c1_5 is the residence question, and was incorrectly used as filing status.
  expect(pdf.getForm().getField(prefix + 'c1_5[0]')).toBeInstanceOf(PDFCheckBox)
  expect(
    pdf
      .getForm()
      .getCheckBox(prefix + 'c1_5[0]')
      .isChecked()
  ).toBe(false)
})

it('does not elect to forgo EIC based on taxpayer age', async () => {
  const info = rehearsalInformation(75250)
  info.taxPayer.primaryPerson.dateOfBirth = new Date('1950-01-01')
  const f = new F1040(info, [])
  const pdf = fillPDFByName(
    await PDFDocument.load(
      readFileSync('public/forms/Y2025/irs/f1040.pdf').toString('base64')
    ),
    f.namedFields(),
    'f1040'
  )
  expect(
    pdf.getForm().getCheckBox('topmostSubform[0].Page2[0].c2_13[0]').isChecked()
  ).toBe(false)
})
