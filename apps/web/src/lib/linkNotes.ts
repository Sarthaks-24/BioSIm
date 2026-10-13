import type { TFunction } from 'i18next'
import { MAX_ITEMS, MODEL_VERSION, PARAMS } from '@lifepeek/engine'
import type { RunState } from '../state/run.ts'

/** What the notes about an opened link read from the run state. */
export type LinkState = Pick<RunState, 'linkModelVersion' | 'unknownOrganism' | 'droppedFoods' | 'hindiLater' | 'changes'>

/** The link was made by a newer LifePeek: a newer model, or an organism this version lacks. */
export const isNewer = (s: LinkState) => s.unknownOrganism !== null || (s.linkModelVersion ?? 0) > MODEL_VERSION

/** A food part of a change as the codec writes it (`cola:999`); anything else is a part it could not read. */
const FOOD_PART = /^([a-z0-9-]{1,40}):(\d+(?:\.\d+)?)$/

/**
 * The notes about the opened link, in words (FP-6), except the "newer version" one, which
 * components/stage/LinkNotes.tsx draws (it may offer "Update now"): Hindi later (R47), an older
 * model, foods that no longer exist, and each change the link had on load (B21), said plainly
 * ("This link asked for Cola ×999; showing ×5, …"). Parts that could not be read, and foods past
 * the sixth, are one note each. `food` names a food by its ID, in the page's language. Last, a
 * meal over the size the model is good for (`over`: this meal, the kept one), which only a link
 * can make (the food sheet and servings stop the meal growing past it).
 */
export function linkNotes(s: LinkState, t: TFunction, food: (id: string) => string, over: readonly boolean[] = []): string[] {
  const newer = isNewer(s)
  const notes: string[] = []
  if (s.hindiLater) notes.push(t('link.hindiLater'))
  if (!newer && s.linkModelVersion !== null && s.linkModelVersion < MODEL_VERSION) notes.push(t('link.old'))
  if (s.droppedFoods > 0) notes.push(t('link.unknownFoods', { count: s.droppedFoods }))
  const unread: string[] = []
  const left: string[] = []
  for (const c of s.changes) {
    const part = FOOD_PART.exec(c.asked)
    if ((c.param === 'a' || c.param === 'b') && part) {
      if (c.shown) notes.push(t('link.servings', { food: food(part[1]!), asked: part[2], shown: c.shown }))
      else left.push(food(part[1]!))
    } else if (c.param === 't' && Number(c.asked) > PARAMS.horizonMin) notes.push(t('link.time', { hours: PARAMS.horizonMin / 60 }))
    else if (c.param === 'who') notes.push(t('link.who'))
    else if (c.param === 'layer') notes.push(t('link.layer', { asked: c.asked, shown: t('systems.digestion.name') }))
    else if (c.param === 'act' || c.param === 'bact') {
      // A newer link's own note says its walk or run is not shown.
      if (!newer) notes.push(t('link.activity'))
    } else unread.push(`“${c.param === 'a' || c.param === 'b' ? c.asked : `${c.param}=${c.asked}`}”`)
  }
  if (left.length) notes.push(t('link.tooMany', { n: MAX_ITEMS, foods: left.join(', ') }))
  if (unread.length) notes.push(t('link.unread', { parts: unread.join(', ') }))
  over.forEach(
    (big, i) => big && notes.push(t('link.overCap', { meal: t(i ? 'stage.keptMeal' : 'stage.thisMeal'), kcal: PARAMS.maxMealKcal })),
  )
  // `act` and `bact` say the same.
  return [...new Set(notes)]
}
