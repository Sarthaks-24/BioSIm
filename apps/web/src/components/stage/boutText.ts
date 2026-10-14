import type { TFunction } from 'i18next'
import type { ActivityBout, ActivityKind, MealItem } from '@lifepeek/engine'
import { mealNames, shortMealNames } from './mealText.ts'

/**
 * Activity bouts as words (E-3b-ui, ui-ux §5): the stage's only; a page that names meals uses
 * mealText.ts alone, so it never downloads these.
 */

/** Each kind's picture on its chip (in place of a food's). */
export const BOUT_EMOJI: { readonly [K in ActivityKind]: string } = {
  walk: '🚶',
  walkBrisk: '🚶',
  run: '🏃',
  sitClass: '🪑',
  football: '⚽',
  cricket: '🏏',
  badminton: '🏸',
}

/** Minutes on the meal clock as h:mm ("0:30", "5:50"), as the link notes write them. */
export const clockText = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`

/** A bout in words: "Walk 20 min, from 0:30" (the chip, the kept tag, the sheet). */
export const boutLabel = (b: ActivityBout, t: TFunction) =>
  t('activity.bout', { kind: t(`activity.kinds.${b.kind}`), min: b.durMin, start: clockText(b.startMin) })

/** Words inside a sentence start in lower case: "Cola + walk 20 min, from 2:00", "Try: walk 20 min, from 0:30" (ui-ux §5, §6). */
export const inSentence = (text: string) => text.charAt(0).toLocaleLowerCase() + text.slice(1)
const after = (text: string, first: boolean) => (first ? text : inSentence(text))

/**
 * A meal and its activity bouts as words: "Cola + walk 20 min, from 2:00" (the kept tag, Keep's
 * announcement); bouts only: "Walk 20 min, from 0:30".
 */
export function planNames(items: readonly MealItem[], bouts: readonly ActivityBout[], lang: string, t: TFunction): string {
  return [mealNames(items, lang), ...bouts.map((b) => boutLabel(b, t))]
    .filter(Boolean)
    .map((x, i) => after(x, !i))
    .join(' + ')
}

/** The graphs' legend name of a plan: its foods in few words, then its first bout's kind ("Cola + walk"). */
export function shortPlanNames(items: readonly MealItem[], bouts: readonly ActivityBout[], lang: string, t: TFunction): string {
  const kind = bouts[0] && t(`activity.kinds.${bouts[0].kind}`)
  return [shortMealNames(items, lang), kind]
    .filter(Boolean)
    .map((x, i) => after(x!, !i))
    .join(' + ')
}
