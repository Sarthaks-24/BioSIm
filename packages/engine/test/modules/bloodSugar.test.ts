import { describe, expect, it } from 'vitest'
import { PARAMS, buildMeal, decodeMeal } from '../../src/index.ts'
import { bloodSugarModule } from '../../src/run.ts'
import { lookup } from '../fixtures.ts'
import { N, paramsWith, runAlone } from './ctx.ts'

/** bloodSugar alone, on a fixed stomach carb outflow (architecture §1.5 "Unit"). */

const meal = buildMeal(decodeMeal('glucose-50:1'), lookup)
/** 50 g of carbs leaving the stomach as a liquid, 1 g a minute from minute 5. */
const pulse = Float64Array.from({ length: N }, (_, i) => (i >= 5 && i < 55 ? 1 : 0))
const upstream = (liquid: Float64Array) => ({
  'x.gut.liquidCarbsOutG': { values: liquid },
  'x.gut.solidCarbsOutG': { values: new Float64Array(N) },
})
const glucose = (store: ReturnType<typeof runAlone>) => store.get('blood.glucose')!

describe('bloodSugar module', () => {
  it('no carbs in, fasting glucose all along, band included', () => {
    const g = glucose(runAlone(bloodSugarModule, meal, upstream(new Float64Array(N))))
    expect(g.values.every((v) => v === PARAMS.glucose.fastingMgDl)).toBe(true)
    expect(g.band!.low.every((v) => v === PARAMS.glucose.fastingMgDl)).toBe(true)
  })

  it('a carb pulse raises glucose, then it comes back; the band spreads around it', () => {
    const g = glucose(runAlone(bloodSugarModule, meal, upstream(pulse)))
    const peak = Math.max(...g.values)
    const at = g.values.indexOf(peak)
    expect(peak).toBeGreaterThan(PARAMS.glucose.fastingMgDl + 20)
    expect(g.values[N - 1]! - PARAMS.glucose.fastingMgDl).toBeLessThan(1)
    expect(g.band!.low[at]!).toBeLessThan(peak)
    expect(g.band!.high[at]!).toBeGreaterThan(peak)
  })

  it('reads ctx.params: a higher fasting level moves the whole curve', () => {
    const g = glucose(runAlone(bloodSugarModule, meal, upstream(new Float64Array(N)), paramsWith('glucose.fastingMgDl', 100)))
    expect(g.values[0]).toBe(100)
  })
})
