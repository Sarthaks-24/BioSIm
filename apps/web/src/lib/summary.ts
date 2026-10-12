import type { TFunction } from 'i18next'
import type { Meal, Simulation } from '@lifepeek/engine'
import { shortMealNames } from '../components/stage/mealText.ts'
import { formatDuration } from './time.ts'

/**
 * The stage's summary sentence (council verdict #3, 2026-10-13): the answer in one sentence, so
 * nobody has to read a graph to get the point. It replaces v1's Verdict and keeps its truth
 * rules (lib/verdict.ts, commit cfdf0e5), now for "this meal" and "the kept meal":
 * - one meal: when half of it has left the stomach (by food energy, as the stomach graph's ring;
 *   for water, by weight);
 * - a kept meal too: which leaves the stomach faster and about how many times, or "about the same
 *   speed" when the times are within 15 %; plus a reason, but only when that reason really
 *   explains the result (a drink against solid food, or clearly fewer calories).
 * The decision (`summaryData`) is kept apart from the wording, so tests can check it is TRUE for
 * every lesson. The aria wiring and the per-graph summaries are WP-15's.
 */
export type SummaryReason = 'drink' | 'calories' | 'none'
export type RunKey = 'run' | 'kept'

export type SummaryData =
  | { kind: 'empty' }
  | { kind: 'single'; halfMin: number; byWeight: boolean }
  | {
      kind: 'pair'
      fast: RunKey
      slow: RunKey
      /** How many times faster the fast meal half-empties. */
      ratio: number
      similar: boolean
      reason: SummaryReason
      half: Record<RunKey, number>
      kcal: Record<RunKey, number>
    }

/** Only a drink: nothing has to be ground up first. */
export const isDrinkOnly = (meal: Meal) => meal.items.length > 0 && meal.solid.massG === 0

/** Below this ratio of the two half-times the meals count as "about the same speed". */
export const SIMILAR_RATIO = 1.15

/** When half of the meal has left the stomach (event.stomachHalfEmpty); the end of the run if never. */
const halfMin = (run: Simulation) => run.moments.get('event.stomachHalfEmpty')?.atMin ?? run.horizonMin

export function summaryData(run: Simulation, kept: Simulation | null): SummaryData {
  if (run.meal.items.length === 0) return { kind: 'empty' }
  if (!kept || kept.meal.items.length === 0) return { kind: 'single', halfMin: halfMin(run), byWeight: run.events.noNutrients }

  const half = { run: halfMin(run), kept: halfMin(kept) }
  const kcal = { run: Math.round(run.meal.total.energyKcal), kept: Math.round(kept.meal.total.energyKcal) }
  const meals = { run: run.meal, kept: kept.meal }
  const [fast, slow] = half.run <= half.kept ? (['run', 'kept'] as const) : (['kept', 'run'] as const)
  const ratio = half[slow] / Math.max(1, half[fast])
  const similar = ratio < SIMILAR_RATIO
  let reason: SummaryReason = 'none'
  if (!similar) {
    if (isDrinkOnly(meals[fast]) && !isDrinkOnly(meals[slow])) reason = 'drink'
    else if (kcal[fast] < kcal[slow] * 0.9) reason = 'calories'
  }
  return { kind: 'pair', fast, slow, ratio, similar, reason, half, kcal }
}

/** The summary as words: a headline and, when one is true, the reason. */
export interface Summary {
  headline: string
  reason?: string
}

/** "×9", or "×1.6" below 3, where the decimal matters. */
const times = (ratio: number) => (ratio < 3 ? ratio.toFixed(1) : String(Math.round(ratio)))

/** English starts a sentence with a capital, whichever meal comes first ("This meal …"). */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * A meal's name inside a sentence: its short food names ("Cola", "Roti ×2 + Dal"). A meal of more
 * than two foods, or two meals with the same name (Cola ×1 kept, Cola ×1 + water now), are
 * "this meal" and "the kept meal" instead, so the sentence never says "Cola is faster than Cola".
 */
function names(run: Simulation, kept: Simulation | null, t: TFunction, lang: string): Record<RunKey, string> {
  const short = (s: Simulation) =>
    s.meal.items.length <= 2
      ? shortMealNames(
          s.meal.items.map((i) => ({ foodId: i.food.id, servings: i.servings })),
          lang,
        )
      : ''
  const n = { run: short(run), kept: kept ? short(kept) : '' }
  if (!kept) return { run: n.run || t('summary.thisMeal'), kept: '' }
  const clash = !n.run || !n.kept || n.run === n.kept
  return clash ? { run: t('summary.thisMeal'), kept: t('summary.keptMeal') } : n
}

/** One meal: "Half of the food energy in Cola has left the stomach after 30 min." */
export function singleSummary(run: Simulation, t: TFunction, lang: string): Summary | null {
  const d = summaryData(run, null)
  if (d.kind !== 'single') return null
  const meal = names(run, null, t, lang).run
  return { headline: sentence(t(d.byWeight ? 'summary.singleWater' : 'summary.single', { meal, time: formatDuration(d.halfMin, t) })) }
}

/** This meal against the kept one: "Cola leaves the stomach about 9× faster than Cheeseburger + French fries." */
export function compareSummary(run: Simulation, kept: Simulation, t: TFunction, lang: string): Summary | null {
  const d = summaryData(run, kept)
  if (d.kind !== 'pair') return d.kind === 'single' ? singleSummary(run, t, lang) : null
  const n = names(run, kept, t, lang)
  const fast = n[d.fast]
  const slow = n[d.slow]
  if (d.similar) return { headline: sentence(t('summary.similar', { a: n.run, b: n.kept })) }
  const headline = sentence(t('summary.faster', { fast, slow, x: times(d.ratio) }))
  if (d.reason === 'drink') return { headline, reason: sentence(t('summary.reasonDrink', { fast })) }
  if (d.reason === 'calories')
    return { headline, reason: sentence(t('summary.reasonCalories', { slow, kcalSlow: d.kcal[d.slow], kcalFast: d.kcal[d.fast] })) }
  return { headline }
}
