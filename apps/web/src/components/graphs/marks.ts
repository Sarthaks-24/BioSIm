import { PARAMS, valueAt, type ActiveSignalId, type EventId, type Simulation } from '@lifepeek/engine'

/**
 * Which moments a graph marks on its own line, and when a moment is worth marking at all.
 *
 * Blood sugar: a rise smaller than the "back near the before-meal level" threshold (5 mg/dL,
 * decision 4) never left that level, so it has no "highest" point worth a marker and no
 * "back to base" moment (the engine would put that one minute after the peak). Timeline markers
 * and summary sentences (WP-14, WP-15) should use `glucoseLeftBase` for the same rule.
 */

/** The rise above the before-meal level at the peak, in mg/dL (0 when there is no peak). */
export function glucoseRise(run: Simulation): number {
  const g = run.signals.get('blood.glucose')
  const peak = run.moments.get('event.glucosePeak')?.atMin
  if (!g || peak == null) return 0
  return valueAt(g, peak) - g.values[0]!
}

/** True when blood sugar rose clearly above the before-meal level (more than the 5 mg/dL threshold). */
export const glucoseLeftBase = (run: Simulation) => glucoseRise(run) > PARAMS.glucose.backToBaseMgDl

/** The moment drawn as a ring on each graph's own line, if the graph has one. */
const MARKED: Partial<Record<ActiveSignalId, EventId>> = {
  'blood.glucose': 'event.glucosePeak',
  // By food energy, not grams (decision 3): "How we know" says why the grams can halve sooner.
  'gut.stomach.contentG': 'event.stomachHalfEmpty',
}

export function markedMoment(signal: ActiveSignalId, run: Simulation): { id: EventId; atMin: number } | null {
  const id = MARKED[signal]
  if (!id) return null
  if (id === 'event.glucosePeak' && !glucoseLeftBase(run)) return null
  const atMin = run.moments.get(id)?.atMin
  return atMin == null ? null : { id, atMin }
}
