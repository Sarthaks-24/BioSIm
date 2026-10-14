import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACTIVE_SIGNAL_IDS,
  EVENTS,
  EVENT_IDS,
  PARAM_SOURCES,
  RESERVED_SIGNAL_IDS,
  SIGNALS,
  SOURCES,
  isChartable,
  isRegisteredSource,
  sourceById,
  type EventMeta,
  type RunEventId,
  type SignalMeta,
} from '../src/index.ts'
import {
  BREATHING_SIGNALS,
  BREATHING_SIGNAL_IDS,
  CIRCULATION_EVENTS,
  CIRCULATION_EVENT_IDS,
  CIRCULATION_SIGNALS,
  CIRCULATION_SIGNAL_IDS,
  EFFORT_SIGNALS,
  EFFORT_SIGNAL_IDS,
  HUMAN_MODEL,
  HUMAN_PROVIDES,
  RUN_EVENT_IDS,
  RUN_EVENTS,
  KIDNEY_EVENTS,
  KIDNEY_EVENT_IDS,
  KIDNEY_SIGNALS,
  KIDNEY_SIGNAL_IDS,
  RUN_SIGNAL_IDS,
  RUN_SIGNALS,
} from '../src/run.ts'
import { ALL_SIGNALS, EVENT_DOCS, RESERVED_SIGNALS, SIGNAL_DOCS } from '../src/core/catalog-docs.ts'

/**
 * The frozen glossary (src/core/catalog.ts, with its documentation half catalog-docs.ts) is a
 * public contract: share links, i18n keys and golden tests use these IDs. These checks keep its
 * shape honest. They do not test the model.
 */

const signals: SignalMeta[] = Object.values(ALL_SIGNALS)
/** The lean catalog's events and the packs' lazy ones (S-4's kidney moments, S-3's gut-flow peak). */
const events: EventMeta<RunEventId>[] = Object.values(RUN_EVENTS)
const allIds = [
  ...ACTIVE_SIGNAL_IDS,
  ...BREATHING_SIGNAL_IDS,
  ...EFFORT_SIGNAL_IDS,
  ...KIDNEY_SIGNAL_IDS,
  ...CIRCULATION_SIGNAL_IDS,
  ...RESERVED_SIGNAL_IDS,
  ...RUN_EVENT_IDS,
] as string[]
const allRows: (SignalMeta | EventMeta<RunEventId>)[] = [...signals, ...events]

/** Dotted, at least two segments, each camelCase starting with a lowercase letter. */
const ID_RE = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/
/** i18n sub-keys under `signals.<id>`. An ID segment with one of these names would clash with them. */
const SUB_KEYS = ['name', 'short', 'desc', 'summary', 'summaryNone', 'band']

/**
 * The glossary as frozen on 2026-10-12, with units. A copy on purpose: renaming an ID inside
 * catalog.ts stays self-consistent there, but fails here. Only ADD lines (when a new ID is added).
 */
const FROZEN: Record<string, string> = {
  'gut.stomach.contentG': 'g',
  'gut.stomach.liquidG': 'g',
  'gut.stomach.solidG': 'g',
  'gut.small.contentG': 'g',
  'gut.colon.contentG': 'g',
  'gut.absorbed.carbsG': 'g',
  'gut.absorbed.proteinG': 'g',
  'gut.absorbed.fatG': 'g',
  'gut.absorbed.waterG': 'g',
  'gut.absorbed.fibreG': 'g',
  'gut.leftBodyG': 'g',
  'blood.glucose': 'mg/dL',
  'energy.inRate': 'kcal/h',
  'energy.inTotal': 'kcal',
  'energy.usedRate': 'kcal/h',
  'energy.usedTotal': 'kcal',
  'gut.stomach.outflowRate': 'kcal/min',
  'gut.absorbRate.carbs': 'g/min',
  'gut.absorbRate.protein': 'g/min',
  'gut.absorbRate.fat': 'g/min',
  'gut.absorbRate.water': 'g/min',
  'blood.insulin': 'xFasting',
  'liver.glucoseOutput': 'g/min',
  'liver.glycogenG': 'g',
  'brain.glucoseUse': 'g/h',
  'heart.rate': 'beats/min',
  'lungs.breathRate': 'breaths/min',
  'kidney.filtrationRate': 'mL/min',
  // S-2 (breathing pack, lazy rows).
  'gas.o2UseRate': 'mL/min',
  'gas.co2OutRate': 'mL/min',
  'gas.exchangeRatio': 'ratio',
  'lungs.tidalVolume': 'mL',
  // S-1, the effort pack (core/catalog/effort.ts).
  'muscle.energyRate': 'kcal/h',
  'skin.sweatRate': 'mL/h',
  'skin.sweatTotal': 'mL',
  // S-4, the kidneys pack (core/catalog/kidneys.ts); kidney.filtrationRate above, unit kept.
  'kidney.urineRate': 'mL/h',
  'kidney.urineTotal': 'mL',
  'kidney.bladderMl': 'mL',
  'water.mealExtraMl': 'mL',
  'event.bladderFirstUrge': 'min',
  'event.mostMealWaterPassed': 'min',
  // S-3, the circulation pack (core/catalog/circulation.ts). heart.rate keeps its reserved unit.
  'heart.output': 'L/min',
  'heart.strokeVolume': 'mL',
  'blood.flow.gut': 'mL/min',
  'blood.flow.muscle': 'mL/min',
  'event.gutFlowPeak': 'min',
  'event.stomachHalfEmpty': 'min',
  'event.glucosePeak': 'min',
  'event.glucoseBackToBase': 'min',
  'event.mostlyAbsorbed': 'min',
  'event.firstLeftovers': 'min',
}

describe('catalog IDs', () => {
  it('every frozen ID still exists with the same unit (IDs are never renamed or deleted)', () => {
    const units: Record<string, string> = Object.fromEntries(allRows.map((r) => [r.id, r.unit]))
    for (const [id, unit] of Object.entries(FROZEN)) expect(units[id], id).toBe(unit)
  })

  it('are well-formed and unique', () => {
    for (const id of allIds) expect(id, id).toMatch(ID_RE)
    expect(new Set(allIds).size).toBe(allIds.length)
  })

  it('match the keys of SIGNALS, RESERVED_SIGNALS, EVENTS and their docs exactly', () => {
    expect(Object.keys(SIGNALS).sort()).toEqual([...ACTIVE_SIGNAL_IDS].sort())
    expect(Object.keys(RESERVED_SIGNALS).sort()).toEqual([...RESERVED_SIGNAL_IDS].sort())
    expect(Object.keys(EVENTS).sort()).toEqual([...EVENT_IDS].sort())
    expect(Object.keys(BREATHING_SIGNALS).sort()).toEqual([...BREATHING_SIGNAL_IDS].sort())
    expect(Object.keys(EFFORT_SIGNALS).sort()).toEqual([...EFFORT_SIGNAL_IDS].sort())
    expect(Object.keys(KIDNEY_SIGNALS).sort()).toEqual([...KIDNEY_SIGNAL_IDS].sort())
    expect(Object.keys(KIDNEY_EVENTS).sort()).toEqual([...KIDNEY_EVENT_IDS].sort())
    expect(Object.keys(CIRCULATION_SIGNALS).sort()).toEqual([...CIRCULATION_SIGNAL_IDS].sort())
    expect(Object.keys(CIRCULATION_EVENTS).sort()).toEqual([...CIRCULATION_EVENT_IDS].sort())
    expect(Object.keys(SIGNAL_DOCS).sort()).toEqual(
      [
        ...ACTIVE_SIGNAL_IDS,
        ...BREATHING_SIGNAL_IDS,
        ...EFFORT_SIGNAL_IDS,
        ...KIDNEY_SIGNAL_IDS,
        ...CIRCULATION_SIGNAL_IDS,
        ...RESERVED_SIGNAL_IDS,
      ].sort(),
    )
    expect(Object.keys(EVENT_DOCS).sort()).toEqual([...RUN_EVENT_IDS].sort())
    for (const [key, row] of [...Object.entries(ALL_SIGNALS), ...Object.entries(RUN_EVENTS)]) expect(row.id).toBe(key)
  })

  it('every row has a one-sentence definition (catalog-docs.ts)', () => {
    for (const [id, d] of [...Object.entries(SIGNAL_DOCS), ...Object.entries(EVENT_DOCS)])
      expect(d.definition.length, id).toBeGreaterThan(20)
  })

  it('no ID is a prefix of another, and no segment clashes with an i18n sub-key (nested JSON)', () => {
    for (const a of allIds) {
      for (const b of allIds) if (a !== b) expect(b.startsWith(`${a}.`), `${a} is a prefix of ${b}`).toBe(false)
      for (const seg of a.split('.').slice(1)) expect(SUB_KEYS, `${a} has segment "${seg}"`).not.toContain(seg)
    }
  })

  it("i18nKey is always 'signals.' + id, and a band's key sits under its signal's", () => {
    for (const row of allRows) expect(row.i18nKey).toBe(`signals.${row.id}`)
    for (const s of signals) if (s.band) expect(s.band.i18nKey).toBe(`${s.i18nKey}.band`)
  })

  it('no retired name equals or prefixes a live ID, and each retired name is listed once', () => {
    const retired = [...Object.values(SIGNAL_DOCS), ...Object.values(EVENT_DOCS)].flatMap((d) => d.retired)
    expect(new Set(retired).size).toBe(retired.length)
    for (const name of retired) {
      expect(allIds, name).not.toContain(name)
      for (const id of allIds) expect(id.startsWith(`${name}.`), `retired ${name} prefixes ${id}`).toBe(false)
    }
  })
})

describe('pack rows (architecture §1.3 lazy rows)', () => {
  const src = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
  const read = (f: string) => readFileSync(resolve(src, f), 'utf8')

  it('the main entry never loads a pack row: catalog.ts names core/catalog/* as types only, index.ts not at all', () => {
    const imports = read('core/catalog.ts').match(/^import .*$/gm) ?? []
    for (const line of imports.filter((l) => l.includes('./catalog/'))) expect(line).toMatch(/^import type /)
    expect(read('index.ts')).not.toMatch(/catalog\//)
  })

  it('S-1 adds the effort rows as Model estimates, never reacting to the meal, each with a validRange', () => {
    expect(EFFORT_SIGNALS['muscle.energyRate']).toMatchObject({ unit: 'kcal/h', kind: 'rate', status: 'assumption', reactsToMeal: false })
    expect(EFFORT_SIGNALS['skin.sweatRate']).toMatchObject({ unit: 'mL/h', kind: 'rate', status: 'assumption', reactsToMeal: false })
    expect(EFFORT_SIGNALS['skin.sweatTotal']).toMatchObject({ unit: 'mL', kind: 'runningTotal', status: 'assumption', reactsToMeal: false })
    for (const id of EFFORT_SIGNAL_IDS) {
      expect(ACTIVE_SIGNAL_IDS as readonly string[], id).not.toContain(id)
      expect(isChartable(EFFORT_SIGNALS[id]), id).toBe(true)
      expect(EFFORT_SIGNALS[id].validRange!.low, id).toBeLessThan(EFFORT_SIGNALS[id].validRange!.high)
    }
    expect(EFFORT_SIGNALS['skin.sweatRate'].validRange).toMatchObject({ low: 0, high: 3000, basis: 'cited' })
  })

  it('S-4 activates kidney.filtrationRate (unit kept) as a sim-clock constant and adds the kidney rows and moments, lazily', () => {
    expect(RESERVED_SIGNAL_IDS as readonly string[]).not.toContain('kidney.filtrationRate')
    for (const id of KIDNEY_SIGNAL_IDS) {
      const row = KIDNEY_SIGNALS[id]
      expect(ACTIVE_SIGNAL_IDS as readonly string[], id).not.toContain(id)
      expect(row, id).toMatchObject({ status: 'assumption', clock: 'sim', shipsIn: 'v3.0' })
      expect(isChartable(row), id).toBe(true)
      expect(row.validRange!.low, id).toBeLessThan(row.validRange!.high)
    }
    expect(KIDNEY_SIGNALS['kidney.filtrationRate']).toMatchObject({ unit: 'mL/min', kind: 'level', reactsToMeal: false })
    expect(KIDNEY_SIGNALS['kidney.urineRate']).toMatchObject({ unit: 'mL/h', kind: 'rate', reactsToMeal: true })
    expect(KIDNEY_SIGNALS['kidney.urineRate'].validRange).toMatchObject({ low: 21, high: 1000, basis: 'cited' })
    expect(KIDNEY_SIGNALS['kidney.bladderMl'].validRange).toMatchObject({ low: 0, high: 600, basis: 'cited' })
    // The lean events stay what the Digestion dock lists; the kidney moments are only in the run chunk.
    for (const id of KIDNEY_EVENT_IDS) {
      expect(EVENT_IDS as readonly string[], id).not.toContain(id)
      expect(KIDNEY_EVENTS[id].status, id).toBe('assumption')
    }
  })

  it('S-3 activates heart.rate (unit kept) as a graphed sim-clock level and adds the circulation rows and event, lazily', () => {
    expect(RESERVED_SIGNAL_IDS as readonly string[]).not.toContain('heart.rate')
    expect(EVENT_IDS as readonly string[]).not.toContain('event.gutFlowPeak')
    for (const id of CIRCULATION_SIGNAL_IDS) {
      const row = CIRCULATION_SIGNALS[id]
      expect(ACTIVE_SIGNAL_IDS as readonly string[], id).not.toContain(id)
      expect(row, id).toMatchObject({ status: 'assumption', clock: 'sim', shipsIn: 'v3.0' })
      expect(isChartable(row), id).toBe(true)
      expect(row.validRange!.low, id).toBeLessThan(row.validRange!.high)
    }
    expect(CIRCULATION_SIGNALS['heart.rate']).toMatchObject({ unit: 'beats/min', kind: 'level', validRange: { low: 40, high: 191 } })
    expect(CIRCULATION_SIGNALS['heart.strokeVolume'].validRange).toMatchObject({ low: 55, high: 100, basis: 'cited' })
    // A meal moves heart rate, output and gut flow, never stroke volume or muscle flow (model §2.3).
    expect(CIRCULATION_SIGNAL_IDS.filter((id) => CIRCULATION_SIGNALS[id].reactsToMeal)).toEqual([
      'heart.rate',
      'heart.output',
      'blood.flow.gut',
    ])
    expect(CIRCULATION_EVENTS['event.gutFlowPeak']).toMatchObject({ status: 'assumption', foundOn: 'blood.flow.gut', shipsIn: 'v3.0' })
  })
})

describe('catalog rows', () => {
  it("illustration ⇒ clock 'real', no displayRange, never chartable", () => {
    for (const s of signals.filter((s) => s.status === 'illustration')) {
      expect(s.clock, s.id).toBe('real')
      expect(s.displayRange, s.id).toBeUndefined()
      expect(isChartable(s), s.id).toBe(false)
    }
    for (const s of signals.filter((s) => s.clock === 'real')) expect(isChartable(s), s.id).toBe(false)
  })

  // Model ACTIVATION_LOG: a reserved row activates with shipsIn 'v3.0' (or 'v3.1'), its unit kept.
  it("every active row ships in 'v2.0' or 'v3.0', and every reserved row in neither", () => {
    const active = ['v2.0', 'v3.0']
    for (const id of RUN_SIGNAL_IDS) expect(active, id).toContain(RUN_SIGNALS[id].shipsIn)
    for (const id of RESERVED_SIGNAL_IDS) expect(active, id).not.toContain(RESERVED_SIGNALS[id].shipsIn)
    for (const e of events) expect(active, e.id).toContain(e.shipsIn)
  })

  it('E-3b-eng activates gut.absorbRate.* with their reserved unit, and adds the energy rows', () => {
    for (const k of ['carbs', 'protein', 'fat', 'water'] as const)
      expect(SIGNALS[`gut.absorbRate.${k}`]).toMatchObject({ unit: 'g/min', kind: 'rate', shipsIn: 'v3.0' })
    expect(SIGNALS['energy.activityRate']).toMatchObject({ unit: 'kcal/h', status: 'assumption', reactsToMeal: false })
    expect(SIGNALS['energy.activityTotal']).toMatchObject({ unit: 'kcal', status: 'assumption', reactsToMeal: false })
    expect(SIGNALS['energy.foodEffectRate']).toMatchObject({ unit: 'kcal/h', status: 'assumption', reactsToMeal: true })
  })

  it('S-2 activates lungs.breathRate (unit kept) as a graphed sim-clock level and adds the gas rows, lazily', () => {
    expect(RESERVED_SIGNAL_IDS as readonly string[]).not.toContain('lungs.breathRate')
    expect(ACTIVE_SIGNAL_IDS as readonly string[]).not.toContain('lungs.breathRate')
    for (const id of BREATHING_SIGNAL_IDS) {
      const row = BREATHING_SIGNALS[id]
      expect(row, id).toMatchObject({ status: 'assumption', clock: 'sim', shipsIn: 'v3.0', reactsToMeal: true })
      expect(isChartable(row), id).toBe(true)
      expect(row.validRange!.low, id).toBeLessThan(row.validRange!.high)
    }
    expect(BREATHING_SIGNALS['lungs.breathRate']).toMatchObject({ unit: 'breaths/min', kind: 'level', validRange: { low: 8, high: 50 } })
    expect(BREATHING_SIGNALS['lungs.tidalVolume'].unit).toBe('mL')
    expect(BREATHING_SIGNALS['gas.exchangeRatio'].validRange).toMatchObject({ low: 0.7, high: 1 })
  })

  it('every active signal and event cites at least one source, and every cited source is registered', () => {
    for (const id of RUN_SIGNAL_IDS) expect(RUN_SIGNALS[id].sourceIds.length, id).toBeGreaterThan(0)
    for (const e of events) expect(e.sourceIds.length, e.id).toBeGreaterThan(0)
    const cited = [...allRows.flatMap((r) => r.sourceIds), ...signals.flatMap((s) => s.band?.sourceIds ?? [])]
    for (const id of cited) expect(isRegisteredSource(id), id).toBe(true)
  })

  it('active rows are internally consistent (ranges, rounding, limits, active-only links)', () => {
    for (const s of signals) {
      if (s.displayRange) expect(s.displayRange[0], s.id).toBeLessThan(s.displayRange[1])
      if (s.round !== undefined) expect(s.round, s.id).toBeGreaterThan(0)
      if (s.limitKey) expect(s.limitKey, s.id).toMatch(/^limits\.[a-z][a-zA-Z0-9]*$/)
    }
    // A 'Model estimate' signal must say what it does not know.
    for (const id of RUN_SIGNAL_IDS) if (RUN_SIGNALS[id].status === 'assumption') expect(RUN_SIGNALS[id].limitKey, id).toBeDefined()
    // Markers and the human organism only point at signals the engine produces.
    for (const e of Object.values(EVENTS)) expect(ACTIVE_SIGNAL_IDS as readonly string[], e.id).toContain(e.foundOn)
    for (const e of Object.values(KIDNEY_EVENTS)) expect(KIDNEY_SIGNAL_IDS as readonly string[], e.id).toContain(e.foundOn)
    for (const e of Object.values(CIRCULATION_EVENTS)) expect(CIRCULATION_SIGNAL_IDS as readonly string[], e.id).toContain(e.foundOn)
    expect([...HUMAN_PROVIDES].sort()).toEqual([...RUN_SIGNAL_IDS].sort())
  })
})

describe('source registry', () => {
  it('every reference in docs/MODEL.md has a SOURCES entry (first author + year)', () => {
    const modelMd = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../docs/MODEL.md'), 'utf8')
    const refs = modelMd
      .slice(modelMd.indexOf('## References'))
      .split('\n')
      .filter((l) => /^\d+\.\s/.test(l))
      .map((l) => l.replace(/^\d+\.\s+/, '').replace(/\*/g, ''))
    expect(refs.length).toBeGreaterThanOrEqual(13)
    const citations = Object.values(SOURCES).map((s) => s.citation)
    for (const ref of refs) {
      const author = ref.split(/[\s,.]/)[0]!
      const year = /\b(19|20)\d{2}\b/.exec(ref)?.[0]
      const match = citations.find((c) => c.startsWith(author) && (!year || c.includes(year)))
      expect(match, `MODEL.md reference without a SOURCES entry: ${ref}`).toBeDefined()
    }
  })

  it('sourceById resolves registered IDs and leaves food:* to the web app', () => {
    for (const id of Object.keys(SOURCES) as (keyof typeof SOURCES)[]) expect(sourceById(id)?.id).toBe(id)
    expect(sourceById('food:cola')).toBeUndefined()
  })

  it('every PARAM_SOURCES key is a real parameter and cites registered sources', () => {
    for (const [path, entry] of Object.entries(PARAM_SOURCES)) {
      const value = path.split('.').reduce<unknown>((o, seg) => (o as Record<string, unknown> | undefined)?.[seg], HUMAN_MODEL.params)
      expect(typeof value, path).toBe('number')
      for (const id of entry!.sources) expect(isRegisteredSource(id), `${path} → ${id}`).toBe(true)
    }
  })
})
