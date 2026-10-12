import { windowOf, type Series } from '@lifepeek/engine'
import { HORIZON_MIN, KNEE_MIN, posToTime, timeToPos } from './time.ts'

/**
 * The graphs' shared axes (G2). x uses the timeline's squeezed scale (`timeToPos`: the first 6 h
 * get 60 % of the width), so a minute sits at the same x on every graph and under the dock's
 * thumb. y is fixed per signal (G4): the catalog's `displayRange`, the same for every meal.
 */

/** Where minute `min` sits along a time axis, 0 (eating) … 1 (48 h). The dock's thumb is placed with this. */
export const posAt = (min: number) => timeToPos(min)

/** x in CSS pixels of minute `min` on a plot `width` px wide: the same scale as the dock's thumb. */
export const xAt = (min: number, width: number) => posAt(min) * width

/** The minute under x on a plot `width` px wide (for dragging on a graph). */
export const minAt = (x: number, width: number) => (width > 0 ? posToTime(x / width) : 0)

/** Most points one line may have (plan-graphs §3.10). */
export const MAX_POINTS = 400
/** Of those, the points for the first 6 h, which get 60 % of the width and most of the action. */
const KNEE_POINTS = 240

/**
 * One series (or its band edge) thinned to ≤ MAX_POINTS for drawing, keeping every peak
 * (`windowOf` keeps each bucket's lowest and highest point). Thinned in two parts, before and
 * after the 6 h knee, so the busy first hours keep the extremes of every 3 minutes. The first and
 * last minutes are always kept, so the line runs the whole width.
 */
export function samplesOf(values: Float32Array, horizonMin = HORIZON_MIN, stepMin = 1): { t: Float32Array; v: Float32Array } {
  const s: Pick<Series, 'values'> = { values }
  const last = Math.min(horizonMin, (values.length - 1) * stepMin)
  // One point of each budget is left for the two ends.
  const parts = [
    windowOf(s, 0, KNEE_MIN, KNEE_POINTS - 1, stepMin),
    windowOf(s, KNEE_MIN + stepMin, last, MAX_POINTS - KNEE_POINTS - 1, stepMin),
  ]
  const t: number[] = []
  const v: number[] = []
  const push = (tm: number, vm: number) => {
    if (t.length && tm <= t[t.length - 1]!) return
    t.push(tm)
    v.push(vm)
  }
  if (values.length) push(0, values[0]!)
  for (const p of parts) for (let i = 0; i < p.t.length; i++) push(p.t[i]!, p.v[i]!)
  if (values.length) push(last, values[Math.round(last / stepMin)]!)
  return { t: Float32Array.from(t), v: Float32Array.from(v) }
}

export type Domain = readonly [number, number]

/**
 * The y-range of a graph: the signal's fixed `displayRange`. Only a value outside it stretches
 * the range, once, to the next round number (so a 4-bottle meal still fits), and `stretched`
 * says so for the note under the graph. Never shrinks: a small rise looks small.
 */
export function domainFor(range: Domain, arrays: readonly (Float32Array | undefined)[]): { domain: Domain; stretched: boolean } {
  // Rounding noise (an energy rate of −0.000000000002 kcal/h) is not a value outside the range:
  // only an overshoot of more than 0.5 % of it counts.
  const slack = (range[1] - range[0]) * 0.005
  let lo = range[0]
  let hi = range[1]
  for (const a of arrays) {
    if (!a) continue
    for (let i = 0; i < a.length; i++) {
      const v = a[i]!
      if (v > hi && v > range[1] + slack) hi = v
      if (v < lo && v < range[0] - slack) lo = v
    }
  }
  if (lo === range[0] && hi === range[1]) return { domain: range, stretched: false }
  // "Round" = a step of half the range's own order of magnitude: 60–200 stretches by 50s, 0–1000 by 500s.
  const step = 10 ** Math.floor(Math.log10(range[1] - range[0])) / 2
  return {
    domain: [lo < range[0] ? Math.floor(lo / step) * step : range[0], hi > range[1] ? Math.ceil(hi / step) * step : range[1]],
    stretched: true,
  }
}

/**
 * The labelled y values: the bottom and top of the range and, if it sits well inside, the value
 * before eating (blood sugar's 90), which the eye compares everything with. Without one, the middle.
 * Top first, so the labels read down the axis in order.
 */
export function yTicks([lo, hi]: Domain, before?: number): number[] {
  const inside = before !== undefined && before > lo + (hi - lo) * 0.15 && before < hi - (hi - lo) * 0.15
  return [hi, inside ? before : (lo + hi) / 2, lo]
}

/** y in CSS pixels (0 = top) of value v on a plot `height` px tall. */
export const yAt = (v: number, [lo, hi]: Domain, height: number) => height - ((v - lo) / (hi - lo)) * height

/** An SVG path through the points (1 decimal is plenty at CSS-pixel scale). */
export function linePath(t: Float32Array, v: Float32Array, x: (min: number) => number, y: (v: number) => number): string {
  let d = ''
  for (let i = 0; i < t.length; i++) d += `${i ? 'L' : 'M'}${x(t[i]!).toFixed(1)} ${y(v[i]!).toFixed(1)}`
  return d
}

/** A closed area between two edges (the "how people differ" band): along the top, back along the bottom. */
export function bandPath(
  high: { t: Float32Array; v: Float32Array },
  low: { t: Float32Array; v: Float32Array },
  x: (min: number) => number,
  y: (v: number) => number,
): string {
  let d = linePath(high.t, high.v, x, y)
  for (let i = low.t.length - 1; i >= 0; i--) d += `L${x(low.t[i]!).toFixed(1)} ${y(low.v[i]!).toFixed(1)}`
  return `${d}Z`
}
