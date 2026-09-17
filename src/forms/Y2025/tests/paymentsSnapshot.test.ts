import F1040 from '../irsForms/F1040'
import { calculationSnapshot } from '../irsForms/calculationSnapshot'
import { rehearsalInformation } from './fixtures/atsRehearsal'
import { validateCalculationRequest } from '../../../../server/utils/calculation-contract'

const withPayments = (estimated: number[], extension?: number) => {
  const info = rehearsalInformation(60000)
  info.estimatedTaxes = estimated.map((payment, i) => ({
    label: i === 0 ? 'Applied from the 2024 return' : `Payment ${i}`,
    payment
  }))
  if (extension !== undefined) info.extensionPaymentAmount = extension
  return new F1040(info, [])
}

describe('calculation snapshot v11: estimated and extension payments', () => {
  it('adds estimated payment cents before rounding line 26', () => {
    // 1,000.30 + 1,000.30 = 2,000.60 → 2,001; rounding each first gives 2,000.
    const f = withPayments([1000.3, 1000.3])
    const s = calculationSnapshot(f)
    expect(s.schemaVersion).toBe('ustaxes-1040-line-snapshot-v14')
    expect(s.lines['26']).toBe(2001)
    expect(s.lines['33']).toBe((s.lines['25d'] ?? 0) + 2001)
    expect(s.lines['31']).toBeNull()
  })

  it('carries the Form 4868 payment through Schedule 3 lines 10 and 15 to line 31', () => {
    const f = withPayments([], 2500.5)
    const s = calculationSnapshot(f)
    expect(s.attachments.schedule3.lines).toMatchObject({
      '9': null,
      '10': 2501,
      '11': 0,
      '12': null,
      '13a': null,
      '13z': null,
      '14': 0,
      '15': 2501
    })
    expect(s.lines['31']).toBe(2501)
    expect(s.lines['32']).toBe(2501)
    expect(s.lines['33']).toBe((s.lines['25d'] ?? 0) + 2501)
    // The PDF prints lines 10 and 15 in the fields at those printed rows.
    const named = f.schedule3.namedFields()
    expect(named.f1_27).toBe(2501)
    expect(named.f1_37).toBe(2501)
  })

  it('omits Schedule 3 when the extension payment is zero', () => {
    const f = withPayments([], 0)
    expect(f.schedule3.isNeeded()).toBe(false)
    expect(calculationSnapshot(f).lines['31']).toBeNull()
  })

  it('refuses negative and sub-cent payments at the request boundary', () => {
    const request = (information: Record<string, unknown>) =>
      validateCalculationRequest({
        taxYear: 'Y2025',
        // The wire carries dates as ISO strings, as the HTTP route receives them.
        information: {
          ...(JSON.parse(JSON.stringify(rehearsalInformation(60000))) as Record<
            string,
            unknown
          >),
          ...information
        }
      }).map((i) => i.path)
    expect(
      request({ estimatedTaxes: [{ label: 'Q1', payment: -1 }] })
    ).toContain('/information/estimatedTaxes/0/payment')
    expect(
      request({ estimatedTaxes: [{ label: 'Q1', payment: 10.005 }] })
    ).toContain('/information/estimatedTaxes/0/payment')
    expect(request({ extensionPaymentAmount: -5 })).toContain(
      '/information/extensionPaymentAmount'
    )
    expect(
      request({
        estimatedTaxes: [{ label: 'Q1', payment: 10.25 }],
        extensionPaymentAmount: 100.5
      })
    ).toEqual([])
  })
})
