import { EVENT_IDS, valueAt, type ActiveSignalId, type EventId, type Series, type Simulation } from '@lifepeek/engine'
import { runMoments, type Moment } from './moments.ts'

/**
 * The numbers behind "Show as table" (G8), apart from the words so they can be tested.
 * Rows at the times a teacher would read off the graph: every 15 min in the first hour, then
 * 1.5, 2, 3, 4 and 6 h, then 12 and 24 h (the squeezed part of the axis), and the run's last
 * minute (48 h today). From the run's own clock, so a longer or shorter run needs no change here.
 */
const READ_AT = [0, 15, 30, 45, 60, 90, 120, 180, 240, 360, 720, 1440]
export const tableTimes = (horizonMin: number): number[] => [...READ_AT.filter((m) => m < horizonMin), horizonMin]

export interface TableColumn {
  /** Which line: this meal's signal, the between-people range of it, or the kept meal's. */
  kind: 'run' | 'range' | 'kept'
  series: Series
  /** The upper edge, for a range column (`series` holds the lower one). */
  high?: Series
}

/**
 * The columns of one graph's table: each line drawn on it, in the graph's order. This meal's
 * line, how much people differ (when the graph draws that band), then the second line (energy
 * used at rest), then the kept meal's line (only the first line has a kept ghost, as on the graph).
 */
export function tableColumns(signals: readonly ActiveSignalId[], run: Simulation, kept: Simulation | null): TableColumn[] {
  const cols: TableColumn[] = []
  signals.forEach((id, i) => {
    const s = run.signals.get(id)
    if (!s) return
    cols.push({ kind: 'run', series: s })
    if (i === 0 && s.low && s.high) {
      cols.push({ kind: 'range', series: { ...s, values: s.low }, high: { ...s, values: s.high } })
    }
  })
  const k = kept?.signals.get(signals[0]!)
  if (k) cols.push({ kind: 'kept', series: k })
  return cols
}

/** One cell's number (or low and high for a range), read on the run's own clock. */
export function cellValue(col: TableColumn, min: number, stepMin: number): number | [number, number] {
  return col.high ? [valueAt(col.series, min, stepMin), valueAt(col.high, min, stepMin)] : valueAt(col.series, min, stepMin)
}

/**
 * The key moments of both meals, one row each, in catalog order: the dock's markers as text.
 * A moment only the kept meal has gets a row too. Every moment is named by its own event, never
 * by the graph it was first drawn on (event.mostlyAbsorbed is about carbohydrate, protein and fat,
 * not only the carbohydrate signal the catalog files it under).
 */
export function momentRows(run: Simulation, kept: Simulation | null): { id: EventId; run?: Moment; kept?: Moment }[] {
  const own = new Map(runMoments(run).map((m) => [m.id, m]))
  const other = new Map((kept && kept.meal.items.length > 0 ? runMoments(kept) : []).map((m) => [m.id, m]))
  return EVENT_IDS.filter((id) => own.has(id) || other.has(id)).map((id) => ({ id, run: own.get(id), kept: other.get(id) }))
}
