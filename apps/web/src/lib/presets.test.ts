import { describe, expect, it } from 'vitest'
import { decodeMeal, valueAt, type MealItem } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import { lookupFood } from '../data/foods.ts'
import { runMoments } from './moments.ts'
import { LESSONS, PRESETS, TASKS } from './presets.ts'
import { QR_PATH } from './qrPath.ts'

const run = (items: MealItem[]) => simulate({ items }, { lookup: lookupFood, particles: 0 })
const moments = (items: MealItem[] | undefined) => (items?.length ? runMoments(run(items)).map((m) => m.atMin) : [])

describe('ready links', () => {
  it('every lesson but "One cola or four" opens at its first key moment (the first marker on the timeline)', () => {
    for (const l of LESSONS.filter((l) => l.key !== 'colaFour')) {
      const first = Math.min(...moments(l.meal), ...moments(l.kept))
      expect(l.t, l.key).toBe(Math.round(first))
    }
  })

  it('"One cola or four" opens at the half hour where four colas keep blood sugar raised furthest above one (council round 3)', () => {
    const l = LESSONS.find((l) => l.key === 'colaFour')!
    const [one, four] = [run(l.meal), run(l.kept!)]
    const gap = (min: number) =>
      valueAt(four.signals.get('blood.glucose')!, min, four.stepMin) - valueAt(one.signals.get('blood.glucose')!, min, one.stepMin)
    let best = 0
    for (let m = 1; m <= 6 * 60; m++) if (gap(m) > gap(best)) best = m
    expect(l.t).toBe(Math.round(best / 30) * 30)
    expect(gap(l.t)).toBeGreaterThan(0.99 * gap(best))
    // There, one cola is back near the before-meal level (within 5 mg/dL) and four are not.
    const base = one.signals.get('blood.glucose')!.values[0]!
    expect(valueAt(one.signals.get('blood.glucose')!, l.t, one.stepMin) - base).toBeLessThan(5)
    expect(valueAt(four.signals.get('blood.glucose')!, l.t, four.stepMin) - base).toBeGreaterThan(5)
  })

  it('every preset, lesson and question uses real foods', () => {
    for (const p of [...PRESETS, ...LESSONS, ...TASKS])
      for (const i of [...p.meal, ...(p.kept ?? [])]) expect(lookupFood(i.foodId), `${p.key}: ${i.foodId}`).toBeDefined()
  })

  it('the Teach QR code opens the screen questions 1 to 3 start from (council round 3)', () => {
    const url = new URL(QR_PATH, 'https://example.org')
    expect(url.pathname).toBe('/sim')
    expect(url.searchParams.get('t')).toBeNull()
    expect(url.searchParams.get('b')).toBeNull()
    for (const task of TASKS.slice(0, 3)) {
      expect(task.kept ?? []).toEqual([])
      expect(decodeMeal(url.searchParams.get('a')!)).toEqual(task.meal)
    }
  })
})
