import { describe, expect, it } from 'vitest'
import { HORIZON_MIN, posToTime, timeToPos } from './time.ts'
import { PRESETS } from './presets.ts'
import { FOODS, lookupFood } from '../data/foods.ts'

describe('timeline scale', () => {
  it('round-trips and is monotonic', () => {
    let prev = -1
    for (let m = 0; m <= HORIZON_MIN; m += 37) {
      const p = timeToPos(m)
      expect(p).toBeGreaterThan(prev)
      expect(posToTime(p)).toBeCloseTo(m, 6)
      prev = p
    }
  })

  it('gives the first 6 hours most of the bar', () => {
    expect(timeToPos(360)).toBeCloseTo(0.6)
    expect(timeToPos(0)).toBe(0)
    expect(timeToPos(HORIZON_MIN)).toBe(1)
  })
})

describe('bundled content', () => {
  it('loads every food file', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(15)
  })

  it('every preset refers to real foods', () => {
    for (const p of PRESETS) for (const i of [...p.meal, ...p.kept]) expect(lookupFood(i.foodId), i.foodId).toBeDefined()
  })
})
