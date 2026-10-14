import type { Callout } from '../callouts.ts'

/** A scene point (base.ts `v`, written out: this file loads with the pack and shares no code with the first paint). */
const v = (x: number, y: number, z: number) => ({ x, y, z })

/**
 * Kidneys & water (the `kidneys` pack; anatomy plan §2.3): the kidneys, their artery and vein, the
 * ureters, the urinary bladder and a short urethra, front-on, in scene units as base.ts (≈ 1 unit =
 * 20 cm; the person's left is +x). Drawn flat in the `torso` framing by systems/kidneys/drawing.tsx,
 * which loads with the pack. Sex-neutral, like the NCERT Class 10 figure (Ch 5, "Excretory system in
 * human beings").
 *
 * The kidneys sit either side of the backbone at the back of the belly, from about the last ribs
 * down: only their upper parts are behind the ribs. The person's right kidney (−x, the viewer's
 * left) sits a little lower than the left, under the liver ("right lower"). Each is about 11 cm
 * tall and 6 cm wide, its notch (hilum: artery in, vein and ureter out) facing the backbone. The
 * big vessels run down the middle: the aorta just left of it (+x), the vena cava just right (−x).
 * The ureters run down to the bladder, low in the middle behind the pubic bone; the bladder grows
 * upwards from its base as it fills.
 */

/** A closed outline or an open path, [x, y] pairs. */
export type Outline = readonly (readonly [number, number])[]

/** The left kidney's centre (+x); the right one is the mirror, `RIGHT_DROP` lower. */
export const KIDNEY = { x: 0.42, y: 0.5 }
/** How much lower the person's right kidney sits (≈ 2 cm, under the liver). */
export const RIGHT_DROP = 0.1

/**
 * One kidney's bean, about its centre, for the left kidney (+x): its notch faces the backbone (−x).
 * Top, round the outer side, the bottom, and up the inner side into the notch and out again.
 */
const BEAN: Outline = [
  [0.02, 0.28],
  [0.12, 0.23],
  [0.16, 0.08],
  [0.15, -0.1],
  [0.1, -0.23],
  [0.0, -0.28],
  [-0.1, -0.21],
  [-0.12, -0.1],
  [-0.07, -0.05],
  [-0.05, 0.0],
  [-0.07, 0.05],
  [-0.12, 0.12],
  [-0.09, 0.24],
]

/** A side's kidney (1 = the person's left, +x; −1 = the right, −x), in scene units. */
export const kidneyOutline = (side: 1 | -1): Outline => {
  const cy = KIDNEY.y - (side < 0 ? RIGHT_DROP : 0)
  return BEAN.map(([x, y]) => [side * (KIDNEY.x + x), cy + y])
}

/** Where a side's vessels and ureter leave the notch (the hilum). */
export const hilum = (side: 1 | -1) => ({ x: side * (KIDNEY.x - 0.06), y: KIDNEY.y - (side < 0 ? RIGHT_DROP : 0) })

/** The aorta (oxygen-rich, +x of the midline) and the vena cava (oxygen-poor, −x), drawn from above the kidneys to where they split for the legs. */
export const AORTA = { x: 0.05, top: 1.0, bottom: -0.3, width: 0.06 }
export const VENA_CAVA = { x: -0.07, top: 1.0, bottom: -0.3, width: 0.075 }

/** A side's renal artery: from the aorta out to the notch, a little above its middle. */
export const renalArtery = (side: 1 | -1): Outline => {
  const h = hilum(side)
  return [
    [AORTA.x, h.y + 0.06],
    [(AORTA.x + h.x) / 2, h.y + 0.06],
    [h.x, h.y + 0.03],
  ]
}

/** A side's renal vein: from the notch, a little below the artery, in to the vena cava. */
export const renalVein = (side: 1 | -1): Outline => {
  const h = hilum(side)
  return [
    [h.x, h.y - 0.01],
    [(VENA_CAVA.x + h.x) / 2, h.y - 0.02],
    [VENA_CAVA.x, h.y - 0.02],
  ]
}

/** The bladder's base (it grows upwards from here) and the urethra below it. */
export const BLADDER_BASE = { x: 0, y: -1.56 }
export const URETHRA: Outline = [
  [0, -1.56],
  [0, -1.74],
]

/** A side's ureter: from the notch, down beside the backbone and over the brim of the pelvis, into the back of the bladder. */
export const ureter = (side: 1 | -1): Outline => {
  const h = hilum(side)
  return [
    [h.x, h.y - 0.06],
    [side * 0.3, h.y - 0.3],
    [side * 0.25, -0.45],
    [side * 0.22, -0.95],
    [side * 0.14, -1.3],
    [side * 0.08, -1.42],
  ]
}

/**
 * The bladder's drawn half-height (scene units) holding `ml`: it grows with the cube root of its
 * volume (anatomy plan §2.3), from a small empty bag to about 9 cm across at 300 mL; never drawn
 * above 600 mL (the most an adult's holds, OpenStax §25.2).
 */
export const BLADDER_MAX_ML = 600
export const bladderRadius = (ml: number) => 0.07 + 0.15 * Math.cbrt(Math.min(BLADDER_MAX_ML, Math.max(0, ml)) / 300)

/**
 * Faint lowest ribs for a bearing (the kidneys' upper parts are behind them), front-on, the viewer's
 * right side (+x; the left is the mirror), after skeleton.ts RIBS (its rows 9–12), drawn as three points.
 */
export const RIBS: readonly Outline[] = (
  [
    [0.89, 0.88],
    [0.76, 0.85],
    [0.63, 0.8],
    [0.52, 0.72],
  ] as const
).map(([y, cage]) => [
  [0.08, y - 0.02],
  [cage * 0.86, y - 0.1],
  [cage * 0.8, y - 0.2],
])

/** The labels kidneys' picture shows (anatomy plan §6), most needed first. */
export type KidneyLabel = 'kidney' | 'bladder' | 'ureter' | 'artery' | 'vein' | 'urethra'

/** Their anchors on the organ and their places beside it, like anatomy/callouts.ts. */
export const LABELS: Readonly<Record<KidneyLabel, Callout>> = {
  kidney: { anchor: v(-0.5, 0.4, -0.2), at: v(-0.86, 0.66, 0.1), side: 'left' },
  bladder: { anchor: v(-0.12, -1.45, 0.2), at: v(-0.5, -1.3, 0.1), side: 'left' },
  ureter: { anchor: v(0.24, -0.6, -0.1), at: v(0.6, -0.5, 0.1), side: 'right' },
  artery: { anchor: v(0.2, 0.56, -0.2), at: v(0.7, 0.98, 0.1), side: 'right' },
  vein: { anchor: v(-0.22, 0.38, -0.2), at: v(-0.86, 0.12, 0.1), side: 'left' },
  urethra: { anchor: v(0, -1.68, 0.2), at: v(0.32, -1.78, 0.1), side: 'right' },
}
