/**
 * Energy in vs used (M5): food energy entering the body from this meal, next to the energy the
 * stated person uses at rest. Two lines on one kcal/h axis; never a score, never "good" or "bad".
 *   in   = Atwater 4·carbs + 4·protein + 9·fat of the grams absorbed (FAO 2003). Fibre left out.
 *   used = the profile's resting kcal/day ÷ 24, the same every minute and for every meal.
 * See docs/MODEL.md "Energy in vs used".
 */
import type { NutrientKind } from '../nutrients.ts'
import type { CoreParams } from '../params.ts'
import type { ProfileDef } from '../core/profile.ts'

export interface EnergySeries {
  /** kcal/h entering the body; index i covers the step that ends at minute i·stepMin (0 at i = 0). */
  inRate: Float64Array
  /** kcal from this meal in the body so far (running total of inRate). */
  inTotal: Float64Array
  /** kcal/h used at rest by the profile. Constant. */
  usedRate: Float64Array
  /** kcal used at rest since the meal started. */
  usedTotal: Float64Array
}

/** Running totals of absorbed carbs, protein and fat (gut.absorbed.*) → the four energy series. */
export function energySignals(
  absorbedG: Readonly<Record<Extract<NutrientKind, 'carbs' | 'protein' | 'fat'>, ArrayLike<number>>>,
  profile: Pick<ProfileDef, 'restingKcalPerDay'>,
  stepMin: number,
  params: CoreParams,
): EnergySeries {
  const f = params.energy.atwaterKcalPerG
  const { carbs, protein, fat } = absorbedG
  const n = carbs.length
  const inRate = new Float64Array(n)
  const inTotal = new Float64Array(n)
  const usedRate = new Float64Array(n)
  const usedTotal = new Float64Array(n)
  const usedPerH = profile.restingKcalPerDay / 24
  const perHour = 60 / stepMin
  for (let i = 0; i < n; i++) {
    inTotal[i] = f.carbs * carbs[i]! + f.protein * protein[i]! + f.fat * fat[i]!
    inRate[i] = i > 0 ? (inTotal[i]! - inTotal[i - 1]!) * perHour : 0
    usedRate[i] = usedPerH
    usedTotal[i] = (usedPerH * i) / perHour
  }
  return { inRate, inTotal, usedRate, usedTotal }
}
