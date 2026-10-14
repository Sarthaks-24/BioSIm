import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeShareState, encodeShareState } from '@lifepeek/engine'
import en from '../../i18n/en.json'
import { SYSTEM_SOURCES } from '../../lib/systemSources.ts'
import { PACKS } from '../packs.ts'
import { PACK_OF, systemOf } from '../registry.ts'
import {
  ANCHOR_DAYS,
  CYCLE_DAYS,
  CYCLE_RANGE,
  HEIGHT_EXAMPLE,
  HEIGHT_TABLE,
  HORMONES,
  MEDIANS,
  MENSTRUATION_DRAWN,
  MENSTRUATION_RANGE,
  OVULATION_DAY,
  PHASES,
  REPRO_SOURCE_IDS,
  STUDY_DAYS,
  fullHeightCm,
  makeCurve,
  relativeMedians,
  toBookDay,
  type Hormone,
} from './data.ts'
import { REPRODUCTION_LESSON } from './lesson.ts'
import { REPRODUCTION } from './row.ts'

/** English text at a dotted key. */
const text = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en) as string

/** A hormone's line, sampled every 0.05 day over one cycle (day 0 = day 28). */
const sample = (h: Hormone) => {
  const curve = makeCurve(h)
  return Array.from({ length: CYCLE_DAYS * 20 + 1 }, (_, i) => ({ day: i / 20, level: curve(i / 20) }))
}
const peakDay = (h: Hormone) => sample(h).reduce((a, b) => (b.level > a.level ? b : a)).day

describe('the hormone panel’s data is Anckaert 2021’s, on the book’s cycle (R-1; model §2.12, V-0 item 22)', () => {
  it('keeps the paper’s sub-phase medians (Table 1) and day spans (Supplementary table S3)', () => {
    expect(PHASES.map((p) => MEDIANS.lh[p])).toEqual([6.41, 7.36, 8.52, 24.0, 9.66, 5.36, 5.0])
    expect(PHASES.map((p) => MEDIANS.estrogen[p])).toEqual([125, 172, 464, 817, 390, 505, 396])
    expect(PHASES.map((p) => MEDIANS.progesterone[p])).toEqual([0.38, 0.21, 0.188, 1.59, 22.6, 39.2, 18.2])
    expect(STUDY_DAYS.ovulation).toEqual([14, 16])
    expect(STUDY_DAYS.lutealLate).toEqual([24.668, 29])
  })

  it('moves the study’s 29-day cycle (egg on day 15) onto the book’s 28 days (egg on day 14)', () => {
    expect(CYCLE_DAYS).toBe(28)
    expect(OVULATION_DAY).toBe(14)
    expect(toBookDay(1)).toBe(1)
    expect(toBookDay(15)).toBe(14)
    expect(toBookDay(29)).toBe(28)
    // The luteal half keeps its 14 days, one day earlier.
    expect(toBookDay(22)).toBe(21)
    expect(ANCHOR_DAYS.ovulation).toBe(14)
    const days = PHASES.map((p) => ANCHOR_DAYS[p])
    expect(days).toEqual([...days].sort((a, b) => a - b))
    expect(days[0]).toBeGreaterThan(0)
    expect(days.at(-1)).toBeLessThan(CYCLE_DAYS)
  })

  it.each(HORMONES)('%s: the curve hits every anchor (± 1 %), in units too', (h) => {
    const curve = makeCurve(h)
    const shares = relativeMedians(h)
    const top = Math.max(...PHASES.map((p) => MEDIANS[h][p]))
    PHASES.forEach((p, i) => {
      const at = curve(ANCHOR_DAYS[p])
      expect(Math.abs(at - shares[i]!)).toBeLessThanOrEqual(0.01 * shares[i]!)
      expect(Math.abs(at * top - MEDIANS[h][p])).toBeLessThanOrEqual(0.01 * MEDIANS[h][p])
    })
  })

  it.each(HORMONES)('%s: relative from just above 0 to its own highest (1), no overshoot, one cycle into the next', (h) => {
    const levels = sample(h).map((s) => s.level)
    // Never above its highest median (no overshoot); sampled, so within a hair of it.
    expect(Math.max(...levels)).toBeLessThanOrEqual(1 + 1e-12)
    expect(Math.max(...levels)).toBeGreaterThan(0.999)
    expect(Math.min(...levels)).toBeGreaterThan(0)
    const curve = makeCurve(h)
    expect(curve(0)).toBeCloseTo(curve(CYCLE_DAYS), 12)
    expect(curve(CYCLE_DAYS + 3)).toBeCloseTo(curve(3), 12)
    // No jump anywhere (the line is continuous through the wrap).
    for (let i = 1; i < levels.length; i++) expect(Math.abs(levels[i]! - levels[i - 1]!)).toBeLessThan(0.08)
  })

  it('LH rises to its highest on the egg’s day (14) and falls again within days', () => {
    const lh = makeCurve('lh')
    expect(peakDay('lh')).toBe(OVULATION_DAY)
    // Rising through the days before, falling through the days after.
    for (let d = OVULATION_DAY - 4; d < OVULATION_DAY; d += 0.25) expect(lh(d + 0.25)).toBeGreaterThan(lh(d))
    for (let d = OVULATION_DAY; d < OVULATION_DAY + 4; d += 0.25) expect(lh(d + 0.25)).toBeLessThan(lh(d))
    expect(lh(OVULATION_DAY)).toBeGreaterThan(2 * lh(7))
    expect(lh(OVULATION_DAY)).toBeGreaterThan(2 * lh(21))
  })

  it('progesterone stays low before the egg and is highest after it; estrogen peaks with the egg and again a little later (the chart’s sentence)', () => {
    const p = makeCurve('progesterone')
    // Low from the end of the period to the egg (it falls from the last cycle's over days 1–2).
    for (let d = 3; d <= 13; d++) expect(p(d)).toBeLessThan(0.05)
    expect(p(1)).toBeLessThan(p(CYCLE_DAYS - 1))
    expect(peakDay('progesterone')).toBeGreaterThan(OVULATION_DAY + 5)
    expect(Math.round(peakDay('progesterone'))).toBe(22)
    expect(peakDay('estrogen')).toBe(OVULATION_DAY)
    const e2 = sample('estrogen').filter((s) => s.day > 17 && s.day < 25)
    const hump = e2.reduce((a, b) => (b.level > a.level ? b : a))
    expect(Math.round(hump.day)).toBe(22)
    expect(hump.level).toBeLessThan(1)
    expect(text('sys.reproduction.cycle.alt')).toContain('around day 22')
    expect(text('sys.reproduction.cycle.alt')).toContain('LH rises sharply to its highest on day 14')
  })
})

describe('the book’s facts (NCERT, read for R-1)', () => {
  it('Class 9 p. 221: cycles of 21–35 days, often about 28; menstruation 3 to 7 days; the diagram’s day 14 and days 1–5', () => {
    expect(CYCLE_RANGE).toEqual([21, 35])
    expect(MENSTRUATION_RANGE).toEqual([3, 7])
    expect(MENSTRUATION_DRAWN).toEqual([1, 5])
    expect(text('sys.reproduction.cycle.differ')).toBe(
      'Cycles differ: NCERT Class 9 says 21–35 days, often about 28. Menstruation usually lasts 3 to 7 days.',
    )
    expect(text('sys.reproduction.cycle.egg')).toContain('Day 14')
  })

  it('Class 8 p. 80: the height table and its worked example (9 years, 120 cm → 160 cm)', () => {
    expect(HEIGHT_TABLE.map((r) => r.age)).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18])
    expect(HEIGHT_TABLE.map((r) => r.boys)).toEqual([72, 75, 78, 81, 84, 88, 92, 95, 98, 99, 100])
    expect(HEIGHT_TABLE.map((r) => r.girls)).toEqual([77, 81, 84, 88, 91, 95, 98, 99, 99.5, 100, 100])
    // "by the age 11, a boy has reached 81% of his probable full height, while a girl has reached 88%".
    expect(HEIGHT_TABLE.find((r) => r.age === 11)).toMatchObject({ boys: 81, girls: 88 })
    const row = HEIGHT_TABLE.find((r) => r.age === HEIGHT_EXAMPLE.age)!
    expect(fullHeightCm(HEIGHT_EXAMPLE.heightCm, row[HEIGHT_EXAMPLE.who])).toBe(160)
    expect(text('sys.reproduction.height.example')).toContain('120 × 100 ÷ 75 = {{cm}} cm')
  })
})

describe('the row, its pack and its lesson (R-1)', () => {
  it('is the reproduction pack’s, public behind the teacher switch (R117), never drawn on the body, tagged Model estimate', () => {
    expect(systemOf('reproduction')).toBe(REPRODUCTION)
    expect(PACK_OF.reproduction).toBe('reproduction')
    expect(REPRODUCTION).toMatchObject({ public: true, teacherSwitch: true, draw: 'panels', tag: 'assumption', inputs: [], slots: [] })
  })

  it('its pack brings the Now line, the panels in the graph column’s place and its English; no rows, no drawing', async () => {
    const pack = PACKS.reproduction!
    expect((await pack.rows()).default).toEqual([])
    const ui = (await pack.ui!()).default.reproduction!
    expect(ui.card).toBeTypeOf('function')
    expect(ui.now).toBeTypeOf('function')
    expect(ui.moments({} as never)).toEqual([])
    expect((await pack.drawing!()).default).toEqual({})
    expect(pack.text).toBeTypeOf('function')
  })

  it('takes no input and keeps no dates: the panels have no field, no date and no storage', () => {
    const src = ['Panels.tsx', 'ui.tsx', 'data.ts'].map((f) => readFileSync(new URL(`./${f}`, import.meta.url), 'utf8')).join('\n')
    expect(src).not.toMatch(/<input|<textarea|<select|contentEditable/)
    expect(src).not.toMatch(/new Date|Date\.now|localStorage|sessionStorage|writePref/)
  })

  it('Science lists its sources (the data’s own, in its order)', () => {
    expect(SYSTEM_SOURCES.reproduction).toEqual(REPRO_SOURCE_IDS)
  })

  it('its lesson stub (v3.2) opens the hormone panel from a link, with its title and question', () => {
    expect(REPRODUCTION_LESSON).toMatchObject({ release: 'v3.2', layer: 'reproduction', slot: 'cycle', t: 0 })
    expect(text(REPRODUCTION_LESSON.title)).toBe('Why does the lining of the uterus build up every month?')
    expect(text(REPRODUCTION_LESSON.question)).toBeTruthy()
    const s = decodeShareState(encodeShareState({ a: REPRODUCTION_LESSON.meal, b: [], t: 0, layer: 'reproduction', act: [], bact: [] }))
    expect(s.layer).toBe('reproduction')
  })
})
