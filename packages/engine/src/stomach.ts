import type { FoodPhase } from './schema.ts'
import type { Meal } from './meal.ts'
import { PARAMS, type Params } from './params.ts'

/**
 * Gastric emptying — the one stage the model computes from the food.
 *
 * Liquids (no lag):
 *   - water-like drinks empty exponentially (half-time ~16 min);
 *   - drinks with calories can't go faster than the duodenum's ~2.13 kcal/min, so they empty
 *     in a straight line. Whichever is slower wins.
 *
 * Solids: nothing leaves during the grinding lag, then they empty in a straight line at the
 * same kcal/min limit. Calories from a drink taken with the meal share that limit, so a sugary
 * drink delays the solid food a little (it gets through first).
 *
 * Straight-line (linear) emptying after a lag is what Siegel et al. 1988 measured for solids
 * and Brener et al. 1983 for glucose drinks.
 */

export interface EmptyingCurve {
  phase: FoodPhase
  /** Minutes before anything leaves (solids only). */
  lagMin: number
  /** Minutes to empty completely at the kcal/min limit, after the lag. 0 = no limit. */
  linearMin: number
  /** Water-like exponential half-time, liquids only (0 = not used). */
  waterHalfTimeMin: number
}

/** Even a zero-calorie solid (salad) needs time to be ground and pushed out. Modelling assumption. */
const SOLID_MIN_EMPTY_MIN = 60

export function emptyingCurves(meal: Meal, params: Params = PARAMS): Record<FoodPhase, EmptyingCurve> {
  const s = params.stomach
  // Drink calories eaten with a solid meal go first and use up part of the solids' time budget.
  const drinkMinutes = meal.liquid.energyKcal / s.energyKcalPerMin
  return {
    liquid: {
      phase: 'liquid',
      lagMin: 0,
      linearMin: drinkMinutes,
      waterHalfTimeMin: s.waterHalfTimeMin,
    },
    solid: {
      phase: 'solid',
      lagMin: s.solidLagMin,
      linearMin: Math.max(SOLID_MIN_EMPTY_MIN, meal.solid.energyKcal / s.solidKcalPerMin + drinkMinutes),
      waterHalfTimeMin: 0,
    },
  }
}

/**
 * "Full-speed minutes" of emptying achieved after t minutes. The lag is not a hard wall: the
 * emptying rate ramps up from zero over 2 × lag, which gives exactly the lag as the intercept of
 * the straight-line part — how scintigraphy studies define the lag phase.
 */
function effectiveMinutes(lag: number, t: number): number {
  if (lag <= 0) return Math.max(0, t)
  if (t <= 0) return 0
  return t < 2 * lag ? (t * t) / (4 * lag) : t - lag
}

/**
 * Share (0–1) of the meal still in the stomach, given the grams of each phase there now.
 * Measured by FOOD ENERGY, so a glass of water with a burger doesn't make the burger look like
 * it left faster. A meal with no energy at all (water) is measured by weight instead.
 */
export function stomachShare(meal: Meal, liquidG: number, solidG: number): number {
  const part = (grams: number, p: Meal['liquid']) => (p.massG > 0 ? grams / p.massG : 0)
  if (meal.total.energyKcal >= 1) {
    return (part(liquidG, meal.liquid) * meal.liquid.energyKcal + part(solidG, meal.solid) * meal.solid.energyKcal) / meal.total.energyKcal
  }
  return meal.total.massG > 0 ? (liquidG + solidG) / meal.total.massG : 0
}

/** Fraction (0–1) of a phase still in the stomach `t` minutes after it arrived. */
export function retention(curve: EmptyingCurve, t: number): number {
  if (t <= 0) return 1
  const linear = curve.linearMin > 0 ? Math.max(0, 1 - effectiveMinutes(curve.lagMin, t) / curve.linearMin) : 0
  const water = curve.waterHalfTimeMin > 0 ? Math.pow(2, -t / curve.waterHalfTimeMin) : 0
  return Math.max(linear, water)
}

/** Minutes after arrival at which fraction `q` (0–1) of the phase has left the stomach. */
export function emptiedAt(curve: EmptyingCurve, q: number): number {
  const clamped = Math.min(Math.max(q, 0), 0.9999)
  const x = curve.linearMin * clamped // full-speed minutes needed
  const lag = curve.lagMin
  const linear = lag <= 0 ? x : x <= lag ? Math.sqrt(4 * lag * x) : x + lag
  const water = curve.waterHalfTimeMin > 0 ? -curve.waterHalfTimeMin * Math.log2(1 - clamped) : 0
  return Math.max(linear, water)
}
