import type { Callout } from '../callouts.ts'

/** A scene point (base.ts `v`, written out: this file loads with the pack and shares no code with the first paint). */
const v = (x: number, y: number, z: number) => ({ x, y, z })

/**
 * Heart & blood (the `circulation` pack; anatomy plan §2.2): the heart and both loops of blood,
 * front-on, in scene units as base.ts (≈ 1 unit = 20 cm; the person's left is +x). Drawn flat in the
 * `torso` framing by systems/circulation/drawing.tsx, which loads with the pack.
 *
 * The heart sits on the diaphragm (y ≈ 0.92), a little to the person's left, its apex down and out.
 * Body loop: the aorta leaves the left ventricle, arches up (branches to the neck and arms), runs
 * down in front of the backbone (branches to the gut and kidneys) and splits into the iliac
 * arteries, which leave the picture's bottom edge to the legs; the venae cavae bring the blood back
 * to the right atrium. Lung loop: the pulmonary artery to the lungs (a pale ghost), the pulmonary
 * veins back to the left atrium. The gut's blood goes through the portal vein to the liver, then the
 * hepatic veins into the inferior vena cava. Schematic like the NCERT figure: the heart a little
 * large, every vessel a tube in front.
 */

/** An outline or a path, [x, y] pairs. */
export type Outline = readonly (readonly [number, number])[]

/** The two ventricles, one outline: base (top) to the apex. The septum is drawn as a faint line. */
export const VENTRICLES: Outline = [
  [-0.24, 1.38],
  [-0.1, 1.43],
  [0.08, 1.44],
  [0.24, 1.43],
  [0.36, 1.35],
  [0.42, 1.21],
  [0.41, 1.06],
  [0.34, 0.96],
  [0.26, 0.91],
  [0.14, 0.95],
  [0.0, 1.05],
  [-0.14, 1.17],
  [-0.24, 1.28],
]
/** The septum between the ventricles: from the base to near the apex. */
export const SEPTUM: Outline = [
  [0.06, 1.42],
  [0.14, 1.2],
  [0.24, 0.96],
]
/** The atria, two lobes over the ventricles: the right one (viewer's left) bigger. Centre and radii. */
export const ATRIA = [
  { cx: -0.11, cy: 1.49, rx: 0.13, ry: 0.11 },
  { cx: 0.2, cy: 1.52, rx: 0.12, ry: 0.09 },
] as const

/** Where the atria shrink to (the valves' plane, between atria and ventricles). */
export const ATRIA_ORIGIN = v(0.04, 1.42, 0)
/** Where the ventricles shrink to: above their base, so the apex moves most (the main cue). */
export const VENTRICLE_ORIGIN = v(0.06, 1.56, 0)
/** The ventricles' apex: the point of the outline that moves most with a beat. */
export const APEX = v(0.26, 0.91, 0)

/** Which blood a vessel carries: rich in oxygen (red) or poor (blue, a drawing convention). */
export type Blood = 'rich' | 'poor'
/**
 * Where a vessel's blood goes, for its dashes: `gut` (denser with blood to the gut), `legs`
 * (denser with blood to the muscles), `lungs` and `body` (the rest).
 */
export type Bed = 'body' | 'gut' | 'legs' | 'lungs'

/** One vessel: its path in the blood's direction, its width, its blood, its bed, and whether it gets an arrow (reduced motion). */
export interface Vessel {
  id: string
  blood: Blood
  bed: Bed
  path: Outline
  width: number
  arrow?: boolean
}

export const VESSELS: readonly Vessel[] = [
  // Body loop, out: the aorta from the left ventricle, over the arch, down to where it splits.
  {
    id: 'aorta',
    blood: 'rich',
    bed: 'body',
    width: 0.075,
    arrow: true,
    path: [
      [0.08, 1.42],
      [0.06, 1.72],
      [0.08, 1.88],
      [0.17, 1.94],
      [0.25, 1.86],
      [0.24, 1.6],
      [0.2, 1.2],
      [0.13, 0.7],
      [0.09, 0.2],
      [0.06, -0.4],
      [0.04, -0.85],
    ],
  },
  {
    id: 'neckL',
    blood: 'rich',
    bed: 'body',
    width: 0.035,
    path: [
      [0.13, 1.93],
      [0.12, 2.2],
      [0.11, 2.6],
    ],
  },
  {
    id: 'neckR',
    blood: 'rich',
    bed: 'body',
    width: 0.035,
    arrow: true,
    path: [
      [0.08, 1.9],
      [0.02, 2.2],
      [-0.04, 2.6],
    ],
  },
  {
    id: 'armL',
    blood: 'rich',
    bed: 'body',
    width: 0.035,
    path: [
      [0.22, 1.9],
      [0.52, 1.98],
      [0.84, 1.9],
    ],
  },
  {
    id: 'armR',
    blood: 'rich',
    bed: 'body',
    width: 0.035,
    path: [
      [0.08, 1.9],
      [-0.3, 2.0],
      [-0.84, 1.9],
    ],
  },
  {
    id: 'kidneyArtL',
    blood: 'rich',
    bed: 'body',
    width: 0.03,
    path: [
      [0.09, 0.28],
      [0.36, 0.26],
    ],
  },
  {
    id: 'kidneyArtR',
    blood: 'rich',
    bed: 'body',
    width: 0.03,
    path: [
      [0.08, 0.2],
      [-0.34, 0.14],
    ],
  },
  // To the gut: the mesenteric artery and two twigs.
  {
    id: 'gutArt',
    blood: 'rich',
    bed: 'gut',
    width: 0.04,
    arrow: true,
    path: [
      [0.11, 0.5],
      [0.24, 0.2],
      [0.24, -0.2],
      [0.1, -0.6],
    ],
  },
  {
    id: 'gutTwigL',
    blood: 'rich',
    bed: 'gut',
    width: 0.025,
    path: [
      [0.24, 0.05],
      [0.42, -0.1],
      [0.46, -0.4],
    ],
  },
  {
    id: 'gutTwigR',
    blood: 'rich',
    bed: 'gut',
    width: 0.025,
    path: [
      [0.22, -0.3],
      [-0.05, -0.32],
      [-0.3, -0.5],
    ],
  },
  // To the legs: the iliac arteries, leaving the picture's bottom edge.
  {
    id: 'legArtL',
    blood: 'rich',
    bed: 'legs',
    width: 0.05,
    arrow: true,
    path: [
      [0.04, -0.85],
      [0.2, -1.2],
      [0.34, -1.6],
      [0.4, -2.0],
    ],
  },
  {
    id: 'legArtR',
    blood: 'rich',
    bed: 'legs',
    width: 0.05,
    path: [
      [0.04, -0.85],
      [-0.14, -1.2],
      [-0.26, -1.6],
      [-0.3, -2.0],
    ],
  },
  // Body loop, back: from the legs and the gut's liver up the inferior vena cava; head and arms down the superior.
  {
    id: 'legVeinL',
    blood: 'poor',
    bed: 'legs',
    width: 0.055,
    path: [
      [0.5, -2.0],
      [0.44, -1.6],
      [0.26, -1.2],
      [-0.07, -0.85],
    ],
  },
  {
    id: 'legVeinR',
    blood: 'poor',
    bed: 'legs',
    width: 0.055,
    arrow: true,
    path: [
      [-0.42, -2.0],
      [-0.38, -1.6],
      [-0.22, -1.2],
      [-0.07, -0.85],
    ],
  },
  {
    id: 'ivc',
    blood: 'poor',
    bed: 'body',
    width: 0.08,
    arrow: true,
    path: [
      [-0.07, -0.85],
      [-0.1, -0.2],
      [-0.12, 0.4],
      [-0.14, 0.9],
      [-0.16, 1.2],
      [-0.14, 1.4],
    ],
  },
  {
    id: 'kidneyVeinL',
    blood: 'poor',
    bed: 'body',
    width: 0.035,
    path: [
      [0.36, 0.18],
      [0.1, 0.12],
      [-0.1, 0.12],
    ],
  },
  {
    id: 'kidneyVeinR',
    blood: 'poor',
    bed: 'body',
    width: 0.035,
    path: [
      [-0.34, 0.04],
      [-0.11, 0.06],
    ],
  },
  // The gut's blood: the portal vein to the liver, the hepatic veins on into the inferior vena cava.
  {
    id: 'portal',
    blood: 'poor',
    bed: 'gut',
    width: 0.045,
    arrow: true,
    path: [
      [-0.02, -0.5],
      [-0.14, -0.15],
      [-0.3, 0.3],
      [-0.4, 0.68],
    ],
  },
  {
    id: 'hepatic',
    blood: 'poor',
    bed: 'gut',
    width: 0.035,
    path: [
      [-0.5, 0.82],
      [-0.3, 0.9],
      [-0.15, 0.96],
    ],
  },
  {
    id: 'svcHead',
    blood: 'poor',
    bed: 'body',
    width: 0.04,
    path: [
      [-0.14, 2.6],
      [-0.16, 2.2],
      [-0.2, 1.98],
    ],
  },
  {
    id: 'svcArmR',
    blood: 'poor',
    bed: 'body',
    width: 0.04,
    path: [
      [-0.84, 1.84],
      [-0.5, 1.9],
      [-0.2, 1.96],
    ],
  },
  {
    id: 'svcArmL',
    blood: 'poor',
    bed: 'body',
    width: 0.04,
    path: [
      [0.84, 1.84],
      [0.4, 1.92],
      [-0.2, 1.98],
    ],
  },
  {
    id: 'svc',
    blood: 'poor',
    bed: 'body',
    width: 0.07,
    arrow: true,
    path: [
      [-0.2, 1.98],
      [-0.2, 1.75],
      [-0.16, 1.58],
    ],
  },
  // Lung loop: the pulmonary artery from the right ventricle to both lungs; the pulmonary veins back.
  {
    id: 'lungArt',
    blood: 'poor',
    bed: 'lungs',
    width: 0.065,
    arrow: true,
    path: [
      [-0.04, 1.42],
      [-0.04, 1.62],
      [0.0, 1.74],
    ],
  },
  {
    id: 'lungArtL',
    blood: 'poor',
    bed: 'lungs',
    width: 0.05,
    path: [
      [0.0, 1.74],
      [0.32, 1.76],
      [0.52, 1.62],
    ],
  },
  {
    id: 'lungArtR',
    blood: 'poor',
    bed: 'lungs',
    width: 0.05,
    path: [
      [0.0, 1.74],
      [-0.3, 1.78],
      [-0.52, 1.64],
    ],
  },
  {
    id: 'lungVeinL',
    blood: 'rich',
    bed: 'lungs',
    width: 0.045,
    arrow: true,
    path: [
      [0.56, 1.36],
      [0.42, 1.44],
      [0.28, 1.5],
    ],
  },
  {
    id: 'lungVeinR',
    blood: 'rich',
    bed: 'lungs',
    width: 0.045,
    path: [
      [-0.56, 1.4],
      [-0.34, 1.62],
      [0.0, 1.62],
      [0.14, 1.55],
    ],
  },
]

/** The lungs, a pale ghost (Breathing draws them): right (viewer's left) and left, with the heart's notch. */
export const LUNGS: readonly Outline[] = [
  [
    [-0.3, 2.04],
    [-0.57, 1.88],
    [-0.76, 1.42],
    [-0.8, 1.02],
    [-0.55, 1.0],
    [-0.2, 0.98],
    [-0.13, 1.3],
    [-0.13, 1.75],
  ],
  [
    [0.3, 2.03],
    [0.57, 1.87],
    [0.76, 1.42],
    [0.78, 1.0],
    [0.55, 0.96],
    [0.42, 1.0],
    [0.44, 1.3],
    [0.3, 1.5],
    [0.18, 1.75],
  ],
]

/** The liver (viewer's left), the gut and the kidneys as faint ghosts, so the vessels have somewhere to go. */
export const LIVER: Outline = [
  [-0.82, 0.92],
  [-0.4, 0.98],
  [0.1, 0.92],
  [0.14, 0.8],
  [-0.12, 0.62],
  [-0.55, 0.5],
  [-0.8, 0.56],
  [-0.88, 0.74],
]
export const GUT: Outline = [
  [-0.55, 0.32],
  [0.0, 0.4],
  [0.55, 0.3],
  [0.66, -0.3],
  [0.5, -0.86],
  [0.0, -0.96],
  [-0.5, -0.86],
  [-0.66, -0.3],
]
/** The kidneys: the person's right one (viewer's left) a little lower. Centre and radii. */
export const KIDNEYS = [
  { cx: -0.42, cy: 0.08, rx: 0.09, ry: 0.16 },
  { cx: 0.44, cy: 0.2, rx: 0.09, ry: 0.16 },
] as const

/** The labels Heart & blood's picture shows (anatomy plan §6; the tap-only portal and hepatic veins are not). */
export type CirculationLabel = 'heart' | 'aorta' | 'venaCava' | 'pulmonaryArtery' | 'pulmonaryVein' | 'legs'

/** Their anchors on the organ and their places beside it, like anatomy/callouts.ts. */
export const LABELS: Readonly<Record<CirculationLabel, Callout>> = {
  heart: { anchor: v(0.24, 1.12, 0.2), at: v(0.95, 0.95, 0.1), side: 'right' },
  aorta: { anchor: v(0.24, 1.75, 0.2), at: v(0.72, 2.45, 0.1), side: 'right' },
  venaCava: { anchor: v(-0.12, 0.4, 0.2), at: v(-0.95, 0.3, 0.1), side: 'left' },
  pulmonaryArtery: { anchor: v(-0.4, 1.72, 0.2), at: v(-0.95, 1.5, 0.1), side: 'left' },
  pulmonaryVein: { anchor: v(0.45, 1.43, 0.2), at: v(0.98, 1.62, 0.1), side: 'right' },
  legs: { anchor: v(0.36, -1.7, 0.2), at: v(0.92, -1.55, 0.1), side: 'right' },
}
