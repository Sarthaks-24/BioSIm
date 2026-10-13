import { MAX_ITEMS, clampServings, type MealItem } from './meal.ts'
import { MODEL_VERSION, PARAMS } from './params.ts'
import { DEFAULT_ORGANISM, ORGANISM_PROFILES, isOrganismId, type OrganismId, type ProfileId } from './core/organism.ts'
import { decodeActivity, encodeActivity, type ActivityBout } from './core/activity.ts'

/**
 * Everything a teacher sets up lives in the URL, so a link IS a saved lesson:
 *   ?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=120&lang=hi
 * `v` is the model version the link was made with. Old links still open; the UI tells the
 * user if results were computed by a newer model. This format is a contract with every link
 * already shared — only ever add optional parameters.
 *
 * Optional parameters added for v2 (all read in the organism's context; a bad value is dropped,
 * so the screen falls back to that organism's default):
 *   o      organism. Absent ⇒ human, forever; `o=human` is never written. An unknown `o` opens
 *          human and is reported as `unknownOrganism` (the link was made by a newer LifePeek).
 *   who    the stated person (profile), e.g. `adult-ref`.
 *   layer  the body-system layer shown, e.g. `digestion`.
 *   in     the inside view that is open (`inside` in ShareState).
 *   bo     RESERVED for the kept run's organism: read and ignored, never written.
 *
 * Added with model version 3 (E-3b-eng, architecture §2):
 *   act    the activity bouts with the meal, `kind.startMin.durMin,…` (`walk.30.20,run.240.10`).
 *   bact   the kept run's bouts, same form. Absent or empty ⇒ resting. Bouts that cannot be shown
 *          (a hidden or unknown kind, outside the limits, overlapping, past the eighth) are dropped.
 */

export const SHARE_LANGS = ['en', 'hi'] as const
export type ShareLang = (typeof SHARE_LANGS)[number]

export interface ShareState {
  modelVersion: number
  organism: OrganismId
  /** The `o` of a link made for an organism this version does not know. The run is human. */
  unknownOrganism?: string
  a: MealItem[]
  b: MealItem[]
  /** Timeline position in minutes. */
  t: number
  /** Only a profile that exists for `organism`. */
  who?: ProfileId
  /** A system ID; the registry checks that it exists for `organism`. */
  layer?: string
  /** An inside-view ID (URL `in`); the registry checks that it exists for `organism`. */
  inside?: string
  lang?: ShareLang
  /** The meal's activity bouts (URL `act`), in start order; absent = resting. */
  act?: ActivityBout[]
  /** The kept run's activity bouts (URL `bact`), in start order; absent = resting. */
  bact?: ActivityBout[]
}

/** What a caller writes: the organism may be left out (human). */
export type ShareInput = Omit<ShareState, 'modelVersion' | 'organism' | 'unknownOrganism'> & { organism?: OrganismId }

const ITEM_RE = /^([a-z0-9-]{1,40}):(\d+(?:\.\d+)?)$/
/** Shape of a system, view or profile ID in a link (catalog style: camelCase, dots, dashes). */
const VIEW_ID_RE = /^[a-zA-Z][a-zA-Z0-9.-]{0,39}$/
/** An unknown `o` is kept only for the notice, so it is cut short. */
const MAX_UNKNOWN_ORGANISM = 40

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

/**
 * Writes v, then o (only if not human), a, b, t, who, layer, in, lang, act, bact. A link with
 * only the v1 parameters is byte-for-byte what v1 wrote; a resting run writes no act or bact.
 */
export function encodeShareState(s: ShareInput): URLSearchParams {
  const p = new URLSearchParams()
  p.set('v', String(MODEL_VERSION))
  const organism = s.organism ?? DEFAULT_ORGANISM
  if (organism !== DEFAULT_ORGANISM) p.set('o', organism)
  if (s.a.length) p.set('a', encodeMeal(s.a))
  if (s.b.length) p.set('b', encodeMeal(s.b))
  if (s.t > 0) p.set('t', String(Math.round(s.t)))
  if (s.who) p.set('who', s.who)
  if (s.layer) p.set('layer', s.layer)
  if (s.inside) p.set('in', s.inside)
  if (s.lang) p.set('lang', s.lang)
  if (s.act?.length) p.set('act', encodeActivity(s.act))
  if (s.bact?.length) p.set('bact', encodeActivity(s.bact))
  return p
}

/** A link's view ID, or undefined if it is missing or not shaped like an ID. */
function viewId(raw: string | null): string | undefined {
  return raw !== null && VIEW_ID_RE.test(raw) ? raw : undefined
}

export function decodeShareState(params: URLSearchParams): ShareState {
  const v = Number(params.get('v'))
  const t = Number(params.get('t'))
  const lang = params.get('lang')
  // `o` absent or empty ⇒ human. Unknown ⇒ human too, and the UI says the link is from a newer version.
  const o = params.get('o') ?? ''
  const organism: OrganismId = isOrganismId(o) ? o : DEFAULT_ORGANISM
  const unknownOrganism = o && !isOrganismId(o) ? o.slice(0, MAX_UNKNOWN_ORGANISM) : undefined
  // A `who` for an unknown organism is not read: it belonged to that organism, not to the human.
  const who = unknownOrganism ? undefined : ORGANISM_PROFILES[organism].find((id) => id === params.get('who'))
  const layer = unknownOrganism ? undefined : viewId(params.get('layer'))
  const inside = unknownOrganism ? undefined : viewId(params.get('in'))
  // `bo` (the kept run's organism) is reserved: never read into the state, never written.
  // Activity belongs to the human: an unknown organism's bouts are not read.
  const act = unknownOrganism ? [] : decodeActivity(params.get('act'), 'act')
  const bact = unknownOrganism ? [] : decodeActivity(params.get('bact'), 'bact')
  return {
    modelVersion: Number.isInteger(v) && v > 0 ? v : MODEL_VERSION,
    organism,
    ...(unknownOrganism ? { unknownOrganism } : {}),
    a: decodeMeal(params.get('a')),
    b: decodeMeal(params.get('b')),
    t: Number.isFinite(t) && t > 0 ? Math.min(t, PARAMS.horizonMin) : 0,
    ...(who ? { who } : {}),
    ...(layer ? { layer } : {}),
    ...(inside ? { inside } : {}),
    ...(lang === 'en' || lang === 'hi' ? { lang } : {}),
    ...(act.length ? { act } : {}),
    ...(bact.length ? { bact } : {}),
  }
}
