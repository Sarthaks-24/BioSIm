import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACTIVE_SIGNAL_IDS,
  PARAMS,
  PROFILES,
  buildMeal,
  decodeMeal,
  findFirst,
  indexAt,
  mealLocation,
  mealLocationAt,
  parseFood,
  riseAboveFasting,
  shareOfMealInStomach,
  stomachFraction,
  valueAt,
  windowOf,
  type RunResult,
} from '../src/index.ts'
import {
  BREATHING_SIGNAL_IDS,
  EFFORT_SIGNAL_IDS,
  HUMAN_MODULES,
  KIDNEY_SIGNAL_IDS,
  RUN_EVENT_IDS,
  energySignals,
  runModules,
  simulate,
} from '../src/run.ts'

/**
 * The signal table (core/table.ts) is a COPY of the modules' arrays under catalog IDs: no new
 * physiology. These tests check the copy, the series helpers (core/signal.ts) and the derived
 * views (core/derive.ts). The physiology itself is checked in model.test.ts.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => foods.find((f) => f.id === id)
const run = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookup))
/** The run's modules again, for the arrays they wrote (Float64, before the table's copy). */
const modulesOf = (sim: RunResult) =>
  runModules(HUMAN_MODULES, {
    input: { meal: sim.meal, activity: sim.activity },
    params: PARAMS,
    profile: PROFILES[sim.profile],
    n: sim.length,
    stepMin: sim.stepMin,
  })

describe('signal table', () => {
  it('gut.stomach.contentG = liquid + solid grams within 0.1 g at every minute, for every food', () => {
    expect(foods).toHaveLength(15)
    for (const f of foods) {
      const sim = run(`${f.id}:1`)
      const content = sim.signals.get('gut.stomach.contentG')!.values
      expect(content).toHaveLength(sim.length)
      // The largest miss and where, one assertion per food (an assertion per minute was 2 s, R68).
      let worst = { miss: 0, at: 0 }
      for (let i = 0; i < sim.length; i++) {
        const miss = Math.abs(
          content[i]! - (sim.signals.get('gut.stomach.liquidG')!.values[i]! + sim.signals.get('gut.stomach.solidG')!.values[i]!),
        )
        if (miss > worst.miss) worst = { miss, at: i }
      }
      expect(worst.miss, `${f.id} @${worst.at}`).toBeLessThanOrEqual(0.1)
    }
  })

  it('every series is a Float32 copy of the array its module wrote, and its band of the band', () => {
    const sim = run('cheeseburger:1,fries:1,cola:1')
    const out = modulesOf(sim)
    expect([...sim.signals.keys()]).toEqual([...ACTIVE_SIGNAL_IDS, ...BREATHING_SIGNAL_IDS, ...EFFORT_SIGNAL_IDS, ...KIDNEY_SIGNAL_IDS])
    for (const [id, s] of sim.signals) {
      const w = out.signals.get(id)!
      expect(s.meta.id).toBe(id)
      expect(s.values).toEqual(Float32Array.from(w.values))
      expect(s.low).toEqual(w.band && Float32Array.from(w.band.low))
      expect(s.high).toEqual(w.band && Float32Array.from(w.band.high))
    }
    expect(sim.signals.get('blood.glucose')!.low).toBeDefined()
    expect(sim.signals.get('gut.small.contentG')!.low).toBeUndefined()
  })

  it('the energy series are Float32 copies of energySignals() for the run’s profile', () => {
    const sim = run('cheeseburger:1,fries:1,cola:1')
    const out = modulesOf(sim)
    const absorbed = (id: 'gut.absorbed.carbsG' | 'gut.absorbed.proteinG' | 'gut.absorbed.fatG') => out.signals.get(id)!.values
    const e = energySignals(
      { carbs: absorbed('gut.absorbed.carbsG'), protein: absorbed('gut.absorbed.proteinG'), fat: absorbed('gut.absorbed.fatG') },
      PROFILES[sim.profile],
      sim.stepMin,
      PARAMS,
    )
    for (const k of ['inRate', 'inTotal', 'usedRate', 'usedTotal'] as const) {
      const s = sim.signals.get(`energy.${k}`)!
      expect(s.meta.id).toBe(`energy.${k}`)
      expect(s.values).toEqual(Float32Array.from(e[k]))
    }
  })

  it('series carry their sources plus food:<id> for every food in the meal', () => {
    const s = run('roti:1,dal:1').signals.get('blood.glucose')!
    expect(s.sourceIds).toEqual([...s.meta.sourceIds, 'food:roti', 'food:dal'])
  })

  it('run shape: rhythms empty, horizon and step from PARAMS', () => {
    const sim = run('cola:1')
    expect(sim.rhythms.size).toBe(0)
    expect(sim.horizonMin).toBe(PARAMS.horizonMin)
    expect(sim.stepMin).toBe(PARAMS.stepMin)
  })
})

describe('moments', () => {
  it('every catalog event is present, with today’s event values', () => {
    const sim = run('cheeseburger:1,fries:1')
    expect([...sim.moments.keys()].sort()).toEqual([...RUN_EVENT_IDS].sort())
    const e = sim.events
    expect(sim.moments.get('event.stomachHalfEmpty')!.atMin).toBe(e.stomachHalfEmptyMin)
    expect(sim.moments.get('event.glucosePeak')!.atMin).toBe(e.glucosePeak!.timeMin)
    expect(sim.moments.get('event.glucoseBackToBase')!.atMin).toBe(e.glucoseBackToBaseMin)
    expect(sim.moments.get('event.mostlyAbsorbed')!.atMin).toBe(e.absorptionMostlyDoneMin)
    const left = sim.moments.get('event.firstLeftovers')!
    expect([left.low, left.atMin, left.high]).toEqual([e.firstExit!.low, e.firstExit!.typical, e.firstExit!.high])
  })

  it('events that do not happen are null, without range edges', () => {
    const sim = run('water:1')
    for (const id of ['event.glucosePeak', 'event.glucoseBackToBase', 'event.mostlyAbsorbed', 'event.firstLeftovers'] as const) {
      const p = sim.moments.get(id)!
      expect(p.atMin, id).toBeNull()
      expect(p.low, id).toBeUndefined()
    }
  })

  it('back to base: the first minute after the peak within backToBaseMgDl of fasting', () => {
    const sim = run('white-rice:1')
    const at = sim.events.glucoseBackToBaseMin!
    const limit = PARAMS.glucose.fastingMgDl + PARAMS.glucose.backToBaseMgDl
    expect(sim.signals.get('blood.glucose')!.values[indexAt(sim, at)]!).toBeLessThanOrEqual(limit)
    for (let t = sim.events.glucosePeak!.timeMin; t < at; t++)
      expect(sim.signals.get('blood.glucose')!.values[indexAt(sim, t)]!).toBeGreaterThan(limit)
  })
})

describe('series helpers', () => {
  const s = { values: Float32Array.from([0, 10, 20, 5, 5, 40, 0, 1]) }

  it('valueAt interpolates and clamps', () => {
    expect(valueAt(s, 1.5)).toBeCloseTo(15)
    expect(valueAt(s, -3)).toBe(0)
    expect(valueAt(s, 99)).toBe(1)
    expect(valueAt(s, 3, 2)).toBeCloseTo(15) // minute 3 at 2-min steps = index 1.5
  })

  it('findFirst finds the first matching minute from a start, or null', () => {
    expect(findFirst(s, (v) => v >= 20)).toBe(2)
    expect(findFirst(s, (v) => v >= 20, 3)).toBe(5)
    expect(findFirst(s, (v) => v > 100)).toBeNull()
    expect(findFirst(s, (v) => v >= 20, 0, 5)).toBe(10)
  })

  it('windowOf returns every point when it fits, and keeps peaks when it decimates', () => {
    const all = windowOf(s, 0, 7, 100)
    expect([...all.t]).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    const few = windowOf(s, 0, 7, 4)
    expect(few.v.length).toBeLessThanOrEqual(4)
    expect(Math.max(...few.v)).toBe(40)
    expect(Math.min(...few.v)).toBe(0)
    for (let k = 1; k < few.t.length; k++) expect(few.t[k]!).toBeGreaterThan(few.t[k - 1]!)
    expect(windowOf(s, 5, 2, 10).t).toHaveLength(0)
  })

  it('windowOf on a real run stays within the point budget', () => {
    const g = run('cola:1').signals.get('blood.glucose')!
    const w = windowOf(g, 0, PARAMS.horizonMin, 300)
    expect(w.t.length).toBeLessThanOrEqual(300)
    expect(Math.max(...w.v)).toBe(Math.max(...g.values))
  })
})

describe('derived views (helpers, not IDs)', () => {
  it('riseAboveFasting is glucose minus fasting', () => {
    const sim = run('cola:1')
    const rise = riseAboveFasting(sim.signals.get('blood.glucose')!, PARAMS.glucose.fastingMgDl)
    const peak = sim.events.glucosePeak!
    expect(rise[peak.timeMin]!).toBeCloseTo(peak.riseMgDl.typical, 3)
  })

  it('shareOfMealInStomach and mealLocationAt match today’s stomachFraction and mealLocation', () => {
    const sim = run('cheeseburger:1,fries:1,cola:1')
    for (const t of [0, 30, 90, 240, 600]) {
      expect(shareOfMealInStomach(sim, t)).toBe(stomachFraction(sim, indexAt(sim, t)))
      expect(mealLocationAt(sim, t)).toEqual(mealLocation(sim, indexAt(sim, t)))
    }
  })
})
