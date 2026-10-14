import type { ActivityKind } from '@lifepeek/engine'

/**
 * Activity bands (R4, R16, R32): the body has one still pose for rest and one for each of walk,
 * brisk walk and run, with no swing in v3.0 (swing is A-9b). The stage reads the band at the clock
 * time (lib/bouts.ts `useActivityBand`) and hands it to the body (BodyView, FlatBody `band`);
 * limbs.ts poses the arms and legs for it. Types, a list and the kinds' bands only: the posing code
 * loads only when a picture shows a pose.
 */
export const ACTIVITY_BANDS = ['rest', 'walk', 'walkBrisk', 'run'] as const
export type ActivityBand = (typeof ACTIVITY_BANDS)[number]

/**
 * The still pose of each kind with no pose of its own (R114 with R32; a kind not listed is its own
 * band). The four kinds made visible in v3.2 take the nearest of the four poses by the 2024
 * Compendium's intensity bands (light < 3 MET, moderate 3–5.9, vigorous ≥ 6), then by the nearest
 * MET inside the band. Sitting in class (1.8, light) stands still as at rest; cricket (4.8) and
 * badminton (5.5) are moderate like walking (3.8) and brisk walking (4.8), nearest the brisk walk;
 * football (7.0) is vigorous like the run (9.3), the only vigorous pose. A drawing's choice: the
 * model runs each kind on its own MET, whatever pose it is drawn in.
 */
export const KIND_BAND: { readonly [K in Exclude<ActivityKind, ActivityBand>]: ActivityBand } = {
  sitClass: 'rest',
  football: 'run',
  cricket: 'walkBrisk',
  badminton: 'walkBrisk',
}
