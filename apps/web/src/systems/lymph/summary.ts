import type { TFunction } from 'i18next'
import type { ActiveSignalId, RunResult, Series, SignalMeta } from '@lifepeek/engine'
import { formatDuration } from '../../lib/time.ts'
import type { Summary } from '../registry.ts'
import { BLOOD_FAT, FASTING_MG_DL, FLAT_MG_DL, LITTLE_FAT_G, UP_MIN, mealFatG, seriesOf, upMin } from './fat.ts'

/**
 * Lymph & germ defence's sentences (U-5; ui-ux §6, §7, R90): the summary under the body and each
 * graph's text alternative, from the run's own numbers. Pure, so lymph.test.ts checks they are true.
 * Like the rest of the pack it shares no code with the stage but the meal clock's (lib/time.ts), so
 * numbers are written here as lib/formatSignal.ts writes them (lymph.test.ts checks they agree).
 *
 * The words never score a meal: blood fat has no band and no threshold line (model §2.10), so it is
 * never "high" or "too much", only higher or lower than before eating. A meal with almost no fat
 * says so (ui-ux §6). On a big solid meal blood fat stays near its highest for hours (R90): the words
 * say "stays up for hours" rather than stress its highest minute, which sits somewhere on that plateau.
 */

const formats = new Map<string, Intl.NumberFormat>()
/** A number in the page's language, in Latin digits, to `digits` places at most (lib/formatSignal.ts numberFormat). */
const num = (v: number, lang: string, digits = 0) => {
  const key = `${lang}:${digits}`
  let f = formats.get(key)
  if (!f) formats.set(key, (f = new Intl.NumberFormat(lang, { numberingSystem: 'latn', maximumFractionDigits: digits })))
  return f.format(v)
}

/** This pack's units' texts (`units.*`, lib/formatSignal.ts UNIT_KEY). */
const UNIT: Partial<Record<SignalMeta['unit'], string>> = { 'mg/dL': 'mgdl', 'g/min': 'gPerMin' }

/** A value with its unit, rounded to its row's step: "98 mg/dL", "0.06 g/min" (lib/formatSignal.ts formatSignal). */
export function valueText(v: number, meta: Pick<SignalMeta, 'round' | 'unit'>, t: TFunction, lang: string): string {
  const step = meta.round ?? 1
  const digits = step < 1 ? Math.round(-Math.log10(step)) : 0
  const n = num(Math.round(v / step) * step || 0, lang, digits)
  const key = UNIT[meta.unit]
  return key ? t(`units.${key}`, { n }) : `${n} ${meta.unit}`
}

/** The highest value of a series and the minute it first comes at. */
export function highestOf(series: Series, stepMin: number): { value: number; atMin: number } {
  let at = 0
  for (let i = 1; i < series.values.length; i++) if (series.values[i]! > series.values[at]!) at = i
  return { value: series.values[at]!, atMin: at * stepMin }
}

/** The fat the meal brings, as the words say it: whole grams, or one decimal under 10 g ("2.6 g"). */
const grams = (g: number, lang: string) => num(g, lang, g < 10 ? 1 : 0)

/**
 * The summary: a meal with almost no fat says lymph carries almost none; a little fat, that blood fat
 * hardly moves; otherwise how high blood fat goes and when, or that it stays up for hours (R90),
 * against before eating. Beside a kept plan: each plan's highest blood fat, and the fat each brings.
 */
export function lymphSummary(run: RunResult, kept: RunResult | null, t: TFunction, lang: string): Summary | null {
  const fat = seriesOf(run, BLOOD_FAT)
  if (!fat) return null
  const n = (v: number) => num(Math.round(v), lang)
  const base = t('units.mgdl', { n: n(FASTING_MG_DL) })
  const top = highestOf(fat, run.stepMin)
  const keptFat = kept && seriesOf(kept, BLOOD_FAT)
  if (kept && keptFat) {
    const other = highestOf(keptFat, kept.stepMin).value
    const [a, b] = [Math.round(top.value), Math.round(other)]
    const reason = t('sys.lymph.summary.compareFat', { run: grams(mealFatG(run), lang), kept: grams(mealFatG(kept), lang) })
    if (Math.abs(a - b) >= FLAT_MG_DL) {
      const text = n(a)
      return { headline: t('sys.lymph.summary.compare', { run: text, kept: n(b) }), key: { text, line: 'run' }, reason }
    }
    return { headline: t('sys.lymph.summary.same', { n: n(Math.max(a, b)) }), reason }
  }
  const g = mealFatG(run)
  if (g < LITTLE_FAT_G) return { headline: t('sys.lymph.summary.none'), reason: t('sys.lymph.summary.noneReason', { base }) }
  const text = n(top.value)
  if (top.value - FASTING_MG_DL < FLAT_MG_DL)
    return { headline: t('sys.lymph.summary.little', { n: text, base }), reason: t('sys.lymph.summary.littleReason', { g: grams(g, lang) }) }
  const reason = t('sys.lymph.summary.road', { g: grams(g, lang) })
  if (upMin(fat, run.stepMin) >= UP_MIN)
    return { headline: t('sys.lymph.summary.hours', { n: text, base }), key: { text, line: 'run' }, reason }
  return {
    headline: t('sys.lymph.summary.peak', { n: text, time: formatDuration(top.atMin, t), base }),
    key: { text, line: 'run' },
    reason,
  }
}

/**
 * A graph's sentence: flat ("about 80 mg/dL all the way"), or from its start to its highest and when,
 * or, on a long plateau, that it stays up for hours (R90).
 */
export function lymphStripSummary(id: ActiveSignalId, run: RunResult, t: TFunction, lang: string): string | null {
  const series = seriesOf(run, id)
  if (!series) return null
  const name = t(`${series.meta.i18nKey}.name`)
  const value = (v: number) => valueText(v, series.meta, t, lang)
  const top = highestOf(series, run.stepMin)
  const start = series.values[0]!
  if (value(top.value) === value(start)) return t('sys.lymph.graph.flat', { name, value: value(start) })
  if ((id as string) === BLOOD_FAT && upMin(series, run.stepMin) >= UP_MIN)
    return t('sys.lymph.graph.hours', { name, start: value(start), peak: value(top.value) })
  return t('sys.lymph.graph.peak', { name, start: value(start), peak: value(top.value), time: formatDuration(top.atMin, t) })
}
