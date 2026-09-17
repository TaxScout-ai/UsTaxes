import { commonTests, testKit } from '.'
import F8606 from '../irsForms/F8606'

jest.setTimeout(40000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation((x: string) => {
    if (!x.includes('Removing XFA form data as pdf-lib')) {
      console.warn(x)
    }
  })
})

describe('F8606', () => {
  it('should have nontaxable portion <= total distributions', async () => {
    await testKit.with1040Assert(async (forms, info) => {
      const f8606s = forms.filter((f) => f.tag === 'f8606') as F8606[]
      for (const f of f8606s) {
        expect(f.l13() ?? 0).toBeLessThanOrEqual((f.l7() ?? 0) + (f.l8() ?? 0))
      }
    })
  })

  it('should produce fields array without error', async () => {
    await testKit.with1040Assert(async (forms) => {
      const f8606s = forms.filter((f) => f.tag === 'f8606') as F8606[]
      for (const f of f8606s) {
        expect(() => f.fields()).not.toThrow()
      }
    })
  })
})
