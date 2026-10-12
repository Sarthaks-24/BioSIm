import type { Food, FoodPhase, Nutrients } from './schema.ts'
import { PARAMS } from './params.ts'

export interface MealItem {
  foodId: string
  servings: number
}

export const MAX_SERVINGS = 5
export const MAX_ITEMS = 6

export type FoodLookup = (id: string) => Food | undefined

/** Nutrients for one phase (liquid or solid) of the meal, plus a carb-weighted GI. */
export interface PhaseTotals extends Nutrients {
  massG: number
  /** Glycemic index of this phase's carbohydrate, weighted by grams of carbs. */
  gi: number
}

export interface Meal {
  items: { food: Food; servings: number }[]
  liquid: PhaseTotals
  solid: PhaseTotals
  total: PhaseTotals
  /** Minutes spent eating/drinking (mouth stage). */
  eatingMin: number
}

const NUTRIENT_KEYS = ['energyKcal', 'carbsG', 'sugarsG', 'fiberG', 'proteinG', 'fatG', 'waterG'] as const

function emptyTotals(): PhaseTotals {
  return { energyKcal: 0, carbsG: 0, sugarsG: 0, fiberG: 0, proteinG: 0, fatG: 0, waterG: 0, massG: 0, gi: 0 }
}

function addInto(target: PhaseTotals, food: Food, servings: number) {
  const giWeightBefore = target.gi * target.carbsG
  for (const key of NUTRIENT_KEYS) target[key] += food.nutrients[key] * servings
  target.massG += food.serving.grams * servings
  const carbs = food.nutrients.carbsG * servings
  const gi = food.glycemicIndex?.value ?? (carbs > 0 ? PARAMS.glucose.defaultGi : 0)
  target.gi = target.carbsG > 0 ? (giWeightBefore + gi * carbs) / target.carbsG : 0
}

export function clampServings(servings: number): number {
  if (!Number.isFinite(servings)) return 1
  return Math.min(MAX_SERVINGS, Math.max(0.25, Math.round(servings * 4) / 4))
}

/**
 * Combine foods × servings into one meal. Unknown food ids are skipped (never throw on bad
 * share links). Duplicate ids are merged.
 */
export function buildMeal(items: MealItem[], lookup: FoodLookup): Meal {
  const merged = new Map<string, number>()
  for (const item of items.slice(0, MAX_ITEMS * 2)) {
    if (!lookup(item.foodId)) continue
    merged.set(item.foodId, (merged.get(item.foodId) ?? 0) + item.servings)
  }

  const meal: Meal = { items: [], liquid: emptyTotals(), solid: emptyTotals(), total: emptyTotals(), eatingMin: 0 }
  for (const [id, rawServings] of [...merged].slice(0, MAX_ITEMS)) {
    const food = lookup(id)!
    const servings = clampServings(rawServings)
    meal.items.push({ food, servings })
    addInto(phaseOf(meal, food.phase), food, servings)
    addInto(meal.total, food, servings)
  }

  const e = PARAMS.eating
  const solidMin = meal.solid.massG > 0 ? Math.max(e.minSolidMin, meal.solid.massG / e.solidGramsPerMin) : 0
  const liquidMin = meal.liquid.massG > 0 ? e.liquidMin : 0
  meal.eatingMin = meal.items.length === 0 ? 0 : Math.min(e.maxMin, Math.max(solidMin, liquidMin))
  return meal
}

function phaseOf(meal: Meal, phase: FoodPhase): PhaseTotals {
  return phase === 'liquid' ? meal.liquid : meal.solid
}
