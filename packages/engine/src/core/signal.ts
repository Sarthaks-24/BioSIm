/**
 * The signal table's value types (A1). A `Series` is one catalog signal for one run; an
 * `EventPoint` is one timeline marker. Graphs, the text table, summaries and tests read these
 * instead of the engine's raw arrays, so every number on screen carries its ID, unit and sources.
 * Built by core/table.ts. The draft is in plans/v2 04-CATALOG-DRAFT §2.
 */
import type { ActiveSignalId, ChartableMeta, EventMeta, RunEventId, RunSignalId, SignalId, SignalMeta } from './catalog.ts'
import type { SourceId } from './sources.ts'

/** One sim-clock signal for one run. Index i = minute i·stepMin. */
export interface Series<Id extends SignalId = SignalId> {
  readonly meta: SignalMeta<Id>
  readonly values: Float32Array
  /** Band edges (between-person spread), only if meta.band. */
  readonly low?: Float32Array
  readonly high?: Float32Array
  /** meta.sourceIds + `food:<id>` for every food in this run's meal (only if meta.reactsToMeal). */
  readonly sourceIds: readonly SourceId[]
}
/** The only series type a graph component accepts. */
export type ChartableSeries = Series & { readonly meta: ChartableMeta }

/** A real-clock signal (later: heart, breathing). Carries a RATE, never an array. Not used in v2.0. */
export interface Rhythm {
  readonly meta: SignalMeta
  readonly restingPerMin: number
  /** Only if the engine models the coupling (e.g. activity). The only bridge between the two clocks. */
  readonly rateFrom?: ActiveSignalId
}

/** One timeline marker. atMin null = does not happen within the run (shown as "Not within 48 h"). */
export interface EventPoint<Id extends RunEventId = RunEventId> {
  readonly meta: EventMeta<Id>
  readonly atMin: number | null
  readonly low?: number
  readonly high?: number
}

/** Added to today's Simulation by WP-04 (old fields stay, @deprecated, until bundle B / A7). */
export interface SignalTable {
  /** Every signal the run produced: the lean catalog's rows, then the packs' (core/catalog/rows.ts). */
  readonly signals: ReadonlyMap<RunSignalId, Series>
  /** Every moment the run put: the lean catalog's events, then the packs' (core/catalog/rows.ts). */
  readonly moments: ReadonlyMap<RunEventId, EventPoint>
  /** Empty in v2.0. */
  readonly rhythms: ReadonlyMap<SignalId, Rhythm>
  readonly stepMin: number
  readonly length: number
  readonly horizonMin: number
}

/** Linear interpolation at tMin (clamped to the run). Per-frame safe: no allocation. */
export function valueAt(series: Pick<Series, 'values'>, tMin: number, stepMin = 1): number {
  const v = series.values
  const last = v.length - 1
  if (last < 0) return NaN
  const x = tMin / stepMin
  if (!(x > 0)) return v[0]!
  if (x >= last) return v[last]!
  const i = Math.floor(x)
  const f = x - i
  return v[i]! + (v[i + 1]! - v[i]!) * f
}

/**
 * Min/max decimation of [fromMin, toMin] to at most `maxPoints` points, for graph paths. Each
 * bucket keeps its lowest and highest point, in time order, so peaks are never lost.
 * (Named `windowOf`, not `window`, so importing it never shadows the browser's `window`.)
 */
export function windowOf(
  series: Pick<Series, 'values'>,
  fromMin: number,
  toMin: number,
  maxPoints: number,
  stepMin = 1,
): { t: Float32Array; v: Float32Array } {
  const values = series.values
  const last = values.length - 1
  const i0 = Math.max(0, Math.ceil(fromMin / stepMin))
  const i1 = Math.min(last, Math.floor(toMin / stepMin))
  const count = i1 - i0 + 1
  if (count <= 0 || maxPoints <= 0) return { t: new Float32Array(0), v: new Float32Array(0) }

  if (count <= maxPoints) {
    const t = new Float32Array(count)
    const v = new Float32Array(count)
    for (let k = 0; k < count; k++) {
      t[k] = (i0 + k) * stepMin
      v[k] = values[i0 + k]!
    }
    return { t, v }
  }

  const buckets = Math.max(1, Math.floor(maxPoints / 2))
  const t: number[] = []
  const v: number[] = []
  for (let b = 0; b < buckets; b++) {
    const start = i0 + Math.floor((b * count) / buckets)
    const end = i0 + Math.floor(((b + 1) * count) / buckets) - 1
    let lo = start
    let hi = start
    for (let i = start + 1; i <= end; i++) {
      if (values[i]! < values[lo]!) lo = i
      if (values[i]! > values[hi]!) hi = i
    }
    for (const i of lo === hi ? [lo] : lo < hi ? [lo, hi] : [hi, lo]) {
      t.push(i * stepMin)
      v.push(values[i]!)
    }
  }
  return { t: Float32Array.from(t), v: Float32Array.from(v) }
}

/** First minute at or after `fromMin` where pred(value) holds; null if never. Used for events and summaries. */
export function findFirst(series: Pick<Series, 'values'>, pred: (v: number) => boolean, fromMin = 0, stepMin = 1): number | null {
  const values = series.values
  for (let i = Math.max(0, Math.ceil(fromMin / stepMin)); i < values.length; i++) if (pred(values[i]!)) return i * stepMin
  return null
}
