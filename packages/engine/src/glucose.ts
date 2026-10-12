import type { Meal } from './meal.ts'
import { PARAMS } from './params.ts'

/**
 * Blood glucose from carbohydrate entering the blood.
 *
 * Input: grams per minute of "glycemic" carbohydrate absorbed — the same small-intestine
 * absorption that `absorbedG.carbs` reports, weighted by each food's glycemic index. So the
 * glucose curve and the "absorbed" numbers can never tell different stories.
 *
 * Plasma: rise above fasting, pulled back by baseline clearance plus insulin action that builds
 * up while glucose is high (structure after the Bergman minimal model; constants calibrated).
 */
export interface GlucoseCurve {
  low: Float64Array
  typical: Float64Array
  high: Float64Array
}

/** Fat and protein blunt the rise; protein about twice as much as fat (Moghaddam et al. 2006). */
export function bluntingFactor(meal: Meal): number {
  const g = PARAMS.glucose
  const c = meal.total
  if (c.carbsG <= 0) return 1
  return Math.max(g.bluntingFloor, 1 / (1 + (g.bluntingK * (2 * c.proteinG + c.fatG)) / c.carbsG))
}

export function glucoseCurve(glycemicAbsorbedPerMin: Float64Array, stepMin: number): GlucoseCurve {
  const g = PARAMS.glucose
  const n = glycemicAbsorbedPerMin.length
  const typical = new Float64Array(n)
  const low = new Float64Array(n)
  const high = new Float64Array(n)
  let rise = 0 // mg/dL above fasting
  let insulin = 0 // insulin action (1/min)
  for (let i = 0; i < n; i++) {
    insulin += (g.insulinGain * Math.max(0, rise) - insulin / g.insulinTauMin) * stepMin
    rise += g.gainMgDlPerG * glycemicAbsorbedPerMin[i]! - (rise / g.clearanceTauMin + insulin * rise) * stepMin
    typical[i] = g.fastingMgDl + rise
    low[i] = g.fastingMgDl + rise * g.bandLow
    high[i] = g.fastingMgDl + rise * g.bandHigh
  }
  return { low, typical, high }
}
