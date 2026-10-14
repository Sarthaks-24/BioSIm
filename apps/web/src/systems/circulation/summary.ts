import type { TFunction } from 'i18next'
import type { ActiveSignalId, RunResult, Series, SignalMeta } from '@lifepeek/engine'
import { formatDuration } from '../../lib/time.ts'
import type { Summary } from '../registry.ts'
import { doingAt, seriesOf } from './beat.ts'

/**
 * Heart & blood's sentences (U-3; ui-ux §6, §7): the summary under the body and each graph's text
 * alternative, from the run's own numbers. Pure, so circulation.test.ts checks they are true. Like
 * the rest of the pack it shares no code with the stage but the meal clock's (lib/time.ts), so
 * numbers are written here as lib/formatSignal.ts writes them (circulation.test.ts checks they agree).
 */

const RATE = 'heart.rate'
const OUTPUT = 'heart.output'

const formats = new Map<string, Intl.NumberFormat>()
/** A number in the page's language, in Latin digits, with `digits` decimals at most (lib/formatSignal.ts numberFormat). */
export function num(v: number, lang: string, digits = 0) {
  const key = `${lang}|${digits}`
  let f = formats.get(key)
  if (!f) formats.set(key, (f = new Intl.NumberFormat(lang, { numberingSystem: 'latn', maximumFractionDigits: digits })))
  const r = digits ? v : Math.round(v)
  return f.format(r === 0 ? 0 : r)
}

/** Decimals of a display step: 0.1 → 1, 5 → 0 (lib/formatSignal.ts). */
const digitsOf = (step: number) => (step < 1 ? Math.round(-Math.log10(step)) : 0)

/** This pack's units' texts (`units.*`, lib/formatSignal.ts UNIT_KEY). */
const UNIT: Partial<Record<SignalMeta['unit'], string>> = { 'beats/min': 'beatsPerMin', 'L/min': 'LPerMin', 'mL/min': 'mLPerMin', mL: 'mL' }

/** A value with its unit, rounded to its row's step: "94 beats a minute", "4.3 L a minute" (lib/formatSignal.ts formatSignal). */
export function valueText(v: number, meta: Pick<SignalMeta, 'round' | 'unit'>, t: TFunction, lang: string): string {
  const step = meta.round ?? 1
  const n = num(Math.round(v / step) * step || 0, lang, digitsOf(step))
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

/** Within 1 % of the first value all the way: the graph is flat ("about the same all the way"). */
export const isFlat = (series: Series) => series.values.every((v) => Math.abs(v - series.values[0]!) <= 0.01 * Math.abs(series.values[0]!))

/** "Run" → "run" inside a sentence (components/stage/boutText.ts inSentence). */
const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1)

/**
 * The summary: a meal at rest says how little the heart moves (and to try a walk) or, after a bigger
 * meal, how many beats more and when; with a walk or a run, the fastest beat and in which bout
 * ("Fastest during the run: about 160 beats a minute (rest 66)."), the blood pumped then, and above
 * 150 a minute that the drawing is slowed. Beside a kept plan: both fastest rates, or that they are the same.
 */
export function circulationSummary(run: RunResult, kept: RunResult | null, t: TFunction, lang: string): Summary | null {
  const rate = seriesOf(run, RATE)
  const output = seriesOf(run, OUTPUT)
  if (!rate || !output) return null
  const n = (v: number) => num(v, lang)
  const peak = peakOf(rate, run.stepMin)
  const keptRate = kept && seriesOf(kept, RATE)
  if (keptRate) {
    const other = peakOf(keptRate, kept.stepMin)
    if (Math.round(peak.value) === Math.round(other.value)) return { headline: t('sys.circulation.summary.same', { n: n(peak.value) }) }
    const text = n(peak.value)
    return { headline: t('sys.circulation.summary.compare', { run: text, kept: n(other.value) }), key: { text, line: 'run' } }
  }
  const rest = rate.values[0]!
  // The bout the fastest beat comes in, or just after (the heart slows over a minute or two: R82, R86).
  const bout = run.activity.find((b) => peak.atMin >= b.startMin && peak.atMin <= b.startMin + b.durMin + 5)
  const kind = bout ? doingAt([bout], bout.startMin) : 'rest'
  if (kind === 'rest' || isFlat(rate)) {
    const up = Math.round(peak.value) - Math.round(rest)
    // A meal moves it a little (R10, R80): say how much and when, once it is two beats or more.
    if (up >= 2 && run.meal.items.length)
      return {
        headline: t('sys.circulation.summary.meal', { up: n(up), n: n(peak.value), time: formatDuration(peak.atMin, t) }),
        reason: `${t('sys.circulation.summary.mealReason')} ${t('sys.circulation.summary.restReason')}`,
      }
    return { headline: t('sys.circulation.summary.rest', { n: n(rest) }), reason: t('sys.circulation.summary.restReason') }
  }
  const text = n(peak.value)
  const at = Math.round(peak.atMin / run.stepMin)
  const pumped = t('sys.circulation.summary.pumped', { from: num(output.values[0]!, lang, 1), to: num(output.values[at]!, lang, 1) })
  return {
    headline: t('sys.circulation.summary.peak', { doing: lower(t(`activity.kinds.${kind}`)), n: text, rest: n(rest) }),
    key: { text, line: 'run' },
    reason: peak.value > 150 ? `${pumped} ${t('sys.circulation.summary.slowed')}` : pumped,
  }
}

/** A graph's sentence: flat ("about 66 beats a minute all the way, with no walk or run"), or from its start to its highest and when. */
export function circulationStripSummary(id: ActiveSignalId, run: RunResult, t: TFunction, lang: string): string | null {
  const series = seriesOf(run, id)
  if (!series) return null
  const name = t(`${series.meta.i18nKey}.name`)
  const value = (v: number) => valueText(v, series.meta, t, lang)
  if (isFlat(series)) return t('sys.circulation.graph.flat', { name, value: value(series.values[0]!) })
  const peak = peakOf(series, run.stepMin)
  return t('sys.circulation.graph.peak', {
    name,
    start: value(series.values[0]!),
    peak: value(peak.value),
    time: formatDuration(peak.atMin, t),
  })
}
