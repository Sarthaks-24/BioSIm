import { valueAt, type ActivityBout, type ActivityKind, type RunResult, type Series } from '@lifepeek/engine'
import { MAX_BREATH_HZ, drawnRate } from '../../flat/rate.ts'

/**
 * How a breath is drawn (anatomy plan §2.1, D8): data → picture, in one place, so the flash and
 * speed rules are checked once (breath.test.ts).
 *
 * - Speed: the model's breaths a minute at the meal-clock minute on screen, drawn at most 0.8 times
 *   a second (48 a minute; a run's 33 is 0.55 Hz), else "animation slowed" with the number kept.
 * - Size: the lungs grow by the cube root of their volume, ((FRC + VT · fill) / FRC)^(1/3), from
 *   a resting volume FRC of 2.4 L (a display constant, not a model output), times GAIN so that a
 *   resting breath still moves the diaphragm ≥ 4 px on a 360 px phone. Deeper breaths (a run's
 *   ≈ 1.4 L against ≈ 0.5 L at rest) draw bigger: rest vs run keeps the model's ratio of the swell.
 * - The diaphragm (the main cue) moves down by as much as the lungs' base does.
 * - Only the size and that one movement change, never a colour (WCAG 2.3.1).
 */

/** The lungs' resting volume (functional residual capacity) the swell is drawn against, in mL. Display only. */
export const FRC_ML = 2400
/** Drawn swell over the cube-root swell: a resting breath must show on a phone. */
export const GAIN = 1.7

/** How full the lungs are at `phase` (0…1 of one breath): 0 breathed out, 1 breathed in; a smooth (cosine) breath. */
export const fillAt = (phase: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * phase)

/** The phase a still (reduced motion) breath is drawn at: half-way in, so the lungs are half full. */
export const STILL_BREATH = 0.25

/** The lungs' drawn size (1 = breathed out) for a breath of `tidalMl` at `fill`. */
export const lungScale = (tidalMl: number, fill: number) => 1 + GAIN * (Math.cbrt((FRC_ML + Math.max(0, tidalMl) * fill) / FRC_ML) - 1)

/** True while breathing in (the lungs filling): the air dashes run in, else out. */
export const breathingIn = (phase: number) => phase % 1 < 0.5

/** The breath's drawn speed for a rate of `perMin` breaths a minute. */
export const breathRate = (perMin: number) => drawnRate(perMin, MAX_BREATH_HZ)

/** A run's series by ID (the pack's IDs are not in the lean catalog's type). Here, so the drawing and the words share no stage code (one chunk each). */
export const seriesOf = (run: RunResult, id: string): Series | undefined => run.signals.get(id as never)

/**
 * What the body is doing at `min`: a bout's kind (any of the seven), else 'rest' (lib/bouts.ts
 * activityKindAt, written out so the pack shares no code with the stage; breathing.test.ts checks
 * they agree).
 */
export function doingAt(bouts: readonly ActivityBout[], min: number): ActivityKind | 'rest' {
  return bouts.find((x) => min >= x.startMin && min < x.startMin + x.durMin)?.kind ?? 'rest'
}

/** The bouts (every kind changes breathing), in clock order. */
const activeBouts = (bouts: readonly ActivityBout[]) => [...bouts].sort((a, b) => a.startMin - b.startMin)

/**
 * The model's breaths a minute for "Count yours" (X-2, content §8.3): at rest (the first minute with
 * no bout), and in the activity: at the clock's minute if a bout is on, else in the middle of the
 * run's first bout. No `active` when the plan has no walk or run.
 */
export function countModel(run: RunResult, min: number): { rest: number; active?: { n: number; doing: ActivityKind } } | null {
  const rate = seriesOf(run, 'lungs.breathRate')
  if (!rate) return null
  const at = (m: number) => Math.round(valueAt(rate, m, run.stepMin))
  const bouts = activeBouts(run.activity)
  // The first resting minute: 0, or the end of the bout (or chain of bouts) that starts there.
  let restMin = 0
  for (const b of bouts) if (restMin >= b.startMin && restMin < b.startMin + b.durMin) restMin = b.startMin + b.durMin
  const doing = doingAt(run.activity, min)
  const first = bouts[0]
  const active =
    doing !== 'rest' ? { n: at(min), doing } : first ? { n: at(first.startMin + first.durMin / 2), doing: first.kind } : undefined
  return { rest: at(restMin), ...(active && { active }) }
}
