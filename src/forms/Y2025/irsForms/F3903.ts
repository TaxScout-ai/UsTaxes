import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormTag } from 'ustaxes/core/irsForms/Form'
import { Form3903Data } from 'ustaxes/core/data'
import { TaxFormInputError } from './formInput'
import F1040 from './F1040'

/**
 * Form 3903 (2025) — Moving Expenses. Only a Member of the Armed Forces on
 * active duty moving under a military order may deduct; line 5 reaches
 * Schedule 1 line 14. A reimbursement above the expenses (line 5 "No") would
 * be income on Form 1040 line 1h and is refused here.
 */
export default class F3903 extends F1040Attachment {
  tag: FormTag = 'f3903'
  sequenceIndex = 170

  readonly data: Form3903Data

  constructor(f1040: F1040, data: Form3903Data) {
    super(f1040)
    this.data = data
    if (!data.armedForcesMoveCertified)
      throw new TaxFormInputError(
        'unsupported',
        '/information/form3903/armedForcesMoveCertified',
        'Form 3903 is only for a Member of the Armed Forces moving under a military order'
      )
    const stated =
      (data.transportationAndStorage ?? 0) + (data.travelAndLodging ?? 0)
    if (
      (data.transportationAndStorage !== undefined ||
        data.travelAndLodging !== undefined) &&
      stated !== data.totalExpenses
    )
      throw new TaxFormInputError(
        'invalid_input',
        '/information/form3903/totalExpenses',
        'Form 3903 line 3 must equal lines 1 and 2'
      )
    if (this.l4() > this.l3())
      throw new TaxFormInputError(
        'unsupported',
        '/information/form3903/governmentReimbursement',
        'A reimbursement above the moving expenses is income on line 1h, not supported'
      )
  }

  isNeeded = (): boolean => this.l3() > 0

  l1 = (): number | undefined => this.data.transportationAndStorage
  l2 = (): number | undefined => this.data.travelAndLodging
  l3 = (): number => this.data.totalExpenses
  l4 = (): number => this.data.governmentReimbursement
  /** Line 5: the deduction, Schedule 1 line 14. */
  l5 = (): number => this.l3() - this.l4()

  fields = (): Field[] => [
    this.f1040.namesString(), // f1_1
    this.f1040.info.taxPayer.primaryPerson.ssid, // f1_2
    this.data.armedForcesMoveCertified, // c1_1 certification
    this.l1(), // f1_3
    this.l2(), // f1_4
    this.l3(), // f1_5
    this.l4(), // f1_6
    false, // c1_2[0] line 5 No
    true, // c1_2[1] line 5 Yes
    this.l5() // f1_7
  ]
}
