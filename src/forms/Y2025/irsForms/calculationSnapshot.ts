import F1040 from './F1040'

/** Values read from the same F1040 instance as the HTTP summary. This is a
 * serialization of the calculator, never a second calculation path.
 */
export function calculationSnapshot(f: F1040) {
  const lines: Record<string, number | null> = {
    '1a': f.l1a(),
    '1z': f.l1z(),
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
    '36': f.l36() ?? null,
    '37': f.l37()
  }
  return {
    schemaVersion: 'ustaxes-1040-line-snapshot-v1',
    taxYear: 2025,
    form: '1040',
    lines
  }
}
