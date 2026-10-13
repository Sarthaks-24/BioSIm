/**
 * effort: the muscles and the skin (model §2.7, §2.9; S-1). After gas in the frozen order (D4),
 * but it reads nothing gas writes: only the energy of moving above rest (energy.activityRate), so
 * S-1 and S-2 build in parallel (R19) and adding either leaves every other signal as it was (D13 iii).
 *
 *   - muscle.energyRate (kcal/h) = resting muscle + all of the activity extra. Resting muscle =
 *     13 kcal/kg/day (Elia 1992, via Wang 2012) × 38.4 % of body mass (Janssen 2000) × kg ÷ 24:
 *     13.5 kcal/h for the 65 kg reference man, 21.6 % of his resting use.
 *   - skin.sweatRate (mL/h) = activity extra (kcal/h) ÷ 0.58 kcal per mL (Baker 2019: 580 kcal per
 *     kg evaporated). Warm room: the dry routes keep their resting values, so sweat carries all of
 *     the extra heat of moving (e = 0: level walking and running do no outside work). The food
 *     effect's heat leaves by the dry routes (D5 C12), so a meal makes no sweat.
 *   - skin.sweatTotal (mL): its running total.
 * Core temperature is held at 37 °C (D5 C4): nothing here feeds back into energy, heart or sweat.
 */
import type { ModelModule } from '../core/module.ts'
import type { Params } from '../params.ts'

export const effortModule: ModelModule = {
  id: 'effort',
  system: 'muscles',
  needs: ['energy.activityRate'],
  provides: ['muscle.energyRate', 'skin.sweatRate', 'skin.sweatTotal'],
  run(ctx) {
    const { n, params, profile } = ctx
    const step = ctx.stepMin
    const { muscleKcalPerKgDay, muscleMassShare, sweatKcalPerMl } = params.effort
    const restingMuscle = (muscleKcalPerKgDay * muscleMassShare * profile.weightKg) / 24
    const activity = ctx.get('energy.activityRate')
    const muscle = new Float64Array(n)
    const sweatRate = new Float64Array(n)
    const sweatTotal = new Float64Array(n)
    let sum = 0
    for (let i = 0; i < n; i++) {
      const extra = activity[i]!
      muscle[i] = restingMuscle + extra
      const sweat = extra / sweatKcalPerMl
      sweatRate[i] = sweat
      sum += (sweat / 60) * step
      sweatTotal[i] = sum
    }
    ctx.put('muscle.energyRate', muscle)
    ctx.put('skin.sweatRate', sweatRate)
    ctx.put('skin.sweatTotal', sweatTotal)
  },
}

/** Heat leaving the body by each route, kcal/min. */
export interface HeatLoss {
  radiation: number
  convection: number
  conduction: number
  evaporation: number
}

/**
 * Where the heat goes (a helper, not a signal; model D10 "heat made = energy used, e = 0"). All
 * energy used ends as heat, and all heat made leaves (core temperature held):
 *   - resting heat leaves by the resting shares (OpenStax §24.6, as shares of their sum);
 *   - the food effect's heat by the dry routes only, in their resting proportions (D5 C12);
 *   - the extra heat of moving by evaporating sweat (warm room; = skin.sweatRate × 0.58).
 * `totalKcalPerMin` is x.energy.total, `activityKcalPerMin` energy.activityRate ÷ 60 and
 * `restingKcalPerMin` the person's resting use.
 */
export function heatLoss(
  totalKcalPerMin: number,
  activityKcalPerMin: number,
  restingKcalPerMin: number,
  effort: Params['effort'],
): HeatLoss {
  const { radiation, convection, conduction, evaporation } = effort.restHeatLoss
  const all = radiation + convection + conduction + evaporation
  const dry = radiation + convection + conduction
  const food = totalKcalPerMin - restingKcalPerMin - activityKcalPerMin
  const share = (route: number) => (restingKcalPerMin * route) / all + (food * route) / dry
  return {
    radiation: share(radiation),
    convection: share(convection),
    conduction: share(conduction),
    evaporation: (restingKcalPerMin * evaporation) / all + activityKcalPerMin,
  }
}
