import type { TFunction } from 'i18next'
import type { ActiveSignalId, RunResult, Series, SignalMeta } from '@lifepeek/engine'
import { formatDuration } from '../../lib/time.ts'
import type { Summary } from '../registry.ts'
import { doingAt, seriesOf } from './breath.ts'

/**
 * Breathing's sentences (U-2; ui-ux §6, §7): the summary under the body and each graph's text
 * alternative, from the run's own numbers. Pure, so breathing.test.ts checks they are true. Like
 * the rest of the pack it shares no code with the stage but the meal clock's (lib/time.ts), so
 * numbers are written here as lib/formatSignal.ts writes them (breathing.test.ts checks they agree).
 */

const RATE = 'lungs.breathRate'
const TIDAL = 'lungs.tidalVolume'

const formats = new Map<string, Intl.NumberFormat>()
/** A whole number in the page's language, in Latin digits (lib/formatSignal.ts numberFormat). */
const whole = (v: number, lang: string) => {
  let f = formats.get(lang)
  if (!f) formats.set(lang, (f = new Intl.NumberFormat(lang, { numberingSystem: 'latn', maximumFractionDigits: 0 })))
  return f.format(Math.round(v))
}

/** This pack's units' texts (`units.*`, lib/formatSignal.ts UNIT_KEY). */
const UNIT: Partial<Record<SignalMeta['unit'], string>> = { 'breaths/min': 'breathsPerMin', mL: 'mL', 'mL/min': 'mLPerMin' }

/** A value with its unit, rounded to its row's step: "24 breaths a minute", "850 mL" (lib/formatSignal.ts formatSignal). */
export function valueText(v: number, meta: Pick<SignalMeta, 'round' | 'unit'>, t: TFunction, lang: string): string {
  const step = meta.round ?? 1
  const n = whole(Math.round(v / step) * step || 0, lang)
  const key = UNIT[meta.unit]
  return key ? t(`units.${key}`, { n }) : `${n} ${meta.unit}`
}

/** The highest value of a series and the minute it comes at (the first, if it comes twice). */
export function peakOf(series: Series, stepMin: number): { value: number; atMin: number } {
  let at = 0
  series.values.forEach((v, i) => {
    if (v > series.values[at]!) at = i
  })
  return { value: series.values[at]!, atMin: at * stepMin }
}

/** Within 1 % of the first value all the way: the graph is flat ("same as at the start"). */
export const isFlat = (series: Series) => series.values.every((v) => Math.abs(v - series.values[0]!) <= 0.01 * Math.abs(series.values[0]!))

/** "Run" → "run" inside a sentence (components/stage/boutText.ts inSentence). */
const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1)

/**
 * The summary: one meal at rest says breathing stays about the same (and to try a walk); with a walk
 * or a run, the fastest breathing and in which bout ("Fastest during the run: about 33 a minute
 * (rest 15)."), how much deeper, and in a run the older book's "up to 25". Beside a kept plan: both
 * fastest rates, or that they are the same.
 */
export function breathingSummary(run: RunResult, kept: RunResult | null, t: TFunction, lang: string): Summary | null {
  const rate = seriesOf(run, RATE)
  const tidal = seriesOf(run, TIDAL)
  if (!rate || !tidal) return null
  const n = (v: number) => whole(v, lang)
  const peak = peakOf(rate, run.stepMin)
  const keptRate = kept && seriesOf(kept, RATE)
  if (keptRate) {
    const other = peakOf(keptRate, kept.stepMin)
    if (Math.round(peak.value) === Math.round(other.value)) return { headline: t('sys.breathing.summary.same', { n: n(peak.value) }) }
    const text = n(peak.value)
    return { headline: t('sys.breathing.summary.compare', { run: text, kept: n(other.value) }), key: { text, line: 'run' } }
  }
  const rest = rate.values[0]!
  // The bout the fastest breathing comes in, or just after (breathing slows over a minute or two: R86).
  const bout = run.activity.find((b) => peak.atMin >= b.startMin && peak.atMin <= b.startMin + b.durMin + 5)
  const kind = bout ? doingAt([bout], bout.startMin) : 'rest'
  if (kind === 'rest' || isFlat(rate))
    return { headline: t('sys.breathing.summary.rest', { n: n(rest) }), reason: t('sys.breathing.summary.restReason') }
  const text = n(peak.value)
  const deeper = t('sys.breathing.summary.deeper', {
    from: n(Math.round(tidal.values[0]! / 10) * 10),
    to: n(Math.round(tidal.values[peak.atMin / run.stepMin]! / 10) * 10),
  })
  return {
    headline: t('sys.breathing.summary.peak', { doing: lower(t(`activity.kinds.${kind}`)), n: text, rest: n(rest) }),
    key: { text, line: 'run' },
    reason: kind === 'run' ? `${deeper} ${t('sys.breathing.summary.runBook')}` : deeper,
  }
}

/** A graph's sentence: flat ("about 15 breaths a minute all the way, with no walk or run"), or from its start to its highest and when. */
export function breathingStripSummary(id: ActiveSignalId, run: RunResult, t: TFunction, lang: string): string | null {
  const series = seriesOf(run, id)
  if (!series) return null
  const name = t(`${series.meta.i18nKey}.name`)
  const value = (v: number) => valueText(v, series.meta, t, lang)
  if (isFlat(series)) return t('sys.breathing.graph.flat', { name, value: value(series.values[0]!) })
  const peak = peakOf(series, run.stepMin)
  return t('sys.breathing.graph.peak', {
    name,
    start: value(series.values[0]!),
    peak: value(peak.value),
    time: formatDuration(peak.atMin, t),
  })
}
