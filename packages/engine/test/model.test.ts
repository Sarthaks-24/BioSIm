import { describe, expect, it } from 'vitest'
import {
  PARAMS,
  activeStage,
  buildMeal,
  indexAt,
  mealLocation,
  simulate,
  stageWindow,
  stomachFraction,
  STAGES,
  type Simulation,
} from '../src/index.ts'
import { lookup } from './fixtures.ts'

/**
 * Golden tests: each checks the model against a PUBLISHED figure (source in the test name).
 * If you change PARAMS and one fails, either the change is wrong or the reference needs a new
 * citation. See docs/MODEL.md.
 */

const run = (...ids: string[]) =>
  simulate(
    buildMeal(
      ids.map((foodId) => ({ foodId, servings: 1 })),
      lookup,
    ),
  )
const leftPct = (sim: Simulation, minutesAfterEating: number) =>
  stomachFraction(sim, indexAt(sim, minutesAfterEating + sim.meal.eatingMin)) * 100
const rise = (sim: Simulation, t: number) => sim.glucose.typical[indexAt(sim, t)]! - PARAMS.glucose.fastingMgDl

describe('gastric emptying', () => {
  it('water half-empties in ~10–22 min (Ziessman et al. 2009)', () => {
    const t50 = run('water-test').events.stomachHalfEmptyMin!
    expect(t50).toBeGreaterThanOrEqual(10)
    expect(t50).toBeLessThanOrEqual(22)
  })

  it('consensus solid test meal stays inside scintigraphy norms (Abell et al. 2008)', () => {
    const sim = run('standard-meal')
    expect(leftPct(sim, 60)).toBeGreaterThanOrEqual(37)
    expect(leftPct(sim, 60)).toBeLessThanOrEqual(90)
    expect(leftPct(sim, 120)).toBeGreaterThanOrEqual(30)
    expect(leftPct(sim, 120)).toBeLessThanOrEqual(60)
    expect(leftPct(sim, 240)).toBeLessThanOrEqual(10)
  })

  it('solids have a lag phase: almost nothing leaves in the first 10 min (Siegel et al. 1988)', () => {
    expect(leftPct(run('standard-meal'), 10)).toBeGreaterThan(95)
  })

  it('a glucose drink empties at ~2.13 kcal/min (Brener et al. 1983)', () => {
    const t90 = run('glucose-50').events.stomach90EmptyMin!
    const expected = (0.9 * 200) / PARAMS.stomach.energyKcalPerMin
    expect(Math.abs(t90 - expected)).toBeLessThan(15)
  })

  it('a high-fat meal is still being emptied after 6 h (OpenStax A&P 2e §23.4)', () => {
    expect(run('fatty-meal').events.stomach90EmptyMin!).toBeGreaterThanOrEqual(6 * 60)
  })

  it('emptying order: water < sugary drink < light meal < heavy fatty meal', () => {
    const order = ['water-test', 'glucose-50', 'standard-meal', 'fatty-meal'].map((id) => run(id).events.stomachHalfEmptyMin!)
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]!)
  })

  it('a caloric drink slows the solid part of a meal eaten with it', () => {
    expect(run('fatty-meal', 'glucose-50').curves.solid.linearMin).toBeGreaterThan(run('fatty-meal').curves.solid.linearMin)
  })

  it('meals over the cap are flagged; a meal at the cap still empties within 16 h', () => {
    const big = simulate(buildMeal([{ foodId: 'fatty-meal', servings: 2.25 }], lookup))
    expect(big.meal.overCap).toBe(true)
    const atCap = simulate(buildMeal([{ foodId: 'fatty-meal', servings: 2 }], lookup))
    expect(atCap.meal.overCap).toBe(false)
    expect(atCap.events.stomach90EmptyMin!).toBeLessThan(16 * 60)
  })
})

describe('blood glucose', () => {
  it('50 g glucose drink: peak +30–60 mg/dL at 30–60 min, near baseline by 2 h (standard OGTT shape)', () => {
    const sim = run('glucose-50')
    const peak = sim.events.glucosePeak!
    expect(peak.timeMin).toBeGreaterThanOrEqual(30)
    expect(peak.timeMin).toBeLessThanOrEqual(60)
    expect(peak.riseMgDl.typical).toBeGreaterThanOrEqual(30)
    expect(peak.riseMgDl.typical).toBeLessThanOrEqual(60)
    expect(rise(sim, 120)).toBeLessThan(20)
    expect(Math.abs(rise(sim, 240))).toBeLessThan(5)
  })

  it('reproduces the GI definition: white bread (GI 75) gives ~75 % of the glucose 2-h area (Brouns et al. 2005)', () => {
    const iauc = (sim: Simulation) => {
      let a = 0
      for (let t = 0; t <= 120; t++) a += Math.max(0, rise(sim, t))
      return a
    }
    const ratio = iauc(run('bread-50')) / iauc(run('glucose-50'))
    expect(ratio).toBeGreaterThan(0.7)
    expect(ratio).toBeLessThan(0.8)
  })

  it('a starchy solid meal peaks later than the drink but within ~75 min (meal tests peak ~46–50 min, Freckmann et al. 2007)', () => {
    const drink = run('glucose-50').events.glucosePeak!
    const bread = run('bread-50').events.glucosePeak!
    expect(bread.timeMin).toBeGreaterThan(drink.timeMin)
    expect(bread.timeMin).toBeLessThanOrEqual(75)
    expect(bread.riseMgDl.typical).toBeLessThan(drink.riseMgDl.typical)
  })

  it('fat and protein flatten and delay the curve (Moghaddam et al. 2006)', () => {
    const light = run('standard-meal').events.glucosePeak!
    const fatty = run('fatty-meal').events.glucosePeak!
    expect(fatty.riseMgDl.typical).toBeLessThan(light.riseMgDl.typical)
    expect(fatty.timeMin).toBeGreaterThan(light.timeMin)
  })

  it('blood sugar comes back down: no long plateau after a starchy meal', () => {
    expect(rise(run('bread-50'), 240)).toBeLessThan(8)
    expect(rise(run('standard-meal'), 240)).toBeLessThan(8)
    expect(rise(run('glucose-50'), 180)).toBeLessThan(3)
  })

  it('water does not change glucose and has no nutrients to absorb', () => {
    const sim = run('water-test')
    expect(sim.events.glucosePeak).toBeNull()
    expect(sim.events.noNutrients).toBe(true)
    expect(sim.events.absorptionMostlyDoneMin).toBeNull()
  })

  it('the band always brackets the typical curve', () => {
    const sim = run('glucose-50')
    for (let i = 0; i < sim.length; i += 37) {
      expect(sim.glucose.low[i]!).toBeLessThanOrEqual(sim.glucose.typical[i]! + 1e-9)
      expect(sim.glucose.high[i]!).toBeGreaterThanOrEqual(sim.glucose.typical[i]! - 1e-9)
    }
  })
})

describe('one consistent story', () => {
  it('sugar from a drink is mostly absorbed by the time blood glucose is back down', () => {
    const sim = run('glucose-50')
    expect(sim.events.absorptionMostlyDoneMin!).toBeLessThanOrEqual(150)
    const atPeak = sim.absorbedG.carbs[indexAt(sim, sim.events.glucosePeak!.timeMin)]!
    expect(atPeak / sim.meal.total.carbsG).toBeGreaterThan(0.2)
  })

  it('mass balance: stomach + intestines + absorbed + left the body = eaten, at every time', () => {
    const sim = run('fatty-meal', 'glucose-50')
    for (let t = 30; t <= PARAMS.horizonMin; t += 97) {
      const loc = mealLocation(sim, indexAt(sim, t))
      const sum = loc.stomach + loc.smallIntestine + loc.largeIntestine + loc.absorbed + loc.leftBody
      expect(sum).toBeCloseTo(loc.total, 0)
    }
  })

  it('fibre is never absorbed and ends up leaving the body; most carbs are absorbed', () => {
    const sim = run('fatty-meal')
    const end = sim.length - 1
    expect(sim.absorbedG.fiber[end]).toBe(0)
    expect(sim.absorbedG.carbs[end]! / sim.meal.total.carbsG).toBeGreaterThan(0.9)
    expect(sim.excretedG[end]!).toBeGreaterThan(sim.meal.total.fiberG * 0.9)
  })

  it('leftover timings depend on the meal; drinks with no leftovers have no exit time', () => {
    expect(run('glucose-50').events.firstExit).toBeNull()
    expect(run('water-test').events.halfLeftoversInColon).toBeNull()
    const light = run('standard-meal').events.halfLeftoversInColon!.typical
    const fatty = run('fatty-meal').events.halfLeftoversInColon!.typical
    expect(fatty).toBeGreaterThan(light)
  })
})

describe('stages and particles', () => {
  it('the meal moves mouth → stomach → small intestine → large intestine', () => {
    const sim = run('fatty-meal')
    expect(activeStage(sim, 1)).toBe('mouth')
    expect(activeStage(sim, 60)).toBe('stomach')
    expect(activeStage(sim, 9 * 60)).toBe('smallIntestine')
    expect(activeStage(sim, 30 * 60)).toBe('largeIntestine')
  })

  it('stage windows start in order', () => {
    const sim = run('standard-meal')
    const starts = STAGES.map((s) => stageWindow(sim, s)?.start ?? Infinity)
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThanOrEqual(starts[i - 1]!)
  })

  it('particles are deterministic and follow the curves', () => {
    const a = run('standard-meal', 'glucose-50')
    const b = run('standard-meal', 'glucose-50')
    expect(a.particles).toEqual(b.particles)
    const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)]!
    const out = (phase: string) => a.particles.filter((p) => p.phase === phase).map((p) => p.stomachOut)
    expect(median(out('liquid'))).toBeLessThan(median(out('solid')))
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
