/**
 * circulation: the heart and where the blood goes (model §2.3, D7, D8; S-3; sources read in V-3).
 * Seventh in the frozen order, after gas: it reads the oxygen used, the food effect, the absorbed
 * nutrients and the MET, and writes only its own rows, so adding it changes no earlier signal
 * (D13 iii). Numbers: ctx.params.circulation (packParams.ts, run chunk only).
 *
 * Each minute (L/min unless said):
 *   - CO_rest = resting O2 use at the fasting RQ ÷ 50 mL/L (4.31 for the reference man), constant;
 *   - ΔVO2 of moving = gas.o2UseRate × moving ÷ all energy used: the O2 of the activity extra
 *     alone, at this minute's kcal per litre. The food effect's O2 is NOT counted (D7): the gut's
 *     wider O2 extraction covers it, and its blood is the gut term below;
 *   - ΔCO_act = 5.5 × ΔVO2 of moving;
 *   - ΔQ_gut = 3 × Rw ÷ (Rw + K), Rw = absorbed kcal/min weighted fat 1, protein 1, carbs 0.6;
 *   - CO = CO_rest + ΔCO_act + ΔQ_gut (Eriksen 1994: meal and exercise rises add up);
 *   - SV = 65 mL × (1 + 0.4·min(1, ΔCO_act / 5)): 1.4× at most (D8); a meal leaves it;
 *   - HR = CO ÷ SV, at most 191;
 *   - gut flow = 24 % of CO_rest + ΔQ_gut; muscle flow = 21 % of CO_rest + 90 % of ΔCO_act (mL/min).
 * event.gutFlowPeak: the first minute gut flow is highest, if it rises by at least 10 mL/min.
 * No baroreflex, posture, fitness or blood volume (model §2.3 Limits); nothing feeds back.
 */
import type { ModelModule } from '../core/module.ts'
import { ACTIVITY_MET } from './activity.ts'

export const circulationModule: ModelModule = {
  id: 'circulation',
  system: 'circulation',
  needs: ['gas.o2UseRate', 'energy.foodEffectRate', 'gut.absorbRate.carbs', 'gut.absorbRate.protein', 'gut.absorbRate.fat', ACTIVITY_MET],
  provides: ['heart.rate', 'heart.output', 'heart.strokeVolume', 'blood.flow.gut', 'blood.flow.muscle'],
  moments: ['event.gutFlowPeak'],
  run(ctx) {
    const { n, params, profile } = ctx
    const c = params.circulation
    const { weirO2, weirCo2, rqFasting } = params.gas
    const atwater = params.energy.atwaterKcalPerG
    const { restO2MlPerKgMin, kcalPerLO2 } = params.activity

    const restingPerMin = profile.restingKcalPerDay / 1440
    const kcalPerMinPerMet = (restO2MlPerKgMin * profile.weightKg * kcalPerLO2) / 1000
    // Resting O2 use (mL/min) at the fasting RQ, over the a–v difference (mL per L of blood): L/min.
    const coRest = (restingPerMin * 1000) / (weirO2 + weirCo2 * rqFasting) / c.restAvdo2MlPerL
    const gutRest = c.gutRestShare * coRest * 1000
    const muscleRest = c.muscleRestShare * coRest * 1000
    const wCarbs = c.gutWeight.carbs * atwater.carbs
    const wProtein = c.gutWeight.protein * atwater.protein
    const wFat = c.gutWeight.fat * atwater.fat

    const o2 = ctx.get('gas.o2UseRate')
    const foodEffect = ctx.get('energy.foodEffectRate')
    const carbs = ctx.get('gut.absorbRate.carbs')
    const protein = ctx.get('gut.absorbRate.protein')
    const fat = ctx.get('gut.absorbRate.fat')
    const met = ctx.get(ACTIVITY_MET)

    const rate = new Float64Array(n)
    const output = new Float64Array(n)
    const stroke = new Float64Array(n)
    const gut = new Float64Array(n)
    const muscle = new Float64Array(n)
    let peakAt = -1
    let peakRise = 0
    for (let i = 0; i < n; i++) {
      // Moving only (MET 1 = rest gives exactly 0): its share of this minute's O2 use, in L/min.
      const moving = met[i]! > 1 ? (met[i]! - 1) * kcalPerMinPerMet : 0
      const vo2Moving = moving > 0 ? (o2[i]! * moving) / (restingPerMin + moving + foodEffect[i]! / 60) / 1000 : 0
      const coMoving = c.coSlopeLPerLO2 * vo2Moving
      const rw = wCarbs * carbs[i]! + wProtein * protein[i]! + wFat * fat[i]!
      const gutRise = rw > 0 ? (c.gutRiseMaxLPerMin * rw) / (rw + c.gutHalfKcalPerMin) : 0
      const co = coRest + coMoving + gutRise
      const sv = c.svRestMl * (1 + c.svRiseMax * Math.min(1, coMoving / c.svRiseAtCoLPerMin))
      output[i] = co
      stroke[i] = sv
      rate[i] = Math.min(c.hrMax, (co * 1000) / sv)
      gut[i] = gutRest + gutRise * 1000
      muscle[i] = muscleRest + c.muscleShareOfRise * coMoving * 1000
      if (gutRise * 1000 > peakRise) {
        peakRise = gutRise * 1000
        peakAt = i
      }
    }
    ctx.put('heart.rate', rate)
    ctx.put('heart.output', output)
    ctx.put('heart.strokeVolume', stroke)
    ctx.put('blood.flow.gut', gut)
    ctx.put('blood.flow.muscle', muscle)
    ctx.putMoment('event.gutFlowPeak', peakRise >= c.gutPeakMinRiseMlPerMin ? peakAt * ctx.stepMin : null)
  },
}
