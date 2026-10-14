/**
 * Builds the signal table from what the modules wrote (A1 + M4). No physiology here, only copies
 * to Float32 under catalog IDs, plus the food sources, so MODEL_VERSION does not change. Rows come
 * in catalog order: the lean catalog's, then each pack's (core/catalog/rows.ts).
 */
import type { Meal } from '../meal.ts'
import type { SimEvents } from '../events.ts'
import { EVENTS, type EventId, type LeanEventId, type RunSignalId } from './catalog.ts'
import { RUN_SIGNALS, RUN_SIGNAL_IDS } from './catalog/rows.ts'
import type { SignalStore } from './module.ts'
import type { SourceId } from './sources.ts'
import type { EventPoint, Series } from './signal.ts'

function series<Id extends RunSignalId>(
  meal: Meal,
  id: Id,
  values: ArrayLike<number>,
  band?: { low: ArrayLike<number>; high: ArrayLike<number> },
): Series<Id> {
  const meta = RUN_SIGNALS[id] as Series<Id>['meta']
  const foodSources: SourceId[] = meta.reactsToMeal ? meal.items.map((it) => `food:${it.food.id}` as const) : []
  return {
    meta,
    values: Float32Array.from(values),
    ...(band ? { low: Float32Array.from(band.low), high: Float32Array.from(band.high) } : {}),
    sourceIds: [...meta.sourceIds, ...foodSources],
  }
}

/** One Series per catalog signal the modules wrote (internal `x.*` arrays are never rows). */
export function buildSignalTable(meal: Meal, store: SignalStore): Map<RunSignalId, Series> {
  const list: Series[] = []
  for (const id of RUN_SIGNAL_IDS) {
    const w = store.get(id)
    if (w) list.push(series(meal, id, w.values, w.band))
  }
  return new Map(list.map((s) => [s.meta.id as RunSignalId, s]))
}

/** One EventPoint per catalog event; atMin null when it does not happen within the run. */
export function buildMoments(e: SimEvents): Map<EventId, EventPoint> {
  const point = <Id extends LeanEventId>(id: Id, atMin: number | null, range?: { low: number; high: number }): EventPoint<Id> => ({
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
