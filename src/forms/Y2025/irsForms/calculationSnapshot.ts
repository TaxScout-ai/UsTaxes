import F1040 from './F1040'

type Lines = Record<string, number | null>

/** Values read from the same F1040 instance as the HTTP summary. This is a
 * serialization of the calculator, never a second calculation path.
 *
 * v2 adds `attachments`: the lines of the forms that reach Form 1040 through
 * Schedules 2 and 3, so a replay can rebuild lines 20 and 23 from their
 * sources the way it rebuilds line 9. A form the return does not carry is
 * `null`, never an empty object — absence is a fact of the return.
 *
 * v3 adds `worksheets` — the Social Security Benefits Worksheet behind line
 * 6b and the Qualified Dividends and Capital Gain Tax Worksheet behind line
 * 16, each `null` when the return does not use it — and `indicators` for the
 * boxes the form prints beside those lines (Schedule D not required).
 *
 * v4 adds the income attachments behind lines 7, 8, 10 and 23: Schedule 1,
 * Schedule D, Schedule E, Schedule F, Schedule SE and Form 4835 (the first
 * copy of a form that may repeat). Yes/no lines are 1/0; an unanswered one is
 * `null`.
 *
 * v5 adds Schedule C and Form 7206 (first copies), Schedule 1 lines 16/17,
 * and reports Form 7206 line 6 (a five-decimal ratio) as an integer in
 * hundred-thousandths so every line stays a whole number.
 *
 * v6 adds the credit chain behind line 20: Schedule 3 lines 6j and 7, Form
 * 8911 with its first Schedule A (line 9 a ratio in hundred-thousandths,
 * yes/no lines 1/0), Form 6251 when the return carries it, and the spouse's
 * age/blindness boxes among the indicators.
 *
 * v7 adds Schedule A (line 18 the election, 1/0), Schedule 8812, Form 8283
 * (count and totals), Schedule C Part IV miles (44a–44c), and indicators for
 * the statutory-employee box, the itemize election, a deceased spouse, the
 * nonresident-alien-spouse election and the line 27c EIC decline.
 */
const yesNo = (v: boolean | undefined): number | null =>
  v === undefined ? null : v ? 1 : 0

export function calculationSnapshot(f: F1040) {
  const lines: Lines = {
    '1a': f.l1a(),
    '1z': f.l1z(),
    '2b': f.l2b() ?? null,
    '3b': f.l3b() ?? null,
    '4a': f.l4a() ?? null,
    '4b': f.l4b() ?? null,
    '5a': f.l5a() ?? null,
    '5b': f.l5b() ?? null,
    '6a': f.l6a() ?? null,
    '6b': f.l6b() ?? null,
    '7': f.l7() ?? null,
    '8': f.l8() ?? null,
    '9': f.l9(),
    '10': f.l10() ?? null,
    '11a': f.l11(),
    '11b': f.l11(),
    '12e': f.l12(),
    '13a': f.l13() ?? null,
    '13b': f.l13b() ?? null,
    '14': f.l14(),
    '15': f.l15(),
    '16': f.l16() ?? null,
    '17': f.l17() ?? null,
    '18': f.l18(),
    '19': f.l19() ?? null,
    '20': f.l20() ?? null,
    '21': f.l21(),
    '22': f.l22(),
    '23': f.l23() ?? null,
    '24': f.l24(),
    '25a': f.l25a(),
    '25b': f.l25b(),
    '25c': f.l25c() ?? null,
    '25d': f.l25d(),
    '26': f.l26(),
    '27a': f.l27(),
    '28': f.l28() ?? null,
    '29': f.l29() ?? null,
    '30': f.l30() ?? null,
    '31': f.l31() ?? null,
    '32': f.l32(),
    '33': f.l33(),
    '34': f.l34(),
    '35a': f.l35a(),
    '36': f.l36(),
    '37': f.l37()
  }
  const h = f.scheduleH
  const e = f.f5695
  const attachments = {
    scheduleH:
      h === undefined
        ? null
        : {
            lines: {
              '1': h.l1(),
              '2': h.l2(),
              '3': h.l3(),
              '4': h.l4(),
              '5': h.l5(),
              '6': h.l6(),
              '7': h.l7(),
              '8': h.l8(),
              '26': h.l26(),
              // What Schedule H hands to Schedule 2 line 9: line 8 without
              // FUTA, line 26 with it.
              schedule2: h.toSchedule2()
            } as Lines
          },
    f5695:
      e === undefined
        ? null
        : {
            lines: {
              '15': e.pdfL15(),
              '19a': e.pdfL19a(),
              '19c': e.pdfL19c(),
              '19d': e.pdfL19d(),
              '19e': e.pdfL19e(),
              '19f': e.pdfL19f(),
              '19g': e.pdfL19g(),
              '19h': e.pdfL19h(),
              '20a': e.pdfL20a(),
              '20b': e.pdfL20b(),
              '20c': e.pdfL20c(),
              '20d': e.pdfL20d(),
              '22a': e.pdfL22aCost(),
              '22b': e.pdfL22b(),
              '22c': e.pdfL22c(),
              '22d': e.pdfL22d(),
              '27': e.pdfL27(),
              '28': e.pdfL28(),
              '29h': e.pdfL29h(),
              '30': e.pdfL30(),
              '31': e.pdfL31(),
              '32': e.pdfL32()
            } as Lines
          },
    schedule2: {
      lines: {
        '4': f.schedule2.l4() ?? null,
        '9': f.schedule2.l9() ?? null,
        '21': f.schedule2.l21()
      } as Lines
    },
    schedule3: {
      lines: {
        '5a': f.schedule3.l5a() ?? null,
        '5b': f.schedule3.l5b() ?? null,
        '5': f.schedule3.l5(),
        '6j': f.schedule3.l6j() ?? null,
        '7': f.schedule3.l7(),
        '8': f.schedule3.l8()
      } as Lines
    },
    f8911:
      f.f8911 === undefined
        ? null
        : {
            lines: {
              A: f.f8911.lA(),
              '1': f.f8911.l1(),
              '2': f.f8911.l2() ?? null,
              '3': f.f8911.l3(),
              '4': f.f8911.l4(),
              '5': f.f8911.l5(),
              '6a': f.f8911.l6a() ?? null,
              '6b': f.f8911.l6b(),
              '6c': f.f8911.l6c(),
              '7': f.f8911.l7(),
              '8': f.f8911.l8(),
              '9': f.f8911.l9(),
              '10': f.f8911.l10()
            } as Lines
          },
    f8911ScheduleA:
      f.f8911 === undefined
        ? null
        : (() => {
            const [a] = f.f8911.schedules
            return {
              lines: {
                '6a': yesNo(a.l6a()),
                '8': a.l8(),
                '9': Math.round(a.l9() * 100000),
                '10': a.l10(),
                '11': a.l11() ?? null,
                '12': a.l12() ?? null,
                '13': yesNo(a.l13()),
                '14': a.l14() ?? null,
                '15': a.l15(),
                '16': a.l16() ?? null,
                '17': yesNo(a.l17()),
                '18': a.l18() ?? null,
                '19': a.l19() ?? null,
                '20': a.l20(),
                '21': a.l21() ?? null
              } as Lines
            }
          })(),
    f6251: !f.f6251.isNeeded()
      ? null
      : {
          lines: {
            '1a': f.f6251.l1a(),
            '1b': f.f6251.l1b(),
            '2a': f.f6251.l2a() ?? null,
            '2b': f.f6251.l2b() ?? null,
            '2e': f.f6251.l2e() ?? null,
            '2i': f.f6251.l2i() ?? null,
            '4': f.f6251.l4(),
            '5': f.f6251.l5() ?? null,
            '6': f.f6251.l6(),
            '7': f.f6251.l7() ?? null,
            '8': f.f6251.l8() ?? null,
            '9': f.f6251.l9(),
            '10': f.f6251.l10(),
            '11': f.f6251.l11()
          } as Lines
        },
    schedule1: !f.schedule1.isNeeded()
      ? null
      : {
          lines: {
            '1': f.schedule1.l1() ?? null,
            '3': f.schedule1.l3() ?? null,
            '5': f.schedule1.l5() ?? null,
            '6': f.schedule1.l6() ?? null,
            '7': f.schedule1.l7() ?? null,
            '10': f.schedule1.l10(),
            '15': f.schedule1.l15() ?? null,
            '16': f.schedule1.l16() ?? null,
            '17': f.schedule1.l17() ?? null,
            '26': f.schedule1.l26()
          } as Lines
        },
    scheduleD: !f.scheduleD.isNeeded()
      ? null
      : {
          lines: {
            '1ad': f.scheduleD.l1ad() ?? null,
            '1ae': f.scheduleD.l1ae() ?? null,
            '1ah': f.scheduleD.l1ah(),
            '7': f.scheduleD.l7(),
            '8ad': f.scheduleD.l8ad() ?? null,
            '8ae': f.scheduleD.l8ae() ?? null,
            '8ah': f.scheduleD.l8ah() ?? null,
            '13': f.scheduleD.l13() ?? null,
            '15': f.scheduleD.l15(),
            '16': f.scheduleD.l16(),
            '17': yesNo(f.scheduleD.l17()),
            '18': f.scheduleD.l18() ?? null,
            '19': f.scheduleD.l19() ?? null,
            '20': yesNo(f.scheduleD.l20()),
            '21': f.scheduleD.l21() ?? null,
            '22': yesNo(f.scheduleD.l22())
          } as Lines
        },
    scheduleE: !f.scheduleE.isNeeded()
      ? null
      : {
          lines: {
            '26': f.scheduleE.l26(),
            '32': f.scheduleE.l32() ?? null,
            '40': f.scheduleE.l40() ?? null,
            '41': f.scheduleE.l41(),
            '42': f.scheduleE.l42() ?? null
          } as Lines
        },
    scheduleF:
      f.scheduleF === undefined
        ? null
        : {
            lines: {
              '1a': f.scheduleF.l1a(),
              '1b': f.scheduleF.l1b(),
              '1c': f.scheduleF.l1c(),
              '2': f.scheduleF.l2(),
              '3a': f.scheduleF.l3a(),
              '4a': f.scheduleF.l4a(),
              '5a': f.scheduleF.l5a(),
              '6': f.scheduleF.l6(),
              '7': f.scheduleF.l7(),
              '8': f.scheduleF.l8(),
              '9': f.scheduleF.l9(),
              '10': f.scheduleF.l10(),
              '11': f.scheduleF.l11(),
              '12': f.scheduleF.l12(),
              '13': f.scheduleF.l13(),
              '14': f.scheduleF.l14(),
              '15': f.scheduleF.l15(),
              '16': f.scheduleF.l16(),
              '17': f.scheduleF.l17(),
              '18': f.scheduleF.l18(),
              '19': f.scheduleF.l19(),
              '20': f.scheduleF.l20(),
              '21a': f.scheduleF.l21a(),
              '21b': f.scheduleF.l21b(),
              '22': f.scheduleF.l22(),
              '23': f.scheduleF.l23(),
              '24a': f.scheduleF.l24a(),
              '24b': f.scheduleF.l24b(),
              '25': f.scheduleF.l25(),
              '26': f.scheduleF.l26(),
              '27': f.scheduleF.l27(),
              '28': f.scheduleF.l28(),
              '29': f.scheduleF.l29(),
              '30': f.scheduleF.l30(),
              '31': f.scheduleF.l31(),
              '32': f.scheduleF.l32(),
              '33': f.scheduleF.l33(),
              '34': f.scheduleF.l34()
            } as Lines
          },
    scheduleSE: !f.scheduleSE.isNeeded()
      ? null
      : {
          lines: {
            '1a': f.scheduleSE.l1a() ?? null,
            '1b': f.scheduleSE.l1b(),
            '2': f.scheduleSE.l2(),
            '3': f.scheduleSE.l3(),
            '4a': f.scheduleSE.l4a(),
            '4b': f.scheduleSE.l4b() ?? null,
            '4c': f.scheduleSE.l4c(),
            '5a': f.scheduleSE.l5a() ?? null,
            '5b': f.scheduleSE.l5b() ?? null,
            '6': f.scheduleSE.l6() ?? null,
            '7': f.scheduleSE.l7(),
            '8a': f.scheduleSE.l8a() ?? null,
            '8d': f.scheduleSE.l8d() ?? null,
            '9': f.scheduleSE.l9() ?? null,
            '10': f.scheduleSE.l10() ?? null,
            '11': f.scheduleSE.l11() ?? null,
            '12': f.scheduleSE.l12() ?? null,
            '13': f.scheduleSE.l13() ?? null,
            '14': f.scheduleSE.l14() ?? null,
            '15': f.scheduleSE.l15() ?? null
          } as Lines
        },
    scheduleC:
      f.scheduleC === undefined
        ? null
        : {
            lines: {
              '1': f.scheduleC.l1(),
              '2': f.scheduleC.l2(),
              '3': f.scheduleC.l3(),
              '4': f.scheduleC.l4(),
              '5': f.scheduleC.l5(),
              '6': f.scheduleC.l6(),
              '7': f.scheduleC.l7(),
              '8': f.scheduleC.l8(),
              '9': f.scheduleC.l9(),
              '10': f.scheduleC.l10(),
              '11': f.scheduleC.l11(),
              '12': f.scheduleC.l12(),
              '13': f.scheduleC.l13(),
              '14': f.scheduleC.l14(),
              '15': f.scheduleC.l15(),
              '16a': f.scheduleC.l16a(),
              '16b': f.scheduleC.l16b(),
              '17': f.scheduleC.l17(),
              '18': f.scheduleC.l18(),
              '19': f.scheduleC.l19(),
              '20a': f.scheduleC.l20a(),
              '20b': f.scheduleC.l20b(),
              '21': f.scheduleC.l21(),
              '22': f.scheduleC.l22(),
              '23': f.scheduleC.l23(),
              '24a': f.scheduleC.l24a(),
              '24b': f.scheduleC.l24b(),
              '25': f.scheduleC.l25(),
              '26': f.scheduleC.l26(),
              '27a': f.scheduleC.l27a(),
              '27b': f.scheduleC.l27b(),
              '28': f.scheduleC.l28(),
              '29': f.scheduleC.l29(),
              '30': f.scheduleC.l30(),
              '31': f.scheduleC.l31(),
              '44a': f.scheduleC.data.vehicle?.businessMiles ?? null,
              '44b': f.scheduleC.data.vehicle?.commutingMiles ?? null,
              '44c': f.scheduleC.data.vehicle?.otherMiles ?? null
            } as Lines
          },
    scheduleA: !f.scheduleA.isNeeded()
      ? null
      : {
          lines: {
            '1': f.scheduleA.l1(),
            '2': f.scheduleA.l2(),
            '3': f.scheduleA.l3(),
            '4': f.scheduleA.l4(),
            '5a': f.scheduleA.l5a(),
            '5b': f.scheduleA.l5b(),
            '5c': f.scheduleA.l5c(),
            '5d': f.scheduleA.l5d(),
            '5e': f.scheduleA.l5e(),
            '6': f.scheduleA.l6() ?? null,
            '7': f.scheduleA.l7(),
            '8a': f.scheduleA.l8a(),
            '8b': f.scheduleA.l8b(),
            '8c': f.scheduleA.l8c(),
            '8e': f.scheduleA.l8e(),
            '9': f.scheduleA.l9() ?? null,
            '10': f.scheduleA.l10(),
            '11': f.scheduleA.l11(),
            '12': f.scheduleA.l12(),
            '13': f.scheduleA.l13(),
            '14': f.scheduleA.l14(),
            '15': f.scheduleA.l15(),
            '16': f.scheduleA.l16(),
            '17': f.scheduleA.l17(),
            '18': yesNo(f.scheduleA.l18())
          } as Lines
        },
    schedule8812: !f.schedule8812.isNeeded()
      ? null
      : {
          lines: {
            '1': f.schedule8812.l1(),
            '2a': f.schedule8812.l2a(),
            '2b': f.schedule8812.l2b(),
            '2c': f.schedule8812.l2c(),
            '2d': f.schedule8812.l2d(),
            '3': f.schedule8812.l3(),
            '4': f.schedule8812.l4(),
            '5': f.schedule8812.l5(),
            '6': f.schedule8812.l6(),
            '7': f.schedule8812.l7(),
            '8': f.schedule8812.l8(),
            '9': f.schedule8812.l9(),
            '10': f.schedule8812.l10(),
            '11': f.schedule8812.l11(),
            '12': f.schedule8812.l12(),
            '13': f.schedule8812.l13(),
            '14': f.schedule8812.l14()
          } as Lines
        },
    f8283:
      f.f8283 === undefined || !f.f8283.isNeeded()
        ? null
        : {
            lines: {
              count: f.f8283.data.contributions.length,
              totalFmv: f.f8283.totalFMV(),
              totalCost: f.f8283.totalCostBasis()
            } as Lines
          },
    f8995:
      f.f8995?.tag !== 'f8995'
        ? null
        : {
            lines: Object.fromEntries(
              Array.from({ length: 16 }, (_, i) => {
                const line = i + 2
                const form = f.f8995
                if (!form) throw new Error('Missing Form 8995')
                const methods = [
                  form.l2,
                  form.l3,
                  form.l4,
                  form.l5,
                  form.l6,
                  form.l7,
                  form.l8,
                  form.l9,
                  form.l10,
                  form.l11,
                  form.l12,
                  form.l13,
                  form.l14,
                  form.l15,
                  form.l16,
                  form.l17
                ]
                return [String(line), methods[i]()]
              })
            ) as Lines
          },
    f7206:
      f.f7206s().length === 0
        ? null
        : (() => {
            const [h] = f.f7206s()
            return {
              lines: {
                '1': h.l1(),
                '2': h.l2(),
                '3': h.l3(),
                '4': h.l4(),
                '5': h.l5(),
                '6': Math.round(h.l6() * 100000),
                '7': h.l7(),
                '8': h.l8(),
                '9': h.l9(),
                '10': h.l10(),
                '11': h.l11() ?? null,
                '12': h.l12() ?? null,
                '13': h.l13(),
                '14': h.l14()
              } as Lines
            }
          })(),
    f4835:
      f.f4835s().length === 0
        ? null
        : (() => {
            const [r] = f.f4835s()
            return {
              lines: {
                '1': r.l1(),
                '2a': r.l2a(),
                '2b': r.l2b(),
                '3a': r.l3a(),
                '3b': r.l3b(),
                '4a': r.l4a(),
                '4b': r.l4b(),
                '4c': r.l4c(),
                '5a': r.l5a(),
                '5b': r.l5b(),
                '5d': r.l5d(),
                '6': r.l6(),
                '7': r.l7(),
                '8': r.l8(),
                '9': r.l9(),
                '10': r.l10(),
                '11': r.l11(),
                '12': r.l12(),
                '13': r.l13(),
                '14': r.l14(),
                '15': r.l15(),
                '16': r.l16(),
                '17': r.l17(),
                '18': r.l18(),
                '19a': r.l19a(),
                '19b': r.l19b(),
                '20': r.l20(),
                '21': r.l21(),
                '22a': r.l22a(),
                '22b': r.l22b(),
                '23': r.l23(),
                '24': r.l24(),
                '25': r.l25(),
                '26': r.l26(),
                '27': r.l27(),
                '28': r.l28(),
                '29': r.l29(),
                '30': r.l30(),
                '31': r.l31(),
                '32': r.l32(),
                '34c': r.l34c() ?? null
              } as Lines
            }
          })()
  }
  const ss = f.socialSecurityBenefitsWorksheet
  const usesQdcg =
    !f.scheduleD.taxWorksheet.isNeeded() &&
    (f.scheduleD.computeTaxOnQDWorksheet() || f.totalQualifiedDividends() > 0)
  const q = f.qualifiedAndCapGainsWorksheet
  const worksheets = {
    socialSecurityBenefits:
      ss === undefined
        ? null
        : {
            lines: {
              '1': ss.l1(),
              '2': ss.l2(),
              '3': ss.l3(),
              '4': ss.l4() ?? null,
              '5': ss.l5(),
              '6': ss.l6(),
              '7': ss.l7(),
              '8': ss.l8(),
              '9': ss.l9(),
              '10': ss.l10(),
              '11': ss.l11(),
              '12': ss.l12(),
              '13': ss.l13(),
              '14': ss.l14(),
              '15': ss.l15(),
              '16': ss.l16(),
              '17': ss.l17(),
              '18': ss.l18(),
              taxable: ss.taxableAmount()
            } as Lines
          },
    qualifiedDividendsCapitalGains: usesQdcg
      ? {
          lines: {
            '1': q.l1(),
            '2': q.l2(),
            '3': q.l3(),
            '4': q.l4(),
            '5': q.l5(),
            '6': q.l6(),
            '7': q.l7(),
            '8': q.l8(),
            '9': q.l9(),
            '10': q.l10(),
            '11': q.l11(),
            '12': q.l12(),
            '13': q.l13(),
            '14': q.l14(),
            '15': q.l15(),
            '16': q.l16(),
            '17': q.l17(),
            '18': q.l18(),
            '19': q.l19(),
            '20': q.l20(),
            '21': q.l21(),
            '22': q.l22(),
            '23': q.l23(),
            '24': q.l24(),
            '25': q.l25()
          } as Lines
        }
      : null
  }
  const indicators = {
    /** Line 7 box: capital gain distributions only, Schedule D not required. */
    scheduleDNotRequired: f.l7Box(),
    /** Line 12d boxes as the standard deduction counts them. */
    primary65OrOlder: f.bornBeforeDate(),
    primaryBlind: f.blind(),
    /** The spouse's boxes on a joint return; false when the return has no spouse. */
    spouse65OrOlder: f.spouseBeforeDate(),
    spouseBlind: f.spouseBlind(),
    /** Schedule C line 1 box: the receipts are a statutory employee's W-2 wages (first copy). */
    scheduleCStatutoryEmployee: f.scheduleC?.data.statutoryEmployee ?? false,
    /** Schedule A line 18: itemized although below the standard deduction. */
    itemizedDeductionsElected: f.scheduleA.isNeeded() && f.scheduleA.l18(),
    /** The spouse died during the year (date of death on the form). */
    spouseDeceased: f.info.taxPayer.spouse?.dateOfDeath !== undefined,
    /** The nonresident-alien spouse is treated as a resident (box and name on the form). */
    nraSpouseTreatedAsResident: f.nraSpouseTreatedAsResident(),
    /** Line 27c: the EIC is not claimed. */
    eicDeclined: f.eicDeclined()
  }
  return {
    schemaVersion: 'ustaxes-1040-line-snapshot-v7',
    taxYear: 2025,
    form: '1040',
    lines,
    attachments,
    worksheets,
    indicators
  }
}
