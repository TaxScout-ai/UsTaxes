import { commonTests, testKit } from '.'
import { business, farm } from './supportedTestData'
import F1040 from '../irsForms/F1040'
import * as fc from 'fast-check'

jest.setTimeout(300000)

beforeAll(() => {
  const warn = console.warn.bind(console)
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      warn(x)
    }
  })
})

describe('Integration tests', () => {
  it('should produce valid F1040 with all random forms', async () => {
    await testKit.with1040Assert((forms) => {
      const f1040 = commonTests.findF1040OrFail(forms)

      // Basic sanity: total tax >= 0
      expect(f1040.l24()).toBeGreaterThanOrEqual(0)

      // Total payments >= 0
      expect(f1040.l33()).toBeGreaterThanOrEqual(0)

      // Either owes or gets refund (or breaks even)
      const owed = f1040.l37() ?? 0
      const refund = f1040.l34() ?? 0
      // Can't both owe and get a refund
      if (owed > 0) {
        expect(refund).toBe(0)
      }
    })
  })

  it('should produce fields array for all forms without error', async () => {
    await testKit.with1040Assert((forms) => {
      for (const form of forms) {
        expect(() => form.fields()).not.toThrow()
      }
    })
  })

  it('should have forms sorted by sequence index', async () => {
    await testKit.with1040Assert((forms) => {
      const sorted = [...forms].sort(
        (a, b) => a.sequenceIndex - b.sequenceIndex
      )
      expect(forms.map((f) => f.tag)).toEqual(sorted.map((f) => f.tag))
    })
  })

  it('should generate PDFs for all forms without failing', async () => {
    await testKit.with1040Pdfs((pdfs) => {
      expect(pdfs.length).toBeGreaterThan(0)
    })
  })

  it('constructs Schedule C cases directly, without an impossible filter', () => {
    fc.assert(
      fc.property(testKit.arbitaries.information(), (info) => {
        const f = new F1040({ ...info, scheduleCBusinesses: [business] }, [])
        const sc = f.schedules().find((form) => form.tag === 'f1040sc')
        expect(sc).toBeDefined()
        expect(f.scheduleCNetProfit()).toBe(8000)
      }),
      { numRuns: 25, seed: 4679 }
    )
  })

  it('constructs Schedule F cases directly, without an impossible filter', () => {
    fc.assert(
      fc.property(testKit.arbitaries.information(), (info) => {
        const f = new F1040({ ...info, scheduleFData: [farm] }, [])
        expect(f.schedules().some((form) => form.tag === 'f1040sf')).toBe(true)
        expect(f.scheduleFNetProfit()).toBe(8000)
      }),
      { numRuns: 25, seed: 4680 }
    )
  })
})
