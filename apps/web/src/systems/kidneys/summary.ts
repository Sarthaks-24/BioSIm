import type { TFunction } from 'i18next'
import type { ActiveSignalId, RunResult, Series, SignalMeta } from '@lifepeek/engine'
import { formatDuration } from '../../lib/time.ts'
import type { Summary } from '../registry.ts'
import { BACKGROUND_ML_PER_H, mealWaterMl, momentAt, seriesOf } from './water.ts'

/**
 * Kidneys & water's sentences (U-4; ui-ux §6, §7): the summary under the body and each graph's text
 * alternative, from the run's own numbers. Pure, so kidneys.test.ts checks they are true. Like the
 * rest of the pack it shares no code with the stage but the meal clock's (lib/time.ts), so numbers
 * are written here as lib/formatSignal.ts writes them (kidneys.test.ts checks they agree).
 *
 * The words never score a drink: any drink's water counts the same, and no drink "dehydrates"
 * (ui-ux §7 "Kidney compare"); beside a kept plan they compare when half the meal's water has left,
 * not first trips to the toilet, and name the water each plan brings when it differs.
 */

const URINE = 'kidney.urineRate'
const HALF = 'event.halfMealWaterPassed'

const formats = new Map<string, Intl.NumberFormat>()
/** A whole number in the page's language, in Latin digits (lib/formatSignal.ts numberFormat). */
const whole = (v: number, lang: string) => {
  let f = formats.get(lang)
  if (!f) formats.set(lang, (f = new Intl.NumberFormat(lang, { numberingSystem: 'latn', maximumFractionDigits: 0 })))
  return f.format(Math.round(v))
}

/** This pack's units' texts (`units.*`, lib/formatSignal.ts UNIT_KEY). */
const UNIT: Partial<Record<SignalMeta['unit'], string>> = { mL: 'mL', 'mL/h': 'mLPerH' }

/** A value with its unit, rounded to its row's step: "220 mL an hour", "−350 mL" (lib/formatSignal.ts formatSignal). */
export function valueText(v: number, meta: Pick<SignalMeta, 'round' | 'unit'>, t: TFunction, lang: string): string {
  const step = meta.round ?? 1
  const n = whole(Math.round(v / step) * step || 0, lang)
  const key = UNIT[meta.unit]
  return key ? t(`units.${key}`, { n }) : `${n} ${meta.unit}`
}

/** The highest (or, `low`, the lowest) value of a series and the minute it comes at (the first, if it comes twice), up to `endMin`. */
export function extremeOf(series: Series, stepMin: number, endMin: number, low = false): { value: number; atMin: number } {
  let at = 0
  const last = Math.min(series.values.length - 1, Math.floor(endMin / stepMin))
  for (let i = 1; i <= last; i++) if (low ? series.values[i]! < series.values[at]! : series.values[i]! > series.values[at]!) at = i
  return { value: series.values[at]!, atMin: at * stepMin }
}

/** Within `slack` of the first value all the way (to `endMin`): the graph is flat ("about the same all the way"). */
export function isFlat(series: Series, stepMin: number, endMin: number, slack: number): boolean {
  const last = Math.min(series.values.length - 1, Math.floor(endMin / stepMin))
  for (let i = 0; i <= last; i++) if (Math.abs(series.values[i]! - series.values[0]!) > slack) return false
  return true
}

/** The graphs' window: what the sentences talk about (systems/kidneys/row.ts graphWindowMin). */
const WINDOW_MIN = 12 * 60
/** Urine within 5 mL an hour of a steady day's all the way is "about a steady day's". */
const FLAT_ML_PER_H = 5
/** Less urine than a steady day's by at least this much (mL an hour) is said: sweat took some water. */
const DIP_ML_PER_H = 10

/**
 * The summary: a meal with little water says urine stays about a steady day's; otherwise the most
 * urine and when, beside a day without this meal, and when half the meal's water has left. Moving
 * that sweats says urine was less for a while. Beside a kept plan: when half of each plan's water
 * has left or, when that is about the same, the most urine an hour of each; and the water each
 * brings if it differs.
 */
export function kidneysSummary(run: RunResult, kept: RunResult | null, t: TFunction, lang: string): Summary | null {
  const urine = seriesOf(run, URINE)
  if (!urine) return null
  const n = (v: number) => whole(v, lang)
  const time = (min: number) => formatDuration(min, t)
  const peak = extremeOf(urine, run.stepMin, WINDOW_MIN)
  const half = momentAt(run, HALF)
  const keptUrine = kept && seriesOf(kept, URINE)
  if (kept && keptUrine) {
    const keptHalf = momentAt(kept, HALF)
    const [water, keptWater] = [mealWaterMl(run), mealWaterMl(kept)]
    const reason =
      Math.round(water) !== Math.round(keptWater) ? t('sys.kidneys.summary.compareWater', { run: n(water), kept: n(keptWater) }) : undefined
    if (half != null && keptHalf != null && Math.abs(half - keptHalf) >= 5) {
      const text = time(half)
      return { headline: t('sys.kidneys.summary.compare', { run: text, kept: time(keptHalf) }), key: { text, line: 'run' }, reason }
    }
    // Half of each plan's water leaves at about the same time (one glass or four): the most urine an hour then.
    const other = extremeOf(keptUrine, kept.stepMin, WINDOW_MIN).value
    const [a, b] = [Math.round(peak.value / 5) * 5, Math.round(other / 5) * 5]
    if (Math.abs(a - b) >= Math.max(10, 0.1 * Math.max(a, b))) {
      const text = n(a)
      return { headline: t('sys.kidneys.summary.comparePeak', { run: text, kept: n(b) }), key: { text, line: 'run' }, reason }
    }
    return { headline: t('sys.kidneys.summary.same', { n: n(Math.max(a, b)) }), reason }
  }
  const low = extremeOf(urine, run.stepMin, WINDOW_MIN, true)
  const sweat = run.activity.length > 0 && low.value <= BACKGROUND_ML_PER_H - DIP_ML_PER_H
  const sweatText = t('sys.kidneys.summary.sweat', { n: n(Math.round(low.value / 5) * 5) })
  // Moving that sweats is said first: less urine for a while (the body drinks the sweat back after, D17).
  if (sweat) return { headline: sweatText, reason: half != null ? t('sys.kidneys.summary.half', { time: time(half) }) : undefined }
  if (isFlat(urine, run.stepMin, WINDOW_MIN, FLAT_ML_PER_H) || peak.value < BACKGROUND_ML_PER_H + FLAT_ML_PER_H) {
    return {
      headline: t('sys.kidneys.summary.flat', { n: n(Math.round(BACKGROUND_ML_PER_H)) }),
      reason: t('sys.kidneys.summary.flatReason'),
    }
  }
  const text = n(Math.round(peak.value / 5) * 5)
  return {
    headline: t('sys.kidneys.summary.peak', {
      n: text,
      time: time(peak.atMin),
      base: t('units.mLPerH', { n: n(Math.round(BACKGROUND_ML_PER_H)) }),
    }),
    key: { text, line: 'run' },
    reason: half != null ? t('sys.kidneys.summary.half', { time: time(half) }) : undefined,
  }
}

/** A graph's sentence: flat ("about 60 mL an hour all the way"), or from its start to its highest (or, below zero, its lowest) and when. */
export function kidneysStripSummary(id: ActiveSignalId, run: RunResult, t: TFunction, lang: string): string | null {
  const series = seriesOf(run, id)
  if (!series) return null
  const name = t(`${series.meta.i18nKey}.name`)
  const value = (v: number) => valueText(v, series.meta, t, lang)
  const step = series.meta.round ?? 1
  if (isFlat(series, run.stepMin, WINDOW_MIN, step)) return t('sys.kidneys.graph.flat', { name, value: value(series.values[0]!) })
  const high = extremeOf(series, run.stepMin, WINDOW_MIN)
  const low = extremeOf(series, run.stepMin, WINDOW_MIN, true)
  const start = series.values[0]!
  // The bigger move from the start says what happened: more water, or (after sweating) less.
  if (start - low.value > high.value - start)
    return t('sys.kidneys.graph.low', { name, start: value(start), low: value(low.value), time: formatDuration(low.atMin, t) })
  return t('sys.kidneys.graph.peak', { name, start: value(start), peak: value(high.value), time: formatDuration(high.atMin, t) })
}
