import { readFileSync } from 'fs'
import { PDFDocument, PDFTextField } from 'pdf-lib'
import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { TaxFormInputError } from '../irsForms/formInput'
import { fillPDFByName } from 'ustaxes/core/pdfFiller/fillPdf'
import { farm, scenarioThreeInformation } from './fixtures/scenarioThree'

describe('ATS Scenario 3 (pension, state refund, Schedule D totals, Schedule F with the farm optional method, Form 4835)', () => {
  const f1040 = () => new F1040(scenarioThreeInformation(), [])
  const snapshot = () => calculationSnapshot(f1040())

  it('carries every income source to its line', () => {
    const { lines, attachments } = snapshot()
    expect(lines['5a']).toBe(53778)
    expect(lines['5b']).toBe(43100)
    expect(lines['7']).toBe(11713)
    expect(lines['8']).toBe(17422)
    expect(lines['9']).toBe(72235)
    expect(lines['10']).toBe(414)
    expect(lines['11b']).toBe(71821)
    expect(lines['12e']).toBe(15750)
    expect(lines['13a'] ?? 0).toBe(0)
    expect(lines['15']).toBe(56071)
    expect(attachments.schedule1?.lines).toMatchObject({
      '1': 3110,
      '5': 11061,
      '6': 3251,
      '10': 17422
    })
    expect(attachments.schedule1?.lines['15']).toBe(414)
    expect(attachments.schedule1?.lines['26']).toBe(414)
  })

  it('reports Schedule D from the 1a/8a totals and taxes the gain on the QDCG worksheet', () => {
    const s = snapshot()
    expect(s.attachments.scheduleD?.lines).toMatchObject({
      '1ad': 14222,
      '1ae': 12234,
      '1ah': 1988,
      '7': 1988,
      '8ad': 14211,
      '8ae': 4486,
      '8ah': 9725,
      '15': 9725,
      '16': 11713,
      '17': 1,
      '20': 1,
      '22': null
    })
    expect(s.indicators.scheduleDNotRequired).toBe(false)
    const q = s.worksheets.qualifiedDividendsCapitalGains
    expect(q).not.toBeNull()
    // 5,321 on the ordinary income (Tax Table) + 1,158 at 15%.
    expect(s.lines['16']).toBe(q?.lines['25'])
    expect(s.lines['16']).toBe(6479)
    // Single 0% ceiling 48,350: 2,004 of the 9,725 gain is taxed at 0%, the rest at 15%.
    expect(q?.lines['6']).toBe(48350)
    expect(q?.lines['9']).toBe(2004)
    expect(q?.lines['18']).toBe(1158)
  })

  it('figures self-employment tax with the farm optional method on Schedule SE', () => {
    const s = snapshot()
    const se = s.attachments.scheduleSE?.lines
    expect(se).toBeDefined()
    expect(se?.['1a']).toBeNull()
    expect(se?.['2']).toBe(0)
    expect(se?.['14']).toBe(7240)
    expect(se?.['15']).toBe(5407)
    expect(se?.['4b']).toBe(5407)
    expect(se?.['4c']).toBe(5407)
    expect(se?.['10']).toBe(670)
    expect(se?.['11']).toBe(157)
    expect(se?.['12']).toBe(827)
    expect(se?.['13']).toBe(414)
    expect(s.attachments.schedule2.lines['4']).toBe(827)
    expect(s.lines['23']).toBe(827)
  })

  it('reports the farm rental on Form 4835 and Schedule E lines 40 and 42', () => {
    const s = snapshot()
    expect(s.attachments.f4835?.lines).toMatchObject({
      '1': 17035,
      '7': 17035,
      '9': 879,
      '14': 350,
      '17': 690,
      '23': 1355,
      '26': 2700,
      '31': 5974,
      '32': 11061,
      '34c': null
    })
    expect(s.attachments.scheduleE?.lines).toMatchObject({
      '40': 11061,
      '41': 11061,
      '42': 17035
    })
    expect(s.attachments.scheduleF?.lines).toMatchObject({
      '1a': 8111,
      '1c': 8111,
      '9': 8111,
      '11': 750,
      '16': 890,
      '17': 250,
      '26': 2970,
      '33': 4860,
      '34': 3251
    })
  })

  it('settles the return: pension withholding against tax plus SE tax', () => {
    const { lines } = snapshot()
    expect(lines['25b']).toBe(3405)
    expect(lines['33']).toBe(3405)
    expect(lines['24']).toBe(6479 + 827)
    expect(lines['37']).toBe(7306 - 3405)
    expect(lines['34']).toBe(0)
  })

  it('uses the regular method when the farm optional method is not elected', () => {
    const s = calculationSnapshot(
      new F1040(scenarioThreeInformation({ scheduleSEOptions: undefined }), [])
    )
    const se = s.attachments.scheduleSE?.lines
    expect(se?.['1a']).toBe(3251)
    expect(se?.['4b']).toBeNull()
    expect(se?.['14']).toBeNull()
    expect(se?.['15']).toBeNull()
    expect(se?.['4a']).toBe(3002)
  })

  it('refuses the election when gross farm income and net profit both exceed the limits', () => {
    const info = scenarioThreeInformation({
      scheduleFData: [farm({ salesLivestock: 20000 })]
    })
    expect(() => calculationSnapshot(new F1040(info, []))).toThrow(
      TaxFormInputError
    )
  })

  it('is v4 and reports the absent attachments as null', () => {
    const s = snapshot()
    expect(s.schemaVersion).toBe('ustaxes-1040-line-snapshot-v8')
    expect(s.attachments.scheduleH).toBeNull()
    expect(s.attachments.f5695).toBeNull()
    expect(s.worksheets.socialSecurityBenefits).toBeNull()
  })

  it('fills the Form 4835 template by field name', async () => {
    const f = f1040()
    const form = f.f4835s()[0]
    const template = await PDFDocument.load(
      readFileSync('public/forms/Y2025/irs/f4835.pdf').toString('base64')
    )
    const pdf = fillPDFByName(template, form.namedFields(), form.tag)
    const text = (suffix: string) => {
      const field = pdf
        .getForm()
        .getFields()
        .find((x) => x.getName().endsWith(`${suffix}[0]`))
      return field instanceof PDFTextField ? field.getText() : undefined
    }
    expect(text('f1_04')).toBe('17035')
    expect(text('f1_16')).toBe('17035')
    expect(text('f1_18')).toBe('879')
    expect(text('f1_55')).toBe('5974')
    expect(text('f1_56')).toBe('11061')
    expect(text('f1_57')).toBeFalsy()
  })
})
