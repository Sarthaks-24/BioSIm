import { valueAt, type RunResult } from '@lifepeek/engine'
import type { DriveChannel, OrganDef } from '../registry/types.ts'

/**
 * Data → picture (anatomy plan D4): a drawing reads the run only through its organs' `drives`
 * (registry/human/organs.ts), at the meal-clock minute on screen (`valueAt`, so a frame between two
 * model minutes is interpolated). Digestion's stomach fill goes this way (anatomy/bodyState.ts);
 * every new layer does the same, so flash safety is checked in one place.
 */

/** The value of each channel an organ's drives name, at meal-clock minute t (signal units; absent when the run lacks the signal). */
export function drivenAt(sim: RunResult, organ: OrganDef, tMin: number): Partial<Record<DriveChannel, number>> {
  const out: Partial<Record<DriveChannel, number>> = {}
  for (const [channel, id] of Object.entries(organ.drives ?? {}) as [DriveChannel, string][]) {
    const series = sim.signals.get(id as never)
    if (series) out[channel] = valueAt(series, tMin, sim.stepMin)
  }
  return out
}

/**
 * A `level` drive as lightness steps (each < 10 % relative luminance) that are safe to scrub (anatomy plan §4): the step changes
 * only half a step past a boundary (hysteresis), so a value sitting on a boundary never flickers,
 * and at most once a real second per organ, however fast the clock is dragged or played.
 * `bounds` are the values between steps, ascending; `nowMs` is the real clock (performance.now).
 */
export function levelGate(bounds: readonly number[], minGapMs = 1000) {
  // Half a step (the mean step) past a boundary before the shown step moves.
  const half = bounds.length > 1 ? (bounds[bounds.length - 1]! - bounds[0]!) / (bounds.length - 1) / 2 : 0
  const count = (value: number, margin: number) => bounds.filter((b) => value >= b + margin).length
  let step = -1
  let changedAt = -Infinity
  return (value: number, nowMs: number): number => {
    if (step < 0) return (step = count(value, 0))
    const raw = count(value, 0)
    const target = raw > step ? Math.max(step, count(value, half)) : raw < step ? Math.min(step, count(value, -half)) : step
    if (target !== step && nowMs - changedAt >= minGapMs) {
      step = target
      changedAt = nowMs
    }
    return step
  }
}
