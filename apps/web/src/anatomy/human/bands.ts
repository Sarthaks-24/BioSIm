import type { ActivityBout, ActivityKind } from '@lifepeek/engine'

/**
 * Activity bands (R4, R16, R32): the body has one still pose for rest and one for each visible
 * activity kind, with no swing in v3.0 (swing is A-9b). The stage passes the band of the moment on
 * the meal clock (`bandAt`) to the body (FlatBody's `band`), and limbs.ts poses the arms and legs
 * for it. Tiny on purpose: the stage reads it on first paint; the posing code loads only when a
 * picture shows a pose.
 */
export const ACTIVITY_BANDS = ['rest', 'walk', 'walkBrisk', 'run'] as const
export type ActivityBand = (typeof ACTIVITY_BANDS)[number]

/**
 * The band each activity kind is drawn with. The three public kinds have their own; the hidden ones
 * (v3.2+) take the band nearest their MET (PARAMS.activity.met: sitting 1.8, cricket 4.8,
 * badminton 5.5, football 7.0 against walk 3.8, brisk walk 4.8 and run 9.3).
 */
export const BAND_OF: { readonly [K in ActivityKind]: ActivityBand } = {
  walk: 'walk',
  walkBrisk: 'walkBrisk',
  run: 'run',
  sitClass: 'rest',
  cricket: 'walkBrisk',
  badminton: 'walkBrisk',
  football: 'run',
}

/** The band at meal-clock minute t: the bout that covers t (start inclusive, end exclusive), else rest. */
export function bandAt(bouts: readonly ActivityBout[], tMin: number): ActivityBand {
  for (const b of bouts) if (tMin >= b.startMin && tMin < b.startMin + b.durMin) return BAND_OF[b.kind]
  return 'rest'
}
