import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  EVENT_IDS,
  PARAMS,
  buildMeal,
  decodeMeal,
  findFirst,
  indexAt,
  mealLocation,
  mealLocationAt,
  parseFood,
  riseAboveFasting,
  shareOfMealInStomach,
  simulate,
  stomachFraction,
  valueAt,
  window,
} from '../src/index.ts'

/**
 * The signal table (core/table.ts) is a COPY of today's arrays under catalog IDs: no new
 * physiology. These tests check the copy, the series helpers (core/signal.ts) and the derived
 * views (core/derive.ts). The physiology itself is checked in model.test.ts.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => foods.find((f) => f.id === id)
const run = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookup))

describe('signal table', () => {
  it('gut.stomach.contentG = liquid + solid grams within 0.1 g at every minute, for every food', () => {
    expect(foods).toHaveLength(15)
    for (const f of foods) {
      const sim = run(`${f.id}:1`)
      const content = sim.signals.get('gut.stomach.contentG')!.values
      expect(content).toHaveLength(sim.length)
      for (let i = 0; i < sim.length; i++) {
        expect(Math.abs(content[i]! - (sim.stomachLiquidG[i]! + sim.stomachSolidG[i]!)), `${f.id} @${i}`).toBeLessThanOrEqual(0.1)
      }
    }
  })

  it('every other series is a Float32 copy of the engine array it names', () => {
    const sim = run('cheeseburger:1,fries:1,cola:1')
    const pairs: [string, Float64Array][] = [
      ['gut.stomach.liquidG', sim.stomachLiquidG],
      ['gut.stomach.solidG', sim.stomachSolidG],
      ['gut.small.contentG', sim.smallIntestineG],
      ['gut.colon.contentG', sim.colonG],
      ['gut.absorbed.carbsG', sim.absorbedG.carbs],
      ['gut.absorbed.proteinG', sim.absorbedG.protein],
      ['gut.absorbed.fatG', sim.absorbedG.fat],
      ['gut.absorbed.waterG', sim.absorbedG.water],
      ['gut.absorbed.fibreG', sim.absorbedG.fiber],
      ['gut.leftBodyG', sim.excretedG],
      ['blood.glucose', sim.glucose.typical],
    ]
    for (const [id, arr] of pairs) {
      const s = sim.signals.get(id as never)!
      expect(s.meta.id).toBe(id)
      expect(s.values).toEqual(Float32Array.from(arr))
    }
    const g = sim.signals.get('blood.glucose')!
    expect(g.low).toEqual(Float32Array.from(sim.glucose.low))
    expect(g.high).toEqual(Float32Array.from(sim.glucose.high))
    expect(sim.signals.get('gut.small.contentG')!.low).toBeUndefined()
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
    expect([...sim.moments.keys()].sort()).toEqual([...EVENT_IDS].sort())
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
    expect(sim.glucose.typical[indexAt(sim, at)]!).toBeLessThanOrEqual(limit)
    for (let t = sim.events.glucosePeak!.timeMin; t < at; t++) expect(sim.glucose.typical[indexAt(sim, t)]!).toBeGreaterThan(limit)
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

  it('window returns every point when it fits, and keeps peaks when it decimates', () => {
    const all = window(s, 0, 7, 100)
    expect([...all.t]).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    const few = window(s, 0, 7, 4)
    expect(few.v.length).toBeLessThanOrEqual(4)
    expect(Math.max(...few.v)).toBe(40)
    expect(Math.min(...few.v)).toBe(0)
    for (let k = 1; k < few.t.length; k++) expect(few.t[k]!).toBeGreaterThan(few.t[k - 1]!)
    expect(window(s, 5, 2, 10).t).toHaveLength(0)
  })

  it('window on a real run stays within the point budget', () => {
    const g = run('cola:1').signals.get('blood.glucose')!
    const w = window(g, 0, PARAMS.horizonMin, 300)
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
