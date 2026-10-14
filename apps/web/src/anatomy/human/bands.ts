/**
 * Activity bands (R4, R16, R32): the body has one still pose for rest and one for each visible
 * activity kind, with no swing in v3.0 (swing is A-9b). The stage reads the band at the clock time
 * (lib/bouts.ts `useActivityBand`) and hands it to the body (BodyView, FlatBody `band`); limbs.ts
 * poses the arms and legs for it. Types and a list only: the posing code loads only when a picture
 * shows a pose.
 */
export const ACTIVITY_BANDS = ['rest', 'walk', 'walkBrisk', 'run'] as const
export type ActivityBand = (typeof ACTIVITY_BANDS)[number]
