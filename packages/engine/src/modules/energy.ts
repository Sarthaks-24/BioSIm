/**
 * energy: food energy entering the body (Atwater kcal of the absorbed grams) next to the energy
 * the stated person uses at rest (energy/energyBalance.ts). Moved here unchanged from simulate.ts
 * (E-1). Later (E-3b) it also owns `x.energy.total`, the only "energy used" other modules read.
 */
import { energySignals } from '../energy/energyBalance.ts'
import type { ModelModule } from '../core/module.ts'

export const energyModule: ModelModule = {
  id: 'energy',
  needs: ['gut.absorbed.carbsG', 'gut.absorbed.proteinG', 'gut.absorbed.fatG'],
  provides: ['energy.inRate', 'energy.inTotal', 'energy.usedRate', 'energy.usedTotal'],
  run(ctx) {
    const absorbedG = {
      carbs: ctx.get('gut.absorbed.carbsG'),
      protein: ctx.get('gut.absorbed.proteinG'),
      fat: ctx.get('gut.absorbed.fatG'),
    }
    const e = energySignals(absorbedG, ctx.profile, ctx.stepMin, ctx.params)
    ctx.put('energy.inRate', e.inRate)
    ctx.put('energy.inTotal', e.inTotal)
    ctx.put('energy.usedRate', e.usedRate)
    ctx.put('energy.usedTotal', e.usedTotal)
  },
}
