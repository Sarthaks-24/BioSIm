import type { RunResult, Series } from '@lifepeek/engine'

/**
 * Lymph's fat road and blood fat as drawn and said (U-5; model §2.10, anatomy plan §2.7, ui-ux §6):
 * data → picture and words, in one place, so lymph.test.ts checks them once. The pack shares no code
 * with the stage, so the few model numbers it says are written out here and the test checks each
 * against the engine's (packParams.ts PACK_PARAMS.lymph).
 */

export const ROAD = 'lymph.fatFlowRate'
export const BLOOD_FAT = 'blood.triglyceride'
export const PEAK = 'event.triglyceridePeak'

/** Blood fat before eating in this model, mg/dL (Liu 2022's 0.91 mmol/L; PACK_PARAMS.lymph.fastingMgDl). */
export const FASTING_MG_DL = 80
/** The Indian baseline (ICMR-INDIAB, Joshi 2014: geometric mean 116 mg/dL, n = 2042; R90): said in Limits and Teach, never drawn. */
export const INDIA_MG_DL = 116

/**
 * Below this much fat in the meal (g) the words say it has almost no fat (ui-ux §6: "fat sentences
 * only if meal fat ≥ 2 g"). A display choice.
 */
export const LITTLE_FAT_G = 2

/**
 * Blood fat within this of fasting all the way (mg/dL) "hardly moves". A display choice: the
 * smallest rise a graph of 0–200 mg/dL shows plainly is about 5 mg/dL.
 */
export const FLAT_MG_DL = 5

/**
 * Blood fat "stays up for hours" (R90: on big solid meals the curve is a long plateau, so the words
 * don't stress its highest minute) when it stays more than a third of its rise above fasting for at
 * least `UP_MIN` minutes: a cheeseburger with fries (about 8 h), not two rotis, an egg or a glass of
 * milk (2–3 h). Display choices.
 */
export const UP_SHARE = 1 / 3
export const UP_MIN = 4 * 60

/** A run's series by ID (the pack's IDs are not in the lean catalog's type). */
export const seriesOf = (run: RunResult, id: string): Series | undefined => run.signals.get(id as never)

/** The minute a moment of the run comes at, if it does within the run. */
export function momentAt(run: RunResult, id: string): number | null {
  const at = run.moments.get(id as never)?.atMin
  return at != null && at <= run.horizonMin ? at : null
}

/** The fat the meal brings, g. */
export const mealFatG = (run: RunResult): number => run.meal.total.fatG

/** How long blood fat stays more than `UP_SHARE` of its rise above fasting (its first value), in minutes. */
export function upMin(series: Series, stepMin: number): number {
  const v = series.values
  const start = v[0]!
  let top = start
  for (const x of v) top = Math.max(top, x)
  if (top <= start) return 0
  const line = start + (top - start) * UP_SHARE
  let n = 0
  for (const x of v) if (x > line) n++
  return n * stepMin
}

/**
 * Fat dots on the lymph route (anatomy plan §2.7: ∝ lymph.fatFlowRate, only with fat in the meal):
 * how many are drawn while lymph carries `gPerMin` of fat to the blood. None below `DOTS_MIN`, so a
 * meal without fat (cola, water) never shows one and they stop once the gut has taken in the last of
 * the fat and the lymph has carried it on; one or more above it, `MAX_DOTS` from `DOTS_FULL` up.
 */
export const DOTS_MIN_G_PER_MIN = 0.002
export const DOTS_FULL_G_PER_MIN = 0.1
export const MAX_DOTS = 12
export function fatDots(gPerMin: number): number {
  if (!(gPerMin >= DOTS_MIN_G_PER_MIN)) return 0
  return Math.min(MAX_DOTS, Math.max(1, Math.round((gPerMin / DOTS_FULL_G_PER_MIN) * MAX_DOTS)))
}

/**
 * Which of the `MAX_DOTS` evenly spaced places along the route show a dot when `n` are drawn: `n` of
 * them, spread out. A change of `n` moves no dot that stays (only the ones that come or go).
 */
export const dotShown = (i: number, n: number): boolean =>
  n >= MAX_DOTS || Math.floor(((i + 1) * n) / MAX_DOTS) !== Math.floor((i * n) / MAX_DOTS)

/** How long a dot takes from the gut to the neck vein, in real seconds (Drawing only: not the model's time). */
export const ROUTE_SEC = 6
