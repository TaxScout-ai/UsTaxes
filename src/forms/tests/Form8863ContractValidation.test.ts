import {
  FORM_8863_CONTRACT_VERSION,
  USTAXES_HTTP_CONTRACT_VERSION
} from 'ustaxes/core/data'
import { validateForm8863Contract } from '../../../server/utils/form8863-contract'

const eligibleStudent = () => ({
  studentPersonId: 'person_01',
  educationExpenseSetId: 'expense_set_01',
  creditElection: 'aotc',
  eligibility: {
    policyVersion: 'education-credit-eligibility-v1',
    aotc: 'eligible',
    llc: 'eligible'
  },
  qualifiedExpenses: 4000,
  wasAtLeastHalfTime: true,
  wasFirstFourYears: true,
  hasCompletedFourYears: false,
  hasBeenConvictedOfFelonyDrug: false,
  receivedAOTCPriorYears: 0
})

const request = () => ({
  contractVersion: USTAXES_HTTP_CONTRACT_VERSION,
  taxYear: 'Y2025',
  information: {
    taxPayer: { filingStatus: 'S' },
    form8863: {
      contractVersion: FORM_8863_CONTRACT_VERSION,
      students: [eligibleStudent()]
    }
  }
})

describe('validateForm8863Contract', () => {
  it('does not require the education contract when Form 8863 is absent', () => {
    expect(
      validateForm8863Contract({ taxYear: 'Y2023', information: {} })
    ).toEqual([])
  })

  it('rejects legacy Form 8863 payloads without the versioned election', () => {
    const payload = request()
    delete (payload as { contractVersion?: string }).contractVersion
    delete (payload.information.form8863 as { contractVersion?: string })
      .contractVersion
    delete (
      payload.information.form8863.students[0] as {
        creditElection?: string
      }
    ).creditElection

    expect(validateForm8863Contract(payload)).toEqual(
      expect.arrayContaining([
        { code: 'http_contract_version_required' },
        { code: 'form8863_contract_version_required' },
        { code: 'credit_election_required', studentIndex: 0 }
      ])
    )
  })

  it('allows an explicit LLC election even when the AOTC facts are compatible', () => {
    const payload = request()
    payload.information.form8863.students[0].creditElection = 'llc'

    expect(validateForm8863Contract(payload)).toEqual([])
  })

  it('rejects an AOTC election that conflicts with confirmed student facts', () => {
    const payload = request()
    payload.information.form8863.students[0].wasAtLeastHalfTime = false

    expect(validateForm8863Contract(payload)).toContainEqual({
      code: 'selected_aotc_facts_incompatible',
      studentIndex: 0
    })
  })

  it('rejects duplicate student and expense-set identities', () => {
    const payload = request()
    payload.information.form8863.students.push({ ...eligibleStudent() })

    expect(validateForm8863Contract(payload)).toEqual(
      expect.arrayContaining([
        { code: 'duplicate_student_person', studentIndex: 1 },
        { code: 'duplicate_expense_set', studentIndex: 1 },
        { code: 'duplicate_student_expense_instance', studentIndex: 1 }
      ])
    )
  })

  it('rejects MFS and does not echo taxpayer values in issues', () => {
    const payload = request()
    payload.information.taxPayer.filingStatus = 'MFS'

    const issues = validateForm8863Contract(payload)
    expect(issues).toContainEqual({ code: 'married_filing_separately' })
    expect(JSON.stringify(issues)).not.toContain('person_01')
  })
})
