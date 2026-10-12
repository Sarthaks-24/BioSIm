import { MAX_ITEMS, clampServings, type MealItem } from './meal.ts'
import { MODEL_VERSION, PARAMS } from './params.ts'

/**
 * Everything a teacher sets up lives in the URL, so a link IS a saved lesson:
 *   ?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=120&lang=hi
 * `v` is the model version the link was made with. Old links still open; the UI tells the
 * user if results were computed by a newer model. This format is a contract with every link
 * already shared — only ever add optional parameters.
 */

export const SHARE_LANGS = ['en', 'hi'] as const
export type ShareLang = (typeof SHARE_LANGS)[number]

export interface ShareState {
  modelVersion: number
  a: MealItem[]
  b: MealItem[]
  /** Timeline position in minutes. */
  t: number
  lang?: ShareLang
}

const ITEM_RE = /^([a-z0-9-]{1,40}):(\d+(?:\.\d+)?)$/

export function encodeMeal(items: MealItem[]): string {
  return items.map((i) => `${i.foodId}:${+clampServings(i.servings).toFixed(2)}`).join(',')
}

/** Parse "cola:1,fries:0.5". Bad parts are skipped; a food listed twice is merged into one item. */
export function decodeMeal(raw: string | null | undefined): MealItem[] {
  if (!raw) return []
  const merged = new Map<string, number>()
  for (const part of raw.split(',').slice(0, MAX_ITEMS * 2)) {
    const m = ITEM_RE.exec(part.trim())
    if (!m) continue
    merged.set(m[1]!, (merged.get(m[1]!) ?? 0) + Number(m[2]))
  }
  return [...merged].slice(0, MAX_ITEMS).map(([foodId, servings]) => ({ foodId, servings: clampServings(servings) }))
}

export function encodeShareState(s: Omit<ShareState, 'modelVersion'>): URLSearchParams {
  const p = new URLSearchParams()
  p.set('v', String(MODEL_VERSION))
  if (s.a.length) p.set('a', encodeMeal(s.a))
  if (s.b.length) p.set('b', encodeMeal(s.b))
  if (s.t > 0) p.set('t', String(Math.round(s.t)))
  if (s.lang) p.set('lang', s.lang)
  return p
}

export function decodeShareState(params: URLSearchParams): ShareState {
  const v = Number(params.get('v'))
  const t = Number(params.get('t'))
  const lang = params.get('lang')
  return {
    modelVersion: Number.isInteger(v) && v > 0 ? v : MODEL_VERSION,
    a: decodeMeal(params.get('a')),
    b: decodeMeal(params.get('b')),
    t: Number.isFinite(t) && t > 0 ? Math.min(t, PARAMS.horizonMin) : 0,
    ...(lang === 'en' || lang === 'hi' ? { lang } : {}),
  }
}
