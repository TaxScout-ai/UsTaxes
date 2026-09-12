import {
  FilingStatus,
  Form2441Data,
  Form3903Data,
  Form8862Data,
  Form8863Data,
  PersonRole
} from 'ustaxes/core/data'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'
import { rehearsalInformation } from './atsRehearsal'

/**
 * IRS ATS Scenario 5 (TY2025) as the published package states it — inputs
 * only, the return is computed. Head of household, blind, born 1990-02-05;
 * two dependent children born 2015-07-04 and 2016-01-23 (the child tax
 * credit, the additional child tax credit declined on line 28). One W-2:
 * 31,232 wages, 1,754 withheld. Moving expenses 1,475 (Form 3903, total
 * only). Form 2441: two providers, 1,300 and 520, one child each. Form 8863:
 * the taxpayer a half-time student in the first four years, 980 of adjusted
 * qualified expenses, no Form 1098-T. Schedule EIC with both children and
 * Form 8862 (Parts II–IV answered, the Part I year and boxes left blank in
 * the package; the year is the filing year and the boxes follow the parts).
 */
export const barkerCare = (over: Partial<Form2441Data> = {}): Form2441Data => ({
  careProviders: [
    {
      name: 'Kid Corner',
      address: '227 Maze Street, Seattle, WA 98104',
      tin: '000000041',
      amountPaid: 1300
    },
    {
      name: 'Little Genius',
      address: '7311 Apple Road, Seattle, WA 98104',
      tin: '000000042',
      amountPaid: 520
    }
  ],
  qualifyingPersons: [
    { name: 'Synthetic Child', ssn: '000000057', qualifyingExpenses: 1300 },
    { name: 'Synthetic Daughter', ssn: '000000058', qualifyingExpenses: 520 }
  ],
  employerProvidedBenefits: 0,
  personRole: PersonRole.PRIMARY,
  ...over
})

export const barkerEducation = (): Form8863Data => ({
  contractVersion: 'form8863-explicit-election-v1',
  students: [
    {
      studentPersonId: 'primary',
      educationExpenseSetId: 'ut-2025',
      creditElection: 'aotc',
      eligibility: { policyVersion: 'ats-5', aotc: 'eligible', llc: 'unknown' },
      name: 'Synthetic Rehearsal',
      ssn: '000000000',
      institutionName: 'University of Texas',
      institutionEIN: '',
      institutionAddress: 'Blue Street, Austin, Texas',
      qualifiedExpenses: 980,
      wasAtLeastHalfTime: true,
      wasFirstFourYears: true,
      hasCompletedFourYears: false,
      hasBeenConvictedOfFelonyDrug: false,
      receivedAOTCPriorYears: 0,
      isGraduateStudent: false,
      personRole: PersonRole.PRIMARY,
      received1098TCurrentYear: false,
      received1098TPriorYearBox7: false
    }
  ]
})

export const barkerMove = (over: Partial<Form3903Data> = {}): Form3903Data => ({
  totalExpenses: 1475,
  governmentReimbursement: 0,
  armedForcesMoveCertified: true,
  ...over
})

export const barkerDisallowanceInformation = (): Form8862Data => ({
  taxYear: 2025,
  claimsEic: true,
  claimsCtc: true,
  claimsAotc: true,
  eic: {
    disallowedOnlyForIncomeReporting: false,
    qualifyingChildOfAnother: false,
    children: [
      { name: 'Synthetic Child', daysLivedInUS: 365 },
      { name: 'Synthetic Daughter', daysLivedInUS: 365 }
    ]
  },
  ctc: {
    children: [
      {
        name: 'Synthetic Child',
        livedWithFilerOverHalfYear: true,
        qualifyingChild: true,
        dependent: true,
        usCitizenNationalOrResident: true
      },
      {
        name: 'Synthetic Daughter',
        livedWithFilerOverHalfYear: true,
        qualifyingChild: true,
        dependent: true,
        usCitizenNationalOrResident: true
      }
    ],
    otherDependents: []
  },
  aotc: {
    students: [
      {
        name: 'Synthetic Rehearsal',
        eligibleStudent: true,
        claimedFourPriorYears: false
      }
    ]
  }
})

export const scenarioFiveInformation = (
  over: Partial<ValidatedInformation> = {}
): ValidatedInformation => {
  const base = rehearsalInformation()
  return {
    ...base,
    taxPayer: {
      ...base.taxPayer,
      filingStatus: FilingStatus.HOH,
      primaryPerson: {
        ...base.taxPayer.primaryPerson,
        dateOfBirth: new Date('1990-02-05T00:00:00Z'),
        isBlind: true
      },
      dependents: [
        {
          firstName: 'Synthetic',
          lastName: 'Child',
          ssid: '000000057',
          dateOfBirth: new Date('2015-07-04T00:00:00Z'),
          isBlind: false,
          role: PersonRole.DEPENDENT,
          relationship: 'Son',
          qualifyingInfo: { numberOfMonths: 12, isStudent: false }
        },
        {
          firstName: 'Synthetic',
          lastName: 'Daughter',
          ssid: '000000058',
          dateOfBirth: new Date('2016-01-23T00:00:00Z'),
          isBlind: false,
          role: PersonRole.DEPENDENT,
          relationship: 'Daughter',
          qualifyingInfo: { numberOfMonths: 12, isStudent: false }
        }
      ]
    },
    questions: { ...base.questions, CRYPTO: false, DECLINE_ACTC: true },
    w2s: [
      {
        income: 31232,
        medicareIncome: 31232,
        ssWages: 31232,
        ssWithholding: 1936,
        medicareWithholding: 453,
        fedWithholding: 1754,
        personRole: PersonRole.PRIMARY,
        occupation: 'Sales'
      }
    ],
    form3903: barkerMove(),
    form2441: barkerCare(),
    form8863: barkerEducation(),
    form8862: barkerDisallowanceInformation(),
    ...over
  }
}
