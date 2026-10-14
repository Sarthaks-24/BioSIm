import type { RunResult, Series, SignalMeta } from '@lifepeek/engine'

/**
 * Kidneys & water as drawn and said (anatomy plan §2.3, model §2.4, D17): data → picture and words,
 * in one place, so the scrub and size rules are checked once (kidneys.test.ts). The pack shares no
 * code with the stage, so the few model numbers it shows are written out here and the test checks
 * each against the engine's (packParams.ts PARAMS.water).
 */

/** A steady day's urine (D17): 1.5 L a day, in mL an hour. The background line on the urine graph. */
export const BACKGROUND_ML_PER_H = 1500 / 24
/** The bladder starts to feel full at about 150 mL (OpenStax §25.2) and empties at 300 mL here (Model estimate). */
export const URGE_ML = 150
export const EMPTIES_ML = 300
/** The kidneys' filtering, a constant (model D15; OpenStax §25.5): mL a minute, and litres a day. */
export const FILTER_ML_PER_MIN = 125

/**
 * The bladder's drawn steps (anatomy plan §2.0, §4: a level change at most once a real second, half a
 * step past a boundary): its volume in steps of 25 mL, 0 … 600, through flat/drives.ts `levelGate`.
 * However fast the clock is played or dragged, the bladder changes size at most once a second, never
 * flickering on a boundary, and an emptying shows at most once a second.
 */
export const BLADDER_STEP_ML = 25
export const BLADDER_BOUNDS: readonly number[] = Array.from({ length: 600 / BLADDER_STEP_ML - 1 }, (_, i) => (i + 1) * BLADDER_STEP_ML)
/** The volume a gated step draws: its boundary below (0 = empty), never above 600 mL. */
export const stepMl = (step: number) => Math.min(600, step * BLADDER_STEP_ML)

/** How long a size change eases when the clock runs faster than 1 h a real second (anatomy plan §2.3); a cut with motion reduced. */
export const EASE_MS = 200

/** A run's series by ID (the pack's IDs are not in the lean catalog's type). */
export const seriesOf = (run: RunResult, id: string): Series | undefined => run.signals.get(id as never)

/**
 * How fast the ureters' drops of urine are drawn (Drawing only): in pulses (the ureter squeezes urine
 * down in waves), at a speed that grows with the urine made, from 0.5× at the least to 3× at about
 * five times a steady day's. Returns px a second at `t` real seconds.
 */
export function ureterSpeed(urineMlPerH: number, t: number): number {
  const k = Math.min(3, Math.max(0.5, Math.sqrt(Math.max(0, urineMlPerH) / BACKGROUND_ML_PER_H)))
  // One squeeze about every 2 s: the drops move mostly while it passes.
  const pulse = Math.max(0, Math.sin(Math.PI * t)) ** 2
  return 30 * k * (0.15 + 0.85 * pulse)
}

const backgrounds = new WeakMap<RunResult, Series>()

/**
 * The urine graph's second line (ui-ux §7, "Water assumption visible"): a day without this meal, a
 * steady day's 62.5 mL an hour all the way, a Model estimate (D17). One object per run, so the graph
 * draws it once.
 */
export function backgroundOf(run: RunResult): Series | null {
  const urine = seriesOf(run, 'kidney.urineRate')
  if (!urine) return null
  let s = backgrounds.get(run)
  if (!s) {
    const meta: SignalMeta = {
      ...urine.meta,
      i18nKey: 'sys.kidneys.background',
      reactsToMeal: false,
      sourceIds: ['openstax-ap2e-26'],
      limitKey: 'limits.waterSteadyDay',
    }
    s = { meta, values: new Float32Array(urine.values.length).fill(BACKGROUND_ML_PER_H), sourceIds: meta.sourceIds }
    backgrounds.set(run, s)
  }
  return s
}

/** The minute a moment of the run comes at, if it does within the run. */
export function momentAt(run: RunResult, id: string): number | null {
  const at = run.moments.get(id as never)?.atMin
  return at != null && at <= run.horizonMin ? at : null
}

/** The water the meal brings, mL (1 g = 1 mL): a glass of water 250, a can of cola 307. */
export const mealWaterMl = (run: RunResult): number => run.meal.total.waterG
