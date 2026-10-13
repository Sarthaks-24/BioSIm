import { stomachFraction, type FoodLookup, type MealItem } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import { DEFAULT_PRESET } from '../lib/presets.ts'
import { HERO_END_MIN, HERO_STEP_MIN, type Hero, type HeroLine } from './heroShape.ts'

function line(items: readonly MealItem[], lookup: FoodLookup): HeroLine {
  const sim = simulate({ items: [...items] }, { lookup, particles: 0 })
  const stomach: number[] = []
  for (let m = 0; m <= HERO_END_MIN; m += HERO_STEP_MIN) stomach.push(Math.round(stomachFraction(sim, m) * 1000) / 1000)
  return { foods: items.map((i) => i.foodId), stomach }
}

/**
 * The picture on Home: how much of each meal of the first preset (cola, with burger + fries kept)
 * is still in the stomach over the first 6 hours, as fractions every 3 minutes. Home draws it from
 * `hero.json`, written by `scripts/build-hero.ts`, so Home never runs the model (size budget,
 * roadmap A8; its race, components/HomeRace.tsx, reads only `heroShape.ts`). `hero.test.ts` recomputes it and fails if the file is stale.
 */
export function computeHero(lookup: FoodLookup): Hero {
  return { meal: line(DEFAULT_PRESET.meal, lookup), kept: line(DEFAULT_PRESET.kept ?? [], lookup) }
}
