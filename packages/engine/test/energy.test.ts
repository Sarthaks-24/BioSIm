import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROFILE,
  ICMR_ADULT_BMR_FACTOR,
  ORGANISM_PROFILES,
  PROFILES,
  buildMeal,
  decodeMeal,
  parseFood,
  schofieldMale18to30KcalPerDay,
  simulate,
  type Simulation,
} from '../src/index.ts'
import { golden, pinned } from './golden.ts'

/**
 * Energy in vs used (WP-06, M5). "In" is calculated from studies: the Atwater factors applied to
 * the absorbed grams. "Used" is a model estimate: a resting-energy formula for the stated person,
 * the same for every meal. The published figures are in the test titles; docs/MODEL.md has the
 * references.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => foods.find((f) => f.id === id)
const cache = new Map<string, Simulation>()
const run = (meal: string) => {
  if (!cache.has(meal)) cache.set(meal, simulate(buildMeal(decodeMeal(meal), lookup), { particles: 0 }))
  return cache.get(meal)!
}
/** Largest |a − b| over the run, so a whole series is checked with one assertion. */
const worst = (n: number, diff: (i: number) => number) => {
  let max = 0
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(diff(i)))
  return max
}
const values = (sim: Simulation, id: Parameters<Simulation['signals']['get']>[0]) => sim.signals.get(id)!.values

/** Every food alone, a mixed meal, and an empty meal. */
const meals = [...foods.map((f) => `${f.id}:1`), 'cheeseburger:1,fries:1,cola:1', 'roti:2,dal:1', '']

/** Atwater general factors, kcal/g, as printed in FAO FNP 77 §3.5.1 (not read from PARAMS on purpose). */
const atwater = (carbsG: number, proteinG: number, fatG: number) => 4 * carbsG + 4 * proteinG + 9 * fatG

describe('the default person (ICMR-NIN 2020 reference adult man)', () => {
  const ref = PROFILES['adult-ref']

  it('is the human default, and every offered profile exists', () => {
    expect(DEFAULT_PROFILE.human).toBe('adult-ref')
    for (const [organism, ids] of Object.entries(ORGANISM_PROFILES)) for (const id of ids) expect(PROFILES[id].organism, id).toBe(organism)
    expect(ref).toMatchObject({ sex: 'male', weightKg: 65, ageY: [19, 39], digestionDataAreAdult: true, i18nKey: 'profiles.adult-ref' })
    expect(ref.sourceIds).toEqual(['faowhounu2004', 'icmr-nin2020'])
  })

  it('a run says which person it is about', () => {
    expect(run('cola:1').profile).toBe('adult-ref')
  })

  golden(
    ['energy.usedRate', 'energy.usedTotal'],
    ['faowhounu2004'],
    'Schofield BMR for a man aged 18–30 y at 65 kg: 15.057·65 + 692.2 = 1671 kcal/d (FAO/WHO/UNU 2004 Table 5.2)',
    () => {
      expect(Math.abs(schofieldMale18to30KcalPerDay(65) - 1671)).toBeLessThanOrEqual(1)
      expect(Math.abs(ref.restingKcalPerDay / ICMR_ADULT_BMR_FACTOR - 1671)).toBeLessThanOrEqual(1)
    },
  )

  golden(
    ['energy.usedRate', 'energy.usedTotal'],
    ['faowhounu2004', 'icmr-nin2020'],
    'with ICMR-NIN 2020’s −10 % for Indian adults: 1504 kcal/d at rest, i.e. 62.7 kcal/h every minute',
    () => {
      expect(ICMR_ADULT_BMR_FACTOR).toBe(0.9)
      expect(Math.abs(ref.restingKcalPerDay - 1504)).toBeLessThanOrEqual(1)
      const used = values(run('roti:1,dal:1'), 'energy.usedRate')
      for (const v of used) expect(v).toBeCloseTo(ref.restingKcalPerDay / 24, 4)
      expect(Math.round(used[0]! * 10) / 10).toBe(62.7)
    },
  )

  golden(
    'energy.usedRate',
    ['icmr-nin2020'],
    'resting use × sedentary PAL 1.40 = 2105 kcal/d, within 0.5 % of ICMR-NIN 2020’s 2110 kcal/d for the 65 kg sedentary man',
    () => {
      const perDay = values(run('cola:1'), 'energy.usedRate')[0]! * 24
      expect(Math.abs(perDay * 1.4 - 2105)).toBeLessThanOrEqual(1)
      expect(Math.abs(perDay * 1.4 - 2110) / 2110).toBeLessThanOrEqual(0.005)
    },
  )
})

describe('energy in', () => {
  golden(
    ['energy.inRate', 'energy.inTotal'],
    ['fao2003'],
    'energy in = 4·carbs + 4·protein + 9·fat of the absorbed grams at every minute (±0.01 kcal), and the hourly rate adds up to it',
    () => {
      for (const meal of meals) {
        const sim = run(meal)
        const a = sim.absorbedG
        const total = values(sim, 'energy.inTotal')
        const rate = values(sim, 'energy.inRate')
        expect(total, meal).toHaveLength(sim.length)
        expect(
          worst(sim.length, (i) => total[i]! - atwater(a.carbs[i]!, a.protein[i]!, a.fat[i]!)),
          meal,
        ).toBeLessThanOrEqual(0.01)
        let summed = 0
        const sums = Array.from(rate, (r, i) => (summed += i > 0 ? (r * sim.stepMin) / 60 : 0))
        expect(
          worst(sim.length, (i) => sums[i]! - total[i]!),
          `${meal} rate`,
        ).toBeLessThanOrEqual(0.01)
      }
    },
  )

  golden(
    'energy.inTotal',
    ['openstax-ap2e-23'],
    'after 48 h, 85–100 % of every food’s Atwater energy has entered the body (most carbohydrate, protein and fat is absorbed)',
    () => {
      expect(foods).toHaveLength(15)
      for (const f of foods) {
        const sim = run(`${f.id}:1`)
        const t = sim.meal.total
        const meal = atwater(t.carbsG, t.proteinG, t.fatG)
        const inAt48h = values(sim, 'energy.inTotal')[sim.length - 1]!
        if (meal === 0) {
          expect(inAt48h, f.id).toBe(0)
          continue
        }
        expect(inAt48h / meal, f.id).toBeGreaterThanOrEqual(0.85)
        expect(inAt48h / meal, f.id).toBeLessThanOrEqual(1)
      }
    },
  )

  pinned(
    ['energy.inRate', 'energy.inTotal'],
    'nothing comes in before the meal reaches the gut, the rate is never negative, and the total only goes up',
    () => {
      for (const meal of meals) {
        const sim = run(meal)
        const total = values(sim, 'energy.inTotal')
        const rate = values(sim, 'energy.inRate')
        expect(total[0], meal).toBe(0)
        expect(rate[0], meal).toBe(0)
        expect(Math.min(...rate), meal).toBeGreaterThanOrEqual(-1e-3)
        expect(Math.min(...total.slice(1).map((v, i) => v - total[i]!)), meal).toBeGreaterThanOrEqual(-1e-3)
      }
    },
  )
})

describe('energy used', () => {
  pinned(
    ['energy.usedRate', 'energy.usedTotal'],
    'used is the same for every meal (resting body, reactsToMeal: false), and usedTotal = usedRate × t/60',
    () => {
      const first = run('')
      const rate0 = values(first, 'energy.usedRate')
      const total0 = values(first, 'energy.usedTotal')
      expect(first.signals.get('energy.usedRate')!.meta.reactsToMeal).toBe(false)
      expect(first.signals.get('energy.usedTotal')!.meta.reactsToMeal).toBe(false)
      expect(worst(first.length, (i) => total0[i]! - (rate0[i]! * i * first.stepMin) / 60)).toBeLessThanOrEqual(0.01)
      for (const meal of meals) {
        const sim = run(meal)
        expect(values(sim, 'energy.usedRate'), meal).toEqual(rate0)
        expect(values(sim, 'energy.usedTotal'), meal).toEqual(total0)
        // No food sources on a line that does not depend on the food.
        expect(sim.signals.get('energy.usedRate')!.sourceIds, meal).toEqual(['faowhounu2004', 'icmr-nin2020'])
      }
    },
  )
})
