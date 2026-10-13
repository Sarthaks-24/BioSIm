import { describe, expect, it } from 'vitest'
import { buildMeal, decodeMeal } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import { lookupFood } from '../data/foods.ts'
import { HORIZON_MIN, KNEE_MIN, timeToPos } from './time.ts'
import { MAX_POINTS, domainFor, minAt, posAt, samplesOf, xAt, yAt, yTicks } from './axis.ts'

// That the playhead stands over the dock's thumb on screen is checked in pixels by e2e/graphs.spec.ts.
describe('shared time axis', () => {
  it('uses the timeline knee: the first 6 h take 60 % of the width', () => {
    expect(xAt(KNEE_MIN, 500)).toBeCloseTo(300)
    expect(xAt(HORIZON_MIN, 500)).toBeCloseTo(500)
    expect(posAt(90)).toBe(timeToPos(90))
  })

  it('turns a drag position back into the minute under it', () => {
    for (const min of [0, 35, 200, KNEE_MIN, 1000, HORIZON_MIN]) expect(minAt(xAt(min, 480), 480)).toBeCloseTo(min, 6)
  })
})

describe('samples for a line', () => {
  const peaky = new Float32Array(HORIZON_MIN + 1).map((_, i) => 90 + 40 * Math.exp(-(((i - 47) / 15) ** 2)) + (i === 2000 ? 5 : 0))

  it('never has more than 400 points, in time order, and keeps every peak', () => {
    const { t, v } = samplesOf(peaky)
    expect(t.length).toBeLessThanOrEqual(MAX_POINTS)
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!)
    expect(Math.max(...v)).toBeCloseTo(Math.max(...peaky), 4)
    expect(v[t.indexOf(2000)]).toBeCloseTo(peaky[2000]!, 4)
    expect(t[0]).toBe(0)
    expect(t[t.length - 1]).toBe(HORIZON_MIN)
  })

  it('keeps the busy first 6 h detailed (3-minute buckets, so never more than 6 min between points)', () => {
    const { t } = samplesOf(peaky)
    const early = [...t].filter((m) => m <= KNEE_MIN)
    for (let i = 1; i < early.length; i++) expect(early[i]! - early[i - 1]!).toBeLessThanOrEqual(6)
  })
})

describe('fixed y range', () => {
  const f = (xs: number[]) => Float32Array.from(xs)

  it('stays at the signal range for every meal that fits (no per-meal rescaling)', () => {
    expect(domainFor([60, 200], [f([90, 121, 90]), f([90, 108])])).toEqual({ domain: [60, 200], stretched: false })
    expect(domainFor([60, 200], [f([90, 91, 90])])).toEqual({ domain: [60, 200], stretched: false })
  })

  it('stretches once, to the next round number, only when a value would not fit', () => {
    expect(domainFor([0, 1000], [f([0, 1376])])).toEqual({ domain: [0, 1500], stretched: true })
    expect(domainFor([60, 200], [f([90, 230])])).toEqual({ domain: [60, 250], stretched: true })
    expect(domainFor([60, 200], [f([55, 90])])).toEqual({ domain: [50, 200], stretched: true })
  })

  it('does not stretch for rounding noise just outside the range', () => {
    expect(domainFor([0, 200], [f([-1.7e-12, 120, 0])])).toEqual({ domain: [0, 200], stretched: false })
    expect(domainFor([0, 600], [f([0, 602])])).toEqual({ domain: [0, 600], stretched: false })
    expect(domainFor([0, 600], [f([0, 1376])])).toEqual({ domain: [0, 1400], stretched: true })
  })

  it('labels the top, the before-meal value when well inside, and the bottom', () => {
    expect(yTicks([60, 200], 90)).toEqual([200, 90, 60])
    expect(yTicks([0, 1000], 0)).toEqual([1000, 500, 0])
    expect(yAt(200, [60, 200], 100)).toBe(0)
    expect(yAt(60, [60, 200], 100)).toBe(100)
  })
})

/**
 * The 6 h "cliff" (council round 2, C2): after a big meal every graph seemed to drop straight down
 * at the knee. The cause is the model plus the axis, not a bug: the stomach lets food out at a
 * steady rate until it is empty (here at about 9 h), so blood sugar and energy coming in stay
 * level and then fall within about an hour, and after 6 h the axis squeezes 42 h into 40 % of
 * the width. The graphs tint that part and break the axis there; "How we know" says why.
 */
describe('the 6 h "cliff" is steady emptying, squeezed', () => {
  const run = simulate(buildMeal(decodeMeal('cheeseburger:1,fries:1'), lookupFood), { particles: 0 })
  const stomach = run.signals.get('gut.stomach.contentG')!.values
  const glucose = run.signals.get('blood.glucose')!.values
  const emptyAt = stomach.findIndex((v, i) => i > 60 && v < 0.5)

  it('the stomach empties at the same rate before and after 6 h, and is empty at about 9 h', () => {
    const rate = (a: number, b: number) => (stomach[a]! - stomach[b]!) / (b - a)
    expect(rate(300, 360)).toBeCloseTo(rate(360, 420), 1)
    expect(stomach[KNEE_MIN]!).toBeGreaterThan(60)
    expect(emptyAt).toBeGreaterThan(8 * 60)
    expect(emptyAt).toBeLessThan(10 * 60)
  })

  it('blood sugar is level until then and falls back within about an hour', () => {
    expect(Math.abs(glucose[KNEE_MIN]! - glucose[4 * 60]!)).toBeLessThan(1.5)
    expect(glucose[emptyAt + 75]! - glucose[0]!).toBeLessThan(2)
  })

  it('on the squeezed axis the last hours of emptying take a few per cent of the width', () => {
    expect(posAt(emptyAt) - posAt(KNEE_MIN)).toBeLessThan(0.04)
    expect(posAt(KNEE_MIN)).toBeCloseTo(0.6)
  })
})
