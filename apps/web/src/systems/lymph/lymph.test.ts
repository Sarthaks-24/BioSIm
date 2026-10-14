import { describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { valueAt, type MealItem, type RunResult } from '@lifepeek/engine'
import { PACK_PARAMS, simulate } from '@lifepeek/engine/run'
import en from '../../i18n/en.json'
import { lookupFood } from '../../data/foods.ts'
import { FRAMINGS } from '../../anatomy/human/base.ts'
import { LIMB_KIT } from '../../anatomy/human/kit.ts'
import { LYMPH_ROUTE, MAIN_DUCT, NECK_VEIN_JOIN, TRUNK_VESSELS } from '../../anatomy/human/lymph.ts'
import { PARTICLE_EDGE } from '../../anatomy/tones/base.ts'
import { LYMPH_TONE } from '../../anatomy/tones/lymph.ts'
import { NUTRIENT_COLOR } from '../../lib/colors.ts'
import { formatSignal } from '../../lib/formatSignal.ts'
import { LYMPH_LESSON } from './lesson.ts'
import {
  BLOOD_FAT,
  DOTS_MIN_G_PER_MIN,
  FASTING_MG_DL,
  INDIA_MG_DL,
  MAX_DOTS,
  PEAK,
  ROAD,
  dotShown,
  fatDots,
  momentAt,
  UP_MIN,
  upMin,
  seriesOf,
} from './fat.ts'
import { highestOf, lymphStripSummary, lymphSummary, valueText } from './summary.ts'

// The flat body's frame, without its drawing code's page APIs (FlatBody imports the stage).
vi.mock('../../i18n/index.ts', () => ({ localized: () => '' }))
const { frame } = await import('../../flat/FlatBody.tsx')
const { DOT_EDGE, fatRoute, pointAlong } = await import('./LymphLayer.tsx')
const UIS = (await import('./ui.tsx')).default

/**
 * Lymph & germ defence's graphs, words and fat dots (U-5; model §2.10, anatomy plan §2.7, ui-ux §6,
 * R3, R90): every number the pack writes out is the engine's, every sentence is true of its run, a
 * meal without fat never draws a fat dot, and the dots stop once the fat has gone by.
 */

/** English text at a key, filled like i18next ({{x}}). */
const t = ((key: string, vars: Record<string, unknown> = {}) => {
  const text = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)
  return typeof text === 'string' ? text.replace(/{{(\w+)}}/g, (_, v: string) => String(vars[v])) : key
}) as unknown as TFunction

const run = (items: MealItem[]): RunResult => simulate({ items }, { lookup: lookupFood, particles: 0 })
const at = (r: RunResult, id: string, min: number) => valueAt(seriesOf(r, id)!, min, r.stepMin)
const dotsAt = (r: RunResult, min: number) => fatDots(at(r, ROAD, min))
/** The numbers a sentence says, in order. */
const numbers = (s: string | undefined) => [...(s ?? '').matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))

const cola = run([{ foodId: 'cola', servings: 1 }])
const milk = run([{ foodId: 'milk', servings: 1 }])
const roti = run([{ foodId: 'roti', servings: 1 }])
const burger = run(LYMPH_LESSON.meal)

describe('what the pack writes out matches the model and the stage', () => {
  it('fasting blood fat is the engine’s, and the Indian baseline is the one the texts give (R90, Joshi 2014)', () => {
    expect(FASTING_MG_DL).toBe(PACK_PARAMS.lymph.fastingMgDl)
    expect(at(cola, BLOOD_FAT, 0)).toBe(FASTING_MG_DL)
    expect(numbers(en.limits.bloodFatIndia)).toEqual([FASTING_MG_DL, INDIA_MG_DL, 2014])
    expect(numbers(en.sys.lymph.fasting)[0]).toBe(FASTING_MG_DL)
  })

  it('the fat dots are digestion’s fat particle: its colour and its dark edge', () => {
    expect(LYMPH_TONE.fat).toBe(NUTRIENT_COLOR.fat)
    expect(DOT_EDGE).toBe(PARTICLE_EDGE)
  })

  it('numbers are written as the stage writes them (lib/formatSignal.ts)', () => {
    for (const id of [ROAD, BLOOD_FAT]) {
      const meta = seriesOf(burger, id)!.meta
      for (const v of [0, 0.004, 0.0617, 0.15, 80, 101.3, 186.6]) expect(valueText(v, meta, t, 'en')).toBe(formatSignal(v, meta, t, 'en'))
    }
  })
})

describe('fat dots on the lymph route (anatomy plan §2.7)', () => {
  it('none below the least fat flow, at least one above it, at most MAX_DOTS, more with more fat', () => {
    expect([fatDots(0), fatDots(DOTS_MIN_G_PER_MIN * 0.99), fatDots(Number.NaN)]).toEqual([0, 0, 0])
    expect(fatDots(DOTS_MIN_G_PER_MIN)).toBe(1)
    expect(fatDots(1)).toBe(MAX_DOTS)
    let last = 0
    for (let f = 0; f <= 0.2; f += 0.001) {
      expect(fatDots(f)).toBeGreaterThanOrEqual(last)
      last = fatDots(f)
    }
  })

  it('`n` dots show, spread over the places along the route', () => {
    for (let n = 0; n <= MAX_DOTS; n++) expect(Array.from({ length: MAX_DOTS }, (_, i) => dotShown(i, n)).filter(Boolean).length).toBe(n)
  })

  it('no fat → no rise and no dots, at any minute (cola)', () => {
    expect(cola.meal.total.fatG).toBe(0)
    for (let m = 0; m <= cola.horizonMin; m += 5) {
      expect(dotsAt(cola, m), `${m} min`).toBe(0)
      expect(at(cola, BLOOD_FAT, m)).toBe(FASTING_MG_DL)
    }
    expect(momentAt(cola, PEAK)).toBeNull()
    expect(UIS.lymph.moments(cola)).toEqual([])
  })

  it('with fat, dots while lymph carries it; they stop once the gut has taken in the last of it, and never come back (milk)', () => {
    expect(dotsAt(milk, 120)).toBeGreaterThan(0)
    const absorb = seriesOf(milk, 'gut.absorbRate.fat')!.values
    const flow = seriesOf(milk, ROAD)!.values
    let lastAbsorbed = 0
    absorb.forEach((v, i) => v > 1e-4 && (lastAbsorbed = i * milk.stepMin))
    let lastDot = -1
    flow.forEach((v, i) => fatDots(v) > 0 && (lastDot = i * milk.stepMin))
    // Lymph carries the last fat on for a while (about half an hour's lag), then no more dots.
    expect(lastDot).toBeGreaterThan(0)
    expect(lastDot).toBeLessThanOrEqual(lastAbsorbed + 180)
    expect(dotsAt(milk, 8 * 60)).toBe(0)
    for (let i = lastDot + 1; i < flow.length; i++) expect(fatDots(flow[i]!)).toBe(0)
  })

  it('the lesson opens on dots: the burger’s fat is on the road at 4 h', () => {
    expect(dotsAt(burger, LYMPH_LESSON.t)).toBeGreaterThanOrEqual(3)
  })

  it('the route runs from the gut, past the sac and up the main duct, to where it joins the left neck vein', () => {
    const [w, h] = [400, 600]
    const view = FRAMINGS.full
    const { X, Y } = frame(w, h, view)
    const pts = fatRoute(LIMB_KIT, w, h, view)
    expect(LYMPH_ROUTE.route).toBe('lymph')
    // The gut's vessel is the map's own (TRUNK_VESSELS) and the duct is the map's.
    expect(TRUNK_VESSELS.some((v) => v.pts === LYMPH_ROUTE.flat)).toBe(true)
    expect(LYMPH_ROUTE.duct).toBe(MAIN_DUCT)
    const [gx, gy] = LYMPH_ROUTE.flat[0]!
    expect(pts[0]![0]).toBeCloseTo(X(gx), 6)
    expect(pts[0]![1]).toBeCloseTo(Y(gy), 6)
    // It ends at the neck vein (z 0: no perspective), higher on the picture than it starts.
    expect(pts.at(-1)![0]).toBeCloseTo(X(NECK_VEIN_JOIN.x), 6)
    expect(pts.at(-1)![1]).toBeCloseTo(Y(NECK_VEIN_JOIN.y), 6)
    expect(pts.at(-1)![1]).toBeLessThan(pts[0]![1])
    const cum = [0]
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]))
    expect(pointAlong(pts, cum, 0)).toEqual(pts[0])
    const end = pointAlong(pts, cum, 1)
    expect(end[0]).toBeCloseTo(pts.at(-1)![0], 6)
    expect(end[1]).toBeCloseTo(pts.at(-1)![1], 6)
  })
})

describe('the words are true of the run (ui-ux §6, R90)', () => {
  it('a meal without fat says lymph carries almost none, and blood fat stays at fasting', () => {
    const s = lymphSummary(cola, null, t, 'en')!
    expect(s.headline).toBe(en.sys.lymph.summary.none)
    expect(numbers(s.reason)).toEqual([FASTING_MG_DL])
    expect(lymphStripSummary(BLOOD_FAT as never, cola, t, 'en')).toBe('Blood fat (triglyceride): about 80 mg/dL all the way.')
  })

  it('two rotis: a little fat, its highest and when', () => {
    const s = lymphSummary(roti, null, t, 'en')!
    const top = highestOf(seriesOf(roti, BLOOD_FAT)!, roti.stepMin)
    expect(top.atMin).toBe(momentAt(roti, PEAK))
    expect(s.headline).toBe(`Blood fat highest: about ${Math.round(top.value)} mg/dL, at 2 h 25 min (80 mg/dL before eating).`)
    expect(numbers(s.reason)).toEqual([roti.meal.total.fatG])
  })

  it('a cheeseburger with fries: blood fat stays up for hours, so the words don’t name its highest minute (R90)', () => {
    const fat = seriesOf(burger, BLOOD_FAT)!
    expect(upMin(fat, burger.stepMin)).toBeGreaterThanOrEqual(UP_MIN)
    // Not two rotis, an egg or a glass of milk: their blood fat is back down within a few hours.
    for (const r of [roti, milk, run([{ foodId: 'boiled-egg', servings: 1 }])]) expect(upMin(seriesOf(r, BLOOD_FAT)!, r.stepMin)).toBeLessThan(UP_MIN)
    const s = lymphSummary(burger, null, t, 'en')!
    const top = Math.round(highestOf(fat, burger.stepMin).value)
    expect(s.headline).toBe(`Blood fat rises to about ${top} mg/dL and stays up for hours (80 mg/dL before eating).`)
    expect(s.key).toEqual({ text: String(top), line: 'run' })
    expect(lymphStripSummary(BLOOD_FAT as never, burger, t, 'en')).toBe(
      `Blood fat (triglyceride): 80 mg/dL at the start, up to ${top} mg/dL, and it stays up for hours.`,
    )
  })

  it('beside a kept plan: each one’s highest blood fat and the fat each brings', () => {
    const s = lymphSummary(burger, roti, t, 'en')!
    const top = (r: RunResult) => Math.round(Math.max(...seriesOf(r, BLOOD_FAT)!.values))
    expect(numbers(s.headline)).toEqual([top(burger), top(roti)])
    expect(numbers(s.reason)).toEqual([Math.round(burger.meal.total.fatG), roti.meal.total.fatG])
    // Two of the same: about the same.
    expect(lymphSummary(roti, roti, t, 'en')!.headline).toBe(`Blood fat is about the same in both: at the most about ${top(roti)} mg/dL.`)
  })

  it('Fat’s road: from nothing to its most and when', () => {
    const top = highestOf(seriesOf(milk, ROAD)!, milk.stepMin)
    expect(lymphStripSummary(ROAD as never, milk, t, 'en')).toBe(
      `Fat reaching the blood by lymph: 0 g/min at the start, ${top.value.toFixed(2)} g/min at the most, at 1 h 30 min.`,
    )
    expect(Math.round(top.atMin / 5) * 5).toBe(90)
  })

  it('no word scores blood fat: no "high", "bad" or "danger" in the pack’s words (no band, no threshold line)', () => {
    const words = JSON.stringify([en.sys.lymph.summary, en.sys.lymph.graph, en.sys.lymph.now, en.signals.blood.triglyceride.name])
    expect(words).not.toMatch(/\b(high|bad|danger|unhealthy|too much)\b/i)
  })
})

describe('the lesson (content-i18n §8.1, R18)', () => {
  it('v3.1, on Lymph’s Fat’s road at 4 h, a cheeseburger with fries against two rotis', () => {
    expect(LYMPH_LESSON).toMatchObject({ key: 'fatRoad', release: 'v3.1', layer: 'lymph', slot: 'road', t: 240 })
    expect(LYMPH_LESSON.kept).toEqual([{ foodId: 'roti', servings: 1 }])
    expect(en.teach.lessons.fatRoad).toBe('How does fat reach the blood?')
  })
})
