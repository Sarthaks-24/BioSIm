/**
 * gut: the meal through the stomach (stomach.ts), small intestine and large intestine
 * (transit.ts), minute by minute for 48 h. Moved here unchanged from simulate.ts (E-1).
 *
 * It also writes, for bloodSugar, the grams of carbohydrate leaving the stomach each minute per
 * phase (liquid / solid), and for the "leftovers" moment the running total of fibre reaching the
 * colon. Those are internal arrays (`x.*`), never shown.
 *
 * E-3b-eng: it also writes the grams absorbed per minute (gut.absorbRate.*, the rate of each
 * gut.absorbed.* total, which the energy module's food effect reads) and the running total of the
 * meal's water leaving the body (x.gut.leftWaterG, for the water balance). Activity never reaches
 * the gut in v3.0 (model D6, C3): the gut reads no activity.
 */
import type { Meal } from '../meal.ts'
import type { CoreParams } from '../params.ts'
import { ABSORBED_ID, GRAMS_KEY, NUTRIENT_KINDS, type NutrientKind } from '../nutrients.ts'
import { emptyingCurves, retention } from '../stomach.ts'
import { runSegment } from '../transit.ts'
import type { ModelModule } from '../core/module.ts'

/** Grams of carbohydrate leaving the stomach per minute, liquid and solid phase. */
export const CARBS_OUT = { liquid: 'x.gut.liquidCarbsOutG', solid: 'x.gut.solidCarbsOutG' } as const
/** Running total of fibre (leftovers) that has reached the colon, g. */
export const LEFTOVERS_IN_COLON = 'x.gut.leftoversInColonG'
/** Running total of the meal's water that has left the body (in faeces), g: the water part of gut.leftBodyG. */
export const LEFT_WATER = 'x.gut.leftWaterG'

/** The absorbed-per-minute signal of each nutrient that has one (model ACTIVATION_LOG, E-3b-eng). */
export const ABSORB_RATE_ID = {
  carbs: 'gut.absorbRate.carbs',
  protein: 'gut.absorbRate.protein',
  fat: 'gut.absorbRate.fat',
  water: 'gut.absorbRate.water',
} as const satisfies Partial<Record<NutrientKind, string>>
const RATE_KINDS = Object.keys(ABSORB_RATE_ID) as (keyof typeof ABSORB_RATE_ID)[]

/** Minute the meal starts arriving in the stomach (end of eating + swallow). */
export const stomachArrivalMin = (meal: Meal, params: CoreParams): number => meal.eatingMin + params.esophagus.transitMin

export const gutModule: ModelModule = {
  id: 'gut',
  system: 'digestion',
  needs: [],
  provides: [
    'gut.stomach.contentG',
    'gut.stomach.liquidG',
    'gut.stomach.solidG',
    'gut.small.contentG',
    'gut.colon.contentG',
    'gut.absorbed.carbsG',
    'gut.absorbed.proteinG',
    'gut.absorbed.fatG',
    'gut.absorbed.waterG',
    'gut.absorbed.fibreG',
    'gut.leftBodyG',
    ...RATE_KINDS.map((k) => ABSORB_RATE_ID[k]),
  ],
  internal: [CARBS_OUT.liquid, CARBS_OUT.solid, LEFTOVERS_IN_COLON, LEFT_WATER],
  run(ctx) {
    const { params, n } = ctx
    const { meal } = ctx.input
    const step = ctx.stepMin
    const zeros = () => new Float64Array(n)
    const curves = emptyingCurves(meal, params)
    const eatingMin = meal.eatingMin
    const arrival = stomachArrivalMin(meal, params)

    // --- Stomach: what's inside and what leaves each minute -----------------------------------
    const stomachLiquidG = zeros()
    const stomachSolidG = zeros()
    const outflow = Object.fromEntries(NUTRIENT_KINDS.map((k) => [k, zeros()])) as Record<NutrientKind, Float64Array>
    const carbsOut = { liquid: zeros(), solid: zeros() }

    for (const phase of ['liquid', 'solid'] as const) {
      const totals = meal[phase]
      if (totals.massG <= 0) continue
      const curve = curves[phase]
      const store = phase === 'liquid' ? stomachLiquidG : stomachSolidG
      let prev = 1
      for (let i = 0; i < n; i++) {
        const t = i * step
        if (t < arrival) {
          store[i] = totals.massG * (eatingMin > 0 ? Math.min(1, t / eatingMin) : 1)
          continue
        }
        const frac = retention(curve, t - arrival)
        store[i] = totals.massG * frac
        const left = Math.max(0, prev - frac)
        prev = frac
        if (left <= 0) continue
        for (const k of NUTRIENT_KINDS) outflow[k][i]! += totals[GRAMS_KEY[k]] * left
        carbsOut[phase][i] = totals.carbsG * left
      }
    }

    // --- Intestines ---------------------------------------------------------------------------
    const siT = params.smallIntestine.typicalMin / step
    const coT = params.colon.typicalMin / step
    const smallIntestineG = zeros()
    const colonG = zeros()
    const excretedG = zeros()
    const leftoversInColonCum = zeros()
    const leftWaterCum = zeros()
    const absorbedG = {} as Record<NutrientKind, Float64Array>
    for (const k of NUTRIENT_KINDS) {
      const small = runSegment(outflow[k], siT, params.absorbedInSmallIntestine[k], params.absorptionTauMin[k])
      const large =
        k === 'water'
          ? runSegment(small.outflow, coT, params.colonWaterAbsorbed, params.colonWaterTauMin)
          : runSegment(small.outflow, coT, 0, 1)
      const abs = zeros()
      let inColon = 0
      let out = 0
      for (let i = 0; i < n; i++) {
        smallIntestineG[i]! += small.content[i]!
        colonG[i]! += large.content[i]!
        abs[i] = small.absorbedCum[i]! + large.absorbedCum[i]!
        out += large.outflow[i]!
        excretedG[i]! += out
        if (k === 'water') leftWaterCum[i] = out
        // Leftovers = fibre, the part the body cannot digest. Small unabsorbed amounts of sugar,
        // protein or fat are fermented by gut bacteria and don't count as "left over".
        if (k === 'fiber') {
          inColon += small.outflow[i]!
          leftoversInColonCum[i]! += inColon
        }
      }
      absorbedG[k] = abs
    }

    // Stomach: grams of food as eaten. Intestines and absorbed: grams of tracked nutrients.
    const content = zeros()
    for (let i = 0; i < n; i++) content[i] = stomachLiquidG[i]! + stomachSolidG[i]!
    ctx.put('gut.stomach.contentG', content)
    ctx.put('gut.stomach.liquidG', stomachLiquidG)
    ctx.put('gut.stomach.solidG', stomachSolidG)
    ctx.put('gut.small.contentG', smallIntestineG)
    ctx.put('gut.colon.contentG', colonG)
    for (const k of NUTRIENT_KINDS) ctx.put(ABSORBED_ID[k], absorbedG[k])
    ctx.put('gut.leftBodyG', excretedG)
    ctx.put(CARBS_OUT.liquid, carbsOut.liquid)
    ctx.put(CARBS_OUT.solid, carbsOut.solid)
    ctx.put(LEFTOVERS_IN_COLON, leftoversInColonCum)
    ctx.put(LEFT_WATER, leftWaterCum)
    // Grams absorbed in the step that ends at minute i, per minute (index 0: what is already in).
    // Never below 0: the running total can dip by rounding (1e-14 g) where nothing is absorbed.
    for (const k of RATE_KINDS) {
      const total = absorbedG[k]
      const rate = zeros()
      for (let i = 0; i < n; i++) rate[i] = Math.max(0, total[i]! - (i > 0 ? total[i - 1]! : 0)) / step
      ctx.put(ABSORB_RATE_ID[k], rate)
    }
  },
}
