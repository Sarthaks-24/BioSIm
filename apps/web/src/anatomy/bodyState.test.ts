import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE, valueAt } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import { lookupFood } from '../data/foods.ts'
import { ORGANISMS } from '../registry/index.ts'
import { FILL_SIGNAL, bodyStateAt, gramsIn } from './bodyState.ts'
import { armRadius } from './human/base.ts'
import { STOMACH_EMPTY, stomachFill, stomachFillRadius, stomachRadius, tumble } from './human/digestion.ts'

const run = (...foods: string[]) =>
  simulate({ items: foods.map((foodId) => ({ foodId, servings: 1 })), profile: DEFAULT_PROFILE.human }, { lookup: lookupFood })

describe('body state', () => {
  it('reads each organ through the signal the registry names for it', () => {
    const organs = ORGANISMS.human.organs
    for (const [organ, signal] of Object.entries(FILL_SIGNAL)) expect(organs.find((o) => o.id === organ)?.drives?.fill).toBe(signal)
  })

  it('interpolates between model minutes (valueAt), so a frame between two minutes is smooth', () => {
    const sim = run('roti', 'dal')
    const series = sim.signals.get(FILL_SIGNAL.stomach)!
    const a = valueAt(series, 30, sim.stepMin)
    const b = valueAt(series, 31, sim.stepMin)
    expect(gramsIn(sim, 'stomach', 30.5)).toBeCloseTo((a + b) / 2, 5)
  })

  it('stretches the stomach while it holds food, and lets it go when it empties', () => {
    const sim = run('roti', 'dal', 'milk')
    const full = bodyStateAt(sim, 40)
    const later = bodyStateAt(sim, 20 * 60)
    expect(full.stage).toBe('stomach')
    expect(full.holds.stomach).toBe(true)
    expect(full.stomachFill).toBeGreaterThan(0.4)
    expect(later.holds.stomach).toBe(false)
    expect(later.stomachFill).toBeLessThan(0.1)
    expect(later.holds.largeIntestine).toBe(true)
  })

  it('maps grams to a 0…1 fill', () => {
    expect(stomachFill(0)).toBe(0)
    expect(stomachFill(-5)).toBe(0)
    expect(stomachFill(10_000)).toBe(1)
    expect(stomachFill(175)).toBeCloseTo(0.5, 5)
  })
})

describe('stomach and arm shapes', () => {
  it('keeps the cardia and the pylorus where they are at any fill (no gap at either end)', () => {
    for (const u of [0, 1]) {
      expect(stomachFillRadius(u, 0)).toBeCloseTo(stomachRadius(u) * STOMACH_EMPTY, 6)
      expect(stomachFillRadius(u, 1)).toBeCloseTo(stomachRadius(u) * STOMACH_EMPTY, 6)
    }
    expect(stomachFillRadius(0.4, 1)).toBeGreaterThan(stomachFillRadius(0.4, 0) * 1.4)
  })

  it('tapers the arm from the shoulder to the wrist', () => {
    expect(armRadius(0.05)).toBeGreaterThan(armRadius(0.4))
    expect(armRadius(0.4)).toBeGreaterThan(armRadius(0.8))
    expect(armRadius(0.8)).toBeGreaterThan(0)
  })
})

describe('particle tumble (motion flag, UI-7)', () => {
  it('turns with the meal clock when motion is on', () => {
    expect(tumble(0.3, 100, false)).not.toBe(tumble(0.3, 200, false))
  })

  it('never turns when motion is reduced', () => {
    for (const t of [0, 15, 600, 2880]) expect(tumble(0.3, t, true)).toBe(tumble(0.3, 0, true))
  })
})
