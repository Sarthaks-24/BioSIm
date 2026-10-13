import type { TFunction } from 'i18next'
import { valueAt, type ActiveSignalId, type Series, type Simulation } from '@lifepeek/engine'
import { glucoseLeftBase } from '../components/graphs/marks.ts'
import { formatNumber } from './formatSignal.ts'
import { KNEE_MIN, formatDuration } from './time.ts'

/**
 * Each graph in one or two sentences (G8, text alternatives), from the catalog's
 * `signals.<id>.summary` templates (04 §7): what a screen reader reads after the graph's name,
 * and the caption of its table. They describe one run; the kept run's follows it, named.
 * - Stomach: how much it holds at the start and when half has left. "Half" is by food energy, as
 *   the ring and the dock say (event.stomachHalfEmpty); a meal with no energy (water) is halved by
 *   weight, and says so (`summaryNone`).
 * - Blood sugar: start, highest and back near the before-meal level; or, when it never clearly
 *   left that level (the graphs' 5 mg/dL rule, marks.ts), that it stays near it.
 * - Energy: what came in and what the resting body used in the first 6 h (the same window for
 *   every meal, so two meals compare). Described, never scored.
 */
export function stripSummary(id: ActiveSignalId, run: Simulation, t: TFunction, lang: string): string | null {
  if (run.meal.items.length === 0) return null
  const series = run.signals.get(id)
  if (!series) return null
  const key = series.meta.i18nKey
  const num = (s: Series, v: number) => formatNumber(v, s.meta, lang)
  const when = (min: number | null | undefined) => (min == null || min > run.horizonMin ? t('signals.event.never') : formatDuration(min, t))

  if (id === 'gut.stomach.contentG') {
    const start = num(series, Math.max(...series.values))
    const half = when(run.moments.get('event.stomachHalfEmpty')?.atMin)
    return t(run.events.noNutrients ? `${key}.summaryNone` : `${key}.summary`, { start, half })
  }
  if (id === 'blood.glucose') {
    const start = num(series, series.values[0]!)
    if (!glucoseLeftBase(run)) return t(`${key}.summaryNone`, { start })
    const peakMin = run.moments.get('event.glucosePeak')!.atMin!
    return t(`${key}.summary`, {
      start,
      peak: num(series, valueAt(series, peakMin, run.stepMin)),
      peakTime: formatDuration(peakMin, t),
      backTime: when(run.moments.get('event.glucoseBackToBase')?.atMin),
    })
  }
  if (id === 'energy.inRate') {
    const total = run.signals.get('energy.inTotal')
    const used = run.signals.get('energy.usedTotal')
    if (!total || !used) return null
    return t(`${key}.summary`, {
      time: formatDuration(KNEE_MIN, t),
      in: num(total, valueAt(total, KNEE_MIN, run.stepMin)),
      used: num(used, valueAt(used, KNEE_MIN, run.stepMin)),
    })
  }
  return null
}

/** The graph's description: this meal's summary, then the kept meal's, named ("Kept: Cola. …"). */
export function stripDescription(
  id: ActiveSignalId,
  run: Simulation,
  kept: Simulation | null,
  keptName: string,
  t: TFunction,
  lang: string,
): string | undefined {
  const own = stripSummary(id, run, t, lang)
  const other = kept && stripSummary(id, kept, t, lang)
  return [own, other && `${t('keep.tag', { meal: keptName })}. ${other}`].filter(Boolean).join(' ') || undefined
}
