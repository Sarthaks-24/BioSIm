/**
 * View helpers (E-2): what the screen reads from a finished run, without the engine. They read
 * the run's signal table and meal only, so they live in the main entry while `simulate` is in the
 * lazy `@lifepeek/engine/run` chunk (architecture §3.1). Moved here from simulate.ts unchanged,
 * except that they read the signals instead of the raw arrays the run no longer carries.
 */
import type { Meal } from './meal.ts'
import { ABSORBED_ID, NUTRIENT_KINDS, type StageId } from './nutrients.ts'
import { stomachShare } from './stomach.ts'
import type { ActiveSignalId } from './core/catalog.ts'
import type { RunResult } from './result.ts'

/** A signal's values in a run. Every view helper reads the gut through this. */
const values = (run: Pick<RunResult, 'signals'>, id: ActiveSignalId): Float32Array => run.signals.get(id)!.values

/** Index into the per-minute arrays for a time in minutes (clamped). */
export function indexAt(run: Pick<RunResult, 'length' | 'stepMin'>, tMin: number): number {
  return Math.min(run.length - 1, Math.max(0, Math.round(tMin / run.stepMin)))
}

/**
 * Share (0–1) of the meal still in the stomach at minute index i (by food energy; by weight for water).
 * @deprecated New code uses `shareOfMealInStomach` (core/derive.ts), which takes minutes.
 */
export function stomachFraction(run: RunResult, i: number): number {
  return stomachShare(run.meal, values(run, 'gut.stomach.liquidG')[i]!, values(run, 'gut.stomach.solidG')[i]!)
}

export interface MealLocation {
  stomach: number
  smallIntestine: number
  largeIntestine: number
  absorbed: number
  leftBody: number
  /** Everything above adds up to this (grams of tracked nutrients). */
  total: number
}

/**
 * Where every gram of tracked nutrients is at minute index i. Sums to the meal's total.
 * @deprecated New code uses `mealLocationAt` (core/derive.ts), which takes minutes.
 */
export function mealLocation(run: RunResult, i: number): MealLocation {
  const tracked = (p: Meal['total']) => p.carbsG + p.proteinG + p.fatG + p.fiberG + p.waterG
  const m = run.meal
  const phaseShare = (stored: Float32Array, p: Meal['total']) => (p.massG > 0 ? (stored[i]! / p.massG) * tracked(p) : 0)
  return {
    stomach: phaseShare(values(run, 'gut.stomach.liquidG'), m.liquid) + phaseShare(values(run, 'gut.stomach.solidG'), m.solid),
    smallIntestine: values(run, 'gut.small.contentG')[i]!,
    largeIntestine: values(run, 'gut.colon.contentG')[i]!,
    absorbed: NUTRIENT_KINDS.reduce((a, k) => a + values(run, ABSORBED_ID[k])[i]!, 0),
    leftBody: values(run, 'gut.leftBodyG')[i]!,
    total: tracked(m.total),
  }
}

/** Grams of tracked nutrients that have left the body by the end of the run. */
export const leftBodyAtEnd = (run: RunResult): number => values(run, 'gut.leftBodyG')[run.length - 1]!

/**
 * Below this share of the meal still in the stomach and intestines, the gut has finished with it
 * (the rest is rounding dust or a last gram of leftovers): the UI's "done" state starts here.
 */
export const GUT_DONE_SHARE = 0.01

/** True once (nearly) all of the meal has been taken into the body or has left it. */
export function gutIsDone(loc: MealLocation): boolean {
  const inGut = loc.stomach + loc.smallIntestine + loc.largeIntestine
  return loc.total > 0 && inGut < GUT_DONE_SHARE * loc.total && loc.absorbed + loc.leftBody > inGut
}

/** Where most of the meal is at time t — drives the "what's happening now" panel. */
export function activeStage(run: RunResult, tMin: number): StageId {
  if (run.meal.items.length === 0) return 'mouth'
  if (tMin < run.meal.eatingMin) return 'mouth'
  if (tMin < run.stomachArrivalMin) return 'esophagus'
  const loc = mealLocation(run, indexAt(run, tMin))
  // Once the gut has (all but) finished with the meal, the three are zeros and rounding dust: keep
  // the last organ that held it (the large intestine if any leftovers left the body), never fall
  // back to the stomach (review 14-17, HIGH 1: a cheeseburger "in the stomach" from 30 h on).
  if (gutIsDone(loc)) {
    return leftBodyAtEnd(run) > 0 || loc.largeIntestine > 0 ? 'largeIntestine' : 'smallIntestine'
  }
  if (loc.stomach >= loc.smallIntestine && loc.stomach >= loc.largeIntestine) return 'stomach'
  if (loc.smallIntestine >= loc.largeIntestine) return 'smallIntestine'
  return 'largeIntestine'
}
