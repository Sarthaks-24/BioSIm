import { DEFAULT_ORGANISM, ORGANISM_PARAMS, valueAt, type ActiveSignalId, type EventId, type RunResult } from '@lifepeek/engine'

/**
 * Which moments a graph marks on its own line, and when a moment is worth marking at all.
 *
 * Blood sugar: a rise smaller than the "back near the before-meal level" threshold (5 mg/dL,
 * decision 4) never left that level, so it has no "highest" point worth a marker and no
 * "back to base" moment (the engine would put that one minute after the peak). Timeline markers
 * and summary sentences (WP-14, WP-15) use `glucoseLeftBase` for the same rule (lib/moments.ts).
 *
 * Values are read on the run's own clock (`run.stepMin`), and the threshold from the run's
 * organism's parameter set (ORGANISM_PARAMS), never from a global parameter object (verify-1 C2). Every v2.0 run is human.
 */

/** The parameter set a run was made with. v2.0 runs carry no organism, and every one is human. */
const paramsOf = (_run: RunResult) => ORGANISM_PARAMS[DEFAULT_ORGANISM]

/** The rise above the before-meal level at the peak, in mg/dL (0 when there is no peak). */
export function glucoseRise(run: RunResult): number {
  const g = run.signals.get('blood.glucose')
  const peak = run.moments.get('event.glucosePeak')?.atMin
  if (!g || peak == null) return 0
  return valueAt(g, peak, run.stepMin) - g.values[0]!
}

/** True when blood sugar rose clearly above the before-meal level (more than the 5 mg/dL threshold). */
export const glucoseLeftBase = (run: RunResult) => glucoseRise(run) > paramsOf(run).glucose.backToBaseMgDl

/** The moment drawn as a ring on each graph's own line, if the graph has one. */
const MARKED: Partial<Record<ActiveSignalId, EventId>> = {
  'blood.glucose': 'event.glucosePeak',
  // By food energy, not grams (decision 3), so its label says "energy" (StripMarker).
  'gut.stomach.contentG': 'event.stomachHalfEmpty',
}

export function markedMoment(signal: ActiveSignalId, run: RunResult): { id: EventId; atMin: number } | null {
  const id = MARKED[signal]
  if (!id) return null
  if (id === 'event.glucosePeak' && !glucoseLeftBase(run)) return null
  const atMin = run.moments.get(id)?.atMin
  return atMin == null ? null : { id, atMin }
}

/**
 * A graph's ring and what its label says. The ring always sits ON the drawn line (`value`, in the
 * graph's unit); the label names the quantity the moment is about, which is not always the one
 * drawn:
 * - blood sugar: "Highest: 121" is the drawn value itself;
 * - stomach: the line is grams, but "half has left" is by food energy (event.stomachHalfEmpty),
 *   and with a drink the grams halve sooner (the drink leaves first). So the label says "Half the
 *   energy has left the stomach". Only a meal with no energy (water) is halved by weight, and
 *   then the grams on the line are half too: "Half has left the stomach".
 * The kept run gets no ring on a graph (its moments are hollow markers on the timeline), so a
 * graph shows at most one label, even where the two runs' moments coincide.
 */
export interface StripMarker {
  id: EventId
  atMin: number
  /** The drawn line's value at `atMin`: where the ring sits. */
  value: number
  /** i18n key of the label; `graph.highest` takes `value`. */
  labelKey: 'graph.highest' | 'graph.halfEnergyLeft' | 'signals.event.stomachHalfEmpty.name'
}

export function stripMarker(signal: ActiveSignalId, run: RunResult): StripMarker | null {
  const moment = markedMoment(signal, run)
  const series = run.signals.get(signal)
  if (!moment || !series) return null
  const value = valueAt(series, moment.atMin, run.stepMin)
  const labelKey =
    moment.id === 'event.glucosePeak'
      ? 'graph.highest'
      : run.events.noNutrients
        ? 'signals.event.stomachHalfEmpty.name'
        : 'graph.halfEnergyLeft'
  return { ...moment, value, labelKey }
}
