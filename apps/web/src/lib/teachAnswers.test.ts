import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MODEL_VERSION, PARAMS, valueAt, type ActiveSignalId, type MealItem, type RunResult } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import en from '../i18n/en.json'
import hi from '../i18n/hi.json'
import { lookupFood } from '../data/foods.ts'
import { LESSONS, TASKS } from './presets.ts'
import { bloodData, summaryData } from './summary.ts'

// The app's i18n setup needs a browser; the food names only need `localized`.
vi.mock('../i18n/index.ts', () => ({
  localized: (text: Record<string, string> | undefined, lang: string) => text?.[lang] ?? text?.en ?? '',
}))

/**
 * The Teach page's "Answers for teachers" (WP-19) are typed into en.json and hi.json, so they are
 * checked here against the model: if a curve moves, this fails and the answers are rewritten.
 * Each question is answered from the screen its link opens (lib/presets.ts TASKS).
 */
const run = (items: MealItem[]) => simulate({ items }, { lookup: lookupFood, particles: 0 })
const at = (sim: RunResult, id: ActiveSignalId, min: number) => valueAt(sim.signals.get(id)!, min)
const [halfLeft, , bloodAt1h, energyAt3h] = TASKS
const cola = run(halfLeft!.meal)
const burgerFries = run(energyAt3h!.kept!)
const glucose = cola.moments.get('event.glucosePeak')!

/** The numbers in each answer, as written (both languages carry the same ones). */
const numbers = (answers: string[]) => answers.map((a) => [...a.matchAll(/\d+/g)].map((m) => Number(m[0])))

describe('Teach: answers for teachers', () => {
  it('both languages give the same numbers', () => {
    expect(numbers(hi.teach.answers)).toEqual(numbers(en.teach.answers))
  })

  const [a1, a2, a3, a4] = numbers(en.teach.answers)

  it('1: when half of the cola has left the stomach (and the accepted range holds it)', () => {
    const half = cola.moments.get('event.stomachHalfEmpty')!.atMin!
    expect(a1).toEqual([Math.round(half), 30, 40])
    expect(half).toBeGreaterThanOrEqual(30)
    expect(half).toBeLessThanOrEqual(40)
  })

  it('2: cola leaves about 8 times faster than a burger with fries, and the reason is that it is a drink', () => {
    const v = summaryData(cola, burgerFries)
    expect(v.kind === 'pair' && v.fast).toBe('run')
    expect(v.kind === 'pair' && v.reason).toBe('drink')
    expect(a2).toEqual([v.kind === 'pair' ? Math.round(v.ratio) : NaN])
  })

  it('3: blood sugar 1 hour after the cola, its highest, and when', () => {
    const at1h = at(run(bloodAt1h!.meal), 'blood.glucose', 60)
    expect(a3![0]).toBe(Math.round(at1h))
    expect(at1h).toBeGreaterThanOrEqual(a3![1]!)
    expect(at1h).toBeLessThanOrEqual(a3![2]!)
    expect(a3!.slice(3)).toEqual([Math.round(at(cola, 'blood.glucose', glucose.atMin!)), Math.round(glucose.atMin!)])
  })

  it('4: at 3 hours the body uses more than comes in from the cola', () => {
    const coming = at(cola, 'energy.inRate', 180)
    const used = at(cola, 'energy.usedRate', 180)
    expect(coming).toBeLessThan(1)
    expect(used).toBeGreaterThan(coming)
    expect(a4).toEqual([Math.round(used)])
  })
})

describe('Teach: the note under "One cola or four" (council round 3)', () => {
  const lesson = LESSONS.find((l) => l.key === 'colaFour')!
  const d = bloodData(run(lesson.meal), run(lesson.kept!))!
  const [note] = numbers([en.teach.lessonNotes.colaFour])

  it('both languages give the same numbers', () => {
    expect(numbers([hi.teach.lessonNotes.colaFour])).toEqual([note])
  })

  it('the same highest point, and blood sugar raised longer by as much as the model says', () => {
    expect(d.samePeak).toBe(true)
    const longer = Math.round(d.longerMin / 5) * 5
    expect(note).toEqual([d.peak, Math.floor(longer / 60), longer % 60])
  })
})

describe('Teach: "Numbers changed in this version" (E-3a)', () => {
  // The reviewed diff's snapshots (packages/engine/scripts/calibration, `npm run calibrate -- --snapshot`).
  type Snap = { meals: Record<string, { energyInKcal48h: number; glucosePeakRise: number | null }> }
  const snap = (v: number) =>
    JSON.parse(
      readFileSync(fileURLToPath(new URL(`../../../../packages/engine/scripts/calibration/v${v}.json`, import.meta.url)), 'utf8'),
    ) as Snap
  const [now, before] = [snap(MODEL_VERSION), snap(MODEL_VERSION - 1)]
  const [n] = numbers([en.teach.changed])

  it('the shares absorbed are the model’s (water, carbohydrate, protein, fat)', () => {
    const a = PARAMS.absorbedInSmallIntestine
    expect([n![0], n![2], n![4], n![6]]).toEqual([a.water, a.carbs, a.protein, a.fat].map((x) => Math.round(x * 100)))
  })

  it('energy in is about 2 % higher and blood sugar peaks at most 1 mg/dL higher, on every reviewed meal', () => {
    const [energyPct, peakMgDl] = n!.slice(-2)
    for (const [meal, b] of Object.entries(now.meals)) {
      const a = before.meals[meal]!
      if (a.energyInKcal48h > 0) expect(Math.abs((b.energyInKcal48h / a.energyInKcal48h - 1) * 100 - energyPct!), meal).toBeLessThan(1)
      if (a.glucosePeakRise !== null && b.glucosePeakRise !== null)
        expect(Math.abs(b.glucosePeakRise - a.glucosePeakRise), meal).toBeLessThanOrEqual(peakMgDl!)
    }
  })

  it('the snapshot is the model today', () => {
    expect(now.meals['cola:1']!.energyInKcal48h).toBeCloseTo(at(cola, 'energy.inTotal', 48 * 60), 1)
  })
})
