import F1040 from '../irsForms/F1040'
import { FilingStatus, PersonRole, ScheduleK1Form1065 } from 'ustaxes/core/data'
import { blankState } from 'ustaxes/redux/reducer'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

const k1 = (
  net: number,
  grossFarm: number,
  grossNonfarm: number
): ScheduleK1Form1065 => ({
  personRole: PersonRole.PRIMARY,
  partnershipName: 'Synthetic partnership',
  partnershipEin: '000000000',
  partnerOrSCorp: 'P',
  isForeign: false,
  isPassive: false,
  ordinaryBusinessIncome: net,
  interestIncome: 0,
  guaranteedPaymentsForServices: 0,
  guaranteedPaymentsForCapital: 0,
  selfEmploymentEarningsA: net,
  selfEmploymentEarningsB: grossFarm,
  selfEmploymentEarningsC: grossNonfarm,
  distributionsCodeAAmount: 0,
  section199AQBI: 0
})
const form = (partner: ScheduleK1Form1065): F1040 => {
  const info: ValidatedInformation = {
    ...blankState,
    scheduleK1Form1065s: [partner],
    taxPayer: {
      filingStatus: FilingStatus.S,
      dependents: [],
      primaryPerson: {
        firstName: 'Synthetic',
        lastName: 'Review',
        ssid: '000000000',
        role: PersonRole.PRIMARY,
        isBlind: false,
        isTaxpayerDependent: false,
        dateOfBirth: new Date('1985-01-01'),
        address: { address: '', city: '' }
      }
    }
  }
  return new F1040(info, [])
}
// IRS i1065sk1 box 14 and i1040sse: B/C belong to optional methods, not
// the default net earnings calculation. No optional election is implemented.
it.each([
  [0, 433.14],
  [433.14, 0],
  [10000, 50000]
])('gross B=%i / C=%i alone never creates net earnings', (farm, nonfarm) => {
  const f = form(k1(0, farm, nonfarm))
  expect(f.scheduleSE.l3()).toBe(0)
  expect(f.scheduleSE.isNeeded()).toBe(false)
  expect(f.l24()).toBe(0)
})
it('does not double-count code A when codes B/C are present', () => {
  const a = form(k1(10000, 0, 0))
  const b = form(k1(10000, 30000, 50000))
  expect(b.scheduleSE.l3()).toBe(10000)
  expect(b.scheduleSE.l4a()).toBe(9235)
  expect(b.scheduleSE.l12()).toBe(a.scheduleSE.l12())
})
it('retains a net SE loss instead of replacing it with gross receipts', () => {
  expect(form(k1(-1000, 0, 50000)).scheduleSE.l3()).toBe(-1000)
})
