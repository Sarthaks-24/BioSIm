import { describe, expect, it } from 'vitest'
import { simulate, type MealItem } from '@lifepeek/engine'
import { lookupFood } from '../data/foods.ts'
import { runMoments } from './moments.ts'
import { LESSONS, PRESETS, TASKS } from './presets.ts'

const moments = (items: MealItem[] | undefined) =>
  items?.length ? runMoments(simulate({ items }, { lookup: lookupFood, particles: 0 })).map((m) => m.atMin) : []

describe('ready links', () => {
  it('every lesson opens at its first key moment (the first marker on the timeline)', () => {
    for (const l of LESSONS) {
      const first = Math.min(...moments(l.meal), ...moments(l.kept))
      expect(l.t, l.key).toBe(Math.round(first))
    }
  })

  it('every preset, lesson and question uses real foods', () => {
    for (const p of [...PRESETS, ...LESSONS, ...TASKS])
      for (const i of [...p.meal, ...(p.kept ?? [])]) expect(lookupFood(i.foodId), `${p.key}: ${i.foodId}`).toBeDefined()
  })
})
