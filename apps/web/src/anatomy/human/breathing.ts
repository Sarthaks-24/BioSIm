import type { Callout } from '../callouts.ts'

/** A scene point (base.ts `v`, written out: this file loads with the pack and shares no code with the first paint). */
const v = (x: number, y: number, z: number) => ({ x, y, z })

/**
 * Breathing (the `breathing` pack; anatomy plan §2.1): the airway, the lungs and the diaphragm,
 * front-on, in scene units as base.ts (≈ 1 unit = 20 cm; the person's left is +x). Drawn flat in the
 * `chest` framing by systems/breathing/drawing.tsx, which loads with the pack.
 *
 * The lungs fill the rib cage from just above the collarbones (y ≈ 2.05) down to the diaphragm's
 * dome (y ≈ 1.0); the right lung (−x) is wider and sits higher over the liver, the left has the
 * heart's notch. The windpipe runs down the middle from the voice box (2.42) to where it splits
 * (1.62), in front of the food pipe.
 */

/** A closed outline, [x, y] pairs. */
export type Outline = readonly (readonly [number, number])[]

/** The nasal passage and the throat, nose to voice box: one tube down the middle of the head and neck. */
export const NASAL: Outline = [
  [0, 2.92],
  [0, 2.7],
  [0, 2.42],
]

/** The windpipe (trachea): voice box to the split, and its width. */
export const WINDPIPE = { top: 2.42, split: 1.62, width: 0.09 }

/** The two levels of bronchi drawn, each a short path from its parent; the first two are the main bronchi. */
export const BRONCHI: readonly { path: Outline; width: number }[] = [
  {
    path: [
      [0, 1.63],
      [-0.12, 1.5],
      [-0.24, 1.41],
    ],
    width: 0.06,
  },
  {
    path: [
      [0, 1.63],
      [0.12, 1.52],
      [0.22, 1.45],
    ],
    width: 0.055,
  },
  {
    path: [
      [-0.24, 1.41],
      [-0.36, 1.58],
    ],
    width: 0.035,
  },
  {
    path: [
      [-0.24, 1.41],
      [-0.4, 1.2],
    ],
    width: 0.035,
  },
  {
    path: [
      [0.22, 1.45],
      [0.37, 1.6],
    ],
    width: 0.035,
  },
  {
    path: [
      [0.22, 1.45],
      [0.4, 1.24],
    ],
    width: 0.035,
  },
]

/** The right lung (on the viewer's left): three lobes, the wider one. Apex, down the outer side, along the base, up the inner side. */
export const RIGHT_LUNG: Outline = [
  [-0.3, 2.04],
  [-0.43, 2.0],
  [-0.57, 1.88],
  [-0.68, 1.68],
  [-0.76, 1.42],
  [-0.8, 1.18],
  [-0.8, 1.02],
  [-0.74, 0.95],
  [-0.55, 1.0],
  [-0.38, 1.01],
  [-0.2, 0.98],
  [-0.13, 1.1],
  [-0.12, 1.3],
  [-0.16, 1.42],
  [-0.12, 1.55],
  [-0.13, 1.75],
  [-0.18, 1.94],
]

/** The left lung (on the viewer's right): narrower, with the notch where the heart lies against it. */
export const LEFT_LUNG: Outline = [
  [0.3, 2.03],
  [0.43, 1.99],
  [0.57, 1.87],
  [0.68, 1.67],
  [0.76, 1.42],
  [0.79, 1.18],
  [0.78, 1.0],
  [0.74, 0.91],
  [0.55, 0.96],
  [0.38, 0.98],
  [0.24, 0.99],
  // The heart's notch: the inner edge steps out round the heart, and the lingula curls back under it.
  [0.3, 1.12],
  [0.36, 1.25],
  [0.3, 1.36],
  [0.17, 1.42],
  [0.14, 1.55],
  [0.14, 1.75],
  [0.19, 1.94],
]

/** Where the lungs grow from as they fill (their top, on the midline): the rhythm layer's origin. */
export const LUNG_TOP = v(0, 2.05, 0)
/** The lungs' lowest edge, on the diaphragm. */
export const LUNG_BASE = 0.95

/** The diaphragm's upper edge, side to side: a dome under each lung, the right one higher (the liver under it). */
export const DIAPHRAGM: Outline = [
  [-0.86, 0.86],
  [-0.74, 0.93],
  [-0.55, 0.98],
  [-0.38, 0.99],
  [-0.2, 0.96],
  [0, 0.92],
  [0.2, 0.95],
  [0.38, 0.96],
  [0.55, 0.94],
  [0.74, 0.89],
  [0.86, 0.82],
]
/** The muscle's thickness under its upper edge. */
export const DIAPHRAGM_THICK = 0.06

/** The food pipe, a pale ghost just beside and behind the windpipe (it is in Digestion's picture). */
export const FOOD_PIPE: Outline = [
  [0.075, 2.38],
  [0.075, 1.6],
  [0.1, 1.0],
]

/**
 * Faint ribs for a bearing (anatomy plan §2.1), front-on, the viewer's right side (+x; the left is the
 * mirror): each from beside the backbone out round the side and down to the front, after
 * skeleton.ts RIBS (its rows 2–9), drawn as three points.
 */
export const RIBS: readonly Outline[] = (
  [
    [1.8, 0.58],
    [1.67, 0.7],
    [1.54, 0.78],
    [1.41, 0.84],
    [1.28, 0.88],
    [1.15, 0.9],
    [1.02, 0.9],
    [0.89, 0.88],
  ] as const
).map(([y, cage]) => [
  [0.08, y - 0.02],
  [cage * 0.86, y - 0.14],
  [cage * 0.62, y - 0.36],
])

/** The labels breathing's picture shows (anatomy plan §6; the tap-only ones, bronchi and food pipe, are not drawn). */
export type BreathingLabel = 'nasal' | 'trachea' | 'lungs' | 'diaphragm'

/** Their anchors on the organ and their places beside it, like anatomy/callouts.ts. */
export const LABELS: Readonly<Record<BreathingLabel, Callout>> = {
  nasal: { anchor: v(0, 2.8, 0.3), at: v(0.42, 2.84, 0.2), side: 'right' },
  trachea: { anchor: v(0, 2.24, 0.1), at: v(-0.42, 2.3, 0.1), side: 'left' },
  lungs: { anchor: v(-0.55, 1.5, 0.2), at: v(-1.0, 1.72, 0.1), side: 'left' },
  diaphragm: { anchor: v(0.5, 0.92, 0.2), at: v(0.95, 0.62, 0.1), side: 'right' },
}

/**
 * Depth for the 3D lungs (A-3; three/layers/breathing.ts builds them from the outlines above), scene z,
 * + towards the viewer. The windpipe is in front of the food pipe; the lungs are deeper behind (they
 * wrap round the back of the chest) than in front; the person's left lung is shown cut open down the
 * front (`cut`), so its bronchi show on the cut face, as a book's figure shows them. The diaphragm's
 * rim reaches further down at the back than at the front.
 */
export const DEPTH = {
  windpipe: 0.06,
  foodPipe: -0.1,
  lungs: { mid: -0.06, front: 0.32, back: 0.38, cut: 0.03 },
  diaphragm: { front: 0.47, back: 0.42 },
} as const
