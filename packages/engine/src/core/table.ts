/**
 * Builds the signal table from what the modules wrote (A1 + M4). No physiology here, only copies
 * to Float32 under catalog IDs, plus the food sources, so MODEL_VERSION does not change. Rows come
 * in catalog order.
 */
import type { Meal } from '../meal.ts'
import type { SimEvents } from '../events.ts'
import { ACTIVE_SIGNAL_IDS, EVENTS, SIGNALS, type ActiveSignalId, type EventId } from './catalog.ts'
import type { SignalStore } from './module.ts'
import type { SourceId } from './sources.ts'
import type { EventPoint, Series } from './signal.ts'

function series<Id extends ActiveSignalId>(
  meal: Meal,
  id: Id,
  values: ArrayLike<number>,
  band?: { low: ArrayLike<number>; high: ArrayLike<number> },
): Series<Id> {
  const meta = SIGNALS[id]
  const foodSources: SourceId[] = meta.reactsToMeal ? meal.items.map((it) => `food:${it.food.id}` as const) : []
  return {
    meta,
    values: Float32Array.from(values),
    ...(band ? { low: Float32Array.from(band.low), high: Float32Array.from(band.high) } : {}),
    sourceIds: [...meta.sourceIds, ...foodSources],
  }
}

/** One Series per catalog signal the modules wrote (internal `x.*` arrays are never rows). */
export function buildSignalTable(meal: Meal, store: SignalStore): Map<ActiveSignalId, Series> {
  const list: Series[] = []
  for (const id of ACTIVE_SIGNAL_IDS) {
    const w = store.get(id)
    if (w) list.push(series(meal, id, w.values, w.band))
  }
  return new Map(list.map((s) => [s.meta.id as ActiveSignalId, s]))
}

/** One EventPoint per catalog event; atMin null when it does not happen within the run. */
export function buildMoments(e: SimEvents): Map<EventId, EventPoint> {
  const point = <Id extends EventId>(id: Id, atMin: number | null, range?: { low: number; high: number }): EventPoint<Id> => ({
    meta: EVENTS[id],
    atMin,
    ...(range && atMin !== null ? { low: range.low, high: range.high } : {}),
  })
  const list: EventPoint[] = [
    point('event.stomachHalfEmpty', e.stomachHalfEmptyMin),
    point('event.glucosePeak', e.glucosePeak?.timeMin ?? null),
    point('event.glucoseBackToBase', e.glucoseBackToBaseMin),
    point('event.mostlyAbsorbed', e.absorptionMostlyDoneMin),
    // Today's firstExit: "leftovers start leaving the body" (note E). Range = between people.
    point('event.firstLeftovers', e.firstExit?.typical ?? null, e.firstExit ?? undefined),
  ]
  return new Map(list.map((p) => [p.meta.id as EventId, p]))
}
