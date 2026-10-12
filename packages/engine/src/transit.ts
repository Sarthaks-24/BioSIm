/**
 * A gut segment as a fixed-delay pipe: what enters at minute τ leaves at τ + T.
 * While inside, a fraction `absorb` of it is absorbed at a steady rate.
 *
 * Small- and large-intestine transit times are NOT computed from the food — they vary far more
 * between people than between meals — so we use cited typical values and show ranges in the UI.
 *
 * Implemented with prefix sums so a 48 h simulation stays O(n).
 */
export interface SegmentResult {
  /** Grams inside the segment at each minute. */
  content: Float64Array
  /** Grams leaving the far end at each minute (input to the next segment). */
  outflow: Float64Array
  /** Cumulative grams absorbed by each minute. */
  absorbedCum: Float64Array
}

export function runSegment(inflow: Float64Array, transitMin: number, absorb: number): SegmentResult {
  const n = inflow.length
  const T = Math.max(1, Math.round(transitMin))
  const p0 = new Float64Array(n) // Σ inflow(τ), τ ≤ t
  const p1 = new Float64Array(n) // Σ τ·inflow(τ), τ ≤ t
  let s0 = 0
  let s1 = 0
  for (let t = 0; t < n; t++) {
    s0 += inflow[t]!
    s1 += t * inflow[t]!
    p0[t] = s0
    p1[t] = s1
  }
  const at = (arr: Float64Array, i: number) => (i < 0 ? 0 : arr[Math.min(i, n - 1)]!)

  const content = new Float64Array(n)
  const outflow = new Float64Array(n)
  const absorbedCum = new Float64Array(n)
  for (let t = 0; t < n; t++) {
    const w0 = at(p0, t) - at(p0, t - T)
    const w1 = at(p1, t) - at(p1, t - T)
    // Each parcel in the window has been inside for (t-τ) minutes and lost absorb·(t-τ)/T of itself.
    content[t] = Math.max(0, (1 - (absorb * t) / T) * w0 + (absorb / T) * w1)
    outflow[t] = (1 - absorb) * (t - T >= 0 ? inflow[t - T]! : 0)
    const exitedCum = (1 - absorb) * at(p0, t - T)
    absorbedCum[t] = Math.max(0, at(p0, t) - content[t]! - exitedCum)
  }
  return { content, outflow, absorbedCum }
}
