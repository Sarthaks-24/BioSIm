import { describe, expect, it } from 'vitest'
import { MODEL_VERSION, buildMeal, decodeMeal, decodeShareState, encodeShareState } from '../src/index.ts'
import { lookup } from './fixtures.ts'

describe('share links', () => {
  it('round-trips a comparison', () => {
    const state = { a: [{ foodId: 'glucose-50', servings: 1 }], b: [{ foodId: 'fatty-meal', servings: 1.5 }], t: 125 }
    const decoded = decodeShareState(encodeShareState(state))
    expect(decoded).toEqual({ modelVersion: MODEL_VERSION, ...state })
  })

  it('survives garbage without throwing', () => {
    const decoded = decodeShareState(new URLSearchParams('a=<script>,cola:abc,cola:99&b=&t=-5&v=xyz'))
    expect(decoded.a).toEqual([{ foodId: 'cola', servings: 5 }])
    expect(decoded.b).toEqual([])
    expect(decoded.t).toBe(0)
    expect(decoded.modelVersion).toBe(MODEL_VERSION)
  })

  it('keeps the link version so old links can be flagged', () => {
    expect(decodeShareState(new URLSearchParams('v=0')).modelVersion).toBe(MODEL_VERSION)
    expect(decodeShareState(new URLSearchParams('v=7')).modelVersion).toBe(7)
  })

  it('unknown foods in a link are skipped when building the meal', () => {
    const meal = buildMeal(decodeMeal('nope:1,glucose-50:2'), lookup)
    expect(meal.items.map((i) => i.food.id)).toEqual(['glucose-50'])
    expect(meal.total.carbsG).toBe(100)
  })
})
