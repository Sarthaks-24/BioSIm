/**
 * A gut segment as a pipe: what enters at minute τ leaves at τ + T.
 * While inside, a fraction `absorb` of it is absorbed, quickly at first and then more slowly
 * (first-order with time constant `tau`), so most absorption happens near the start of the
 * segment — as it does in the small intestine.
 *
 * Transit times are NOT computed from the food — they vary far more between people than
 * between meals — so we use cited typical values and show ranges in the UI.
 */
export interface SegmentResult {
  /** Grams inside the segment at each minute. */
  content: Float64Array
  /** Grams leaving the far end at each minute (input to the next segment). */
  outflow: Float64Array
  /** Cumulative grams absorbed by each minute. */
  absorbedCum: Float64Array
}

export function runSegment(inflow: Float64Array, transitMin: number, absorb: number, tauMin: number): SegmentResult {
  const n = inflow.length
  const T = Math.max(1, Math.round(transitMin))
  const content = new Float64Array(n)
  const outflow = new Float64Array(n)
  const absorbedCum = new Float64Array(n)

  if (absorb === 0) {
    // Nothing absorbed: the segment just holds a sliding window of the inflow (fast path).
    let window = 0
    for (let t = 0; t < n; t++) {
      window += inflow[t]!
      if (t - T >= 0) {
        window -= inflow[t - T]!
        outflow[t] = inflow[t - T]!
      }
      content[t] = Math.max(0, window)
    }
    return { content, outflow, absorbedCum }
  }

  // Fraction of a parcel still present after `age` minutes inside the segment.
  const remaining = new Float64Array(T)
  const norm = 1 - Math.exp(-T / tauMin)
  for (let age = 0; age < T; age++) remaining[age] = 1 - (absorb * (1 - Math.exp(-age / tauMin))) / norm

  for (let s = 0; s < n; s++) {
    const v = inflow[s]!
    if (v === 0) continue
    const end = Math.min(n, s + T)
    for (let t = s; t < end; t++) content[t]! += v * remaining[t - s]!
    if (s + T < n) outflow[s + T]! += v * (1 - absorb)
  }

  // Mass balance: everything that entered is either still inside, has left, or was absorbed.
  let entered = 0
  let exited = 0
  for (let t = 0; t < n; t++) {
    entered += inflow[t]!
    exited += outflow[t]!
    absorbedCum[t] = Math.max(0, entered - content[t]! - exited)
  }
  return { content, outflow, absorbedCum }
}
