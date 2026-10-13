import { describe, expect, it } from 'vitest'
import { PARAMS, PROFILES, buildMeal } from '../../src/index.ts'
import { ENERGY_TOTAL, energyModule, energySignals } from '../../src/run.ts'
import { lookup } from '../fixtures.ts'
import { N, paramsWith, runAlone } from './ctx.ts'

/** energy alone, on fixed absorbed-gram arrays and a fixed MET array (architecture §1.5 "Unit"). */

const ramp = (gPerMin: number) => Float64Array.from({ length: N }, (_, i) => gPerMin * i)
const flat = (v: number) => new Float64Array(N).fill(v)
/** MET 1 everywhere, except `met` from minute `from` (exclusive) to `to` (inclusive). */
const bout = (met: number, from: number, to: number) => Float64Array.from({ length: N }, (_, i) => (i > from && i <= to ? met : 1))
const upstreamWith = (met: Float64Array) => ({
  'gut.absorbed.carbsG': { values: ramp(0.1) },
  'gut.absorbed.proteinG': { values: ramp(0.02) },
  'gut.absorbed.fatG': { values: ramp(0.01) },
  'gut.absorbRate.carbs': { values: flat(0.1) },
  'gut.absorbRate.protein': { values: flat(0.02) },
  'gut.absorbRate.fat': { values: flat(0.01) },
  'x.activity.met': { values: met },
})
const upstream = upstreamWith(flat(1))
const meal = buildMeal([], lookup)
const R = PROFILES['adult-ref'].restingKcalPerDay / 1440

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

  it('MET 1 adds nothing: moving is 0 and the total is resting + food effect', () => {
    const store = runAlone(energyModule, meal, upstream)
    expect(store.get('energy.activityRate')!.values.every((v) => v === 0)).toBe(true)
    expect(store.get('energy.activityTotal')!.values.every((v) => v === 0)).toBe(true)
    const total = store.get(ENERGY_TOTAL)!.values
    const effect = store.get('energy.foodEffectRate')!.values
    for (const i of [0, 10, 600, N - 1]) expect(total[i]!).toBeCloseTo(R + effect[i]! / 60, 12)
  })

  it('a bout adds (MET − 1)·3.5·kg/200 kcal/min for exactly its minutes', () => {
    const store = runAlone(energyModule, meal, upstreamWith(bout(3.8, 30, 50)))
    const rate = store.get('energy.activityRate')!.values
    const extra = (2.8 * 3.5 * 65) / 200 // 3.185 kcal/min
    expect(rate[30]).toBe(0)
    expect(rate[31]!).toBeCloseTo(extra * 60, 9)
    expect(rate[50]!).toBeCloseTo(extra * 60, 9)
    expect(rate[51]).toBe(0)
    expect(store.get('energy.activityTotal')!.values[N - 1]!).toBeCloseTo(extra * 20, 9)
  })

  it('the food effect: Westerterp shares of the absorbed energy, lagged; a steady input settles at its own value', () => {
    const store = runAlone(energyModule, meal, upstream)
    const into = (0.075 * 4 * 0.1 + 0.25 * 4 * 0.02 + 0.02 * 9 * 0.01) * 60 // kcal/h
    const effect = store.get('energy.foodEffectRate')!.values
    // After one tau a step input is 1 − 1/e of the way there.
    expect(effect[PARAMS.energy.foodEffect.tauMin - 1]! / into).toBeCloseTo(1 - Math.exp(-1), 2)
    expect(effect[N - 1]!).toBeCloseTo(into, 9)
  })

  it('reads ctx.params: a faster lag gets there sooner', () => {
    const slow = runAlone(energyModule, meal, upstream).get('energy.foodEffectRate')!.values
    const fast = runAlone(energyModule, meal, upstream, paramsWith('energy.foodEffect.tauMin', 10)).get('energy.foodEffectRate')!.values
    expect(fast[30]!).toBeGreaterThan(slow[30]!)
  })
})
