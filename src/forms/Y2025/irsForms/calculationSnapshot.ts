import F1040 from './F1040'

type Lines = Record<string, number | null>

/** Values read from the same F1040 instance as the HTTP summary. This is a
 * serialization of the calculator, never a second calculation path.
 *
 * v2 adds `attachments`: the lines of the forms that reach Form 1040 through
 * Schedules 2 and 3, so a replay can rebuild lines 20 and 23 from their
 * sources the way it rebuilds line 9. A form the return does not carry is
 * `null`, never an empty object — absence is a fact of the return.
 */
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
        '8': f.schedule3.l8()
      } as Lines
    }
  }
  return {
    schemaVersion: 'ustaxes-1040-line-snapshot-v2',
    taxYear: 2025,
    form: '1040',
    lines,
    attachments
  }
}
