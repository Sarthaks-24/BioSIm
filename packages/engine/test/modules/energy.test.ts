import { describe, expect, it } from 'vitest'
import { PARAMS, PROFILES, buildMeal } from '../../src/index.ts'
import { energyModule, energySignals } from '../../src/run.ts'
import { lookup } from '../fixtures.ts'
import { N, paramsWith, runAlone } from './ctx.ts'

/** energy alone, on fixed absorbed-gram arrays (architecture §1.5 "Unit"). */

const ramp = (gPerMin: number) => Float64Array.from({ length: N }, (_, i) => gPerMin * i)
const upstream = {
  'gut.absorbed.carbsG': { values: ramp(0.1) },
  'gut.absorbed.proteinG': { values: ramp(0.02) },
  'gut.absorbed.fatG': { values: ramp(0.01) },
} as const
const meal = buildMeal([], lookup)

describe('energy module', () => {
  it('writes energySignals() of the absorbed grams for the run’s person', () => {
    const store = runAlone(energyModule, meal, upstream)
    const absorbed = {
      carbs: upstream['gut.absorbed.carbsG'].values,
      protein: upstream['gut.absorbed.proteinG'].values,
      fat: upstream['gut.absorbed.fatG'].values,
    }
    const e = energySignals(absorbed, PROFILES['adult-ref'], 1, PARAMS)
    for (const k of ['inRate', 'inTotal', 'usedRate', 'usedTotal'] as const) expect(store.get(`energy.${k}`)!.values, k).toEqual(e[k])
    // 0.1·4 + 0.02·4 + 0.01·9 = 0.57 kcal per minute = 34.2 kcal/h.
    expect(store.get('energy.inRate')!.values[10]!).toBeCloseTo(34.2, 9)
  })

  it('reads ctx.params: fat at 0 kcal/g takes fat out of energy in', () => {
    const store = runAlone(energyModule, meal, upstream, paramsWith('energy.atwaterKcalPerG.fat', 0))
    expect(store.get('energy.inRate')!.values[10]!).toBeCloseTo(28.8, 9)
  })
})
