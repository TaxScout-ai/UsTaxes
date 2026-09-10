import {
  FilingStatus,
  Information,
  Schedule1APersonFacts
} from 'ustaxes/core/data'
import { sumExactCents, toExactCents } from './rounding'

export class Schedule1AInputError extends Error {
  constructor(
    readonly code: 'invalid_input' | 'needs_facts' | 'unsupported',
    readonly path: string,
    message: string
  ) {
    super(message)
    this.name = 'Schedule1AInputError'
    Object.setPrototypeOf(this, Schedule1AInputError.prototype)
  }
}

const fail = (
  code: Schedule1AInputError['code'],
  path: string,
  message: string
): never => {
  throw new Schedule1AInputError(
    code,
    `/information/schedule1AData/${path}`,
    message
  )
}

export const calendarDate = (date: Date): string => {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime()))
    return fail('invalid_input', 'people', 'A valid date of birth is required')
  return date.toISOString().slice(0, 10)
}

export const seniorAtYearEnd = (date: Date): boolean =>
  calendarDate(date) < '1961-01-02'

export const seniorAtDeath = (
  birth: Date,
  facts: Schedule1APersonFacts
): boolean => {
  if (facts.dateOfDeath === null) return true
  // IRS considers age 65 attained the day before the 65th birthday.
  const birthday = new Date(`${calendarDate(birth)}T00:00:00Z`)
  birthday.setUTCFullYear(birthday.getUTCFullYear() + 65)
  birthday.setUTCDate(birthday.getUTCDate() - 1)
  return facts.dateOfDeath >= birthday.toISOString().slice(0, 10)
}

export function validateSchedule1AInput(info: Information): void {
  const data = info.schedule1AData
  if (!data) return
  if ((info.form2555s?.length ?? 0) > 1)
    fail(
      'unsupported',
      'incomeExclusions',
      'Multiple Forms 2555 require a combined exclusion calculation not implemented by this F1040'
    )
  if (
    data.primaryBornBefore1962 !== undefined ||
    data.spouseBornBefore1962 !== undefined
  )
    fail(
      'invalid_input',
      'people',
      'Legacy 1962 age flags are not valid for TY2025; use the taxpayer date of birth'
    )
  if (!data.incomeExclusions)
    fail(
      'needs_facts',
      'incomeExclusions',
      'Establish Puerto Rico and Form 4563 exclusions, including explicit zero'
    )

  const amounts: number[] = []
  const money = (value: unknown, path: string, allowNegative = false) => {
    if (value === undefined)
      fail(
        'needs_facts',
        path,
        'Establish this worksheet amount, including explicit zero'
      )
    if (typeof value !== 'number')
      return fail('invalid_input', path, 'Expected a numeric amount')
    try {
      toExactCents(value, path)
      if (value < 0 && !allowNegative) throw new Error('negative')
      amounts.push(value)
    } catch {
      fail('invalid_input', path, 'Expected finite exact cents within range')
    }
  }
  for (const key of [
    'qualifiedTipsW2',
    'qualifiedTipsF4137',
    'qualifiedTipsSelfEmployed',
    'qualifiedOvertimeW2',
    'qualifiedOvertime1099'
  ] as const)
    if (data[key] !== undefined) money(data[key], key)
  money(data.incomeExclusions?.puertoRico, 'incomeExclusions/puertoRico')
  money(data.incomeExclusions?.form4563, 'incomeExclusions/form4563')

  if (
    data.employeeTips !== undefined &&
    (data.qualifiedTipsW2 !== undefined ||
      data.qualifiedTipsF4137 !== undefined)
  )
    fail(
      'invalid_input',
      'employeeTips',
      'Use per-employer tips or single-employer line inputs, not both'
    )
  for (const [i, tips] of (data.employeeTips ?? []).entries()) {
    money(tips.reportedTips, `employeeTips/${i}/reportedTips`)
    money(tips.form4137Tips, `employeeTips/${i}/form4137Tips`)
  }
  if ((data.qualifiedTipsSelfEmployed ?? 0) !== 0)
    fail(
      'needs_facts',
      'businessTips',
      'Self-employed tips require the net income limit for each business'
    )
  for (const [i, tips] of (data.businessTips ?? []).entries()) {
    money(tips.qualifiedTips, `businessTips/${i}/qualifiedTips`)
    money(tips.netIncome, `businessTips/${i}/netIncome`, true)
  }
  const vins = new Set<string>()
  if ((data.vehicleInterest?.length ?? 0) > 2)
    fail(
      'unsupported',
      'vehicleInterest',
      'More than two VINs require a supplemental statement; it is not implemented'
    )
  for (const [i, vehicle] of (data.vehicleInterest ?? []).entries()) {
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vehicle.vin) || vins.has(vehicle.vin))
      fail(
        'invalid_input',
        `vehicleInterest/${i}/vin`,
        'Expected a distinct 17-character VIN without I, O or Q'
      )
    vins.add(vehicle.vin)
    money(
      vehicle.interestDeductedOnSchedule,
      `vehicleInterest/${i}/interestDeductedOnSchedule`
    )
    money(
      vehicle.interestForSchedule1A,
      `vehicleInterest/${i}/interestForSchedule1A`
    )
  }
  try {
    sumExactCents(amounts.map(Math.abs), 'Schedule 1-A input total')
  } catch {
    fail('invalid_input', '', 'Schedule 1-A aggregate exceeds the exact range')
  }

  const mfj = info.taxPayer.filingStatus === FilingStatus.MFJ
  const mfs = info.taxPayer.filingStatus === FilingStatus.MFS
  const personFacts = (role: 'primary' | 'spouse'): Schedule1APersonFacts => {
    const person =
      role === 'primary' ? info.taxPayer.primaryPerson : info.taxPayer.spouse
    if (!person || (role === 'spouse' && !mfj))
      return fail(
        'invalid_input',
        `people/${role}`,
        'Recipient must be a taxpayer on this return'
      )
    const facts = data.people?.[role]
    if (
      !facts ||
      typeof facts.ssnValidForEmployment !== 'boolean' ||
      typeof facts.ssnIssuedByReturnDeadline !== 'boolean'
    )
      return fail(
        'needs_facts',
        `people/${role}`,
        'Establish SSN employment validity and issuance by the return due date'
      )
    if (facts.dateOfDeath !== null) {
      if (
        typeof facts.dateOfDeath !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(facts.dateOfDeath) ||
        !Number.isFinite(Date.parse(facts.dateOfDeath)) ||
        new Date(facts.dateOfDeath).toISOString().slice(0, 10) !==
          facts.dateOfDeath
      )
        return fail(
          'needs_facts',
          `people/${role}/dateOfDeath`,
          'Establish a valid death date or explicit null for a living person'
        )
      if (
        facts.dateOfDeath < calendarDate(person.dateOfBirth) ||
        facts.dateOfDeath > '2025-12-31' ||
        facts.dateOfDeath < '2025-01-01'
      )
        return fail(
          'invalid_input',
          `people/${role}/dateOfDeath`,
          'Death date must follow birth and fall within TY2025'
        )
    }
    return facts
  }
  const recipients = (
    needed: boolean,
    key: 'tipRecipients' | 'overtimeRecipients'
  ) => {
    if (!needed) return
    if (mfs)
      fail(
        'unsupported',
        key,
        'Married taxpayers must file jointly to claim tips or overtime deductions'
      )
    const roles = data[key]
    if (!roles?.length)
      fail(
        'needs_facts',
        key,
        'Identify each recipient of the qualified income'
      )
    for (const role of roles ?? []) {
      const checkedRole: unknown = role
      if (checkedRole !== 'primary' && checkedRole !== 'spouse')
        fail('invalid_input', key, 'Invalid recipient')
      const facts = personFacts(role)
      if (!facts.ssnValidForEmployment || !facts.ssnIssuedByReturnDeadline)
        fail(
          'unsupported',
          key,
          'Qualified income includes a recipient without the required valid SSN'
        )
    }
  }
  recipients(
    (data.qualifiedTipsW2 ?? 0) > 0 ||
      (data.qualifiedTipsF4137 ?? 0) > 0 ||
      (data.employeeTips ?? []).some(
        (t) => t.reportedTips > 0 || t.form4137Tips > 0
      ) ||
      (data.businessTips ?? []).some((t) => t.qualifiedTips > 0),
    'tipRecipients'
  )
  recipients(
    (data.qualifiedOvertimeW2 ?? 0) > 0 ||
      (data.qualifiedOvertime1099 ?? 0) > 0,
    'overtimeRecipients'
  )
  if (!mfs) {
    if (
      info.taxPayer.primaryPerson &&
      seniorAtYearEnd(info.taxPayer.primaryPerson.dateOfBirth)
    )
      personFacts('primary')
    if (
      mfj &&
      info.taxPayer.spouse &&
      seniorAtYearEnd(info.taxPayer.spouse.dateOfBirth)
    )
      personFacts('spouse')
  }
}
