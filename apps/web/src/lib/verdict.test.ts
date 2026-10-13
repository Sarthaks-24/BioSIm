import { describe, expect, it } from 'vitest'
import { buildMeal, decodeMeal, simulate } from '@lifepeek/engine'
import { lookupFood } from '../data/foods.ts'
import { PRESETS } from './presets.ts'
import { verdictData } from './verdict.ts'
import type { Sims } from '../state/sim.ts'

/** The verdict is what students read first, so it must be true for every lesson the app offers. */
const sim = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookupFood), { particles: 0 })
const pair = (a: string, b: string): Sims => ({ a: sim(a), b: sim(b) })
const encode = (items: { foodId: string; servings: number }[]) => items.map((i) => `${i.foodId}:${i.servings}`).join(',')

describe('verdict', () => {
  it('cola vs burger + fries: cola is faster, because it is only a drink', () => {
    const v = verdictData(pair('cola:1', 'cheeseburger:1,fries:1'))
    expect(v).toMatchObject({ kind: 'pair', fast: 'a', reason: 'drink' })
    if (v.kind === 'pair') expect(v.ratio).toBeGreaterThan(4)
  })

  it('apple vs orange juice: the juice is faster even with more calories — reason is drink, never calories', () => {
    const v = verdictData(pair('apple:1', 'orange-juice:1'))
    expect(v).toMatchObject({ kind: 'pair', fast: 'b', reason: 'drink' })
  })

  it('cola vs salad: never claims calories as the reason when the faster meal has more', () => {
    const v = verdictData(pair('cola:1', 'green-salad:1'))
    expect(v.kind).toBe('pair')
    if (v.kind === 'pair') expect(v.reason).not.toBe('calories')
  })

  it('adding a cola to burger + fries does not make that meal "faster"', () => {
    const v = verdictData(pair('cheeseburger:1,fries:1', 'cheeseburger:1,fries:1,cola:1'))
    expect(v.kind).toBe('pair')
    if (v.kind === 'pair') expect(v.similar || v.fast === 'a').toBe(true)
  })

  it('whenever calories are given as the reason, the slower meal really has more of them', () => {
    const meals = [
      'cola:1',
      'water:1',
      'milk:1',
      'apple:1',
      'white-rice:1',
      'roti:1,dal:1',
      'cheeseburger:1,fries:1',
      'green-salad:1',
      'idli:1',
    ]
    for (const a of meals)
      for (const b of meals) {
        if (a === b) continue
        const v = verdictData(pair(a, b))
        if (v.kind === 'pair' && v.reason === 'calories') expect(v.kcal[v.slow], `${a} vs ${b}`).toBeGreaterThan(v.kcal[v.fast])
      }
  })

  it('every ready-made lesson gives a sensible verdict', () => {
    for (const p of PRESETS) {
      const v = verdictData(pair(encode(p.meal), encode(p.kept)))
      expect(v.kind, p.key).toBe('pair')
    }
  })

  it("meal A's numbers don't depend on what meal B is", () => {
    const a1 = verdictData(pair('cola:1', 'water:1'))
    const a2 = verdictData(pair('cola:1', 'cheeseburger:1,fries:1'))
    if (a1.kind === 'pair' && a2.kind === 'pair') expect(a1.half.a).toBe(a2.half.a)
  })
})
