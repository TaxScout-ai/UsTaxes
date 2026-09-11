import { readFileSync } from 'fs'
import { PDFDocument } from 'pdf-lib'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import F1040 from '../irsForms/F1040'
import { scenarioTwelveInformation } from './fixtures/scenarioTwelve'
import { scenarioThreeInformation } from './fixtures/scenarioThree'

async function printed(
  tag: string,
  values: Record<string, import('ustaxes/core/pdfFiller').Field>
) {
  return fillPDFByName(
    await PDFDocument.load(
      readFileSync(`public/forms/Y2025/irs/${tag}.pdf`).toString('base64')
    ),
    values,
    tag
  ).getForm()
}

it('prints Schedule 1 income and deductions on the actual TY2025 labels', async () => {
  const f = new F1040(scenarioTwelveInformation(), []).schedule1
  const form = await printed(f.tag, f.namedFields())
  // Independently located from the printed Schedule 1 PDF, not fieldMaps.
  const read = (page: number, n: string) =>
    form
      .getTextField(`topmostSubform[0].Page${page}[0].f${page}_${n}[0]`)
      .getText() ?? ''
  expect(read(1, '07')).toBe('24328') // business income, line3
  expect(read(1, '38')).toBe('24328') // total income, line10
  expect(read(2, '01')).toBe('') // educator expenses, no name on page2
  expect(read(2, '02')).toBe('') // business expenses, no SSN on page2
  expect(read(2, '05')).toBe('1719') // half SE, line15
  expect(read(2, '07')).toBe('1000') // health deduction, line17
  expect(read(2, '30')).toBe('2719') // total adjustments, line26
  expect(
    form.getCheckBox('topmostSubform[0].Page1[0].c1_1[0]').isChecked()
  ).toBe(false)
  expect(
    form.getCheckBox('topmostSubform[0].Page1[0].c1_2[0]').isChecked()
  ).toBe(false)
  expect(
    form
      .getCheckBox('topmostSubform[0].Page1[0].Line7_ReadOrder[0].c1_3[0]')
      .isChecked()
  ).toBe(false)
})

it('prints Schedule F totals in amount controls, with activity code and explicit answers', async () => {
  const info = scenarioThreeInformation()
  if (!info.scheduleFData) throw new Error('Fixture needs a farm')
  Object.assign(info.scheduleFData[0], {
    activityCode: '111400',
    materiallyParticipated: true,
    paymentsRequiringForms1099: true,
    forms1099Filed: false
  })
  const f = new F1040(info, []).scheduleF
  if (!f) throw new Error('Fixture must attach Schedule F')
  const form = await printed(f.tag, f.namedFields())
  const root = 'topmostSubform[0].Page1[0].'
  const field = (n: number) =>
    form.getFields().find((x) => x.getName().endsWith(`.f1_${n}[0]`))
  const read = (n: number) =>
    form.getTextField(field(n)?.getName() ?? 'MISSING').getText() ?? ''
  expect(read(4)).toBe('111400')
  expect(read(5)).toBe('') // EIN is distinct from line B activity code
  expect(read(21)).toBe('0') // other income, line8
  expect(read(22)).toBe('8111') // gross income, line9
  expect(read(49)).toBe('') // other-expense DESCRIPTION
  expect(read(59)).toBe('4860') // expenses, line33
  expect(read(60)).toBe('3251') // profit, line34
  expect(form.getCheckBox(root + 'c1_2[0]').isChecked()).toBe(true)
  expect(form.getCheckBox(root + 'c1_4[0]').isChecked()).toBe(false)
  expect(form.getCheckBox(root + 'c1_4[1]').isChecked()).toBe(true)
})
