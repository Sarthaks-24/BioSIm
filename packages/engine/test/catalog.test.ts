import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACTIVE_SIGNAL_IDS,
  EVENTS,
  EVENT_IDS,
  HUMAN_PROVIDES,
  PARAMS,
  PARAM_SOURCES,
  RESERVED_SIGNAL_IDS,
  SIGNALS,
  SOURCES,
  isChartable,
  isRegisteredSource,
  sourceById,
  type EventMeta,
  type SignalMeta,
} from '../src/index.ts'

/**
 * The frozen glossary (src/core/catalog.ts) is a public contract: share links, i18n keys and
 * golden tests use these IDs. These checks keep its shape honest. They do not test the model.
 */

const signals: SignalMeta[] = Object.values(SIGNALS)
const events: EventMeta[] = Object.values(EVENTS)
const allIds = [...ACTIVE_SIGNAL_IDS, ...RESERVED_SIGNAL_IDS, ...EVENT_IDS] as string[]
const allRows: (SignalMeta | EventMeta)[] = [...signals, ...events]

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

  it('match the keys of SIGNALS and EVENTS exactly', () => {
    expect(Object.keys(SIGNALS).sort()).toEqual([...ACTIVE_SIGNAL_IDS, ...RESERVED_SIGNAL_IDS].sort())
    expect(Object.keys(EVENTS).sort()).toEqual([...EVENT_IDS].sort())
    for (const [key, row] of [...Object.entries(SIGNALS), ...Object.entries(EVENTS)]) expect(row.id).toBe(key)
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
    const retired = allRows.flatMap((r) => r.retired)
    expect(new Set(retired).size).toBe(retired.length)
    for (const name of retired) {
      expect(allIds, name).not.toContain(name)
      for (const id of allIds) expect(id.startsWith(`${name}.`), `retired ${name} prefixes ${id}`).toBe(false)
    }
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

  it("every active row ships in 'v2.0' and every reserved row does not", () => {
    for (const id of ACTIVE_SIGNAL_IDS) expect(SIGNALS[id].shipsIn, id).toBe('v2.0')
    for (const id of RESERVED_SIGNAL_IDS) expect(SIGNALS[id].shipsIn, id).not.toBe('v2.0')
    for (const e of events) expect(e.shipsIn, e.id).toBe('v2.0')
  })

  it('every active signal and event cites at least one source, and every cited source is registered', () => {
    for (const id of ACTIVE_SIGNAL_IDS) expect(SIGNALS[id].sourceIds.length, id).toBeGreaterThan(0)
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
    // A 'Best guess' signal must say what it does not know.
    for (const id of ACTIVE_SIGNAL_IDS) if (SIGNALS[id].status === 'assumption') expect(SIGNALS[id].limitKey, id).toBeDefined()
    // Markers and the human organism only point at signals the engine produces.
    for (const e of events) expect(ACTIVE_SIGNAL_IDS as readonly string[], e.id).toContain(e.foundOn)
    expect([...HUMAN_PROVIDES].sort()).toEqual([...ACTIVE_SIGNAL_IDS].sort())
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
      const value = path.split('.').reduce<unknown>((o, seg) => (o as Record<string, unknown> | undefined)?.[seg], PARAMS)
      expect(typeof value, path).toBe('number')
      for (const id of entry!.sources) expect(isRegisteredSource(id), `${path} → ${id}`).toBe(true)
    }
  })
})
