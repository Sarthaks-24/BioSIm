import type { TFunction } from 'i18next'
import { DEFAULT_ORGANISM, ORGANISM_PARAMS, valueAt, type Meal, type RunResult } from '@lifepeek/engine'
import { shortMealNames } from '../../components/stage/mealText.ts'
import { formatDuration } from '../../lib/time.ts'
import type { RunKey, Summary } from '../registry.ts'

export type { RunKey, Summary }

/**
 * The stage's summary sentence (council verdict #3, 2026-10-13): the answer in one sentence, so
 * nobody has to read a graph to get the point. It replaces v1's Verdict and keeps its truth
 * rules (lib/verdict.ts, commit cfdf0e5), now for "this meal" and "the kept meal":
 * - one meal: when half of it has left the stomach (by food energy, as the stomach graph's ring;
 *   for water, by weight);
 * - a kept meal too: which leaves the stomach faster and about how many times, or "about the same
 *   speed" when the times are within 15 %; plus a reason, but only when that reason really
 *   explains the result (a drink against solid food, or clearly fewer calories);
 * - the same foods in another amount: how much longer blood sugar stays raised (`bloodData`,
 *   council round 3), the meals named by amount ("4 servings of cola").
 * The decision (`summaryData`) is kept apart from the wording, so tests can check it is TRUE for
 * every lesson. The aria wiring and the per-graph summaries are WP-15's. Digestion's
 * `SystemUi.summary` (W-1): the stage's SummaryLine draws whichever system is lit.
 */
export type SummaryReason = 'drink' | 'calories' | 'none'

export type SummaryData =
  | { kind: 'empty' }
  /** `open`: half never left within the run, so `halfMin` is the run's end and the sentence says "more than". */
  | { kind: 'single'; halfMin: number; byWeight: boolean; open: boolean }
  | {
      kind: 'pair'
      fast: RunKey
      slow: RunKey
      /** How many times faster the fast meal half-empties. */
      ratio: number
      similar: boolean
      reason: SummaryReason
      half: Record<RunKey, number>
      /** The slow meal never half-emptied within the run: `ratio` is only a lower bound ("more than 9×"). */
      open: boolean
      kcal: Record<RunKey, number>
    }

/** Only a drink: nothing has to be ground up first. */
export const isDrinkOnly = (meal: Meal) => meal.items.length > 0 && meal.solid.massG === 0

/** Below this ratio of the two half-times the meals count as "about the same speed". */
export const SIMILAR_RATIO = 1.15

/** When half of the meal has left the stomach (event.stomachHalfEmpty); the end of the run if never. */
const halfMin = (run: RunResult) => run.moments.get('event.stomachHalfEmpty')?.atMin ?? run.horizonMin
/** True when half of the meal never left the stomach within the run (review 14-17, LOW 6). */
const neverHalf = (run: RunResult) => run.moments.get('event.stomachHalfEmpty')?.atMin == null

export function summaryData(run: RunResult, kept: RunResult | null): SummaryData {
  if (run.meal.items.length === 0) return { kind: 'empty' }
  const single = { kind: 'single', halfMin: halfMin(run), byWeight: run.events.noNutrients, open: neverHalf(run) } as const
  if (!kept || kept.meal.items.length === 0) return single
  // Neither half-empties within the run: no comparison can be claimed, only this meal's own sentence.
  if (neverHalf(run) && neverHalf(kept)) return single

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
  const open = neverHalf(slow === 'run' ? run : kept)
  return { kind: 'pair', fast, slow, ratio, similar: similar && !open, reason, half, open, kcal }
}

/** The same foods, at least one in another amount ("one cola or four"). */
export function sameFoods(a: Meal, b: Meal): boolean {
  if (a.items.length === 0 || a.items.length !== b.items.length) return false
  const servings = new Map(b.items.map((i) => [i.food.id, i.servings]))
  return a.items.every((i) => servings.has(i.food.id)) && a.items.some((i) => servings.get(i.food.id) !== i.servings)
}

/** Below this (minutes) "stays raised longer" is not worth a sentence: the stomach's one is used. */
const BLOOD_LONGER_MIN = 15
/** Peaks closer than this (mg/dL) are "the same highest point". */
const SAME_PEAK_MGDL = 1

export interface BloodData {
  /** The meal that keeps blood sugar raised longer, and the other one. */
  more: RunKey
  less: RunKey
  /** How much longer (minutes) until blood sugar is back near the before-meal level (decision 4). */
  longerMin: number
  /** Both runs' highest blood sugar, rounded as the graph's "Highest: 121" (the larger one). */
  peak: number
  samePeak: boolean
}

/**
 * The highest blood sugar (the graph's "Highest: 121", graphs/marks.ts) and when it is back near
 * the before-meal level, for a run whose blood sugar really left that level (the graphs' and the
 * timeline's rule, marks.ts glucoseLeftBase). Worked out here, not imported from marks.ts: that
 * import split the stage's first download into one more file (size budget).
 */
function bloodOf(run: RunResult): { peak: number; backMin: number } | null {
  const g = run.signals.get('blood.glucose')
  const peakMin = run.moments.get('event.glucosePeak')?.atMin
  const backMin = run.moments.get('event.glucoseBackToBase')?.atMin
  if (!g || peakMin == null || backMin == null) return null
  const peak = valueAt(g, peakMin, run.stepMin)
  return peak - g.values[0]! > ORGANISM_PARAMS[DEFAULT_ORGANISM].glucose.backToBaseMgDl ? { peak, backMin } : null
}

/**
 * The same foods in two amounts (the "One cola or four" lesson, council round 3): the stomach's
 * "4× faster" is true but misses the point, and a class seeing both lines peak at 121 mg/dL may
 * conclude four colas are no worse. In this model the stomach lets sugar through at a capped rate,
 * so more of a food keeps blood sugar raised for LONGER, not higher (engine content.test.ts). So
 * the sentence is about blood sugar: how much longer it stays raised, and, when the highest points
 * match, why. Null when it does not apply (other foods, no rise, or under 15 min apart).
 */
export function bloodData(run: RunResult, kept: RunResult): BloodData | null {
  if (!sameFoods(run.meal, kept.meal)) return null
  const blood = { run: bloodOf(run), kept: bloodOf(kept) }
  if (!blood.run || !blood.kept) return null
  const [more, less] = blood.run.backMin >= blood.kept.backMin ? (['run', 'kept'] as const) : (['kept', 'run'] as const)
  const longerMin = blood[more]!.backMin - blood[less]!.backMin
  if (longerMin < BLOOD_LONGER_MIN) return null
  return {
    more,
    less,
    longerMin,
    peak: Math.round(Math.max(blood.run.peak, blood.kept.peak)),
    samePeak: Math.abs(blood.run.peak - blood.kept.peak) < SAME_PEAK_MGDL,
  }
}

/** "×9", or "×1.6" below 3, where the decimal matters. */
const times = (ratio: number) => (ratio < 3 ? ratio.toFixed(1) : String(Math.round(ratio)))

/** English starts a sentence with a capital, whichever meal comes first ("This meal …"). */
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * A meal's name inside a sentence: its short food names ("Cola", "Roti ×2 + Dal"). A meal of more
 * than two foods, or two meals with the same name (Cola ×1 kept, Cola ×1 + water now), are
 * "this meal" and "the kept meal" instead, so the sentence never says "Cola is faster than Cola".
 * The same foods in other amounts are named by amount: "1 serving of cola", "कोला के 4 हिस्से".
 *
 * `oblique`: the name goes before a postposition in Hindi ("इस भोजन की", never "यह भोजन की"; FIX-F).
 * English is the same either way. The Hindi templates never make a verb or adjective agree with a
 * food name, since some foods are feminine (इडली, दाल) and some masculine (केला); i18n/agreement.test.ts
 * holds them to it, and to the case each name is passed in below.
 */
function names(run: RunResult, kept: RunResult | null, t: TFunction, lang: string, oblique = false): Record<RunKey, string> {
  const thisMeal = t(oblique ? 'summary.oblique.thisMeal' : 'summary.thisMeal')
  const keptMeal = t(oblique ? 'summary.oblique.keptMeal' : 'summary.keptMeal')
  // The same foods in other amounts are named by amount, "1 serving of cola" and "4 servings of
  // cola" (council round 3): "Cola … faster than Cola ×4" read as a food compared with itself.
  const byAmount = kept != null && sameFoods(run.meal, kept.meal)
  const amount = (food: string, count: number) =>
    t(oblique ? 'sameFood.oblique.amount' : 'sameFood.amount', {
      count,
      // English names go mid-sentence in lower case ("servings of cola"); Hindi has no case.
      food: lang.startsWith('en') ? food.toLowerCase() : food,
    })
  const short = (s: RunResult) =>
    s.meal.items.length > 2
      ? ''
      : byAmount
        ? s.meal.items.map((i) => amount(shortMealNames([{ foodId: i.food.id, servings: 1 }], lang), i.servings)).join(' + ')
        : shortMealNames(
            s.meal.items.map((i) => ({ foodId: i.food.id, servings: i.servings })),
            lang,
          )
  const n = { run: short(run), kept: kept ? short(kept) : '' }
  if (!kept) return { run: n.run || thisMeal, kept: '' }
  const clash = !n.run || !n.kept || n.run === n.kept
  return clash ? { run: thisMeal, kept: keptMeal } : n
}

/** One meal: "Half of the food energy in Cola has left the stomach after 30 min." */
export function singleSummary(run: RunResult, t: TFunction, lang: string): Summary | null {
  const d = summaryData(run, null)
  if (d.kind !== 'single') return null
  const meal = names(run, null, t, lang, true).run
  const time = formatDuration(d.halfMin, t)
  const key = d.byWeight ? (d.open ? 'summary.singleWaterMore' : 'summary.singleWater') : d.open ? 'summary.singleMore' : 'summary.single'
  return { headline: sentence(t(key, { meal, time })), key: { text: time, line: 'run' } }
}

/** This meal against the kept one: "Cola leaves the stomach about 9× faster than Cheeseburger + French fries." */
export function compareSummary(run: RunResult, kept: RunResult, t: TFunction, lang: string): Summary | null {
  const b = bloodData(run, kept)
  if (b) {
    // Both names stand before a postposition in Hindi ("… के बाद").
    const o = names(run, kept, t, lang, true)
    const time = formatDuration(b.longerMin, t)
    const headline = sentence(t('sameFood.bloodLonger', { more: o[b.more], less: o[b.less], time }))
    const key = { text: time, line: b.more }
    return b.samePeak ? { headline, key, reason: sentence(t('sameFood.reasonSamePeak', { peak: b.peak })) } : { headline, key }
  }
  const d = summaryData(run, kept)
  if (d.kind !== 'pair') return d.kind === 'single' ? singleSummary(run, t, lang) : null
  // The fast meal is the subject ("इडली आमाशय से निकलने में … तेज़ है"); the slow one, and both in
  // "similar", come before a postposition in Hindi.
  const n = names(run, kept, t, lang)
  const o = names(run, kept, t, lang, true)
  const fast = n[d.fast]
  const slow = o[d.slow]
  if (d.similar) return { headline: sentence(t('summary.similar', { a: o.run, b: o.kept })) }
  const x = t('summary.times', { n: times(d.ratio) })
  const headline = sentence(t(d.open ? 'summary.fasterMore' : 'summary.faster', { fast, slow, x }))
  const key = { text: x, line: d.fast }
  if (d.reason === 'drink') return { headline, key, reason: sentence(t('summary.reasonDrink', { fast })) }
  if (d.reason === 'calories')
    return { headline, key, reason: sentence(t('summary.reasonCalories', { slow, kcalSlow: d.kcal[d.slow], kcalFast: d.kcal[d.fast] })) }
  return { headline, key }
}
