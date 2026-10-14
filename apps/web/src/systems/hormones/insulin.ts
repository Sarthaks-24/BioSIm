/**
 * Hormones as drawn (anatomy plan §2.8, model §2.5): data → picture in one place, so the scrub rules
 * are checked once (hormones.test.ts). The pack shares no code with the stage, so the model numbers
 * it shows are written out here and the test checks each against the engine's (packParams.ts).
 */

/**
 * The brain's sugar use (model §2.5): 5.6 mg per 100 g of brain a minute × 1.3 kg ≈ 4.4 g an hour
 * (Mergenthaler 2013), 106 g a day (Cahill & Owen 1968: 100–145). The same all day in the model: the
 * liver keeps it supplied between meals, so no meal changes it.
 */
export const BRAIN_G_PER_H = 4.4

/**
 * The insulin dots' steps (anatomy plan §2.0, §4: a level change at most once a real second, half a
 * step past a boundary): insulin (× before eating) between these values draws 0, 2, 4 … dots, through
 * flat/drives.ts `levelGate`. Below the first, none: water alone keeps insulin at exactly 1×, so the
 * picture shows no dots (anatomy plan §8 "no insulin dots for water").
 */
export const DOT_BOUNDS: readonly number[] = [1.1, 2, 3.5, 5.5, 8]
/** Dots a step draws: two per step, at most 10. */
export const dotsOf = (step: number) => Math.min(10, 2 * Math.max(0, step))
/** The gate's step (× before eating): a shown count moves only 0.1× past a boundary (R93 #14), so a value on one never flickers. */
export const DOT_STEP = 0.2

/** Real seconds a dot takes from the pancreas's tail to the liver (Drawing only: blood takes longer). */
export const TRIP_SEC = 3
