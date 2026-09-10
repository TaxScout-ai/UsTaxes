import F1040Attachment from './F1040Attachment'
import { Field } from 'ustaxes/core/pdfFiller'
import { FormStatement } from 'ustaxes/core/irsForms/Form'
import {
  Form5695Data,
  Form5695Details,
  EnergyPropertyItem
} from 'ustaxes/core/data'
import F1040 from './F1040'
import {
  establishedBoolean,
  nonnegativeMoney,
  TaxFormInputError
} from './formInput'
import {
  MoneyInputError,
  rateToWholeDollars,
  sumExactCents,
  sumToWholeDollars
} from './rounding'

const ROOT = '/information/form5695'
const itemKeys = [
  'doors',
  'windows',
  'centralAirConditioners',
  'waterHeaters',
  'furnaces',
  'heatPumps',
  'heatPumpWaterHeaters',
  'biomassStoves',
  'enablingProperty'
] as const
type ItemKey = (typeof itemKeys)[number]

/** TY2025 Form 5695. Qualified net costs are prepared worksheet inputs.
 * Instructions: https://www.irs.gov/instructions/i5695 (pinned in authority/).
 * Part II precedes child/other-dependent and Part I credit limitations.
 * Explicit item details replace ambiguous legacy doors/windows aggregation.
 */
export default class F5695 extends F1040Attachment {
  tag = 'f5695'
  sequenceIndex = 75
  readonly data: Form5695Data
  readonly detail: Form5695Details | undefined

  constructor(f1040: F1040, data: Form5695Data) {
    super(f1040)
    this.data = data
    this.detail = data.details
    this.validate()
  }

  private fail = (
    code: TaxFormInputError['code'],
    path: string,
    message: string
  ): never => {
    throw new TaxFormInputError(code, `${ROOT}/${path}`, message)
  }
  private sum = (...values: number[]): number => {
    try {
      return sumToWholeDollars(values, 'Form 5695')
    } catch (e) {
      if (e instanceof MoneyInputError)
        return this.fail('invalid_input', '', e.message)
      throw e
    }
  }
  private cents = (values: number[]): number => {
    try {
      return sumExactCents(values, 'Form 5695')
    } catch (e) {
      if (e instanceof MoneyInputError)
        return this.fail('invalid_input', '', e.message)
      throw e
    }
  }
  private percent30 = (amount: number, cap = Number.MAX_SAFE_INTEGER): number =>
    Math.min(cap, rateToWholeDollars(amount, 3, 10, 'Form 5695'))
  private items = (key: ItemKey): EnergyPropertyItem[] =>
    [...(this.detail?.[key] ?? [])].sort(
      (a, b) => b.cost - a.cost || a.qmid.localeCompare(b.qmid)
    )
  private itemCost = (key: ItemKey, start = 0, end?: number): number =>
    this.sum(
      ...this.items(key)
        .slice(start, end)
        .map((i) => i.cost)
    )
  private itemLineCost = (key: ItemKey, index: number): number =>
    this.sum(this.items(key)[index]?.cost ?? 0)

  private validate = (): void => {
    const d = this.data
    const amountKeys = [
      'solarElectric',
      'solarWaterHeating',
      'fuelCell',
      'smallWindEnergy',
      'geothermalHeatPump',
      'batteryStorage',
      'insulationMaterials',
      'exteriorDoorsWindows',
      'roofingSurfaces',
      'heatPumps',
      'heatPumpWaterHeaters',
      'biomassStoves',
      'centralAC',
      'naturalGasFurnace',
      'panelboards',
      'homeEnergyAudit',
      'priorYearCreditsUsed'
    ] as const
    amountKeys.forEach((k) => nonnegativeMoney(d[k], `${ROOT}/${k}`))
    this.sum(...amountKeys.map((k) => d[k]))
    if (d.roofingSurfaces > 0)
      this.fail(
        'unsupported',
        'roofingSurfaces',
        'Roofing surfaces are not a TY2025 Form 5695 credit category'
      )
    const x = this.detail
    if (!x) {
      if (amountKeys.some((k) => d[k] > 0))
        this.fail(
          'needs_facts',
          'details',
          'Provide qualification facts, property address, carryforward and itemized QMID/cost details'
        )
      return
    }
    if (
      !establishedBoolean(
        x.costsQualifiedFor2025,
        `${ROOT}/details/costsQualifiedFor2025`
      )
    )
      this.fail(
        'needs_facts',
        'details/costsQualifiedFor2025',
        'Establish qualified net 2025 costs, including allocations and labor exclusions'
      )
    for (const key of ['jointOccupancy', 'condominiumShare'] as const) {
      if (establishedBoolean(x[key], `${ROOT}/details/${key}`))
        this.fail(
          'unsupported',
          `details/${key}`,
          'Shared-property allocation requires a separate supported worksheet'
        )
    }
    const home = x.home
    if (
      !home ||
      !['street', 'city', 'state', 'zip'].every(
        (k) =>
          typeof home[k as keyof typeof home] === 'string' &&
          String(home[k as keyof typeof home]).trim().length > 0
      )
    )
      this.fail(
        'needs_facts',
        'details/home',
        'Provide the property address; do not substitute the mailing address'
      )
    if (!/^[A-Z]{2}$/.test(home.state) || !/^\d{5}(?:-\d{4})?$/.test(home.zip))
      this.fail('invalid_input', 'details/home', 'Invalid state or ZIP format')
    nonnegativeMoney(
      x.cleanEnergyCarryforward,
      `${ROOT}/details/cleanEnergyCarryforward`
    )
    for (const key of itemKeys) {
      if (!Array.isArray(x[key]))
        this.fail(
          'needs_facts',
          `details/${key}`,
          'Provide all item QMID/cost pairs or an explicit empty list'
        )
      x[key].forEach((i, n) => {
        if (!i || typeof i !== 'object')
          this.fail(
            'invalid_input',
            `details/${key}/${n}`,
            'Expected a QMID/cost item'
          )
        nonnegativeMoney(i.cost, `${ROOT}/details/${key}/${n}/cost`)
        if (!/^[A-Z0-9]{4}$/.test(i.qmid ?? ''))
          this.fail(
            i.qmid === undefined ? 'needs_facts' : 'invalid_input',
            `details/${key}/${n}/qmid`,
            'A four-character alphanumeric QMID is required for each item'
          )
      })
      this.cents(x[key].map((i) => i.cost))
    }
    const reconcile = (key: keyof Form5695Data, keys: ItemKey[]) => {
      if (
        this.cents([d[key] as number]) !==
        this.cents(keys.flatMap((k) => x[k].map((i) => i.cost)))
      )
        this.fail(
          'invalid_input',
          String(key),
          'Legacy total and detailed item costs do not reconcile exactly'
        )
    }
    reconcile('exteriorDoorsWindows', ['doors', 'windows'])
    reconcile('centralAC', ['centralAirConditioners'])
    reconcile('naturalGasFurnace', ['furnaces'])
    reconcile('heatPumps', ['heatPumps'])
    reconcile('heatPumpWaterHeaters', ['heatPumpWaterHeaters'])
    reconcile('biomassStoves', ['biomassStoves'])
    reconcile('panelboards', ['enablingProperty'])
    if (
      d.batteryStorage > 0 &&
      !establishedBoolean(
        x.batteryAtLeast3Kwh,
        `${ROOT}/details/batteryAtLeast3Kwh`
      )
    )
      this.fail(
        'invalid_input',
        'details/batteryAtLeast3Kwh',
        'Included battery costs must have capacity of at least 3 kWh'
      )
    if (d.fuelCell > 0) {
      if (
        !establishedBoolean(
          x.fuelCellMainHomeInUS,
          `${ROOT}/details/fuelCellMainHomeInUS`
        )
      )
        this.fail(
          'invalid_input',
          'details/fuelCellMainHomeInUS',
          'Included fuel cell costs must be for a main home in the US'
        )
      if (x.fuelCellCapacityKw === undefined)
        this.fail(
          'needs_facts',
          'details/fuelCellCapacityKw',
          'Fuel cell capacity is needed for the per-half-kW limit'
        )
      const kw = x.fuelCellCapacityKw
      if (
        typeof kw !== 'number' ||
        !Number.isSafeInteger(kw * 2) ||
        kw < 0.5 ||
        kw > 1000000
      )
        this.fail(
          'invalid_input',
          'details/fuelCellCapacityKw',
          'Use qualified capacity in half-kW increments'
        )
    }
    if (
      d.insulationMaterials > 0 ||
      d.exteriorDoorsWindows > 0 ||
      x.envelope !== undefined
    ) {
      if (!x.envelope)
        this.fail(
          'needs_facts',
          'details/envelope',
          'Establish the Section A qualification facts'
        )
      for (const key of [
        'mainHomeInUS',
        'originalUser',
        'expectedLifeAtLeast5Years',
        'constructionCostsExcluded'
      ] as const)
        establishedBoolean(x.envelope?.[key], `${ROOT}/details/envelope/${key}`)
      if (x.envelope?.constructionCostsExcluded === false)
        this.fail(
          'needs_facts',
          'details/envelope/constructionCostsExcluded',
          'Separate construction costs from eligible existing-home improvements'
        )
    }
    if (
      itemKeys.slice(2).some((k) => x[k].length > 0) ||
      x.energyProperty !== undefined
    ) {
      if (!x.energyProperty)
        this.fail(
          'needs_facts',
          'details/energyProperty',
          'Establish the Section B qualification facts'
        )
      establishedBoolean(
        x.energyProperty?.homeInUS,
        `${ROOT}/details/energyProperty/homeInUS`
      )
      establishedBoolean(
        x.energyProperty?.originallyPlacedInServiceByTaxpayer,
        `${ROOT}/details/energyProperty/originallyPlacedInServiceByTaxpayer`
      )
    }
    if (d.panelboards > 0) {
      const codes =
        x.enablingPropertyCodes ??
        this.fail(
          'needs_facts',
          'details/enablingPropertyCodes',
          'Identify the qualifying enabled property'
        )
      if (codes.length === 0)
        this.fail(
          'needs_facts',
          'details/enablingPropertyCodes',
          'Identify the qualifying enabled property'
        )
      const mapping: Record<string, ItemKey> = {
        A: 'windows',
        B: 'centralAirConditioners',
        C: 'waterHeaters',
        D: 'furnaces',
        E: 'heatPumps',
        F: 'heatPumpWaterHeaters',
        G: 'biomassStoves'
      }
      if (
        new Set(codes).size !== codes.length ||
        codes.some((c) => !mapping[c] || x[mapping[c]].length === 0)
      )
        this.fail(
          'unsupported',
          'details/enablingPropertyCodes',
          'Each code must identify included 2025 enabled property; prior-year safe-harbor allocations need a separate worksheet'
        )
    }
    if (d.homeEnergyAudit > 0)
      establishedBoolean(
        x.qualifiedHomeEnergyAudit,
        `${ROOT}/details/qualifiedHomeEnergyAudit`
      )
    this.sum(
      ...amountKeys.map((k) => d[k]),
      x.cleanEnergyCarryforward,
      ...x.waterHeaters.map((i) => i.cost)
    )
  }

  isNeeded = (): boolean => this.data !== undefined
  private envelopeAllowed = (): boolean =>
    this.detail?.envelope?.mainHomeInUS === true &&
    this.detail.envelope.originalUser &&
    this.detail.envelope.expectedLifeAtLeast5Years &&
    this.detail.envelope.constructionCostsExcluded
  private propertyAllowed = (): boolean =>
    this.detail?.energyProperty?.homeInUS === true &&
    this.detail.energyProperty.originallyPlacedInServiceByTaxpayer
  pdfL1 = (): number => this.sum(this.data.solarElectric)
  pdfL2 = (): number => this.sum(this.data.solarWaterHeating)
  pdfL3 = (): number => this.sum(this.data.smallWindEnergy)
  pdfL4 = (): number => this.sum(this.data.geothermalHeatPump)
  pdfL5b = (): number => this.sum(this.data.batteryStorage)
  pdfL6a = (): number =>
    this.sum(
      this.pdfL1(),
      this.pdfL2(),
      this.pdfL3(),
      this.pdfL4(),
      this.pdfL5b()
    )
  pdfL6b = (): number => this.percent30(this.pdfL6a())
  pdfL8 = (): number => this.sum(this.data.fuelCell)
  pdfL9 = (): number => this.percent30(this.pdfL8())
  pdfL10 = (): number => this.sum((this.detail?.fuelCellCapacityKw ?? 0) * 1000)
  pdfL11 = (): number => Math.min(this.pdfL9(), this.pdfL10())
  pdfL12 = (): number => this.sum(this.detail?.cleanEnergyCarryforward ?? 0)
  pdfL13 = (): number => this.sum(this.pdfL6b(), this.pdfL11(), this.pdfL12())
  pdfL14 = (): number => {
    if (this.pdfL13() === 0) return 0
    const s = this.f1040.schedule3
    const childOffset = this.f1040.schedule8812.usesCreditLimitWorksheetB()
      ? this.f1040.schedule8812.creditLimitWorksheetBLine14()
      : this.f1040.l19() ?? 0
    return Math.max(
      0,
      this.pdfL31() -
        this.sum(
          this.pdfL32(),
          s.l6m() ?? 0,
          s.l6f() ?? 0,
          childOffset,
          s.l6g() ?? 0,
          s.l6c() ?? 0,
          s.l6h() ?? 0
        )
    )
  }
  pdfL15 = (): number => Math.min(this.pdfL13(), this.pdfL14())
  pdfL16 = (): number => this.pdfL13() - this.pdfL15()
  pdfL18a = (): number =>
    this.envelopeAllowed() ? this.sum(this.data.insulationMaterials) : 0
  pdfL18b = (): number => this.percent30(this.pdfL18a(), 1200)
  pdfL19a = (): number =>
    this.envelopeAllowed() ? this.itemLineCost('doors', 0) : 0
  pdfL19c = (): number => this.percent30(this.pdfL19a(), 250)
  pdfL19d = (): number =>
    this.envelopeAllowed()
      ? this.sum(this.itemLineCost('doors', 1), this.itemLineCost('doors', 2))
      : 0
  pdfL19e = (): number =>
    this.envelopeAllowed() ? this.itemCost('doors', 3) : 0
  pdfL19f = (): number => this.sum(this.pdfL19d(), this.pdfL19e())
  pdfL19g = (): number => this.percent30(this.pdfL19f())
  pdfL19h = (): number =>
    Math.min(500, this.sum(this.pdfL19c(), this.pdfL19g()))
  pdfL20a = (): number =>
    this.envelopeAllowed()
      ? this.sum(
          ...this.items('windows')
            .slice(0, 4)
            .map((i) => this.sum(i.cost))
        )
      : 0
  pdfL20b = (): number =>
    this.envelopeAllowed() ? this.itemCost('windows', 4) : 0
  pdfL20c = (): number => this.sum(this.pdfL20a(), this.pdfL20b())
  pdfL20d = (): number => this.percent30(this.pdfL20c(), 600)
  propertyCost = (key: ItemKey, start = 0, end?: number): number =>
    this.propertyAllowed() ? this.itemCost(key, start, end) : 0
  pdfL22aCost = (): number => this.propertyCost('centralAirConditioners', 0, 1)
  pdfL22b = (): number => this.propertyCost('centralAirConditioners', 1)
  pdfL22c = (): number => this.sum(this.pdfL22aCost(), this.pdfL22b())
  pdfL22d = (): number => this.percent30(this.pdfL22c(), 600)
  pdfL23a = (): number =>
    this.propertyAllowed()
      ? this.sum(
          this.itemLineCost('waterHeaters', 0),
          this.itemLineCost('waterHeaters', 1)
        )
      : 0
  pdfL23b = (): number => this.propertyCost('waterHeaters', 2)
  pdfL23c = (): number => this.sum(this.pdfL23a(), this.pdfL23b())
  pdfL23d = (): number => this.percent30(this.pdfL23c(), 600)
  pdfL24aCost = (): number => this.propertyCost('furnaces', 0, 1)
  pdfL24b = (): number => this.propertyCost('furnaces', 1)
  pdfL24c = (): number => this.sum(this.pdfL24aCost(), this.pdfL24b())
  pdfL24d = (): number => this.percent30(this.pdfL24c(), 600)
  pdfL25c = (): number => this.propertyCost('enablingProperty')
  pdfL25e = (): number => this.percent30(this.pdfL25c(), 600)
  pdfL26b = (): number =>
    this.detail?.qualifiedHomeEnergyAudit === true
      ? this.sum(this.data.homeEnergyAudit)
      : 0
  pdfL26c = (): number => this.percent30(this.pdfL26b(), 150)
  pdfL27 = (): number =>
    this.sum(
      this.pdfL18b(),
      this.pdfL19h(),
      this.pdfL20d(),
      this.pdfL22d(),
      this.pdfL23d(),
      this.pdfL24d(),
      this.pdfL25e(),
      this.pdfL26c()
    )
  pdfL28 = (): number => Math.min(1200, this.pdfL27())
  pdfL29aCost = (): number => this.propertyCost('heatPumps', 0, 1)
  pdfL29b = (): number => this.propertyCost('heatPumps', 1)
  pdfL29cCost = (): number => this.propertyCost('heatPumpWaterHeaters', 0, 1)
  pdfL29d = (): number => this.propertyCost('heatPumpWaterHeaters', 1)
  pdfL29eCost = (): number => this.propertyCost('biomassStoves', 0, 1)
  pdfL29f = (): number => this.propertyCost('biomassStoves', 1)
  pdfL29g = (): number =>
    this.sum(
      this.pdfL29aCost(),
      this.pdfL29b(),
      this.pdfL29cCost(),
      this.pdfL29d(),
      this.pdfL29eCost(),
      this.pdfL29f()
    )
  pdfL29h = (): number => this.percent30(this.pdfL29g(), 2000)
  pdfL30 = (): number => this.sum(this.pdfL28(), this.pdfL29h())
  pdfL31 = (): number => {
    const s = this.f1040.schedule3
    return Math.max(
      0,
      this.sum(this.f1040.l18()) -
        this.sum(
          s.l6l() ?? 0,
          s.l1() ?? 0,
          s.l2() ?? 0,
          s.l6d() ?? 0,
          s.l3() ?? 0,
          s.l4() ?? 0
        )
    )
  }
  pdfL32 = (): number => Math.min(this.pdfL30(), this.pdfL31())
  // Preserve the two consumed legacy aliases; do not retain obsolete formulas.
  l12 = (): number => this.pdfL15()
  l24 = (): number => this.pdfL32()
  l30 = (): number => this.sum(this.pdfL15(), this.pdfL32())
  credit = (): number => this.l30()

  supportingStatements = (): FormStatement[] => {
    const detail = this.detail
    if (!detail) return []
    const groups: Array<[ItemKey, number, string]> = [
      ['doors', 3, '19e'],
      ['windows', 4, '20b'],
      ['centralAirConditioners', 1, '22b'],
      ['waterHeaters', 2, '23b'],
      ['furnaces', 1, '24b'],
      ['heatPumps', 1, '29b'],
      ['heatPumpWaterHeaters', 1, '29d'],
      ['biomassStoves', 1, '29f'],
      ['enablingProperty', 2, '25d']
    ]
    return groups.flatMap(([key, count, line]) => {
      const items = this.items(key).slice(count)
      const allowed =
        key === 'doors' || key === 'windows'
          ? this.envelopeAllowed()
          : this.propertyAllowed()
      return !allowed || items.length === 0
        ? []
        : [
            {
              title: `Form 5695 line ${line} - additional qualified property`,
              lines: [
                `Name: ${this.f1040.namesString()}; SSN: ${
                  this.f1040.info.taxPayer.primaryPerson.ssid
                }`,
                `Property: ${detail.home.street}, ${detail.home.city}, ${detail.home.state} ${detail.home.zip}`,
                ...items.map(
                  (i) => `QMID ${i.qmid}; qualified cost $${i.cost.toFixed(2)}`
                ),
                `Rounded line cost: $${this.sum(...items.map((i) => i.cost))}`
              ]
            }
          ]
    })
  }

  namedFields = (): Record<string, Field> => {
    const x = this.detail
    const f: Record<string, Field> = {
      f1_01: this.f1040.namesString(),
      f1_02: this.f1040.info.taxPayer.primaryPerson.ssid
    }
    const put = (page: number, n: number, value: Field) => {
      f[`f${page}_${String(n).padStart(2, '0')}`] = value
    }
    const yesNo = (page: number, n: number, v: boolean | undefined) => {
      if (v !== undefined) {
        f[`c${page}_${n}[0]`] = v
        f[`c${page}_${n}[1]`] = !v
      }
    }
    const address = (page: number, start: number) => {
      if (x)
        [
          x.home.street,
          x.home.unit,
          x.home.city,
          x.home.state,
          x.home.zip
        ].forEach((v, i) => put(page, start + i, v))
    }
    if (this.pdfL6a() > 0) address(1, 3)
    ;[this.pdfL1(), this.pdfL2(), this.pdfL3(), this.pdfL4()].forEach((v, i) =>
      put(1, 8 + i, v)
    )
    yesNo(1, 1, x?.batteryAtLeast3Kwh)
    put(1, 12, this.pdfL5b())
    put(1, 13, this.pdfL6a())
    put(1, 14, this.pdfL6b())
    yesNo(1, 2, x?.fuelCellMainHomeInUS)
    if (this.pdfL8() > 0) address(1, 15)
    f.c1_3 = false
    put(1, 20, this.pdfL8())
    put(1, 21, this.pdfL9())
    if (x?.fuelCellCapacityKw !== undefined) {
      put(1, 22, Math.floor(x.fuelCellCapacityKw))
      put(1, 23, x.fuelCellCapacityKw % 1 === 0 ? '0' : '5')
    }
    ;[
      this.pdfL10(),
      this.pdfL11(),
      this.pdfL12(),
      this.pdfL13(),
      this.pdfL14(),
      this.pdfL15(),
      this.pdfL16()
    ].forEach((v, i) => put(1, 24 + i, v))
    yesNo(2, 1, x?.envelope?.mainHomeInUS)
    yesNo(2, 2, x?.envelope?.originalUser)
    yesNo(2, 3, x?.envelope?.expectedLifeAtLeast5Years)
    if (x?.envelope) {
      address(2, 3)
      yesNo(2, 4, !x.envelope.constructionCostsExcluded)
    }
    if (this.envelopeAllowed()) {
      put(2, 8, this.pdfL18a())
      put(2, 9, this.pdfL18b())
      put(2, 10, this.pdfL19a())
      put(2, 11, this.items('doors')[0]?.qmid)
      put(2, 13, this.pdfL19c())
      put(2, 14, this.pdfL19d())
      ;[
        [15, 17],
        [18, 20]
      ].forEach(([q, c], i) => {
        put(2, q, this.items('doors')[i + 1]?.qmid)
        put(
          2,
          c,
          this.items('doors')[i + 1]
            ? this.itemLineCost('doors', i + 1)
            : undefined
        )
      })
      ;[
        this.pdfL19e(),
        this.pdfL19f(),
        this.pdfL19g(),
        this.pdfL19h(),
        this.pdfL20a()
      ].forEach((v, i) => put(2, 21 + i, v))
      for (let i = 0; i < 4; i++) {
        put(2, 26 + i * 3, this.items('windows')[i]?.qmid)
        put(
          2,
          28 + i * 3,
          this.items('windows')[i] ? this.itemLineCost('windows', i) : undefined
        )
      }
      put(2, 38, this.pdfL20b())
      put(2, 39, this.pdfL20c())
      put(2, 40, this.pdfL20d())
    }
    yesNo(3, 1, x?.energyProperty?.homeInUS)
    yesNo(3, 2, x?.energyProperty?.originallyPlacedInServiceByTaxpayer)
    if (x?.energyProperty) address(3, 1)
    if (this.propertyAllowed()) {
      put(3, 21, this.pdfL22aCost())
      put(3, 22, this.items('centralAirConditioners')[0]?.qmid)
      put(3, 24, this.pdfL22b())
      put(3, 25, this.pdfL22c())
      put(3, 26, this.pdfL22d())
      put(3, 27, this.pdfL23a())
      put(3, 28, this.items('waterHeaters')[0]?.qmid)
      // The official PDF reuses f3_30 for two different controls. Full paths are essential.
      f['topmostSubform[0].Page3[0].f3_30[0]'] = this.items('waterHeaters')[0]
        ? this.itemLineCost('waterHeaters', 0)
        : undefined
      f['topmostSubform[0].Page3[0].Ln23aii[0].Box1-4[0].f3_30[0]'] =
        this.items('waterHeaters')[1]?.qmid
      put(
        3,
        32,
        this.items('waterHeaters')[1]
          ? this.itemLineCost('waterHeaters', 1)
          : undefined
      )
      ;[
        this.pdfL23b(),
        this.pdfL23c(),
        this.pdfL23d(),
        this.pdfL24aCost()
      ].forEach((v, i) => put(3, 33 + i, v))
      put(3, 37, this.items('furnaces')[0]?.qmid)
      put(3, 39, this.pdfL24b())
      put(3, 40, this.pdfL24c())
      put(3, 41, this.pdfL24d())
      yesNo(3, 4, this.pdfL25c() > 0)
      ;(x?.enablingPropertyCodes ?? []).forEach((c, i) => put(3, 42 + i, c))
      put(3, 49, this.pdfL25c())
      put(3, 50, this.items('enablingProperty')[0]?.qmid)
      put(3, 51, this.items('enablingProperty')[1]?.qmid)
      put(3, 52, this.pdfL25e())
      ;[this.pdfL29aCost(), this.pdfL29cCost(), this.pdfL29eCost()].forEach(
        (v, i) => put(4, 5 + i * 4, v)
      )
      ;(
        ['heatPumps', 'heatPumpWaterHeaters', 'biomassStoves'] as const
      ).forEach((k, i) => put(4, 6 + i * 4, this.items(k)[0]?.qmid))
      ;[this.pdfL29b(), this.pdfL29d(), this.pdfL29f()].forEach((v, i) =>
        put(4, 8 + i * 4, v)
      )
      put(4, 17, this.pdfL29g())
      put(4, 18, this.pdfL29h())
    }
    yesNo(
      4,
      1,
      x?.qualifiedHomeEnergyAudit ??
        (this.data.homeEnergyAudit === 0 ? false : undefined)
    )
    ;[this.pdfL26b(), this.pdfL26c(), this.pdfL27(), this.pdfL28()].forEach(
      (v, i) => put(4, 1 + i, v)
    )
    put(4, 19, this.pdfL30())
    put(4, 20, this.pdfL31())
    put(4, 21, this.pdfL32())
    f.c4_2 = false
    f.c4_3 = false
    return f
  }
  fields = (): Field[] => Object.values(this.namedFields())
}
