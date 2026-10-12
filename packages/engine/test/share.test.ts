import { describe, expect, it } from 'vitest'
import { MODEL_VERSION, buildMeal, decodeMeal, decodeShareState, encodeShareState } from '../src/index.ts'
import { lookup } from './fixtures.ts'

describe('share links', () => {
  it('round-trips a comparison, including language', () => {
    const state = { a: [{ foodId: 'glucose-50', servings: 1 }], b: [{ foodId: 'fatty-meal', servings: 1.5 }], t: 125, lang: 'hi' as const }
    const decoded = decodeShareState(encodeShareState(state))
    expect(decoded).toEqual({ modelVersion: MODEL_VERSION, ...state })
  })

  it('a link made with model v1 still opens the same meals (format is a contract)', () => {
    const old = decodeShareState(new URLSearchParams('v=1&a=cola%3A1&b=cheeseburger%3A1%2Cfries%3A1&t=90'))
    expect(old.modelVersion).toBe(1)
    expect(old.a).toEqual([{ foodId: 'cola', servings: 1 }])
    expect(old.b).toEqual([
      { foodId: 'cheeseburger', servings: 1 },
      { foodId: 'fries', servings: 1 },
    ])
    expect(old.t).toBe(90)
  })

  it('survives garbage without throwing', () => {
    const decoded = decodeShareState(new URLSearchParams('a=<script>,cola:abc,cola:99&b=&t=-5&v=xyz&lang=fr'))
    expect(decoded.a).toEqual([{ foodId: 'cola', servings: 5 }])
    expect(decoded.b).toEqual([])
    expect(decoded.t).toBe(0)
    expect(decoded.modelVersion).toBe(MODEL_VERSION)
    expect(decoded.lang).toBeUndefined()
  })

  it('merges a food listed twice instead of creating two rows', () => {
    expect(decodeMeal('cola:1,cola:2')).toEqual([{ foodId: 'cola', servings: 3 }])
  })

  it('clamps time to the 48 h window', () => {
    expect(decodeShareState(new URLSearchParams('t=999999')).t).toBe(48 * 60)
  })

  it('unknown foods in a link are skipped and reported', () => {
    const meal = buildMeal(decodeMeal('nope:1,glucose-50:2'), lookup)
    expect(meal.items.map((i) => i.food.id)).toEqual(['glucose-50'])
    expect(meal.unknownIds).toEqual(['nope'])
    expect(meal.total.carbsG).toBe(100)
  })
})
