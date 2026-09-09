import { PDFDocument } from 'pdf-lib'
import { combinePdfs } from 'ustaxes/core/pdfFiller/pdfHandler'
import { blankState } from 'ustaxes/redux/reducer'
import { FilingStatus, PersonRole } from 'ustaxes/core/data'
import F1040 from '../irsForms/F1040'

const make = (birthday: string, wages = [10000], medicare = [145]) =>
  new F1040(
    {
      ...blankState,
      taxPayer: {
        filingStatus: FilingStatus.S,
        dependents: [],
        primaryPerson: {
          firstName: 'Synthetic',
          lastName: 'Test',
          ssid: '000000000',
          role: PersonRole.PRIMARY,
          isBlind: false,
          isTaxpayerDependent: false,
          dateOfBirth: new Date(`${birthday}T12:00:00Z`),
          address: { address: '1 Test', city: 'Test' }
        }
      },
      w2s: wages.map((income, i) => ({
        occupation: 'Test',
        personRole: PersonRole.PRIMARY,
        income,
        medicareIncome: income,
        medicareWithholding: medicare[i],
        ssWages: income,
        ssWithholding: 0,
        fedWithholding: 1000
      }))
    },
    []
  )

describe('adversarial regressions discovered by independent HTTP benchmark', () => {
  it.each([
    ['1960-12-31', false],
    ['1961-01-01', true],
    ['1961-01-02', true],
    ['2001-01-01', true],
    ['2001-01-02', false],
    ['2006-01-01', false]
  ])('applies Pub 596 Rule 11 to birth date %s', (birthday, eligible) => {
    const f = make(birthday)
    expect(f.scheduleEIC.over25Under65()).toBe(eligible)
    if (!eligible) expect(f.l27()).toBe(0)
  })
  it('does not manufacture EIC for a 19-year-old on fifty cents of wages', () => {
    const f = make('2006-01-01', [0.11, 0.39], [0, 0.01])
    expect(f.l27()).toBe(0)
    expect(f.l33()).toBe(2000)
  })
  it.each([
    [
      [8627.26, 31475.68],
      [125.1, 456.4]
    ],
    [
      [15417.03, 24685.87],
      [223.55, 357.95]
    ]
  ])(
    'does not use a whole-dollar reconciliation artifact as evidence of additional withholding',
    (wages, medicare) => {
      const f = make('1985-01-01', wages, medicare)
      expect(f.f8959.hasCreditableWithholding()).toBe(false)
      expect(f.f8959.isNeeded()).toBe(false)
      expect(f.l25c()).toBeUndefined()
    }
  )
  it('preserves all imported PDF field trees without aliasing repeated IRS names', async () => {
    const makePdf = async (value: string) => {
      const p = await PDFDocument.create()
      const page = p.addPage()
      const f = p.getForm().createTextField('topmostSubform.Page1.amount')
      f.setText(value)
      f.addToPage(page)
      return p
    }
    const merged = await combinePdfs([
      await makePdf('8010'),
      await makePdf('90'),
      await makePdf('450')
    ])
    const reloaded = await PDFDocument.load(await merged.save())
    const form = reloaded.getForm()
    expect(reloaded.getPageCount()).toBe(3)
    expect(form.getTextField('topmostSubform.Page1.amount').getText()).toBe(
      '8010'
    )
    expect(
      form.getTextField('attachment_1_topmostSubform.Page1.amount').getText()
    ).toBe('90')
    expect(
      form.getTextField('attachment_2_topmostSubform.Page1.amount').getText()
    ).toBe('450')
  })
})
