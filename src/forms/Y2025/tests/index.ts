import * as fc from 'fast-check'
import { Asset } from 'ustaxes/core/data'
import CommonTests, { FormTestInfo } from 'ustaxes/forms/tests/CommonTests'
import TestKit from 'ustaxes/forms/tests/TestKit'
import F1040 from '../irsForms/F1040'

// The TY2025 kit must instantiate TY2025 forms. It was constructed with
// 'Y2024', so every test in this directory exercised the previous year.
export const testKit = new TestKit('Y2025')
// Generate values inside the monetary contract. Separate negative tests exercise
// overflow; arbitrary nat() prices times nat() quantities generated quadrillions.
testKit.assetArbitrary = fc.record({
  name: fc.constant('Synthetic security'),
  openDate: fc.constant(new Date('2024-01-01T12:00:00Z')),
  closeDate: fc.constant(new Date('2025-06-01T12:00:00Z')),
  openPrice: fc.nat({ max: 10000000 }).map((c) => c / 100),
  closePrice: fc.nat({ max: 10000000 }).map((c) => c / 100),
  openFee: fc.nat({ max: 10000 }).map((c) => c / 100),
  closeFee: fc.nat({ max: 10000 }).map((c) => c / 100),
  quantity: fc.integer({ min: 1, max: 1000 }),
  positionType: fc.constant<Asset['positionType']>('Security')
})

class FormTestInfo2025 extends FormTestInfo<F1040> {
  getAssets = (f1040: F1040) => f1040.assets
  getInfo = (f1040: F1040) => f1040.info
}

export const commonTests = new CommonTests<F1040>(
  testKit,
  new FormTestInfo2025()
)
