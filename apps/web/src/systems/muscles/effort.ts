import { useEffect, useRef, useState } from 'react'
import type { ActivityBout, ActivityKind, RunResult, Series, SignalMeta } from '@lifepeek/engine'
import type { TFunction } from 'i18next'
import { MAX_DROPS } from '../../anatomy/human/skin.ts'

/**
 * The `effort` pack's data → picture rules and number words (U-1; anatomy plan §2.4, §2.5, §4), in
 * one place so effort.test.ts checks them once: the muscles' hatch steps, the sweat drops' count,
 * the skin vessels' one step, and numbers written as lib/formatSignal.ts writes them. Like the rest
 * of the pack it shares no code with the stage but the meal clock's (systems/breathing/breath.ts says why).
 */

/** A run's series by ID (the pack's IDs are not in the lean catalog's type). */
export const seriesOf = (run: RunResult, id: string): Series | undefined => run.signals.get(id as never)

export type Doing = ActivityKind | 'rest'

/**
 * What the body is doing at `min`: a bout's kind, else 'rest' (lib/bouts.ts activityKindAt, written
 * out; effort.test.ts checks they agree).
 */
export function doingAt(bouts: readonly ActivityBout[], min: number): Doing {
  return bouts.find((x) => min >= x.startMin && min < x.startMin + x.durMin)?.kind ?? 'rest'
}

/**
 * Light activity: the kinds below 3 MET, the 2024 Compendium's light band (sitting in class, 1.8;
 * the pose's band is rest: anatomy/human/bands.ts). Their summaries say so in words, with no "×" and
 * no sweat figure: the model puts all of its small extra energy on the muscles and sweat (R120 #9).
 * The engine's output is the same; only the words change. Listed, not read from PARAMS: the pack
 * may not import the engine's params chunk (check-budget); effort.test.ts checks the list is the
 * kinds whose MET is below 3.
 */
export const LIGHT_MET = 3
export const LIGHT_KINDS: ReadonlySet<ActivityKind> = new Set(['sitClass'])
export const isLight = (kind: Doing): boolean => kind !== 'rest' && LIGHT_KINDS.has(kind)

/**
 * The kind of the bout going on at `min`, or of the last one that ended before it: the muscles that
 * worked in it stay hatched while their energy comes back down (the model's off-kinetics, R86).
 */
export function lastKindAt(bouts: readonly ActivityBout[], min: number): ActivityKind | null {
  let last: ActivityBout | null = null
  for (const b of bouts) if (b.startMin <= min && (!last || b.startMin > last.startMin)) last = b
  return last?.kind ?? null
}

/**
 * A step of a value with hysteresis (anatomy plan §4, scrub-safe): the step goes up only once the
 * value is past the boundary by MARGIN of it, and down only once it is that far below, so a value
 * near a boundary never flickers between two steps. A margin of the boundary, not half a step (the
 * plan's words): the steps are uneven (40, 240, 380 kcal/h), and half of the 200 kcal/h step would
 * put a brisk walk (≈ 273) on either side by its history; 8 % keeps each kind on its own step.
 */
const MARGIN = 0.08
export function stepOf(value: number, bounds: readonly number[], prev: number): number {
  let step = 0
  while (step < bounds.length && value >= bounds[step]!) step++
  if (step > prev && value < bounds[step - 1]! * (1 + MARGIN)) step = Math.max(prev, step - 1)
  if (step < prev && value > bounds[step]! * (1 - MARGIN)) step = Math.min(prev, step + 1)
  return step
}

/**
 * The muscles' hatch steps (anatomy plan §2.4): energy used by muscles, kcal/h, past which the
 * working groups get a sparse hatch and one lightness step (1), a denser hatch (2), a cross-hatch (3).
 * Resting muscle is ≈ 13.5 kcal/h; a walk ≈ 205, a brisk walk ≈ 273, a run ≈ 580 (S-1): one step each.
 * The last boundary is 380, not 420: football (≈ 423) sat on 420 inside its margin, so its step
 * hung on where the value came from (R120 #18). At 380 football (vigorous, the run's pose) is
 * always the cross-hatch and badminton (≈ 321) and cricket (≈ 273) always the denser hatch.
 */
export const HATCH_BOUNDS: readonly number[] = [40, 240, 380]
export const hatchStep = (kcalPerH: number, prev = 0) => stepOf(kcalPerH, HATCH_BOUNDS, prev)

/** Sweat per drop drawn, mL an hour: a walk's ≈ 330 shows 4 drops, a run's ≈ 980 all 12 (anatomy plan §2.5). */
export const ML_PER_DROP = 80

/** How many drops (0–12) for a sweat rate, with hysteresis (a quarter drop past the half). */
export function dropCount(mlPerH: number, prev = 0): number {
  const want = Math.max(0, mlPerH) / ML_PER_DROP
  const n = Math.abs(want - prev) > 0.75 || (want < 0.25 && prev > 0) ? Math.round(want) : prev
  return Math.min(MAX_DROPS, Math.max(0, n))
}

/** The skin's vessels widen one step while sweat is made (Drawing only), with hysteresis. */
export const vesselsWide = (mlPerH: number, prev = false) => (prev ? mlPerH > 10 : mlPerH > 30)

/** A run's resting value of a series: its lowest (a bout may start at 0:00, so not its first). */
export const restOf = (s: Series) => Math.min(...s.values)

/** The muscles' energy over their resting energy, whole from 2 up ("about 43×"); 1 near rest. */
export const timesRest = (rate: number, rest: number) => (rate < rest * 1.5 ? 1 : Math.round(rate / rest))

/**
 * A value that changes at most once every `ms` (anatomy plan §2.0, §4: a lightness step or a drop's
 * count at most once a real second, at any clock speed): a change sooner than that waits, and the
 * latest value shows then.
 */
export function useSteady<T>(value: T, ms = 1000): T {
  const [shown, setShown] = useState(value)
  const last = useRef(0)
  useEffect(() => {
    if (Object.is(value, shown)) return
    const wait = last.current + ms - performance.now()
    const apply = () => {
      last.current = performance.now()
      setShown(value)
    }
    if (wait <= 0) return void apply()
    const id = setTimeout(apply, wait)
    return () => clearTimeout(id)
  }, [value, shown, ms])
  return shown
}

const formats = new Map<string, Intl.NumberFormat>()
/** A whole number in the page's language, in Latin digits (lib/formatSignal.ts numberFormat). */
export const whole = (v: number, lang: string) => {
  let f = formats.get(lang)
  if (!f) formats.set(lang, (f = new Intl.NumberFormat(lang, { numberingSystem: 'latn', maximumFractionDigits: 0 })))
  return f.format(Math.round(v))
}

/** This pack's units' texts (`units.*`, lib/formatSignal.ts UNIT_KEY). */
const UNIT: Partial<Record<SignalMeta['unit'], string>> = { 'kcal/h': 'kcalPerH', mL: 'mL', 'mL/h': 'mLPerH' }

/** A value with its unit, rounded to its row's step: "580 kcal/h", "330 mL an hour" (lib/formatSignal.ts formatSignal). */
export function valueText(v: number, meta: Pick<SignalMeta, 'round' | 'unit'>, t: TFunction, lang: string): string {
  const step = meta.round ?? 1
  const n = whole(Math.round(v / step) * step || 0, lang)
  const key = UNIT[meta.unit]
  return key ? t(`units.${key}`, { n }) : `${n} ${meta.unit}`
}

/** The highest value of a series and the minute it comes at (the first, if it comes twice). */
export function peakOf(series: Series, stepMin: number): { value: number; atMin: number } {
  let at = 0
  series.values.forEach((v, i) => {
    if (v > series.values[at]!) at = i
  })
  return { value: series.values[at]!, atMin: at * stepMin }
}

/** Within 1 % of the first value all the way: the graph is flat. */
export const isFlat = (series: Series) =>
  series.values.every((v) => Math.abs(v - series.values[0]!) <= 0.01 * Math.abs(series.values[0]!) + 1e-9)
