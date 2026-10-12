import { useMemo } from 'react'
import { buildMeal, simulate, type MealItem, type Simulation } from '@biosim/engine'
import { lookupFood } from '../data/foods.ts'

/** Recomputes only when the meal changes (a 48 h run takes a few milliseconds). */
export function useSimulation(items: MealItem[]): Simulation {
  // Keyed on the meal's contents, not the array identity, so equal meals reuse the result.
  const key = items.map((i) => `${i.foodId}:${i.servings}`).join(',')
  return useMemo(() => simulate(buildMeal(items, lookupFood), { particles: 56 }), [key]) // eslint-disable-line react-hooks/exhaustive-deps
}
