/**
 * Derived views: HELPERS, not IDs (catalog rule). "% of the meal", "rise above fasting" and
 * "where the meal is" are computed from catalog signals or the run for display; they never get
 * a catalog ID, a link parameter or a golden test of their own.
 */
import { indexAt, mealLocation, stomachFraction, type MealLocation } from '../view.ts'
import type { RunResult } from '../result.ts'
import type { Series } from './signal.ts'

/** mg/dL above fasting at every minute (can dip slightly below 0 on the way back down). */
export function riseAboveFasting(glucose: Pick<Series<'blood.glucose'>, 'values'>, fastingMgDl: number): Float32Array {
  const v = glucose.values
  const out = new Float32Array(v.length)
  for (let i = 0; i < v.length; i++) out[i] = v[i]! - fastingMgDl
  return out
}

/** Share (0–1) of the meal still in the stomach at tMin: by food energy, by weight for water. Today's `stomachFraction`. */
export function shareOfMealInStomach(run: RunResult, tMin: number): number {
  return stomachFraction(run, indexAt(run, tMin))
}

/** Where every gram of tracked nutrients is at tMin (for the text table). Today's `mealLocation`. */
export function mealLocationAt(run: RunResult, tMin: number): MealLocation {
  return mealLocation(run, indexAt(run, tMin))
}
