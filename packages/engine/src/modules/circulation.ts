/**
 * circulation: the heart and where the blood goes (model §2.3, D7, D8; S-3, FIX-S R80/R83; sources
 * read in V-3 and V-FIXS). Seventh in the frozen order, after gas: it reads the oxygen used, the food
 * effect, the absorbed nutrients, the meal and the MET, and writes only its own rows, so adding it
 * changes no earlier signal (D13 iii). Numbers: ctx.params.circulation (packParams.ts, run chunk only).
 *
 * Each minute (L/min unless said):
 *   - CO_rest = resting O2 use at the fasting RQ ÷ 50 mL/L (4.31 for the reference man), constant;
 *   - ΔVO2 of moving = gas.o2UseRate × moving ÷ all energy used: the O2 of the activity extra
 *     alone, at this minute's kcal per litre. The food effect's O2 is NOT counted (D7): the gut's
 *     wider O2 extraction covers it, and its blood is the gut term below;
 *   - ΔCO_act = 5.5 × ΔVO2 of moving;
 *   - food in the gut W = the meal's absorbable energy eaten so far minus what is absorbed (kcal,
 *     weighted fat 1, protein 1, carbs 0.6); L = W through a 20 min first-order lag;
 *     ΔQ_gut = 3 × L ÷ (L + K): a big meal raises it more and for longer than a small drink (R80);
 *   - CO = CO_rest + ΔCO_act + ΔQ_gut (Eriksen 1994: meal and exercise rises add up);
 *   - SV = 65 mL × (1 + 0.4·min(1, ΔCO_act / 5)) × m^0.73, m = (CO_rest + ΔQ_gut) ÷ CO_rest: 1.4× at
 *     most in a bout (D8); a meal's rise is shared, 73 % stroke volume and 27 % heart rate (in logs);
 *   - HR = CO ÷ SV, at most 191;
 *   - gut flow = 24 % of CO_rest + ΔQ_gut − 57 % of the resting gut flow × ΔCO_act ÷ ΔCO_max (R83,
 *     Table 20.3; ΔCO_max = 191 × 91 mL − CO_rest); muscle flow = 21 % of CO_rest + 90 % of ΔCO_act
 *     + what the gut gave up (mL/min). CO is unchanged. Muscles take all of the activity
 *     extra; the heart's and breathing muscles' own cost is inside it.
 * event.gutFlowPeak: the first minute the meal's gut-flow rise is highest, if at least 10 mL/min.
 * No baroreflex, posture, fitness or blood volume (model §2.3 Limits); nothing feeds back. Recovery
 * is simplified: the heart follows the MET's on/off kinetics (activity.ts), with no slow EPOC.
 */
import type { ModelModule } from '../core/module.ts'
import { ACTIVITY_MET } from './activity.ts'

export const circulationModule: ModelModule = {
  id: 'circulation',
  system: 'circulation',
  needs: ['gas.o2UseRate', 'energy.foodEffectRate', 'gut.absorbed.carbsG', 'gut.absorbed.proteinG', 'gut.absorbed.fatG', ACTIVITY_MET],
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
    // The weighted energy of the whole meal that the gut will absorb (absorbed fractions, params.ts).
    const { meal } = ctx.input
    const f = params.absorbedInSmallIntestine
    const mealW = wCarbs * f.carbs * meal.total.carbsG + wProtein * f.protein * meal.total.proteinG + wFat * f.fat * meal.total.fatG
    const keep = Math.exp(-ctx.stepMin / c.gutRiseTauMin)
    // The most a bout can add to CO: the top heart rate at the top stroke volume (R83).
    const coMovingMax = (c.hrMax * c.svRestMl * (1 + c.svRiseMax)) / 1000 - coRest

    const o2 = ctx.get('gas.o2UseRate')
    const foodEffect = ctx.get('energy.foodEffectRate')
    const carbs = ctx.get('gut.absorbed.carbsG')
    const protein = ctx.get('gut.absorbed.proteinG')
    const fat = ctx.get('gut.absorbed.fatG')
    const met = ctx.get(ACTIVITY_MET)

    const rate = new Float64Array(n)
    const output = new Float64Array(n)
    const stroke = new Float64Array(n)
    const gut = new Float64Array(n)
    const muscle = new Float64Array(n)
    let peakAt = -1
    let peakRise = 0
    let load = 0
    for (let i = 0; i < n; i++) {
      // Moving only (MET 1 = rest gives exactly 0): its share of this minute's O2 use, in L/min.
      const moving = met[i]! > 1 ? (met[i]! - 1) * kcalPerMinPerMet : 0
      const vo2Moving = moving > 0 ? (o2[i]! * moving) / (restingPerMin + moving + foodEffect[i]! / 60) / 1000 : 0
      const coMoving = c.coSlopeLPerLO2 * vo2Moving
      // Food in the gut: eaten (as the stomach fills, gut.ts) and not yet absorbed. 0 for water.
      const eaten = meal.eatingMin > 0 ? Math.min(1, (i * ctx.stepMin) / meal.eatingMin) : 1
      const inGut = mealW > 0 ? Math.max(0, mealW * eaten - (wCarbs * carbs[i]! + wProtein * protein[i]! + wFat * fat[i]!)) : 0
      load = keep * load + (1 - keep) * inGut
      const gutRise = load > 0 ? (c.gutRiseMaxLPerMin * load) / (load + c.gutHalfKcal) : 0
      const co = coRest + coMoving + gutRise
      const sv =
        c.svRestMl *
        (1 + c.svRiseMax * Math.min(1, coMoving / c.svRiseAtCoLPerMin)) *
        (gutRise > 0 ? Math.pow((coRest + gutRise) / coRest, 1 - c.hrShareOfMealRise) : 1)
      const givenUp = c.gutGiveUpAtMax * gutRest * Math.min(1, coMoving / coMovingMax)
      output[i] = co
      stroke[i] = sv
      rate[i] = Math.min(c.hrMax, (co * 1000) / sv)
      gut[i] = gutRest + gutRise * 1000 - givenUp
      muscle[i] = muscleRest + c.muscleShareOfRise * coMoving * 1000 + givenUp
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
