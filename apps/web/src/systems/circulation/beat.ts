import { valueAt, type ActivityBout, type ActivityKind, type RunResult, type Series } from '@lifepeek/engine'
import { MAX_DRAWN_HZ, drawnRate } from '../../flat/rate.ts'

/**
 * How a heartbeat and the blood are drawn (anatomy plan §2.2, D8): data → picture, in one place,
 * so the flash and speed rules are checked once (circulation.test.ts).
 *
 * - Speed: the model's beats a minute at the meal-clock minute on screen, drawn at most 2.5 times a
 *   second (150 a minute); a run's ≈ 160 is drawn at 2.5 Hz and the chip says "animation slowed",
 *   the number kept true.
 * - Beat: the atria squeeze, then the ventricles: a size change only, never a colour (WCAG 2.3.1).
 *   The ventricles' squeeze follows the blood pushed out in each beat (`heart.strokeVolume`):
 *   BEAT_GAIN of their size for a resting beat (enlarged to be seen, D8), more for a bigger beat in
 *   the model's ratio, never past MAX_SQUEEZE (12 %).
 * - Dashes: their speed follows the blood pumped a minute (`heart.output`) against resting, held
 *   between half and twice (the real run is ≈ 3.5×: Known limits say so); on the gut's vessels
 *   they are denser with the blood to the gut, on the legs' with the blood to the muscles.
 */

/** The fastest beat drawn (150 a minute; flat/rhythm.ts). */
export const MAX_BEAT_HZ = MAX_DRAWN_HZ
/** The ventricles' squeeze for a resting beat of SV_REST_ML, as a share of their size (D8's gain). */
export const BEAT_GAIN = 0.083
/** The model's resting stroke volume (model §2.3 SV_rest), the beat's yardstick. */
export const SV_REST_ML = 65
/** The biggest squeeze drawn (anatomy plan §2.2: ≤ 12 % with the gain). */
export const MAX_SQUEEZE = 0.12
/** The atria squeeze less than the ventricles (they push less blood). */
export const ATRIA_SHARE = 0.6

/** The beat's drawn speed for a rate of `perMin` beats a minute. */
export const beatRate = (perMin: number) => drawnRate(perMin, MAX_BEAT_HZ)

/** The ventricles' squeeze for a beat of `strokeMl`: the model's ratio, capped. */
export const squeezeOf = (strokeMl: number) => Math.min(MAX_SQUEEZE, (BEAT_GAIN * Math.max(0, strokeMl)) / SV_REST_ML)

/** A smooth bump of `width` (a share of the cycle) round `centre`: 0 outside, 1 at its middle. */
function bump(phase: number, centre: number, width: number) {
  let d = (phase % 1) - centre
  if (d > 0.5) d -= 1
  if (d < -0.5) d += 1
  return Math.abs(d) < width / 2 ? 0.5 + 0.5 * Math.cos((2 * Math.PI * d) / width) : 0
}

/** The atria's size at `phase` (0…1 of a beat): they squeeze first. */
export const atriaScale = (phase: number, squeeze: number) => 1 - ATRIA_SHARE * squeeze * bump(phase, 0.12, 0.26)
/** The ventricles' size at `phase`: they squeeze after the atria. */
export const ventricleScale = (phase: number, squeeze: number) => 1 - squeeze * bump(phase, 0.45, 0.36)
/** The phase of the ventricles' strongest squeeze (the tests compare it with a relaxed heart). */
export const SQUEEZED = 0.45

/** Shares of the resting output that go to the gut and to the muscles (OpenStax Table 20.3; model §2.3). */
export const GUT_REST_SHARE = 0.24
export const MUSCLE_REST_SHARE = 0.21

/** The dashes' speed against resting: blood pumped over resting, held between half and twice. */
export const dashSpeed = (output: number, outputRest: number) => Math.min(2, Math.max(0.5, outputRest > 0 ? output / outputRest : 1))

/** How dense a bed's dashes are against resting: its flow over its resting flow, held to [0.5, max], in quarter steps (no churn). */
export function dashDensity(flow: number, rest: number, max: number): number {
  const k = Math.min(max, Math.max(0.5, rest > 0 ? flow / rest : 1))
  return Math.round(k * 4) / 4
}
/** The densest the legs' (muscles') dashes get, and the gut's. */
export const LEGS_MAX = 4
export const GUT_MAX = 3

/** A run's resting output: the least blood pumped a minute in it (L/min). */
export const restingOutput = (output: Series) => output.values.reduce((a, b) => Math.min(a, b), Infinity)

/** A run's series by ID (the pack's IDs are not in the lean catalog's type). */
export const seriesOf = (run: RunResult, id: string): Series | undefined => run.signals.get(id as never)

/**
 * What the body is doing at `min`: a bout's kind (any of the seven), else 'rest' (lib/bouts.ts
 * activityKindAt, written out so the pack shares no code with the stage; circulation.test.ts checks
 * they agree).
 */
export function doingAt(bouts: readonly ActivityBout[], min: number): ActivityKind | 'rest' {
  return bouts.find((x) => min >= x.startMin && min < x.startMin + x.durMin)?.kind ?? 'rest'
}

/**
 * The model's heart beats a minute for "Count yours" (X-2, content §8.3): at rest (the first minute
 * with no bout), and in the activity: at the clock's minute if a bout is on, else in the middle of
 * the run's first bout. No `active` when the plan has no walk or run. (Breathing's breath.ts has
 * its own: the packs share no code.)
 */
export function countModel(run: RunResult, min: number): { rest: number; active?: { n: number; doing: ActivityKind } } | null {
  const rate = seriesOf(run, 'heart.rate')
  if (!rate) return null
  const at = (m: number) => Math.round(valueAt(rate, m, run.stepMin))
  const bouts = [...run.activity].sort((a, b) => a.startMin - b.startMin)
  let restMin = 0
  for (const b of bouts) if (restMin >= b.startMin && restMin < b.startMin + b.durMin) restMin = b.startMin + b.durMin
  const doing = doingAt(run.activity, min)
  const first = bouts[0]
  const active =
    doing !== 'rest' ? { n: at(min), doing } : first ? { n: at(first.startMin + first.durMin / 2), doing: first.kind } : undefined
  return { rest: at(restMin), ...(active && { active }) }
}
