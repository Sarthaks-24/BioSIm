/**
 * The engine worker's wire format (W-2, architecture §3.2). A `RunResult` crosses from the worker
 * to the page as plain data: its Maps become lists, every catalog row becomes its ID (the page
 * attaches the very same row objects again, from the run chunk's catalog), and every Float32 array
 * is transferred, not copied. `fromWire(structuredClone(toWire(run)))` deep-equals `run`, every
 * array to the byte (test/wire.test.ts), so a run looks the same whether the worker or the page made it.
 */
import type { FoodLookup } from './meal.ts'
import type { RunResult } from './result.ts'
import { SIGNALS, type RunEventId, type RunSignalId, type SignalId } from './core/catalog.ts'
import { RUN_EVENTS, RUN_SIGNALS } from './core/catalog/rows.ts'
import type { SourceId } from './core/sources.ts'
import type { EventPoint, Rhythm, Series } from './core/signal.ts'

export interface WireSeries {
  id: RunSignalId
  values: Float32Array
  low?: Float32Array
  high?: Float32Array
  sourceIds: readonly SourceId[]
}
export interface WireMoment {
  id: RunEventId
  atMin: number | null
  low?: number
  high?: number
}
export type WireRhythm = Omit<Rhythm, 'meta'> & { id: SignalId }

/** A run on the wire: the result without its Maps and catalog rows. */
export interface WireResult extends Omit<RunResult, 'signals' | 'moments' | 'rhythms'> {
  signals: WireSeries[]
  moments: WireMoment[]
  rhythms: WireRhythm[]
}

/** A run as plain data, and the buffers to transfer with it (each series' arrays have buffers of their own). */
export function toWire(run: RunResult): { wire: WireResult; transfer: ArrayBuffer[] } {
  const { signals, moments, rhythms, ...rest } = run
  const transfer: ArrayBuffer[] = []
  const take = (a: Float32Array) => {
    if (!transfer.includes(a.buffer as ArrayBuffer)) transfer.push(a.buffer as ArrayBuffer)
    return a
  }
  return {
    wire: {
      ...rest,
      signals: [...signals.values()].map(({ meta, values, low, high, sourceIds }) => ({
        id: meta.id as RunSignalId,
        values: take(values),
        ...(low ? { low: take(low) } : {}),
        ...(high ? { high: take(high) } : {}),
        sourceIds,
      })),
      moments: [...moments.values()].map(({ meta, ...p }) => ({ id: meta.id, ...p })),
      rhythms: [...rhythms.values()].map(({ meta, ...r }) => ({ id: meta.id, ...r })),
    },
    transfer,
  }
}

/**
 * The run again, with the catalog's own row objects. `lookup` (optional) puts the page's own food
 * objects back into the meal, where the worker had copies.
 */
export function fromWire(wire: WireResult, lookup?: FoodLookup): RunResult {
  const { signals, moments, rhythms, meal, ...rest } = wire
  return {
    ...rest,
    meal: lookup ? { ...meal, items: meal.items.map((it) => ({ ...it, food: lookup(it.food.id) ?? it.food })) } : meal,
    signals: new Map(signals.map(({ id, ...s }): [RunSignalId, Series] => [id, { meta: RUN_SIGNALS[id], ...s } as Series])),
    moments: new Map(moments.map(({ id, ...p }): [RunEventId, EventPoint] => [id, { meta: RUN_EVENTS[id], ...p } as EventPoint])),
    rhythms: new Map(
      rhythms.map(({ id, ...r }): [SignalId, Rhythm] => [id, { ...r, meta: SIGNALS[id as keyof typeof SIGNALS] } as Rhythm]),
    ),
  }
}
