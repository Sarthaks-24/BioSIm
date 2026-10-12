import { MAX_ITEMS, clampServings, type MealItem } from './meal.ts'
import { MODEL_VERSION } from './params.ts'

/**
 * Everything a teacher sets up lives in the URL, so a link IS a saved lesson:
 *   ?v=1&a=cola:1&b=cheeseburger:1,fries:1&t=120
 * `v` is the model version the link was made with. Old links still open; the UI tells the
 * user if results were computed by a newer model.
 */

export interface ShareState {
  modelVersion: number
  a: MealItem[]
  b: MealItem[]
  /** Timeline position in minutes. */
  t: number
}

const ITEM_RE = /^([a-z0-9-]{1,40}):(\d+(?:\.\d+)?)$/

export function encodeMeal(items: MealItem[]): string {
  return items.map((i) => `${i.foodId}:${+clampServings(i.servings).toFixed(2)}`).join(',')
}

export function decodeMeal(raw: string | null | undefined): MealItem[] {
  if (!raw) return []
  const out: MealItem[] = []
  for (const part of raw.split(',').slice(0, MAX_ITEMS)) {
    const m = ITEM_RE.exec(part.trim())
    if (!m) continue
    out.push({ foodId: m[1]!, servings: clampServings(Number(m[2])) })
  }
  return out
}

export function encodeShareState(s: Omit<ShareState, 'modelVersion'>): URLSearchParams {
  const p = new URLSearchParams()
  p.set('v', String(MODEL_VERSION))
  if (s.a.length) p.set('a', encodeMeal(s.a))
  if (s.b.length) p.set('b', encodeMeal(s.b))
  if (s.t > 0) p.set('t', String(Math.round(s.t)))
  return p
}

export function decodeShareState(params: URLSearchParams): ShareState {
  const v = Number(params.get('v'))
  const t = Number(params.get('t'))
  return {
    modelVersion: Number.isInteger(v) && v > 0 ? v : MODEL_VERSION,
    a: decodeMeal(params.get('a')),
    b: decodeMeal(params.get('b')),
    t: Number.isFinite(t) && t > 0 ? Math.min(t, 48 * 60) : 0,
  }
}
