import { simulate, stomachFraction, type FoodLookup, type MealItem } from '@lifepeek/engine'
import { DEFAULT_PRESET } from '../lib/presets.ts'

/**
 * The picture on Home: how much of each meal of the first preset (cola, with burger + fries kept)
 * is still in the stomach over the first 6 hours, as fractions every 3 minutes. Home draws it from
 * `hero.json`, written by `scripts/build-hero.ts`, so Home never runs the model (size budget,
 * roadmap A8). `hero.test.ts` recomputes it and fails if the file is stale.
 */
export const HERO_STEP_MIN = 3
export const HERO_END_MIN = 360

export interface HeroLine {
  /** The foods, for the legend (names come from the food files, in the reader's language). */
  foods: string[]
  /** Share of the meal still in the stomach (0–1) at 0, 3, 6 … 360 min, rounded to 3 decimals. */
  stomach: number[]
}

export interface Hero {
  meal: HeroLine
  kept: HeroLine
}

function line(items: readonly MealItem[], lookup: FoodLookup): HeroLine {
  const sim = simulate({ items: [...items] }, { lookup, particles: 0 })
  const stomach: number[] = []
  for (let m = 0; m <= HERO_END_MIN; m += HERO_STEP_MIN) stomach.push(Math.round(stomachFraction(sim, m) * 1000) / 1000)
  return { foods: items.map((i) => i.foodId), stomach }
}

export function computeHero(lookup: FoodLookup): Hero {
  return { meal: line(DEFAULT_PRESET.meal, lookup), kept: line(DEFAULT_PRESET.kept ?? [], lookup) }
}
