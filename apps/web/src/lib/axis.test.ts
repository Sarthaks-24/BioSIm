import { describe, expect, it } from 'vitest'
import { HORIZON_MIN, KNEE_MIN, timeToPos } from './time.ts'
import { MAX_POINTS, domainFor, minAt, posAt, samplesOf, xAt, yAt, yTicks } from './axis.ts'

/** Where the dock's thumb centre sits: the track's left edge plus --pos (set from posAt) of its width (Scrubber.tsx). */
const thumbX = (min: number, left: number, width: number) => left + posAt(min) * width

describe('shared time axis', () => {
  it('puts the playhead exactly over the dock thumb, at 20 times and 3 widths', () => {
    const times = Array.from({ length: 20 }, (_, i) => Math.round((i / 19) ** 2 * HORIZON_MIN))
    for (const width of [302, 466, 548]) {
      for (const min of times) {
        // The graph and the track start at the same x (left), so their x within the box must match.
        expect(xAt(min, width) + 100, `${min} min at ${width}px`).toBeCloseTo(thumbX(min, 100, width), 6)
      }
    }
  })

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
