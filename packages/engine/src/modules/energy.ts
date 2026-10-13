/**
 * energy: food energy entering the body (Atwater kcal of the absorbed grams) next to the energy
 * the stated person uses at rest (energy/energyBalance.ts), as in v2. Model version 3 (E-3b-eng,
 * model §2.1, D2, D3) adds the energy used by moving and by digesting:
 *   - moving, above rest: (MET − 1)·3.5·kg/200 kcal/min (net MET; Compendium 2024), so MET 1 adds
 *     exactly 0 and a resting run is unchanged;
 *   - the food effect: shares of the absorbed carbohydrate, protein and fat energy (Westerterp
 *     2004), reaching energy use through a first-order lag (tau calibrated, Reed & Hill 1996);
 *   - x.energy.total = resting + moving + food effect (kcal/min), the only "energy used" any later
 *     module reads (breathing, heart, muscles, skin, water).
 * energy.usedRate keeps its frozen meaning: resting only. Moving never changes energy.in*.
 */
import { energySignals } from '../energy/energyBalance.ts'
import type { ModelModule } from '../core/module.ts'
import { ACTIVITY_MET } from './activity.ts'

/** All energy used, kcal/min (internal): resting + moving + food effect. */
export const ENERGY_TOTAL = 'x.energy.total'

export const energyModule: ModelModule = {
  id: 'energy',
  system: 'digestion',
  needs: [
    'gut.absorbed.carbsG',
    'gut.absorbed.proteinG',
    'gut.absorbed.fatG',
    'gut.absorbRate.carbs',
    'gut.absorbRate.protein',
    'gut.absorbRate.fat',
    ACTIVITY_MET,
  ],
  provides: [
    'energy.inRate',
    'energy.inTotal',
    'energy.usedRate',
    'energy.usedTotal',
    'energy.activityRate',
    'energy.activityTotal',
    'energy.foodEffectRate',
  ],
  internal: [ENERGY_TOTAL],
  run(ctx) {
    const { n, params, profile } = ctx
    const step = ctx.stepMin
    const absorbedG = {
      carbs: ctx.get('gut.absorbed.carbsG'),
      protein: ctx.get('gut.absorbed.proteinG'),
      fat: ctx.get('gut.absorbed.fatG'),
    }
    const e = energySignals(absorbedG, profile, step, params)
    ctx.put('energy.inRate', e.inRate)
    ctx.put('energy.inTotal', e.inTotal)
    ctx.put('energy.usedRate', e.usedRate)
    ctx.put('energy.usedTotal', e.usedTotal)

    // Moving: kcal/min above rest for each MET above 1.
    const { restO2MlPerKgMin, kcalPerLO2 } = params.activity
    const kcalPerMinPerMet = (restO2MlPerKgMin * profile.weightKg * kcalPerLO2) / 1000
    const met = ctx.get(ACTIVITY_MET)
    const activityRate = new Float64Array(n)
    const activityTotal = new Float64Array(n)
    // Food effect: kcal/min going in (shares of the absorbed energy), then the lag.
    const atwater = params.energy.atwaterKcalPerG
    const share = params.energy.foodEffect
    const carbs = ctx.get('gut.absorbRate.carbs')
    const protein = ctx.get('gut.absorbRate.protein')
    const fat = ctx.get('gut.absorbRate.fat')
    const keep = Math.exp(-step / share.tauMin)
    const foodEffectRate = new Float64Array(n)
    const total = new Float64Array(n)
    const restingPerMin = profile.restingKcalPerDay / 1440
    let activitySum = 0
    let effect = 0
    for (let i = 0; i < n; i++) {
      const moving = (met[i]! - 1) * kcalPerMinPerMet
      activitySum += moving * step
      activityRate[i] = moving * 60
      activityTotal[i] = activitySum
      const into =
        share.carbs * atwater.carbs * carbs[i]! + share.protein * atwater.protein * protein[i]! + share.fat * atwater.fat * fat[i]!
      // Exact step of dy/dt = (into − y)/tau for an input held over the step: the lag keeps the area.
      effect = keep * effect + (1 - keep) * into
      foodEffectRate[i] = effect * 60
      total[i] = restingPerMin + moving + effect
    }
    ctx.put('energy.activityRate', activityRate)
    ctx.put('energy.activityTotal', activityTotal)
    ctx.put('energy.foodEffectRate', foodEffectRate)
    ctx.put(ENERGY_TOTAL, total)
  },
}
