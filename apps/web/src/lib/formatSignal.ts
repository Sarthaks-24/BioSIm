import type { TFunction } from 'i18next'
import type { SignalMeta, Unit } from '@lifepeek/engine'

/**
 * Numbers on the graphs, as words (plan-graphs §3.7): rounded to the signal's display step
 * (glucose 1, kcal/h 5, g 5) so the model never looks more precise than it is, written with
 * `Intl.NumberFormat` for the page language but always in Latin digits (the international form
 * of Indian numerals, Constitution Art. 343(1), which NCERT books use), and with the unit from i18n.
 */

const formatters = new Map<string, Intl.NumberFormat>()

/** The page language's number format, Latin digits, whole numbers. Cached: readouts call it 10 times a second. */
export function numberFormat(lang: string): Intl.NumberFormat {
  let f = formatters.get(lang)
  if (!f) {
    f = new Intl.NumberFormat(lang, { numberingSystem: 'latn', maximumFractionDigits: 0 })
    formatters.set(lang, f)
  }
  return f
}

/** Rounds to the display step (1, 5 …); −0 becomes 0. */
export function roundTo(value: number, step = 1): number {
  const r = Math.round(value / step) * step
  return r === 0 ? 0 : r
}

/** "118", "1,000": the rounded number alone (axis labels). */
export function formatNumber(value: number, meta: Pick<SignalMeta, 'round'>, lang: string): string {
  return numberFormat(lang).format(roundTo(value, meta.round ?? 1))
}

/** The i18n key of each unit: `units.<key>` = "{{n}} mg/dL", `units.words.<key>` = the unit in words. i18n.test.ts counts these keys as used. */
export const UNIT_KEY: Partial<Record<Unit, string>> = {
  'mg/dL': 'mgdl',
  g: 'g',
  kcal: 'kcal',
  'kcal/h': 'kcalPerH',
}

/** "118 mg/dL", "340 g", "1,000 g": the rounded value with its unit, in the page language. */
export function formatSignal(value: number, meta: Pick<SignalMeta, 'round' | 'unit'>, t: TFunction, lang: string): string {
  const n = formatNumber(value, meta, lang)
  const key = UNIT_KEY[meta.unit]
  return key ? t(`units.${key}`, { n }) : `${n} ${meta.unit}`
}

/** The unit spelled out for "How we know": "mg/dL: milligrams of sugar in each decilitre of blood". */
export function unitInWords(unit: Unit, t: TFunction): string {
  const key = UNIT_KEY[unit]
  return key ? t(`units.words.${key}`) : unit
}

/** "75–140 mg/dL": a between-people range, both ends rounded like the value; "90 mg/dL" when they round the same (U10). */
export function formatBand(low: number, high: number, meta: Pick<SignalMeta, 'round' | 'unit'>, t: TFunction, lang: string): string {
  const from = formatNumber(low, meta, lang)
  return from === formatNumber(high, meta, lang)
    ? formatSignal(high, meta, t, lang)
    : t('graph.range', { low: from, high: formatSignal(high, meta, t, lang) })
}

/** The unit alone, as the readouts write it ("g", "mg/dL", "किलो कैलोरी/घंटा"): a graph's y-axis unit. */
export function unitLabel(meta: Pick<SignalMeta, 'unit'>, t: TFunction): string {
  const key = UNIT_KEY[meta.unit]
  return key ? t(`units.${key}`, { n: '' }).trim() : meta.unit
}
