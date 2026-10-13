import { MAX_ITEMS, clampServings, type MealItem } from './meal.ts'
import { MODEL_VERSION, PARAMS } from './params.ts'
import { DEFAULT_ORGANISM, ORGANISM_PROFILES, isOrganismId, type OrganismId, type ProfileId } from './core/organism.ts'

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
  /** What this version could not show as the link asked (bug B21); absent when nothing changed. */
  changes?: LinkChange[]
}

/**
 * One part of a link that this version shows differently, or leaves out, so the stage can say so
 * (B21: a link is never changed silently). `param` is the link's letter (`a`, `t`, `who`, …) and
 * `asked` the part as the link wrote it (cut at 40 characters). A food's servings that changed
 * (`cola:999`) have `shown` (`5`); a food past the sixth has none, nor has a part that could not be
 * read. A time past the end opens at the end. Foods the catalog no longer has are the app's to
 * report: it knows the catalog.
 */
export interface LinkChange {
  param: string
  asked: string
  shown?: string
}

/** What a caller writes: the organism may be left out (human). */
export type ShareInput = Omit<ShareState, 'modelVersion' | 'organism' | 'unknownOrganism'> & { organism?: OrganismId }

const ITEM_RE = /^([a-z0-9-]{1,40}):(\d+(?:\.\d+)?)$/
/** Shape of a system, view or profile ID in a link (catalog style: camelCase, dots, dashes). */
const VIEW_ID_RE = /^[a-zA-Z][a-zA-Z0-9.-]{0,39}$/
/** An unknown `o`, or a part of a link that changed, is kept only for the notice, so it is cut short. */
const MAX_UNKNOWN_ORGANISM = 40
const MAX_ASKED = 40

export function encodeMeal(items: MealItem[]): string {
  return items.map((i) => `${i.foodId}:${+clampServings(i.servings).toFixed(2)}`).join(',')
}

/**
 * Parse "cola:1,fries:0.5". A food listed twice is merged into one item. What can't be shown as
 * written goes into `changes`: a part that can't be read, servings outside ¼–5 or between quarter
 * steps, and foods past the sixth.
 */
export function decodeMeal(raw: string | null | undefined, param = 'a', changes: LinkChange[] = []): MealItem[] {
  if (!raw) return []
  const merged = new Map<string, number>()
  const parts = raw.split(',')
  // A huge link is not read part by part (so it can't make us loop for long): the rest is one part.
  for (const part of [...parts.slice(0, MAX_ITEMS * 2), parts.slice(MAX_ITEMS * 2).join(',')]) {
    const m = ITEM_RE.exec(part.trim())
    if (m) merged.set(m[1]!, (merged.get(m[1]!) ?? 0) + Number(m[2]))
    else if (part.trim()) changes.push({ param, asked: part.slice(0, MAX_ASKED) })
  }
  return [...merged].flatMap(([foodId, n], i) => {
    const servings = clampServings(n)
    if (i >= MAX_ITEMS || servings !== n)
      changes.push({ param, asked: `${foodId}:${n}`, ...(i < MAX_ITEMS ? { shown: `${servings}` } : {}) })
    return i < MAX_ITEMS ? [{ foodId, servings }] : []
  })
}

/**
 * Writes v, then o (only if not human), a, b, t, who, layer, in, lang. A link with only the v1
 * parameters is byte-for-byte what v1 wrote.
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
  return p
}

/** A link's view ID, or undefined if it is missing or not shaped like an ID. */
function viewId(raw: string | null): string | undefined {
  return raw !== null && VIEW_ID_RE.test(raw) ? raw : undefined
}

export function decodeShareState(params: URLSearchParams): ShareState {
  const changes: LinkChange[] = []
  /** `param` is in the link but this version can't show it as written. */
  const change = (param: string) => {
    const asked = params.get(param)
    if (asked) changes.push({ param, asked: asked.slice(0, MAX_ASKED) })
  }
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
  const versionOk = Number.isInteger(v) && v > 0
  if (!versionOk) change('v')
  // Past the end, it opens at the end.
  if (!(t >= 0 && t <= PARAMS.horizonMin)) change('t')
  if (lang !== 'en' && lang !== 'hi') change('lang')
  // An unknown organism's own parameters are not changes: the "newer version" note covers them.
  if (!unknownOrganism) {
    if (!who) change('who')
    if (!layer) change('layer')
    if (!inside) change('in')
  }
  // Activity bouts come with model version 3 (architecture §2): this version shows no walk or run.
  change('act')
  change('bact')
  const a = decodeMeal(params.get('a'), 'a', changes)
  const b = decodeMeal(params.get('b'), 'b', changes)
  return {
    modelVersion: versionOk ? v : MODEL_VERSION,
    organism,
    ...(unknownOrganism ? { unknownOrganism } : {}),
    a,
    b,
    t: t > 0 ? Math.min(t, PARAMS.horizonMin) : 0,
    ...(who ? { who } : {}),
    ...(layer ? { layer } : {}),
    ...(inside ? { inside } : {}),
    ...(lang === 'en' || lang === 'hi' ? { lang } : {}),
    ...(changes.length ? { changes } : {}),
  }
}
