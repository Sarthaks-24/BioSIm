import type { ActivityBout, MealItem } from '@lifepeek/engine'
import { systemOf, type SystemId } from '../systems/registry.ts'
import { presetHref } from './presets.ts'

/**
 * The flagship guided lesson, "One roti, one walk: what does every system do?" (X-1; ui-ux §8.1,
 * content-i18n §8.2, R30, R37, R38): roti (one serving, two rotis) and a glass of water at 0:00, a
 * 20-minute walk from 1:00 (`walk.60.20`), and the same meal at rest kept. Its pauses (where the
 * stage stops, which system and graph, what it says) come with the lesson bar
 * (lib/flagshipPauses.ts, lazy); this is what Home's lesson card and Teach need to offer it. Neither
 * is in any page's first download (Home loads its card after the first paint).
 *
 * Its release (R18): v3.0. It pauses on v3.0 systems only (R30), so Home and Teach offer it once all
 * of them are public (their rows' `public`, flipped at H-1), or in a `?preview=1` session. Skin is not
 * among them: while it is hidden its pause falls back to the heart (R34).
 */
const meal: MealItem[] = [
  { foodId: 'roti', servings: 1 },
  { foodId: 'water', servings: 1 },
]
const walk: ActivityBout[] = [{ kind: 'walk', startMin: 60, durMin: 20 }]

export const FLAGSHIP = {
  key: 'flagship',
  release: 'v3.0',
  meal,
  activity: walk,
  kept: meal,
  keptActivity: [] as ActivityBout[],
  /** Its first pause: Digestion at 0:30 (lib/flagshipPauses.ts; presets.test checks they agree). */
  layer: 'digestion' as SystemId,
  t: 30,
  /** The systems it pauses on whatever is public (pause 4 is skin only when skin is public, R34). */
  systems: ['digestion', 'circulation', 'breathing', 'kidneys'] as readonly SystemId[],
}

/**
 * What Home's and Teach's link to the lesson carries in its history entry (React Router's `state`):
 * the stage shows the lesson bar for it. Not in the address: a copied link, or one opened in a new
 * tab, is the plain stage (no new link parameter, ui-ux §8.1). The bar's End clears it.
 */
export interface LessonState {
  lesson?: 1
}
export const LESSON_STATE: LessonState = { lesson: 1 }

/** A page's own `?preview=1` (Home, Teach): hidden systems and their lessons show, as on the stage. */
export const isPreview = (search: string) => new URLSearchParams(search).get('preview') === '1'

/** Home and Teach offer the lesson once every system it pauses on is public, or in a preview session. */
export const flagshipShown = (preview: boolean) => preview || FLAGSHIP.systems.every((id) => systemOf(id)?.public)

/**
 * Its first pause as a plain link (no lesson parameter: ui-ux §8.1). A preview session's link keeps
 * `preview=1`, so the hidden systems it pauses on open. The walk is written as the codec writes `act`
 * (presets.test checks the whole link against encodeShareState): importing the codec here, outside
 * every page's first download, split part of it out of that download (+1.3 KB on /sim, measured).
 */
export const flagshipHref = (preview: boolean) =>
  `${presetHref({ key: FLAGSHIP.key, meal, kept: meal, t: FLAGSHIP.t, layer: FLAGSHIP.layer })}&act=${walk.map((b) => `${b.kind}.${b.startMin}.${b.durMin}`).join()}${preview ? '&preview=1' : ''}`
