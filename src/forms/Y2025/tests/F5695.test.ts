import { readFileSync } from 'fs'
import { PDFDocument } from 'pdf-lib'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import F1040 from '../irsForms/F1040'
import {
  energyData,
  energyDetails,
  rehearsalInformation,
  scenarioOneVariation
} from './fixtures/atsRehearsal'

const template = () =>
  PDFDocument.load(
    readFileSync('public/forms/Y2025/irs/f5695.pdf').toString('base64')
  )
describe('F5695 genuine TY2025 PDF binding', () => {
  it('fills the real form, including QMID fields and the correct subtotal fields', async () => {
    const f = new F1040(scenarioOneVariation(), []).f5695
    if (!f) throw new Error('Missing energy form')
    const pdf = fillPDFByName(await template(), f.namedFields(), f.tag)
    expect(
      pdf
        .getForm()
        .getTextField('topmostSubform[0].Page2[0].f2_10[0]')
        .getText()
    ).toBe('1020')
    expect(pdf.getPageCount()).toBe(4)
  })
  it('resolves both controls that have the same f3_30 leaf without overwriting either', async () => {
    const f = new F1040(
      {
        ...rehearsalInformation(),
        form5695: energyData({
          details: energyDetails({
            waterHeaters: [
              { qmid: 'T001', cost: 500 },
              { qmid: 'T002', cost: 400 }
            ]
          })
        })
      },
      []
    ).f5695
    if (!f) throw new Error('Missing energy form')
    const pdf = fillPDFByName(await template(), f.namedFields(), f.tag)
    expect(
      pdf
        .getForm()
        .getTextField('topmostSubform[0].Page3[0].f3_30[0]')
        .getText()
    ).toBe('500')
    expect(
      pdf
        .getForm()
        .getTextField(
          'topmostSubform[0].Page3[0].Ln23aii[0].Box1-4[0].f3_30[0]'
        )
        .getText()
    ).toBe('T002')
  })
  it('refuses missing/ambiguous names and mismatched field types', async () => {
    const pdf = await template()
    for (const values of [
      { missing: 1 },
      { f3_30: 1 },
      { f1_08: true },
      { c1_3: 5 }
    ])
      expect(() => fillPDFByName(pdf, values, 'f5695')).toThrow()
  })
})
