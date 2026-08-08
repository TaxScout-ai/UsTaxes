import {
  FilingStatus,
  FORM_8863_CONTRACT_VERSION,
  Form8863Data,
  PersonRole,
  Student8863
} from 'ustaxes/core/data'
import F8863Y2024 from 'ustaxes/forms/Y2024/irsForms/F8863'
import F8863Y2025 from 'ustaxes/forms/Y2025/irsForms/F8863'
import F8863Y2026 from 'ustaxes/forms/Y2026/irsForms/F8863'

const student = (
  creditElection: Student8863['creditElection'],
  id: string,
  qualifiedExpenses = 4000
): Student8863 => ({
  studentPersonId: `person_${id}`,
  educationExpenseSetId: `expense_set_${id}`,
  creditElection,
  eligibility: {
    policyVersion: 'education-credit-eligibility-v1',
    aotc: 'eligible',
    llc: 'eligible'
  },
  name: `Student ${id}`,
  ssn: '111223333',
  institutionName: 'Example University',
  institutionEIN: '123456789',
  institutionAddress: '100 College Ave',
  qualifiedExpenses,
  wasAtLeastHalfTime: true,
  wasFirstFourYears: true,
  hasCompletedFourYears: false,
  hasBeenConvictedOfFelonyDrug: false,
  receivedAOTCPriorYears: 0,
  isGraduateStudent: false,
  personRole: PersonRole.DEPENDENT
})

const data = (...students: Student8863[]): Form8863Data => ({
  contractVersion: FORM_8863_CONTRACT_VERSION,
  students
})

function fakeF1040(form8863: Form8863Data) {
  return {
    info: {
      form8863,
      taxPayer: {
        filingStatus: FilingStatus.S,
        primaryPerson: { ssid: '999887777' }
      }
    },
    l11: () => 0,
    l18: () => 10000,
    namesString: () => 'Taxpayer Example',
    schedule3: {
      l1: () => undefined,
      l2: () => undefined
    }
  }
}

const yearForms = [
  ['2024', F8863Y2024],
  ['2025', F8863Y2025],
  ['2026', F8863Y2026]
] as const

describe.each(yearForms)(
  'Form 8863 %s explicit election contract',
  (_, Form8863) => {
    it('places the tentative $2,500 AOTC on line 30 and leaves line 31 blank', () => {
      const formData = data(student('aotc', 'aotc'))
      const form = new Form8863(fakeF1040(formData) as never, formData)
      const fields = form.fields()

      expect(form.studentLine29(formData.students[0])).toBe(500)
      expect(form.studentLine30(formData.students[0])).toBe(2500)
      expect(form.studentAOTC(formData.students[0])).toBe(2500)
      expect(fields[75]).toBe(2500)
      expect(fields[76]).toBeUndefined()
    })

    it('honors an explicit LLC election even when AOTC facts are compatible', () => {
      const formData = data(student('llc', 'llc', 3000))
      const form = new Form8863(fakeF1040(formData) as never, formData)
      const fields = form.fields()

      expect(form.qualifiesForAOTC(formData.students[0])).toBe(true)
      expect(form.studentAOTC(formData.students[0])).toBe(0)
      expect(form.studentLLCExpenses(formData.students[0])).toBe(3000)
      expect(fields.slice(64, 76)).toEqual(Array(12).fill(undefined))
      expect(fields[76]).toBe(3000)
    })

    it('keeps mixed student elections separate across copies and totals', () => {
      const formData = data(
        student('aotc', 'aotc'),
        student('llc', 'llc', 3000)
      )
      const form = new Form8863(fakeF1040(formData) as never, formData)
      const copies = form.copies()

      expect(form.l1()).toBe(2500)
      expect(form.l10TotalExpenses()).toBe(3000)
      expect(copies).toHaveLength(1)
      expect(form.fields()[75]).toBe(2500)
      expect(copies[0].fields()[75]).toBeUndefined()
      expect(copies[0].fields()[76]).toBe(3000)
    })
  }
)
