/**
 * How fast a rhythm is drawn (anatomy plan §2.0, §4; flash safety, WCAG 2.3.1): the caps and the
 * capped rate, shared by the flat rhythm layer (flat/rhythm.ts), the drawings' maths
 * (systems/breathing/breath.ts, systems/circulation/beat.ts) and the 3D layers. Pure: no store, no
 * React, so a lazy 3D layer that imports it takes nothing of the stage with it.
 */

/** The fastest rhythm drawn, in cycles per second (150 a minute). */
export const MAX_DRAWN_HZ = 2.5
/** The fastest breath drawn (48 a minute; ui-ux §4, architecture §1.7): a run's 33 a minute is 0.55 Hz. */
export const MAX_BREATH_HZ = 0.8

/** The phase a still (reduced motion) rhythm is drawn at: mid-way, as the plan's still frames are. */
export const STILL_PHASE = 0.5

/**
 * How fast a rhythm of `perMin` (beats or breaths a minute, from the run) is drawn: its rate in
 * Hz, capped at `max` (MAX_DRAWN_HZ; breaths MAX_BREATH_HZ), and whether it was slowed (the chip
 * then says "animation slowed").
 */
export function drawnRate(perMin: number, max = MAX_DRAWN_HZ): { hz: number; slowed: boolean } {
  // No number (a missing signal, NaN, ∞) draws nothing moving rather than a wild rate.
  if (!Number.isFinite(perMin)) return { hz: 0, slowed: false }
  const hz = Math.max(0, perMin) / 60
  return hz > max ? { hz: max, slowed: true } : { hz, slowed: false }
}
