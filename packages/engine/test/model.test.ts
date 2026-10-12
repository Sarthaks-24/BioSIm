import { describe, expect, it } from 'vitest'
import { activeStage, buildMeal, indexAt, simulate, type Simulation } from '../src/index.ts'
import { lookup } from './fixtures.ts'

/**
 * Golden tests: the model must reproduce published physiology for reference meals.
 * If you change PARAMS and these fail, either the change is wrong or the reference
 * ranges below need a citation explaining why they moved. See docs/MODEL.md.
 */

const run = (...ids: string[]) =>
  simulate(
    buildMeal(
      ids.map((foodId) => ({ foodId, servings: 1 })),
      lookup,
    ),
  )

const stomachPct = (sim: Simulation, t: number) => {
  const i = indexAt(sim, t)
  return ((sim.stomachLiquidG[i]! + sim.stomachSolidG[i]!) / sim.meal.total.massG) * 100
}
const rise = (sim: Simulation, t: number) => sim.glucose.typical[indexAt(sim, t)]! - 90

describe('gastric emptying', () => {
  it('water: half-time about 10–20 minutes', () => {
    const sim = run('water-test')
    expect(sim.events.stomachHalfEmptyMin).toBeGreaterThanOrEqual(10)
    expect(sim.events.stomachHalfEmptyMin).toBeLessThanOrEqual(20)
  })

  it('standard solid test meal stays inside consensus scintigraphy norms (Abell 2008)', () => {
    const sim = run('standard-meal')
    // Normal retention: 1 h 37–90 %, 2 h 30–60 %, 4 h ≤ 10 %.
    expect(stomachPct(sim, 60 + sim.meal.eatingMin)).toBeGreaterThanOrEqual(37)
    expect(stomachPct(sim, 60 + sim.meal.eatingMin)).toBeLessThanOrEqual(90)
    expect(stomachPct(sim, 120 + sim.meal.eatingMin)).toBeGreaterThanOrEqual(30)
    expect(stomachPct(sim, 120 + sim.meal.eatingMin)).toBeLessThanOrEqual(60)
    expect(stomachPct(sim, 240 + sim.meal.eatingMin)).toBeLessThanOrEqual(10)
  })

  it('emptying order: water < sugary drink < light meal < heavy fatty meal', () => {
    const order = ['water-test', 'glucose-50', 'standard-meal', 'fatty-meal'].map((id) => run(id).events.stomachHalfEmptyMin!)
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]!)
  })

  it('a caloric drink slows the solid part of a meal eaten with it', () => {
    const alone = run('fatty-meal')
    const withDrink = run('fatty-meal', 'glucose-50')
    expect(withDrink.curves.solid.halfTimeMin).toBeGreaterThan(alone.curves.solid.halfTimeMin)
  })

  it('a heavy meal is still in the stomach at 4 h, a light one is not', () => {
    expect(stomachPct(run('fatty-meal'), 240)).toBeGreaterThan(15)
    expect(stomachPct(run('standard-meal'), 240)).toBeLessThan(10)
  })
})

describe('blood glucose', () => {
  it('50 g glucose drink: peak +30–60 mg/dL at 30–60 min, near baseline by 2 h', () => {
    const sim = run('glucose-50')
    const peak = sim.events.glucosePeak!
    expect(peak.timeMin).toBeGreaterThanOrEqual(30)
    expect(peak.timeMin).toBeLessThanOrEqual(60)
    expect(peak.riseMgDl.typical).toBeGreaterThanOrEqual(30)
    expect(peak.riseMgDl.typical).toBeLessThanOrEqual(60)
    expect(rise(sim, 120)).toBeLessThan(25)
    expect(Math.abs(rise(sim, 240))).toBeLessThan(8)
  })

  it('solid starchy meal peaks later and lower than the glucose drink', () => {
    const drink = run('glucose-50').events.glucosePeak!
    const meal = run('standard-meal').events.glucosePeak!
    expect(meal.timeMin).toBeGreaterThan(drink.timeMin)
    expect(meal.timeMin).toBeLessThanOrEqual(90)
    expect(meal.riseMgDl.typical).toBeLessThan(drink.riseMgDl.typical)
  })

  it('reproduces the glycemic index definition: white bread (GI 75) gives ~75 % of glucose 2-h area', () => {
    const iauc = (sim: Simulation) => {
      let a = 0
      for (let t = 0; t <= 120; t++) a += Math.max(0, sim.glucose.typical[t]! - 90)
      return a
    }
    const ratio = iauc(run('bread-50')) / iauc(run('glucose-50'))
    expect(ratio).toBeGreaterThan(0.7)
    expect(ratio).toBeLessThan(0.8)
  })

  it('fat and protein flatten the curve', () => {
    const light = run('standard-meal').events.glucosePeak!
    const fatty = run('fatty-meal').events.glucosePeak!
    expect(fatty.riseMgDl.typical).toBeLessThan(light.riseMgDl.typical)
    expect(fatty.timeMin).toBeGreaterThan(light.timeMin)
  })

  it('water does not change glucose', () => {
    const sim = run('water-test')
    expect(sim.events.glucosePeak).toBeNull()
    expect(rise(sim, 60)).toBeCloseTo(0, 5)
  })

  it('band always brackets the typical curve', () => {
    const sim = run('glucose-50')
    for (let i = 0; i < sim.length; i += 37) {
      expect(sim.glucose.low[i]!).toBeLessThanOrEqual(sim.glucose.typical[i]! + 1e-9)
      expect(sim.glucose.high[i]!).toBeGreaterThanOrEqual(sim.glucose.typical[i]! - 1e-9)
    }
  })
})

describe('mass balance', () => {
  it('nothing is created or lost: stomach + intestines + absorbed + excreted = eaten', () => {
    const sim = run('fatty-meal', 'glucose-50')
    // Stomach arrays hold whole-serving grams (incl. ash etc.); convert to tracked-nutrient grams.
    const tracked = (p: typeof sim.meal.total) => p.carbsG + p.proteinG + p.fatG + p.fiberG + p.waterG
    const eaten = tracked(sim.meal.total)
    for (const t of [30, 200, 600, 1500]) {
      const i = indexAt(sim, t)
      const absorbed = Object.values(sim.absorbedG).reduce((a, arr) => a + arr[i]!, 0)
      const stomach =
        (sim.stomachLiquidG[i]! / sim.meal.liquid.massG) * tracked(sim.meal.liquid) +
        (sim.stomachSolidG[i]! / sim.meal.solid.massG) * tracked(sim.meal.solid)
      const inside = stomach + sim.smallIntestineG[i]! + sim.colonG[i]!
      // Before the colon empties nothing has been excreted, so inside + absorbed must equal what was eaten.
      expect(inside + absorbed).toBeCloseTo(eaten, 0)
    }
  })

  it('fibre is never absorbed; most carbs are', () => {
    const sim = run('fatty-meal')
    const end = sim.length - 1
    expect(sim.absorbedG.fiber[end]).toBe(0)
    expect(sim.absorbedG.carbs[end]! / sim.meal.total.carbsG).toBeGreaterThan(0.9)
  })
})

describe('stages and particles', () => {
  it('the meal moves mouth → stomach → small intestine → large intestine', () => {
    const sim = run('fatty-meal')
    expect(activeStage(sim, 1)).toBe('mouth')
    expect(activeStage(sim, 60)).toBe('stomach')
    expect(activeStage(sim, 420)).toBe('smallIntestine')
    expect(activeStage(sim, 1500)).toBe('largeIntestine')
  })

  it('particles leave the stomach in the order the curve predicts and are deterministic', () => {
    const a = run('standard-meal', 'glucose-50')
    const b = run('standard-meal', 'glucose-50')
    expect(a.particles).toEqual(b.particles)
    const liquidOut = a.particles.filter((p) => p.phase === 'liquid').map((p) => p.stomachOut)
    const solidOut = a.particles.filter((p) => p.phase === 'solid').map((p) => p.stomachOut)
    const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)]!
    expect(median(liquidOut)).toBeLessThan(median(solidOut))
    for (const p of a.particles) {
      expect(p.stomachOut).toBeGreaterThan(p.stomachIn)
      if (p.absorbedAt !== null) expect(p.absorbedAt).toBeGreaterThan(p.stomachOut)
      if (p.kind === 'fiber') expect(p.absorbedAt).toBeNull()
    }
  })

  it('empty meal does not crash', () => {
    const sim = simulate(buildMeal([], lookup))
    expect(sim.particles).toHaveLength(0)
    expect(sim.events.glucosePeak).toBeNull()
    expect(activeStage(sim, 100)).toBe('mouth')
  })
})
