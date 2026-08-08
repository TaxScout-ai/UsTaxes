import {
  FORM_8863_CONTRACT_VERSION,
  USTAXES_HTTP_CONTRACT_VERSION
} from 'ustaxes/core/data'

export type Form8863ContractIssueCode =
  | 'http_contract_version_required'
  | 'form8863_contract_version_required'
  | 'form8863_tax_year_unsupported'
  | 'form8863_students_required'
  | 'form8863_student_invalid'
  | 'student_instance_identity_required'
  | 'duplicate_student_person'
  | 'duplicate_expense_set'
  | 'duplicate_student_expense_instance'
  | 'credit_election_required'
  | 'eligibility_confirmation_required'
  | 'selected_credit_not_eligible'
  | 'qualified_expenses_invalid'
  | 'selected_aotc_facts_incompatible'
  | 'married_filing_separately'

export interface Form8863ContractIssue {
  code: Form8863ContractIssueCode
  studentIndex?: number
}

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function aotcFactsAreCompatible(student: UnknownRecord): boolean {
  return (
    student.wasAtLeastHalfTime === true &&
    student.wasFirstFourYears === true &&
    student.hasCompletedFourYears === false &&
    student.hasBeenConvictedOfFelonyDrug === false &&
    Number.isSafeInteger(student.receivedAOTCPriorYears) &&
    (student.receivedAOTCPriorYears as number) >= 0 &&
    (student.receivedAOTCPriorYears as number) < 4
  )
}

/**
 * Validates the explicit Form 8863 election handshake before deserialization.
 * Returned issues contain only stable codes and array indexes, never payload
 * values, so an invalid request cannot leak taxpayer data into API logs.
 */
export function validateForm8863Contract(
  requestBody: unknown
): readonly Form8863ContractIssue[] {
  const request = record(requestBody)
  const information = record(request?.information)
  const form8863 = record(information?.form8863)
  if (form8863 === null) return []

  const issues: Form8863ContractIssue[] = []
  if (request?.contractVersion !== USTAXES_HTTP_CONTRACT_VERSION) {
    issues.push({ code: 'http_contract_version_required' })
  }
  if (form8863.contractVersion !== FORM_8863_CONTRACT_VERSION) {
    issues.push({ code: 'form8863_contract_version_required' })
  }
  if (!['Y2024', 'Y2025', 'Y2026'].includes(String(request?.taxYear))) {
    issues.push({ code: 'form8863_tax_year_unsupported' })
  }
  if (record(information?.taxPayer)?.filingStatus === 'MFS') {
    issues.push({ code: 'married_filing_separately' })
  }

  if (!Array.isArray(form8863.students) || form8863.students.length === 0) {
    issues.push({ code: 'form8863_students_required' })
    return issues
  }

  const studentIds = new Set<string>()
  const expenseSetIds = new Set<string>()
  const instances = new Set<string>()

  form8863.students.forEach((value, studentIndex) => {
    const student = record(value)
    if (student === null) {
      issues.push({ code: 'form8863_student_invalid', studentIndex })
      return
    }

    const studentPersonId = student.studentPersonId
    const educationExpenseSetId = student.educationExpenseSetId
    if (
      !nonEmptyString(studentPersonId) ||
      !nonEmptyString(educationExpenseSetId)
    ) {
      issues.push({ code: 'student_instance_identity_required', studentIndex })
    } else {
      const instance = `${studentPersonId}:${educationExpenseSetId}`
      if (studentIds.has(studentPersonId)) {
        issues.push({ code: 'duplicate_student_person', studentIndex })
      }
      if (expenseSetIds.has(educationExpenseSetId)) {
        issues.push({ code: 'duplicate_expense_set', studentIndex })
      }
      if (instances.has(instance)) {
        issues.push({
          code: 'duplicate_student_expense_instance',
          studentIndex
        })
      }
      studentIds.add(studentPersonId)
      expenseSetIds.add(educationExpenseSetId)
      instances.add(instance)
    }

    const election = student.creditElection
    if (election !== 'aotc' && election !== 'llc') {
      issues.push({ code: 'credit_election_required', studentIndex })
    }

    const eligibility = record(student.eligibility)
    if (eligibility === null || !nonEmptyString(eligibility.policyVersion)) {
      issues.push({ code: 'eligibility_confirmation_required', studentIndex })
    } else if (
      (election === 'aotc' || election === 'llc') &&
      eligibility[election] !== 'eligible'
    ) {
      issues.push({ code: 'selected_credit_not_eligible', studentIndex })
    }

    if (
      typeof student.qualifiedExpenses !== 'number' ||
      !Number.isFinite(student.qualifiedExpenses) ||
      student.qualifiedExpenses < 0
    ) {
      issues.push({ code: 'qualified_expenses_invalid', studentIndex })
    }

    if (election === 'aotc' && !aotcFactsAreCompatible(student)) {
      issues.push({ code: 'selected_aotc_facts_incompatible', studentIndex })
    }
  })

  return issues
}
