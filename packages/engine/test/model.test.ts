import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PARAMS,
  activeStage,
  buildMeal,
  decodeMeal,
  parseFood,
  indexAt,
  mealLocation,
  simulate,
  stageWindow,
  stomachFraction,
  STAGES,
  findFirst,
  type Simulation,
} from '../src/index.ts'
import { lookup } from './fixtures.ts'
import { golden, pinned } from './golden.ts'

/**
 * Golden tests: each checks the model against a PUBLISHED figure (source in the test name).
 * If you change PARAMS and one fails, either the change is wrong or the reference needs a new
 * citation. See docs/MODEL.md.
 *
 * Each test names the catalog IDs it checks (test/golden.ts): `golden` = checked against the
 * sources listed, `pinned` = a behaviour pin with no source, `golden.fails` = a known limit.
 * test/contract.test.ts reads these calls and fails if an active ID has no sourced test.
 * Stage and particle tests stay plain `it`: they check the picture, not a signal.
 */

const run = (...ids: string[]) =>
  simulate(
    buildMeal(
      ids.map((foodId) => ({ foodId, servings: 1 })),
      lookup,
    ),
  )
/** The shipped foods (content/foods), for checks about everyday meals rather than test meals. */
const foodsDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(foodsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(foodsDir, f), 'utf8'))))
const runFoods = (meal: string) =>
  simulate(
    buildMeal(decodeMeal(meal), (id) => foods.find((f) => f.id === id)),
    { particles: 0 },
  )
const leftPct = (sim: Simulation, minutesAfterEating: number) =>
  stomachFraction(sim, indexAt(sim, minutesAfterEating + sim.meal.eatingMin)) * 100
const rise = (sim: Simulation, t: number) => sim.glucose.typical[indexAt(sim, t)]! - PARAMS.glucose.fastingMgDl

describe('gastric emptying', () => {
  golden(
    ['gut.stomach.liquidG', 'event.stomachHalfEmpty'],
    ['ziessman2009'],
    'water half-empties in ~10–22 min (Ziessman et al. 2009)',
    () => {
      const t50 = run('water-test').events.stomachHalfEmptyMin!
      expect(t50).toBeGreaterThanOrEqual(10)
      expect(t50).toBeLessThanOrEqual(22)
    },
  )

  golden('gut.stomach.solidG', ['abell2008'], 'consensus solid test meal stays inside scintigraphy norms (Abell et al. 2008)', () => {
    const sim = run('standard-meal')
    expect(leftPct(sim, 60)).toBeGreaterThanOrEqual(37)
    expect(leftPct(sim, 60)).toBeLessThanOrEqual(90)
    expect(leftPct(sim, 120)).toBeGreaterThanOrEqual(30)
    expect(leftPct(sim, 120)).toBeLessThanOrEqual(60)
    expect(leftPct(sim, 240)).toBeLessThanOrEqual(10)
  })

  golden(
    'gut.stomach.solidG',
    ['siegel1988'],
    'solids have a lag phase: almost nothing leaves in the first 10 min (Siegel et al. 1988)',
    () => {
      expect(leftPct(run('standard-meal'), 10)).toBeGreaterThan(95)
    },
  )

  golden('gut.stomach.liquidG', ['brener1983'], 'a glucose drink empties at ~2.13 kcal/min (Brener et al. 1983)', () => {
    const t90 = run('glucose-50').events.stomach90EmptyMin!
    // 2.13 kcal/min is Brener et al.'s figure, written out here (not read from PARAMS) so a change to the parameter fails this test.
    const expected = (0.9 * 200) / 2.13
    expect(Math.abs(t90 - expected)).toBeLessThan(15)
  })

  golden('gut.stomach.contentG', ['openstax-ap2e-23'], 'a high-fat meal is still being emptied after 6 h (OpenStax A&P 2e §23.4)', () => {
    expect(run('fatty-meal').events.stomach90EmptyMin!).toBeGreaterThanOrEqual(6 * 60)
  })

  golden.fails(
    ['gut.stomach.contentG', 'gut.stomach.solidG'],
    ['openstax-ap2e-23'],
    'an ordinary meal (2 rotis + dal, or a portion of fries) is 90 % emptied within 2–4 h (OpenStax A&P 2e §23.4)',
    'docs/MODEL.md Known limits: the fixed 1.4 kcal/min solid rate empties everyday meals slowly (both ~4.5 h; burger + fries ~7.9 h)',
    () => {
      for (const meal of ['roti:2,dal:1', 'fries:1']) expect(runFoods(meal).events.stomach90EmptyMin!, meal).toBeLessThanOrEqual(4 * 60)
    },
  )

  // The known limit above passes on any error (a renamed food file would hide it): this pins
  // today's values, so the limit is known to fail for the reason it states.
  pinned(
    ['gut.stomach.contentG', 'gut.stomach.solidG'],
    'today an ordinary meal (2 rotis + dal, or fries) is 90 % emptied after 4–5 h',
    () => {
      for (const meal of ['roti:2,dal:1', 'fries:1']) {
        const t90 = runFoods(meal).events.stomach90EmptyMin!
        expect(t90, meal).toBeGreaterThan(4 * 60)
        expect(t90, meal).toBeLessThan(5 * 60)
      }
    },
  )

  golden('event.stomachHalfEmpty', ['hunt1975'], 'emptying order: water < sugary drink < light meal < heavy fatty meal', () => {
    const order = ['water-test', 'glucose-50', 'standard-meal', 'fatty-meal'].map((id) => run(id).events.stomachHalfEmptyMin!)
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeGreaterThan(order[i - 1]!)
  })

  golden('gut.stomach.solidG', ['hunt1975'], 'a caloric drink slows the solid part of a meal eaten with it', () => {
    expect(run('fatty-meal', 'glucose-50').curves.solid.linearMin).toBeGreaterThan(run('fatty-meal').curves.solid.linearMin)
  })

  pinned('gut.stomach.contentG', 'meals over the cap are flagged; a meal at the cap still empties within 16 h', () => {
    const big = simulate(buildMeal([{ foodId: 'fatty-meal', servings: 2.25 }], lookup))
    expect(big.meal.overCap).toBe(true)
    const atCap = simulate(buildMeal([{ foodId: 'fatty-meal', servings: 2 }], lookup))
    expect(atCap.meal.overCap).toBe(false)
    expect(atCap.events.stomach90EmptyMin!).toBeLessThan(16 * 60)
  })
})

describe('blood glucose', () => {
  golden(
    ['blood.glucose', 'event.glucosePeak'],
    ['freckmann2007', 'bergman1979'],
    '50 g glucose drink: peak +30–60 mg/dL at 30–60 min, near baseline by 2 h (standard OGTT shape)',
    () => {
      const sim = run('glucose-50')
      const peak = sim.events.glucosePeak!
      expect(peak.timeMin).toBeGreaterThanOrEqual(30)
      expect(peak.timeMin).toBeLessThanOrEqual(60)
      expect(peak.riseMgDl.typical).toBeGreaterThanOrEqual(30)
      expect(peak.riseMgDl.typical).toBeLessThanOrEqual(60)
      expect(rise(sim, 120)).toBeLessThan(20)
      expect(Math.abs(rise(sim, 240))).toBeLessThan(5)
    },
  )

  golden(
    'blood.glucose',
    ['brouns2005', 'atkinson2008'],
    'reproduces the GI definition: white bread (GI 75) gives ~75 % of the glucose 2-h area (Brouns et al. 2005)',
    () => {
      const iauc = (sim: Simulation) => {
        let a = 0
        for (let t = 0; t <= 120; t++) a += Math.max(0, rise(sim, t))
        return a
      }
      const ratio = iauc(run('bread-50')) / iauc(run('glucose-50'))
      expect(ratio).toBeGreaterThan(0.7)
      expect(ratio).toBeLessThan(0.8)
    },
  )

  golden(
    'event.glucosePeak',
    ['freckmann2007'],
    'a starchy solid meal peaks later than the drink but within ~75 min (meal tests peak ~46–50 min, Freckmann et al. 2007)',
    () => {
      const drink = run('glucose-50').events.glucosePeak!
      const bread = run('bread-50').events.glucosePeak!
      expect(bread.timeMin).toBeGreaterThan(drink.timeMin)
      expect(bread.timeMin).toBeLessThanOrEqual(75)
      expect(bread.riseMgDl.typical).toBeLessThan(drink.riseMgDl.typical)
    },
  )

  golden('blood.glucose', ['moghaddam2006'], 'fat and protein flatten and delay the curve (Moghaddam et al. 2006)', () => {
    const light = run('standard-meal').events.glucosePeak!
    const fatty = run('fatty-meal').events.glucosePeak!
    expect(fatty.riseMgDl.typical).toBeLessThan(light.riseMgDl.typical)
    expect(fatty.timeMin).toBeGreaterThan(light.timeMin)
  })

  golden(
    ['blood.glucose', 'event.glucoseBackToBase'],
    ['ada2001'],
    'blood sugar comes back down: no long plateau after a starchy meal',
    () => {
      expect(rise(run('bread-50'), 240)).toBeLessThan(8)
      expect(rise(run('standard-meal'), 240)).toBeLessThan(8)
      expect(rise(run('glucose-50'), 180)).toBeLessThan(3)
      // ADA 2001: back to preprandial within 2–3 h. The marker uses the 5 mg/dL display threshold.
      const drink = run('glucose-50').events
      expect(drink.glucoseBackToBaseMin!).toBeGreaterThan(drink.glucosePeak!.timeMin)
      expect(drink.glucoseBackToBaseMin!).toBeLessThanOrEqual(180)
    },
  )

  golden.fails(
    'event.glucoseBackToBase',
    ['ada2001'],
    'a starchy meal is back within 5 mg/dL of fasting by 3 h (ADA 2001: 2–3 h)',
    'limits.glucoseTail: the model keeps glucose slightly raised while starch still leaves the stomach (white bread: ~4 h)',
    () => {
      expect(run('bread-50').events.glucoseBackToBaseMin!).toBeLessThanOrEqual(180)
    },
  )

  pinned(['blood.glucose', 'gut.absorbed.carbsG'], 'water does not change glucose and has no nutrients to absorb', () => {
    const sim = run('water-test')
    expect(sim.events.glucosePeak).toBeNull()
    expect(sim.events.noNutrients).toBe(true)
    expect(sim.events.absorptionMostlyDoneMin).toBeNull()
  })

  golden(
    ['gut.stomach.liquidG', 'event.stomachHalfEmpty'],
    ['brener1983'],
    'a glucose drink 4× as big leaves at the same ~2.13 kcal/min, so it takes about 4× as long (Brener et al. 1983)',
    () => {
      const one = simulate(buildMeal([{ foodId: 'glucose-50', servings: 1 }], lookup)).events
      const four = simulate(buildMeal([{ foodId: 'glucose-50', servings: 4 }], lookup)).events
      const ratio = four.stomach90EmptyMin! / one.stomach90EmptyMin!
      expect(ratio).toBeGreaterThan(3.5)
      expect(ratio).toBeLessThan(4.5)
    },
  )

  // Council MUST 2 (2026-10-13): cola ×1 and ×4 both read "Highest: 121". Not a bug: the release
  // is capped (above), the rise depends on the rate sugar arrives, and insulin action brings the
  // curve down before even one serving has left the stomach. So a bigger portion of the same food
  // keeps blood sugar up for longer at the same highest point. Real people usually reach a
  // somewhat higher point with a bigger portion: "How we know" says so (limits.glucoseSameHighest).
  pinned(
    ['blood.glucose', 'event.glucosePeak'],
    'more of the same food: the same highest point, raised for longer (capped release; known limit limits.glucoseSameHighest)',
    () => {
      const of = (servings: number) => simulate(buildMeal([{ foodId: 'glucose-50', servings }], lookup))
      const above = (sim: Simulation) => sim.glucose.typical.filter((g) => g > PARAMS.glucose.fastingMgDl + 5).length
      const one = of(1)
      for (const n of [2, 4]) {
        const more = of(n)
        expect(Math.abs(more.events.glucosePeak!.riseMgDl.typical - one.events.glucosePeak!.riseMgDl.typical)).toBeLessThan(0.5)
        expect(above(more)).toBeGreaterThan(1.5 * above(one))
      }
    },
  )

  pinned('blood.glucose', 'the band always brackets the typical curve', () => {
    const sim = run('glucose-50')
    for (let i = 0; i < sim.length; i += 37) {
      expect(sim.glucose.low[i]!).toBeLessThanOrEqual(sim.glucose.typical[i]! + 1e-9)
      expect(sim.glucose.high[i]!).toBeGreaterThanOrEqual(sim.glucose.typical[i]! - 1e-9)
    }
  })
})

describe('one consistent story', () => {
  pinned(
    ['gut.absorbed.carbsG', 'event.mostlyAbsorbed'],
    'sugar from a drink is mostly absorbed by the time blood glucose is back down',
    () => {
      const sim = run('glucose-50')
      expect(sim.events.absorptionMostlyDoneMin!).toBeLessThanOrEqual(150)
      const atPeak = sim.absorbedG.carbs[indexAt(sim, sim.events.glucosePeak!.timeMin)]!
      expect(atPeak / sim.meal.total.carbsG).toBeGreaterThan(0.2)
    },
  )

  golden(
    [
      'gut.small.contentG',
      'gut.colon.contentG',
      'gut.absorbed.carbsG',
      'gut.absorbed.proteinG',
      'gut.absorbed.fatG',
      'gut.absorbed.waterG',
      'gut.absorbed.fibreG',
      'gut.leftBodyG',
    ],
    ['openstax-ap2e-23'],
    'mass balance: stomach + intestines + absorbed + left the body = eaten, at every time',
    () => {
      const sim = run('fatty-meal', 'glucose-50')
      for (let t = 30; t <= PARAMS.horizonMin; t += 97) {
        const loc = mealLocation(sim, indexAt(sim, t))
        const sum = loc.stomach + loc.smallIntestine + loc.largeIntestine + loc.absorbed + loc.leftBody
        expect(sum).toBeCloseTo(loc.total, 0)
      }
    },
  )

  golden(
    ['gut.absorbed.fibreG', 'gut.absorbed.carbsG', 'gut.leftBodyG'],
    ['openstax-ap2e-23'],
    'fibre is never absorbed and ends up leaving the body; most carbs are absorbed',
    () => {
      const sim = run('fatty-meal')
      const end = sim.length - 1
      expect(sim.absorbedG.fiber[end]).toBe(0)
      expect(sim.absorbedG.carbs[end]! / sim.meal.total.carbsG).toBeGreaterThan(0.9)
      expect(sim.excretedG[end]!).toBeGreaterThan(sim.meal.total.fiberG * 0.9)
    },
  )

  pinned(
    'event.stomachHalfEmpty',
    'half-empty is measured by food energy: water added to a meal never makes the meal look faster; a sugary drink only a little',
    () => {
      const alone = run('fatty-meal').events.stomachHalfEmptyMin!
      const withWater = run('fatty-meal', 'water-test').events.stomachHalfEmptyMin!
      const withDrink = run('fatty-meal', 'glucose-50').events.stomachHalfEmptyMin!
      expect(withWater).toBeGreaterThanOrEqual(alone)
      expect(withDrink).toBeGreaterThan(alone * 0.8)
    },
  )

  pinned('event.firstLeftovers', 'only fibre counts as leftovers: sugar drinks leave nothing, however many', () => {
    const drinks = simulate(buildMeal([{ foodId: 'glucose-50', servings: 3 }], lookup))
    expect(drinks.events.firstExit).toBeNull()
    expect(drinks.events.halfLeftoversInColon).toBeNull()
  })

  pinned('event.firstLeftovers', 'leftover timings depend on the meal; drinks with no leftovers have no exit time', () => {
    expect(run('glucose-50').events.firstExit).toBeNull()
    expect(run('water-test').events.halfLeftoversInColon).toBeNull()
    const light = run('standard-meal').events.halfLeftoversInColon!.typical
    const fatty = run('fatty-meal').events.halfLeftoversInColon!.typical
    expect(fatty).toBeGreaterThan(light)
  })

  golden(
    'gut.colon.contentG',
    ['openstax-ap2e-23', 'nandhra2023'],
    'the first of the meal reaches the colon 3–5.7 h after it reaches the stomach (small-bowel transit: OpenStax 3–5 h; Nandhra et al. 2023 3.3–5.7 h)',
    () => {
      for (const id of ['glucose-50', 'standard-meal', 'fatty-meal']) {
        const sim = run(id)
        const colon = sim.signals.get('gut.colon.contentG')!
        const first = findFirst(colon, (g) => g > 0.1)! - sim.stomachArrivalMin
        expect(first, id).toBeGreaterThanOrEqual(3 * 60)
        expect(first, id).toBeLessThanOrEqual(5.7 * 60)
      }
    },
  )

  golden(
    'event.mostlyAbsorbed',
    ['openstax-ap2e-23'],
    'a meal is mostly absorbed before its last chyme has left the small intestine (OpenStax: almost all food is absorbed there; all chyme leaves it in 3–5 h)',
    () => {
      for (const id of ['glucose-50', 'bread-50', 'standard-meal', 'fatty-meal']) {
        const sim = run(id)
        const mostly = sim.moments.get('event.mostlyAbsorbed')!.atMin!
        expect(mostly, id).toBeGreaterThan(sim.events.stomachHalfEmptyMin!)
        expect(mostly, id).toBeLessThanOrEqual(sim.events.stomach90EmptyMin! + 5 * 60)
      }
    },
  )

  golden(
    'event.firstLeftovers',
    ['openstax-ap2e-23', 'nandhra2023'],
    'leftovers start leaving within the published transit times: no sooner than 15 h (3 h small bowel + 12 h colon, OpenStax), no later than ~36 h (5.7 h + 29 h, Nandhra et al. 2023)',
    () => {
      for (const id of ['bread-50', 'standard-meal', 'fatty-meal']) {
        const p = run(id).moments.get('event.firstLeftovers')!
        expect(p.low!, id).toBeGreaterThanOrEqual(15 * 60)
        expect(p.low!, id).toBeLessThanOrEqual(p.atMin!)
        expect(p.atMin!, id).toBeLessThanOrEqual(p.high!)
        expect(p.high!, id).toBeLessThanOrEqual(36 * 60)
      }
    },
  )
})

describe('stages and particles', () => {
  it('the meal moves mouth → stomach → small intestine → large intestine', () => {
    const sim = run('fatty-meal')
    expect(activeStage(sim, 1)).toBe('mouth')
    expect(activeStage(sim, 60)).toBe('stomach')
    expect(activeStage(sim, 9 * 60)).toBe('smallIntestine')
    expect(activeStage(sim, 30 * 60)).toBe('largeIntestine')
  })

  it('never goes back once the meal has moved on, also after the gut is empty (review 14-17)', () => {
    for (const id of ['fatty-meal', 'standard-meal']) {
      const sim = run(id)
      let furthest = 0
      for (let t = 0; t <= sim.horizonMin; t++) {
        const at = STAGES.indexOf(activeStage(sim, t))
        expect(at, `${id} at ${t} min`).toBeGreaterThanOrEqual(furthest)
        furthest = at
      }
      expect(activeStage(sim, sim.horizonMin), id).toBe('largeIntestine')
    }
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
