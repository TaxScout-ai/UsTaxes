import { testKit } from '.'
import F2441 from '../irsForms/F2441'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F2441', () => {
  it('should have credit percentage between 20% and 35%', async () => {
    await testKit.with1040Assert((forms, info): Promise<void> => {
      const f2441 = forms.find((f) => f.tag === 'f2441') as F2441 | undefined
      if (f2441 && info.form2441) {
        const pct = f2441.l8()
        expect(pct).toBeGreaterThanOrEqual(0.2)
        expect(pct).toBeLessThanOrEqual(0.35)
      }
      return Promise.resolve()
    })
  })

  it('should produce credit >= 0', async () => {
    await testKit.with1040Assert((forms, info): Promise<void> => {
      const f2441 = forms.find((f) => f.tag === 'f2441') as F2441 | undefined
      if (f2441 && info.form2441) {
        expect(f2441.l11()).toBeGreaterThanOrEqual(0)
      }
      return Promise.resolve()
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert((forms): Promise<void> => {
      const f2441 = forms.find((f) => f.tag === 'f2441') as F2441 | undefined
      if (f2441) {
        expect(() => f2441.fields()).not.toThrow()
      }
      return Promise.resolve()
    })
  })
})
