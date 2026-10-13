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
 * Markers drawn along a bar, merged where they nearly coincide (council round 2): cola's "half
 * has left", "blood sugar highest" and "back near the before-meal level" all fall in its first
 * hour, a few pixels apart, and would pile up on the thumb. Each marker starts a new group unless
 * it is less than `gap` px after the one before it; a group is drawn as one target that names all
 * its moments. `xs` must be sorted. Returns each marker's group index.
 */
export function groupClose(xs: readonly number[], gap: number): number[] {
  let group = -1
  return xs.map((x, i) => (i === 0 || x - xs[i - 1]! >= gap ? ++group : group))
}

/**
 * The hit area of each target along a bar, as px left and right of its point: `size` wide, or
 * split halfway where a neighbour is closer, so two targets never overlap. A single target, or
 * the first and last, get the full half `size` on their open side (verify: a lone marker was
 * once given a 12 px button with its dot on the edge). `xs` must be sorted.
 */
export function hitAreas(xs: readonly number[], size: number): { before: number; after: number }[] {
  const half = size / 2
  return xs.map((x, i) => ({
    before: i > 0 ? Math.min(half, (x - xs[i - 1]!) / 2) : half,
    after: i < xs.length - 1 ? Math.min(half, (xs[i + 1]! - x) / 2) : half,
  }))
}
