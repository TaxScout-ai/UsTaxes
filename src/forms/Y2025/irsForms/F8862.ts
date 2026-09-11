import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form8862Data, Form8862NoChildFiler } from 'ustaxes/core/data'
import F1040 from './F1040'

/**
 * Form 8862 (Rev. December 2025) — Information To Claim Certain Credits
 * After Disallowance. Information only: nothing here changes a line of the
 * return. Part II (EIC), Part III (CTC/ACTC/ODC) and Part IV (AOTC) are
 * printed as answered.
 */
export default class F8862 extends F1040Attachment {
  tag: FormTag = 'f8862'
  sequenceIndex = 862

  readonly data: Form8862Data

  constructor(f1040: F1040, data: Form8862Data) {
    super(f1040)
    this.data = data
  }

  isNeeded = (): boolean =>
    this.data.claimsEic || this.data.claimsCtc || this.data.claimsAotc

  private yesNo = (v: boolean | undefined): [boolean, boolean] =>
    v === undefined ? [false, false] : [v, !v]

  private monthDay = (v: string | undefined): [string, string] => {
    if (v === undefined) return ['', '']
    const parts = v.split('/')
    return [parts[0], parts.length > 1 ? parts[1] : '']
  }

  private noChild = (
    f: Form8862NoChildFiler | undefined
  ): [number | undefined, number | undefined] => [f?.mainHomeUSDays, f?.age]

  fields = (): Field[] => {
    const d = this.data
    const eic = d.eic
    const children = [0, 1, 2].map((i) => eic?.children[i])
    const ctcChildren = [0, 1, 2, 3].map((i) => d.ctc?.children[i])
    const others = [0, 1, 2, 3].map((i) => d.ctc?.otherDependents[i])
    const students = [0, 1, 2].map((i) => d.aotc?.students[i])
    const [primaryDays, primaryAge] = this.noChild(eic?.primaryWithoutChild)
    const [spouseDays, spouseAge] = this.noChild(eic?.spouseWithoutChild)
    return [
      // Page 1
      this.f1040.namesString(), // f1_01
      this.f1040.info.taxPayer.primaryPerson.ssid, // f1_02
      String(d.taxYear), // f1_03 line 1
      d.claimsEic, // c1_1
      d.claimsCtc, // c1_2
      d.claimsAotc, // c1_3
      ...this.yesNo(eic?.disallowedOnlyForIncomeReporting), // c1_4 line 3
      ...this.yesNo(eic?.qualifyingChildOfAnother), // c1_5 line 4
      ...children.map((c) => c?.name ?? ''), // f1_04..06 line 5
      ...this.yesNo(eic?.scheduleEicShowsQualifyingChild), // c1_6 line 6
      ...children.map((c) => c?.daysLivedInUS), // f1_07..09 line 7
      ...children.flatMap((c) => [
        ...this.monthDay(c?.birthMonthDay),
        ...this.monthDay(c?.deathMonthDay)
      ]), // f1_10..21 line 8
      // Page 2
      primaryDays, // f2_01 line 9a
      spouseDays, // f2_02 line 9b
      primaryAge, // f2_03 line 10a
      spouseAge, // f2_04 line 10b
      ...this.yesNo(eic?.primaryWithoutChild?.dependentOfAnother), // c2_1 line 11a
      ...this.yesNo(eic?.spouseWithoutChild?.dependentOfAnother), // c2_2 line 11b
      ...ctcChildren.map((c) => c?.name ?? ''), // f2_05..08 line 12
      ...others.map((o) => o?.name ?? ''), // f2_09..12 line 13
      ...ctcChildren.flatMap((c) => this.yesNo(c?.livedWithFilerOverHalfYear)), // c2_3..6 line 14
      ...ctcChildren.flatMap((c) => this.yesNo(c?.qualifyingChild)), // c2_7..10 line 15
      ...ctcChildren.flatMap((c) => this.yesNo(c?.dependent)), // c2_11..14 line 16
      ...others.flatMap((o) => this.yesNo(o?.dependent)), // c2_15..18 line 16
      ...ctcChildren.flatMap((c) => this.yesNo(c?.usCitizenNationalOrResident)), // c2_19..22 line 17
      ...others.flatMap((o) => this.yesNo(o?.usCitizenNationalOrResident)), // c2_23..26 line 17
      // Page 3
      ...students.map((s) => s?.name ?? ''), // f3_01..03 line 18
      ...students.flatMap((s) => this.yesNo(s?.eligibleStudent)), // c3_1..3 line 19a
      ...students.flatMap((s) => this.yesNo(s?.claimedFourPriorYears)) // c3_4..6 line 19b
    ]
  }
}
