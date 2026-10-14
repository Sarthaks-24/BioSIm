import { useCallback } from 'react'
import type { ActivityBout, ActivityKind } from '@lifepeek/engine'
import { KIND_BAND, type ActivityBand } from '../anatomy/human/bands.ts'
import { useClock } from '../state/clock.ts'
import { useRunStore } from '../state/run.ts'

/**
 * Activity bouts on the clock (E-3b-ui, ui-ux §5): which kind the body is doing at the clock time.
 * Their words are in components/stage/mealText.ts; the sheet that adds and changes them is
 * components/ActivitySheet.tsx (lazy).
 */

/** The body's pose at a moment: resting, walk, brisk walk or run (architecture §0; anatomy/human/bands.ts). */
export type { ActivityBand }

/** The kind the body is doing at `min` (a bout runs from its start to its end), else 'rest': the words. */
export function activityKindAt(bouts: readonly ActivityBout[], min: number): ActivityKind | 'rest' {
  return bouts.find((x) => min >= x.startMin && min < x.startMin + x.durMin)?.kind ?? 'rest'
}

/** The pose of the kind the body is doing at `min` (KIND_BAND: a game takes the nearest still pose). */
export const activityBandAt = (bouts: readonly ActivityBout[], min: number): ActivityBand => {
  const kind = activityKindAt(bouts, min)
  return (KIND_BAND as Readonly<Record<string, ActivityBand>>)[kind] ?? (kind as ActivityBand)
}

/**
 * The body's stance at the clock time (R4, R16, R32: one still pose per band, no swing). Re-renders
 * only when the band changes, never per frame. A-0 flat draws the legs from it (`limbs.ts`).
 */
export function useActivityBand(): ActivityBand {
  const bouts = useRunStore((s) => s.activity)
  return useClock(useCallback((s: { simMin: number }) => activityBandAt(bouts, s.simMin), [bouts]))
}
