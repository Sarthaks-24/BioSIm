import { useCallback } from 'react'
import type { ActivityBout } from '@lifepeek/engine'
import { useClock } from '../state/clock.ts'
import { useRunStore } from '../state/run.ts'

/**
 * Activity bouts on the clock (E-3b-ui, ui-ux §5): which kind the body is doing at the clock time.
 * Their words are in components/stage/mealText.ts; the sheet that adds and changes them is
 * components/ActivitySheet.tsx (lazy).
 */

/** What the body is doing at a moment: resting, or one of the kinds offered (architecture §0). */
export type ActivityBand = 'rest' | 'walk' | 'walkBrisk' | 'run'

/** The kind the body is doing at `min` (a bout runs from its start to its end), else 'rest'. */
export function activityBandAt(bouts: readonly ActivityBout[], min: number): ActivityBand {
  const b = bouts.find((x) => min >= x.startMin && min < x.startMin + x.durMin)
  return b && (b.kind === 'walk' || b.kind === 'walkBrisk' || b.kind === 'run') ? b.kind : 'rest'
}

/**
 * The body's stance at the clock time (R4, R16, R32: one still pose per band, no swing). Re-renders
 * only when the band changes, never per frame. A-0 flat draws the legs from it (`limbs.ts`).
 */
export function useActivityBand(): ActivityBand {
  const bouts = useRunStore((s) => s.activity)
  return useClock(useCallback((s: { simMin: number }) => activityBandAt(bouts, s.simMin), [bouts]))
}
