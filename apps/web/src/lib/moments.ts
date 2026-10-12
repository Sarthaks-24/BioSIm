import { EVENT_IDS, type EventId, type Simulation } from '@lifepeek/engine'
import { glucoseLeftBase } from '../components/graphs/marks.ts'

/**
 * The key moments of one run that the dock's timeline marks (WP-14) and that "next / previous
 * moment" (PageDown / PageUp) steps through: every catalog event that happens within the run,
 * in catalog order. Blood sugar's two moments only when blood sugar really left the before-meal
 * level (the graphs' rule, marks.ts): otherwise the engine would put "highest" and "back near the
 * before-meal level" a minute apart on a flat line.
 *
 * Each fact is shown once (03 WP-14): "when" is a marker here; the graphs ring at most one moment
 * each on their own line. v1's "fibre reaches the large intestine" marker is not in the frozen
 * catalog and is dropped (decision 5).
 */
export interface Moment {
  id: EventId
  atMin: number
  /** Between-person range (event.firstLeftovers), drawn as a bar from low to high. */
  low?: number
  high?: number
}

export function runMoments(run: Simulation): Moment[] {
  const leftBase = glucoseLeftBase(run)
  const out: Moment[] = []
  for (const id of EVENT_IDS) {
    const m = run.moments.get(id)
    if (m?.atMin == null || m.atMin > run.horizonMin) continue
    if ((id === 'event.glucosePeak' || id === 'event.glucoseBackToBase') && !leftBase) continue
    out.push(m.low != null && m.high != null ? { id, atMin: m.atMin, low: m.low, high: m.high } : { id, atMin: m.atMin })
  }
  return out
}

/**
 * The words for a moment. "Half has left the stomach" is by food energy (water: by weight), so
 * it says "the energy" when the meal has any, as the stomach graph's ring does (council MUST 1).
 */
export function momentNameKey(id: EventId, run: Simulation): string {
  if (id === 'event.stomachHalfEmpty' && !run.events.noNutrients) return 'graph.halfEnergyLeft'
  return `signals.${id}.name`
}

/**
 * Rows for markers drawn along a bar, so two that nearly coincide (cola's "half has left" and
 * "blood sugar highest" are both near 35 min) never hide each other: each goes in the first row
 * where it is at least `gap` px from the previous marker in that row. `xs` must be sorted.
 */
export function stackRows(xs: readonly number[], gap: number): number[] {
  const last: number[] = []
  return xs.map((x) => {
    let row = last.findIndex((l) => x - l >= gap)
    if (row < 0) row = last.length
    last[row] = x
    return row
  })
}
