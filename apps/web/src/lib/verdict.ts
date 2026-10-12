import type { Meal } from '@lifepeek/engine'
import { presentMeals, type MealKey, type Sims } from '../state/sim.ts'

/**
 * What the one-line answer says, decided from the simulation — kept separate from the wording so
 * tests can check it's TRUE for every lesson. A reason is only given when it actually explains
 * the result.
 */
export type VerdictReason = 'drink' | 'calories' | 'none'

export type VerdictData =
  | { kind: 'empty' }
  | { kind: 'single'; meal: MealKey; halfMin: number }
  | {
      kind: 'pair'
      fast: MealKey
      slow: MealKey
      /** How many times faster the fast meal half-empties. */
      ratio: number
      similar: boolean
      reason: VerdictReason
      half: Record<MealKey, number>
      kcal: Record<MealKey, number>
    }

/** Only a drink: nothing has to be ground up first. */
export const isDrinkOnly = (meal: Meal) => meal.items.length > 0 && meal.solid.massG === 0

export function verdictData(sims: Sims): VerdictData {
  const keys = presentMeals(sims)
  if (keys.length === 0) return { kind: 'empty' }
  const half = { a: sims.a.events.stomachHalfEmptyMin ?? 0, b: sims.b.events.stomachHalfEmptyMin ?? 0 }
  if (keys.length === 1) return { kind: 'single', meal: keys[0]!, halfMin: half[keys[0]!] }

  const kcal = { a: Math.round(sims.a.meal.total.energyKcal), b: Math.round(sims.b.meal.total.energyKcal) }
  const [fast, slow] = half.a <= half.b ? (['a', 'b'] as const) : (['b', 'a'] as const)
  const ratio = half[slow] / Math.max(1, half[fast])
  const similar = ratio < 1.15
  let reason: VerdictReason = 'none'
  if (!similar) {
    if (isDrinkOnly(sims[fast].meal) && !isDrinkOnly(sims[slow].meal)) reason = 'drink'
    else if (kcal[fast] < kcal[slow] * 0.9) reason = 'calories'
  }
  return { kind: 'pair', fast, slow, ratio, similar, reason, half, kcal }
}
