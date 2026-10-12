import type { Food, FoodPhase, Nutrients } from './schema.ts'
import { PARAMS } from './params.ts'

export interface MealItem {
  foodId: string
  servings: number
}

export const MAX_SERVINGS = 5
export const MAX_ITEMS = 6
/** Servings the picker offers. Links may carry any quarter step; the picker adds that value if missing. */
export const SERVING_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 2.5, 3, 4, 5] as const

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
  /** Food ids that were asked for but don't exist (e.g. an old share link). */
  unknownIds: string[]
  /** Bigger than PARAMS.maxMealKcal: the model is not reliable for meals this large. */
  overCap: boolean
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
  // No published GI means too little carbohydrate to test (schema enforces this): no glycemic effect.
  const gi = food.glycemicIndex?.value ?? 0
  target.gi = target.carbsG > 0 ? (giWeightBefore + gi * carbs) / target.carbsG : 0
}

export function clampServings(servings: number): number {
  if (!Number.isFinite(servings)) return 1
  return Math.min(MAX_SERVINGS, Math.max(0.25, Math.round(servings * 4) / 4))
}

/** Energy of a list of items, for checking the meal cap before adding food. */
export function mealKcal(items: MealItem[], lookup: FoodLookup): number {
  return items.reduce((sum, i) => sum + (lookup(i.foodId)?.nutrients.energyKcal ?? 0) * clampServings(i.servings), 0)
}

/** Never read more than this many raw items from a link, so a huge link can't make us loop for long. */
const MAX_RAW_ITEMS = MAX_ITEMS * 2

/**
 * Combine foods × servings into one meal. Unknown food ids are skipped and reported (never
 * throw on bad share links). Duplicate ids are merged.
 */
export function buildMeal(items: MealItem[], lookup: FoodLookup): Meal {
  const merged = new Map<string, number>()
  const unknownIds: string[] = []
  for (const item of items.slice(0, MAX_RAW_ITEMS)) {
    if (!lookup(item.foodId)) {
      unknownIds.push(item.foodId)
      continue
    }
    merged.set(item.foodId, (merged.get(item.foodId) ?? 0) + item.servings)
  }

  const meal: Meal = {
    items: [],
    liquid: emptyTotals(),
    solid: emptyTotals(),
    total: emptyTotals(),
    eatingMin: 0,
    unknownIds,
    overCap: false,
  }
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
  meal.overCap = meal.total.energyKcal > PARAMS.maxMealKcal
  return meal
}

function phaseOf(meal: Meal, phase: FoodPhase): PhaseTotals {
  return phase === 'liquid' ? meal.liquid : meal.solid
}
