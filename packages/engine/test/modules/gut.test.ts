import { describe, expect, it } from 'vitest'
import { buildMeal, decodeMeal, type ModuleSignalId } from '../../src/index.ts'
import { gutModule, simulate } from '../../src/run.ts'
import { lookup } from '../fixtures.ts'
import { paramsWith, runAlone } from './ctx.ts'

/** gut alone (architecture §1.5 "Unit"). It needs nothing upstream. */

const meal = buildMeal(decodeMeal('standard-meal:1,glucose-50:1'), lookup)
const values = (store: ReturnType<typeof runAlone>, id: ModuleSignalId) => store.get(id)!.values

describe('gut module', () => {
  it('alone, it writes the same arrays a full run shows', () => {
    const store = runAlone(gutModule, meal)
    const sim = simulate(meal, { particles: 0 })
    for (const id of gutModule.provides) expect(Float32Array.from(values(store, id)), id).toEqual(sim.signals.get(id)!.values)
  })

  it('an empty meal leaves every array at zero', () => {
    const store = runAlone(gutModule, buildMeal([], lookup))
    for (const id of [...gutModule.provides, ...gutModule.internal!])
      expect(
        values(store, id).every((v) => v === 0),
        id,
      ).toBe(true)
  })

  it('carbs leaving the stomach (x.*) add up to the carbs that enter the small intestine', () => {
    const store = runAlone(gutModule, meal)
    const sum = (id: ModuleSignalId) => values(store, id).reduce((a, v) => a + v, 0)
    expect(sum('x.gut.liquidCarbsOutG') + sum('x.gut.solidCarbsOutG')).toBeCloseTo(meal.total.carbsG, 6)
  })

  it('reads ctx.params: a slower colon keeps more in it at 30 h', () => {
    const at30h = 30 * 60
    const slow = runAlone(gutModule, meal, {}, paramsWith('colon.typicalMin', 28 * 60))
    expect(values(slow, 'gut.colon.contentG')[at30h]!).toBeGreaterThan(values(runAlone(gutModule, meal), 'gut.colon.contentG')[at30h]!)
  })
})
