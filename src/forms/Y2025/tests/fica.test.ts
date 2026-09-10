import { fica } from '../data/federal'
import F1040 from '../irsForms/F1040'
import F8959 from '../irsForms/F8959'
import Form from 'ustaxes/core/irsForms/Form'
import Schedule2 from '../irsForms/Schedule2'
import { testKit, commonTests } from '.'
import { FilingStatus, IncomeW2, PersonRole } from 'ustaxes/core/data'
import { run } from 'ustaxes/core/util'
import { blankState } from 'ustaxes/redux/reducer'
import { ValidatedInformation } from 'ustaxes/forms/F1040Base'

jest.setTimeout(10000)

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => {
    // do nothing
  })
})

const sampleW2: IncomeW2 = {
  employer: { EIN: '111111111', employerName: 'w2s employer name' },
  personRole: PersonRole.PRIMARY,
  occupation: 'w2s-occupation',
  state: 'AL',
  income: 111,
  medicareIncome: 222,
  fedWithholding: 333,
  ssWages: 111,
  ssWithholding: fica.maxSSTax,
  medicareWithholding: 555,
  stateWages: 666,
  stateWithholding: 777
}

const sampleInfo: ValidatedInformation = {
  ...blankState,
  taxPayer: {
    dependents: [],
    filingStatus: FilingStatus.MFJ,
    primaryPerson: {
      address: {
        address: '',
        city: ''
      },
      firstName: '',
      isTaxpayerDependent: false,
      lastName: '',
      role: PersonRole.PRIMARY,
      ssid: '',
      isBlind: false,
      dateOfBirth: new Date('2000-01-01')
    },
    spouse: {
      firstName: '',
      isTaxpayerDependent: false,
      lastName: '',
      role: PersonRole.SPOUSE,
      ssid: '',
      isBlind: false,
      dateOfBirth: new Date('2000-01-01')
    }
  }
}

function hasAdditionalMedicareTax(f1040: F1040): boolean {
  const medicareTax = f1040.f8959.l18()
  return medicareTax > 0
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Constructor<T> = new (...args: any[]) => T
function hasAttachment<FormType>(
  attachments: Form[],
  formType: Constructor<FormType>
): boolean {
  return (
    attachments.find((f) => {
      return f instanceof formType
    }) !== undefined
  )
}

describe('fica', () => {
  // TAX-4706 replaces two false random assertions with constructive source-based
  // and split/merge/permutation tests in excessSocialSecurity.test.ts. Box 1 is
  // not the SS wage base; spouses have separate caps, and W-2 count is not
  // employer count. No arbitrary facts are filtered until they happen to pass.

  it('should not give a refund if each person has less than the max', () => {
    const testInfo: ValidatedInformation = {
      ...sampleInfo,
      w2s: [
        {
          ...sampleW2,
          personRole: PersonRole.SPOUSE,
          ssWithholding: fica.maxSSTax
        },
        {
          ...sampleW2,
          personRole: PersonRole.PRIMARY,
          ssWithholding: fica.maxSSTax
        }
      ]
    }

    const f1040 = run(testKit.builder.build(testInfo, []).f1040())
      .map(commonTests.findF1040OrFail)
      .orThrow()

    expect(f1040.schedule3.claimableExcessSSTaxWithholding()).toEqual(0)
  })

  it('claims a spouse excess only for two different employers', () => {
    const testInfo: ValidatedInformation = {
      ...sampleInfo,
      w2s: [
        {
          ...sampleW2,
          personRole: PersonRole.SPOUSE,
          ssWithholding: fica.maxSSTax
        },
        {
          ...sampleW2,
          personRole: PersonRole.SPOUSE,
          employer: { EIN: '222222222', employerName: 'Second employer' },
          // This person has already contributed to the max for their other w2 so the refund should equal this amount
          ssWithholding: 1000
        },
        {
          ...sampleW2,
          personRole: PersonRole.PRIMARY,
          ssWithholding: fica.maxSSTax
        }
      ]
    }

    const f1040 = run(testKit.builder.build(testInfo, []).f1040())
      .map(commonTests.findF1040OrFail)
      .orThrow()
    expect(f1040.schedule3.claimableExcessSSTaxWithholding()).toEqual(1000)
  })

  it('should add Additional Medicare Tax form 8959', async () => {
    await testKit.with1040Assert((forms): Promise<void> => {
      const f1040 = commonTests.findF1040OrFail(forms)
      const filingStatus = f1040.info.taxPayer.filingStatus
      // Should add Additional Medicare Tax if medicare wages over threshold
      if (
        f1040.medicareWages() >
        fica.additionalMedicareTaxThreshold(filingStatus)
      ) {
        expect(hasAdditionalMedicareTax(f1040)).toEqual(true)

        // Should attach both S2 and F8959 to return
        expect(hasAttachment(forms, Schedule2)).toEqual(true)
        expect(hasAttachment(forms, F8959)).toEqual(true)
      } else {
        const selfEmploymentWages = f1040.scheduleSE.l6() ?? 0
        const hasTax =
          f1040.medicareWages() + selfEmploymentWages >
          fica.additionalMedicareTaxThreshold(filingStatus)
        expect(hasAdditionalMedicareTax(f1040)).toEqual(hasTax)
        // Filing may be required without tax: one W-2 > $200k or a credit.
        const requiresForm =
          hasTax ||
          f1040.validW2s().some((w2) => w2.medicareIncome > 200000) ||
          f1040.f8959.l24() > 0
        expect(hasAttachment(forms, F8959)).toEqual(requiresForm)
      }
      return Promise.resolve()
    })
  })

  // Constructive coverage: the old random property spent minutes shrinking
  // mismatches between independently rounded wage/SE lines and a combined tax.
  // These values exercise the actual form on both sides of every status threshold.
  it.each([
    FilingStatus.S,
    FilingStatus.MFJ,
    FilingStatus.MFS,
    FilingStatus.HOH,
    FilingStatus.W
  ])(
    'reconciles wage-only Medicare at threshold boundaries for %s',
    (status) => {
      const threshold = fica.additionalMedicareTaxThreshold(status)
      for (const extra of [-1, 0, 1, 55, 56, 167, 10000]) {
        const wages = threshold + extra
        const info: ValidatedInformation = {
          ...sampleInfo,
          taxPayer: {
            ...sampleInfo.taxPayer,
            filingStatus: status,
            spouse:
              status === FilingStatus.S || status === FilingStatus.HOH
                ? undefined
                : sampleInfo.taxPayer.spouse,
            dependents: []
          },
          w2s: [
            {
              ...sampleW2,
              income: wages,
              medicareIncome: wages,
              ssWages: 176100,
              ssWithholding: 10918.2,
              medicareWithholding:
                Number(
                  (BigInt(wages) * BigInt(145) + BigInt(50)) / BigInt(100)
                ) / 100,
              fedWithholding: 0
            }
          ]
        }
        const f = new F1040(info, [])
        const forms = f.schedules()
        // IRS Form 8959 lines 6-7: excess whole-dollar wages times .009,
        // rounded half up on the printed tax line, including sub-dollar tax.
        const expectedTax = Number(
          (BigInt(Math.max(0, extra)) * BigInt(9) + BigInt(500)) / BigInt(1000)
        )
        expect(f.f8959.l18()).toBe(expectedTax)
        expect(f.f8959.l24()).toBe(0)
        expect(f.l25c() ?? 0).toBe(0)
        const required = wages > 200000 || wages > threshold
        expect(hasAttachment(forms, F8959)).toBe(required)
      }
    }
  )
})
