import type { FoodPhase } from './schema.ts'
import type { Meal } from './meal.ts'
import { PARAMS } from './params.ts'

/**
 * Gastric emptying — the one stage the model actually computes from the food.
 *
 * - Liquids: exponential. Water leaves fast; calories slow it toward the energy-regulated rate.
 * - Solids: power-exponential with a lag (food must be ground small first). Half-time grows with
 *   the energy the duodenum has to accept — including calories from drinks taken with the meal,
 *   because the small intestine's feedback limits *total* calories, not just solid ones.
 */

export interface EmptyingCurve {
  phase: FoodPhase
  halfTimeMin: number
  beta: number
}

export function emptyingCurves(meal: Meal): Record<FoodPhase, EmptyingCurve> {
  const s = PARAMS.stomach
  const rate = s.energyKcalPerMin
  const liquidHalf = Math.max(s.waterHalfTimeMin, meal.liquid.energyKcal / (2 * rate))
  const solidHalf = s.solidLagMin + (meal.solid.energyKcal + meal.liquid.energyKcal) / (2 * rate)
  return {
    liquid: { phase: 'liquid', halfTimeMin: liquidHalf, beta: s.liquidBeta },
    solid: { phase: 'solid', halfTimeMin: solidHalf, beta: s.solidBeta },
  }
}

/** Fraction (0–1) of a phase still in the stomach `t` minutes after it arrived. */
export function retention(curve: EmptyingCurve, t: number): number {
  if (t <= 0) return 1
  return Math.pow(2, -Math.pow(t / curve.halfTimeMin, curve.beta))
}

/** Minutes after arrival at which fraction `q` (0–1) of the phase has left the stomach. */
export function emptiedAt(curve: EmptyingCurve, q: number): number {
  const clamped = Math.min(Math.max(q, 0), 0.9999)
  return curve.halfTimeMin * Math.pow(-Math.log2(1 - clamped), 1 / curve.beta)
}
