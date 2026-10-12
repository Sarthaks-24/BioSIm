/**
 * Builds the signal table from today's engine arrays (A1 + M4, v2.0 signals only). This is the
 * mapping in plans/v2 04-CATALOG-DRAFT §5: one line per catalog ID. No new physiology here, only
 * copies and sums, so MODEL_VERSION does not change.
 *
 * Not built yet: energy.inRate, energy.inTotal, energy.usedRate, energy.usedTotal. They need the
 * stated person (core/profile.ts), which WP-06 adds together with their golden tests.
 */
import type { Simulation } from '../simulate.ts'
import { EVENTS, SIGNALS, type ActiveSignalId, type EventId } from './catalog.ts'
import type { SourceId } from './sources.ts'
import type { EventPoint, Series } from './signal.ts'

/** The parts of a run the table is built from (everything except the table itself). */
export type SimArrays = Omit<Simulation, 'signals' | 'moments' | 'rhythms' | 'horizonMin'>

function series<Id extends ActiveSignalId>(
  sim: SimArrays,
  id: Id,
  values: ArrayLike<number>,
  band?: { low: ArrayLike<number>; high: ArrayLike<number> },
): Series<Id> {
  const meta = SIGNALS[id]
  const foodSources: SourceId[] = meta.reactsToMeal ? sim.meal.items.map((it) => `food:${it.food.id}` as const) : []
  return {
    meta,
    values: Float32Array.from(values),
    ...(band ? { low: Float32Array.from(band.low), high: Float32Array.from(band.high) } : {}),
    sourceIds: [...meta.sourceIds, ...foodSources],
  }
}

/** One Series per v2.0 signal the engine produces today (energy.* arrive in WP-06). */
export function buildSignalTable(sim: SimArrays): Map<ActiveSignalId, Series> {
  const n = sim.length
  const content = new Float64Array(n)
  for (let i = 0; i < n; i++) content[i] = sim.stomachLiquidG[i]! + sim.stomachSolidG[i]!
  const a = sim.absorbedG

  const list: Series[] = [
    // Stomach: grams of food as eaten. Intestines and absorbed: grams of tracked nutrients (note A).
    series(sim, 'gut.stomach.contentG', content),
    series(sim, 'gut.stomach.liquidG', sim.stomachLiquidG),
    series(sim, 'gut.stomach.solidG', sim.stomachSolidG),
    series(sim, 'gut.small.contentG', sim.smallIntestineG),
    series(sim, 'gut.colon.contentG', sim.colonG),
    series(sim, 'gut.absorbed.carbsG', a.carbs),
    series(sim, 'gut.absorbed.proteinG', a.protein),
    series(sim, 'gut.absorbed.fatG', a.fat),
    series(sim, 'gut.absorbed.waterG', a.water),
    // Engine spelling stays `fiber`; IDs use the UI spelling. Always 0 (note C).
    series(sim, 'gut.absorbed.fibreG', a.fiber),
    series(sim, 'gut.leftBodyG', sim.excretedG),
    // Absolute mg/dL; the rise above fasting is the helper riseAboveFasting (core/derive.ts).
    series(sim, 'blood.glucose', sim.glucose.typical, { low: sim.glucose.low, high: sim.glucose.high }),
  ]
  return new Map(list.map((s) => [s.meta.id as ActiveSignalId, s]))
}

/** One EventPoint per catalog event; atMin null when it does not happen within the run. */
export function buildMoments(sim: SimArrays): Map<EventId, EventPoint> {
  const e = sim.events
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
