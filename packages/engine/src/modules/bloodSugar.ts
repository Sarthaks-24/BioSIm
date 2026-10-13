/**
 * bloodSugar: blood glucose from the carbohydrate the gut absorbs, weighted by each phase's GI and
 * blunted by the meal's fat and protein (glucose.ts). Moved here unchanged from simulate.ts (E-1).
 * It runs the same small-intestine absorption as the gut's carbs, so the glucose curve and the
 * "absorbed" numbers can never tell different stories.
 */
import { bluntingFactor, glucoseCurve } from '../glucose.ts'
import { runSegment } from '../transit.ts'
import type { ModelModule } from '../core/module.ts'
import { CARBS_OUT } from './gut.ts'

export const bloodSugarModule: ModelModule = {
  id: 'bloodSugar',
  system: 'digestion',
  needs: [CARBS_OUT.liquid, CARBS_OUT.solid],
  provides: ['blood.glucose'],
  run(ctx) {
    const { params, n } = ctx
    const { meal } = ctx.input
    const step = ctx.stepMin
    const blunt = bluntingFactor(meal, params)

    // Grams of "glycemic" carbohydrate leaving the stomach each minute.
    const glycemicOutflow = new Float64Array(n)
    for (const phase of ['liquid', 'solid'] as const) {
      const totals = meal[phase]
      if (totals.massG <= 0) continue
      // GI already includes a food's own emptying speed; see params.glucose.solidGlycemicCorrection.
      const glycemicWeight = (totals.gi / 100) * blunt * (phase === 'solid' ? params.glucose.solidGlycemicCorrection : 1)
      const carbsOut = ctx.get(CARBS_OUT[phase])
      for (let i = 0; i < n; i++) if (carbsOut[i]! > 0) glycemicOutflow[i]! += carbsOut[i]! * glycemicWeight
    }

    const siT = params.smallIntestine.typicalMin / step
    const glycemic = runSegment(glycemicOutflow, siT, params.absorbedInSmallIntestine.carbs, params.absorptionTauMin.carbs)
    const glycemicRate = new Float64Array(n)
    for (let i = 0; i < n; i++) glycemicRate[i] = glycemic.absorbedCum[i]! - (i > 0 ? glycemic.absorbedCum[i - 1]! : 0)
    const glucose = glucoseCurve(glycemicRate, step, params)
    ctx.put('blood.glucose', glucose.typical, { low: glucose.low, high: glucose.high })
  },
}
