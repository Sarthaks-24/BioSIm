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
 * `step`: a step's size in the drive's units, for the hysteresis; by default the mean gap between
 * bounds, and with one bound (two steps) a fifth of that bound's size (R93 #14: one bound still
 * gets hysteresis). A value that is not a number keeps the step shown.
 */
export function levelGate(bounds: readonly number[], minGapMs = 1000, step?: number) {
  // Half a step past a boundary before the shown step moves.
  const size =
    step ?? (bounds.length > 1 ? (bounds[bounds.length - 1]! - bounds[0]!) / (bounds.length - 1) : Math.abs(bounds[0] ?? 0) / 5 || 1)
  const half = size / 2
  const count = (value: number, margin: number) => bounds.filter((b) => value >= b + margin).length
  let shown = -1
  let changedAt = -Infinity
  return (value: number, nowMs: number): number => {
    if (!Number.isFinite(value)) return Math.max(shown, 0)
    if (shown < 0) return (shown = count(value, 0))
    const raw = count(value, 0)
    const target = raw > shown ? Math.max(shown, count(value, half)) : raw < shown ? Math.min(shown, count(value, -half)) : shown
    if (target !== shown && nowMs - changedAt >= minGapMs) {
      shown = target
      changedAt = nowMs
    }
    return shown
  }
}
