import type { TFunction } from 'i18next'
import type { ActiveSignalId, RunResult } from '@lifepeek/engine'
import { formatDuration } from '../../lib/time.ts'
import type { Summary } from '../registry.ts'
import { doingAt, isFlat, peakOf, seriesOf, timesRest, valueText, whole } from './effort.ts'

/**
 * Muscles' and skin's sentences (U-1; ui-ux §6, §7): the summary under the body and each graph's
 * text alternative, from the run's own numbers. Pure, so effort.test.ts checks they are true.
 * Muscles are said in times their resting energy, never in kcal (no activity text names kcal:
 * content-i18n §6); both move only with walking or running (R75), so at rest they say so and offer a walk.
 */

const MUSCLE = 'muscle.energyRate'
const SWEAT = 'skin.sweatRate'
const SWEAT_TOTAL = 'skin.sweatTotal'

/** "Run" → "run" inside a sentence (components/stage/boutText.ts inSentence). */
const lower = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1)

/** The bout the highest value comes in, or just after (the model eases off over a minute or two: R86). */
function boutAt(run: RunResult, atMin: number) {
  const bout = run.activity.find((b) => atMin >= b.startMin && atMin <= b.startMin + b.durMin + 5)
  return bout ? doingAt([bout], bout.startMin) : 'rest'
}

/** The highest energy used by muscles over their resting energy (the first minute's), "about 43×". */
function peakTimes(run: RunResult) {
  const s = seriesOf(run, MUSCLE)
  if (!s) return null
  const peak = peakOf(s, run.stepMin)
  return { k: timesRest(peak.value, s.values[0]!), atMin: peak.atMin, flat: isFlat(s) }
}

/**
 * Muscles' summary: at rest, about the same all day (the meal does not change it) and try a walk;
 * in a walk or run, how many times their resting energy and that most ends up as heat; beside a kept
 * plan, both highest, or that they are the same.
 */
export function musclesSummary(run: RunResult, kept: RunResult | null, t: TFunction, lang: string): Summary | null {
  const now = peakTimes(run)
  if (!now) return null
  const other = kept && peakTimes(kept)
  if (other) {
    if (now.k === other.k) return { headline: t('sys.effort.muscles.summary.same') }
    const text = whole(now.k, lang)
    return { headline: t('sys.effort.muscles.summary.compare', { run: text, kept: whole(other.k, lang) }), key: { text, line: 'run' } }
  }
  const kind = boutAt(run, now.atMin)
  if (kind === 'rest' || now.flat || now.k < 2)
    return { headline: t('sys.effort.muscles.summary.rest'), reason: t('sys.effort.muscles.summary.restReason') }
  const text = whole(now.k, lang)
  return { headline: t('sys.effort.muscles.summary.peak', { doing: lower(t(`activity.kinds.${kind}`)), k: text }), key: { text, line: 'run' } }
}

/**
 * Skin's summary: at rest, no sweat from moving (the meal does not change that) and try a walk; in a
 * walk or run the most sweat an hour and in which bout, then the sweat in all ("Sweat is water and
 * salt, not fat leaving."); beside a kept plan, both totals, or that they are the same.
 */
export function skinSummary(run: RunResult, kept: RunResult | null, t: TFunction, lang: string): Summary | null {
  const rate = seriesOf(run, SWEAT)
  const total = seriesOf(run, SWEAT_TOTAL)
  if (!rate || !total) return null
  const all = (r: RunResult) => {
    const s = seriesOf(r, SWEAT_TOTAL)!
    return { v: s.values[s.values.length - 1]!, text: valueText(s.values[s.values.length - 1]!, s.meta, t, lang) }
  }
  const keptTotal = kept && seriesOf(kept, SWEAT_TOTAL) && all(kept)
  if (keptTotal) {
    const mine = all(run)
    if (mine.text === keptTotal.text) return { headline: t('sys.effort.skin.summary.same', { value: mine.text }) }
    return { headline: t('sys.effort.skin.summary.compare', { run: mine.text, kept: keptTotal.text }), key: { text: mine.text, line: 'run' } }
  }
  const peak = peakOf(rate, run.stepMin)
  const kind = boutAt(run, peak.atMin)
  if (kind === 'rest' || peak.value < 1)
    return { headline: t('sys.effort.skin.summary.rest'), reason: t('sys.effort.skin.summary.restReason') }
  const text = valueText(peak.value, rate.meta, t, lang)
  return {
    headline: t('sys.effort.skin.summary.peak', { doing: lower(t(`activity.kinds.${kind}`)), value: text }),
    key: { text, line: 'run' },
    reason: t('sys.effort.skin.summary.total', { value: all(run).text }),
  }
}

/** A graph's sentence: flat ("about 14 kcal/h all the way, with no walk or run"), or from its start to its highest and when. */
export function effortStripSummary(id: ActiveSignalId, run: RunResult, t: TFunction, lang: string): string | null {
  const series = seriesOf(run, id)
  if (!series) return null
  const name = t(`${series.meta.i18nKey}.name`)
  const value = (v: number) => valueText(v, series.meta, t, lang)
  if (isFlat(series)) return t('sys.effort.graph.flat', { name, value: value(series.values[0]!) })
  const peak = peakOf(series, run.stepMin)
  return t('sys.effort.graph.peak', { name, start: value(series.values[0]!), peak: value(peak.value), time: formatDuration(peak.atMin, t) })
}
