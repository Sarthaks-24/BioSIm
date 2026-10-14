import type { TFunction } from 'i18next'
import type { ActiveSignalId, RunResult, Series, SignalMeta } from '@lifepeek/engine'
import { formatDuration } from '../../lib/time.ts'
import type { Summary } from '../registry.ts'

/**
 * Hormones' sentences (U-6; ui-ux §6, §7): the summary under the body and each graph's text
 * alternative, from the run's own numbers. Pure, so hormones.test.ts checks they are true. Like the
 * other packs it shares no code with the stage but the meal clock's (lib/time.ts), so numbers are
 * written here as lib/formatSignal.ts writes them (hormones.test.ts checks they agree).
 *
 * Insulin is "× before eating", never µU/mL (model §2.5): the model's number is a multiple of one
 * young adult group's fasting level, not a lab value. The words describe, never score: no spike, no
 * crash (content-i18n §6). Insulin here follows the sugar coming in (open loop, R91), so the words
 * never say it brings blood sugar down.
 */

export const INSULIN = 'blood.insulin'
export const GLUCOSE = 'blood.glucose'
export const BRAIN = 'brain.glucoseUse'
export const INSULIN_PEAK = 'event.insulinPeak'

/** A signal's series in a run, if it has one (the pack's IDs are not in the lean catalog's type). */
export const seriesOf = (run: RunResult, id: string): Series | undefined => run.signals.get(id as ActiveSignalId) as Series | undefined

/** The minute a moment comes at, or null (it never comes in this run). */
export const momentAt = (run: RunResult, id: string): number | null => run.moments.get(id as never)?.atMin ?? null

const formats = new Map<string, Intl.NumberFormat>()
/** A number in the page's language, in Latin digits, with at most `digits` decimals (lib/formatSignal.ts numberFormat). */
const num = (v: number, lang: string, digits = 0) => {
  const key = `${lang}|${digits}`
  let f = formats.get(key)
  if (!f) formats.set(key, (f = new Intl.NumberFormat(lang, { numberingSystem: 'latn', maximumFractionDigits: digits })))
  return f.format(v)
}

/** This pack's units' texts (`units.*`, lib/formatSignal.ts UNIT_KEY). */
const UNIT: Partial<Record<SignalMeta['unit'], string>> = { 'mg/dL': 'mgdl', xFasting: 'xFasting', 'g/h': 'gPerH' }

/** A value rounded to its row's step, as a number in words: "4.8", "118". */
export function numberText(v: number, meta: Pick<SignalMeta, 'round'>, lang: string): string {
  const step = meta.round ?? 1
  const r = Math.round(v / step) * step || 0
  return num(r, lang, step < 1 ? Math.round(-Math.log10(step)) : 0)
}

/** A value with its unit, rounded to its row's step: "4.8× before eating", "118 mg/dL" (lib/formatSignal.ts formatSignal). */
export function valueText(v: number, meta: Pick<SignalMeta, 'round' | 'unit'>, t: TFunction, lang: string): string {
  const n = numberText(v, meta, lang)
  const key = UNIT[meta.unit]
  return key ? t(`units.${key}`, { n }) : `${n} ${meta.unit}`
}

/** The highest value of a series and the minute it comes at (the first, if it comes twice), up to `endMin`. */
export function highestOf(series: Series, stepMin: number, endMin: number): { value: number; atMin: number } {
  let at = 0
  const last = Math.min(series.values.length - 1, Math.floor(endMin / stepMin))
  for (let i = 1; i <= last; i++) if (series.values[i]! > series.values[at]!) at = i
  return { value: series.values[at]!, atMin: at * stepMin }
}

/** The graphs' window (systems/hormones/row.ts graphWindowMin). */
export const WINDOW_MIN = 12 * 60
/** Insulin that never passes this (× before eating) has not risen: the moment's own threshold (+0.1×, engine catalog). */
export const RISE_X = 1.1

/** The first minute after the peak that insulin is back under RISE_X, within the window, or null. */
export function backMin(series: Series, stepMin: number, peakMin: number): number | null {
  const last = Math.min(series.values.length - 1, Math.floor(WINDOW_MIN / stepMin))
  for (let i = Math.ceil(peakMin / stepMin); i <= last; i++) if (series.values[i]! < RISE_X) return i * stepMin
  return null
}

/** The insulin peak of a run, rounded as the graph writes it (× before eating, 0.1 steps); 1 when it never rises. */
const peakX = (series: Series, stepMin: number) => Math.round(highestOf(series, stepMin, WINDOW_MIN).value * 10) / 10

/**
 * The summary: a meal with almost no sugar or starch says insulin stays at its before-eating level
 * (and why: here only sugar from food raises it, R91); otherwise its highest, when, and when it is
 * back near 1×. Beside a kept plan: the highest of each, or "about the same" within a tenth.
 */
export function hormonesSummary(run: RunResult, kept: RunResult | null, t: TFunction, lang: string): Summary | null {
  const insulin = seriesOf(run, INSULIN)
  if (!insulin) return null
  const x = (v: number) => num(v, lang, 1)
  const time = (min: number) => formatDuration(min, t)
  const peak = highestOf(insulin, run.stepMin, WINDOW_MIN)
  const keptInsulin = kept && seriesOf(kept, INSULIN)
  if (kept && keptInsulin) {
    const [a, b] = [peakX(insulin, run.stepMin), peakX(keptInsulin, kept.stepMin)]
    if (Math.abs(a - b) >= Math.max(0.2, 0.1 * Math.max(a, b))) {
      const text = x(a)
      return {
        headline: t('sys.control.summary.compare', { run: text, kept: x(b) }),
        key: { text, line: 'run' },
        reason: t('sys.control.summary.why'),
      }
    }
    return { headline: t('sys.control.summary.same', { n: x(Math.max(a, b)) }), reason: t('sys.control.summary.why') }
  }
  if (peak.value < RISE_X) return { headline: t('sys.control.summary.flat'), reason: t('sys.control.summary.flatReason') }
  const text = x(Math.round(peak.value * 10) / 10)
  const back = backMin(insulin, run.stepMin, peak.atMin)
  return {
    headline: t('sys.control.summary.peak', { n: text, time: time(peak.atMin) }),
    key: { text, line: 'run' },
    reason: back != null ? t('sys.control.summary.back', { time: time(back) }) : t('sys.control.summary.still', { time: time(WINDOW_MIN) }),
  }
}

/** A graph's sentence: flat ("about 1× before eating all the way"), or from its start to its highest and when. */
export function hormonesStripSummary(id: ActiveSignalId, run: RunResult, t: TFunction, lang: string): string | null {
  const series = seriesOf(run, id)
  if (!series) return null
  const name = t(`${series.meta.i18nKey}.name`)
  const value = (v: number) => valueText(v, series.meta, t, lang)
  const start = series.values[0]!
  const high = highestOf(series, run.stepMin, WINDOW_MIN)
  if (numberText(high.value, series.meta, lang) === numberText(start, series.meta, lang))
    return t('sys.control.graph.flat', { name, value: value(start) })
  return t('sys.control.graph.peak', { name, start: value(start), peak: value(high.value), time: formatDuration(high.atMin, t) })
}
