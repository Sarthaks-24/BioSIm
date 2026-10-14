import type { ActivityKind } from '@lifepeek/engine'
import type { Callout } from '../callouts.ts'

/** A scene point (base.ts `v`, written out: this file loads with the `effort` pack and shares no code with the first paint). */
const v = (x: number, y: number, z: number) => ({ x, y, z })

/**
 * Muscles (the `effort` pack; anatomy plan §2.4): about twelve muscle groups, front-on, in scene units
 * as base.ts (≈ 1 unit = 20 cm; the person's left is the viewer's right, +x). Drawn flat in the `full`
 * framing by systems/muscles/drawing.tsx, over the base body in the band's still pose.
 *
 * The trunk's groups do not move with a pose, so they are outlines here (the viewer's right side;
 * the left is the mirror). The limbs' groups follow the pose: each is a stretch of its limb's curve
 * (anatomy/human/limbs.ts; u = 0 at the hip or shoulder, 1 at the sole or fingertips), a little to
 * the limb's outer (+) or inner (−) side, as wide as a share of the limb there. Shapes are a
 * drawing's, after the NCERT and OpenStax figures, not measured.
 *
 * Plain data, importing nothing at run time (flat/layerKit.ts says why).
 */

/** A closed outline, [x, y] pairs. */
export type Outline = readonly (readonly [number, number])[]

/** The muscle groups drawn (≈ 12, anatomy plan §2.4). */
export type MuscleGroup =
  'neck' | 'chest' | 'belly' | 'sideBelly' | 'hip' | 'shoulder' | 'upperArm' | 'forearm' | 'thighFront' | 'thighInner' | 'shin' | 'calf'

/** The trunk's groups, the viewer's right side (+x); each is drawn on both sides. */
export const TRUNK_MUSCLES: readonly { group: MuscleGroup; outline: Outline }[] = [
  // The strap down the side of the neck, from behind the ear to the breastbone.
  {
    group: 'neck',
    outline: [
      [0.07, 1.97],
      [0.13, 1.99],
      [0.22, 2.4],
      [0.17, 2.43],
    ],
  },
  // The chest muscle, a fan from the breastbone to the shoulder.
  {
    group: 'chest',
    outline: [
      [0.06, 1.92],
      [0.4, 1.96],
      [0.72, 1.87],
      [0.86, 1.72],
      [0.8, 1.5],
      [0.6, 1.3],
      [0.32, 1.2],
      [0.07, 1.24],
    ],
  },
  // The straight belly muscle, beside the midline from the ribs to the pubic bone (its bands: BELLY_BANDS).
  {
    group: 'belly',
    outline: [
      [0.03, 1.08],
      [0.28, 1.06],
      [0.31, 0.55],
      [0.3, -0.1],
      [0.24, -0.75],
      [0.12, -1.25],
      [0.03, -1.3],
    ],
  },
  // The side belly muscle, from the lower ribs down to the hip bone.
  {
    group: 'sideBelly',
    outline: [
      [0.36, 1.0],
      [0.64, 1.08],
      [0.75, 0.6],
      [0.75, 0.0],
      [0.81, -0.55],
      [0.6, -0.85],
      [0.34, -0.62],
      [0.35, 0.1],
    ],
  },
  // The side of the hip (the buttock muscles as seen from the front).
  {
    group: 'hip',
    outline: [
      [0.68, -0.8],
      [0.86, -0.9],
      [0.92, -1.12],
      [0.87, -1.3],
      [0.75, -1.22],
      [0.65, -1.0],
    ],
  },
]

/** The belly muscle's bands across it (the lines between its "packs"), at these heights. */
export const BELLY_BANDS: readonly number[] = [0.72, 0.36, 0.0]

/**
 * A stretch of a limb: from `u0` to `u1` along its curve, its middle `off` × the limb's radius to
 * the outer (+) or inner (−) side, `w` × the radius wide each side at its widest. Muscles taper to
 * their ends (tendons); a tendon does not.
 */
export interface LimbStretch {
  limb: 'leg' | 'arm'
  u0: number
  u1: number
  off: number
  w: number
}

/** The limbs' groups (drawn in this order on each limb: the inner thigh under the front of the thigh). */
export const LIMB_MUSCLES: readonly (LimbStretch & { group: MuscleGroup })[] = [
  { group: 'thighInner', limb: 'leg', u0: 0.03, u1: 0.3, off: -0.58, w: 0.36 },
  { group: 'thighFront', limb: 'leg', u0: 0.05, u1: 0.45, off: 0.1, w: 0.66 },
  { group: 'calf', limb: 'leg', u0: 0.52, u1: 0.76, off: -0.5, w: 0.4 },
  { group: 'shin', limb: 'leg', u0: 0.53, u1: 0.86, off: 0.32, w: 0.32 },
  { group: 'shoulder', limb: 'arm', u0: 0.0, u1: 0.26, off: 0.2, w: 0.85 },
  { group: 'upperArm', limb: 'arm', u0: 0.2, u1: 0.47, off: -0.05, w: 0.6 },
  { group: 'forearm', limb: 'arm', u0: 0.53, u1: 0.82, off: 0, w: 0.64 },
]

/** Tendons drawn (anatomy plan §2.4): below the kneecap, at the front of the ankle, at the wrist. */
export const TENDONS: readonly LimbStretch[] = [
  { limb: 'leg', u0: 0.47, u1: 0.535, off: 0.04, w: 0.22 },
  { limb: 'leg', u0: 0.855, u1: 0.925, off: 0.22, w: 0.2 },
  { limb: 'arm', u0: 0.81, u1: 0.88, off: 0, w: 0.4 },
]

const LEGS: readonly MuscleGroup[] = ['hip', 'thighFront', 'thighInner', 'shin', 'calf']
const ARMS: readonly MuscleGroup[] = ['shoulder', 'upperArm', 'forearm']
const TRUNK: readonly MuscleGroup[] = ['belly', 'sideBelly']

/**
 * Which groups work in each kind of activity (a drawing's choice: the model counts all the extra
 * energy of moving in the muscles together, model §2.7). The legs in every walk or run; the arms
 * swing bent in a brisk walk and a run; the belly holds the trunk in a run. Sitting in class holds
 * the trunk up and writes with the forearm. The games use the legs, arms and trunk as a run does;
 * cricket and badminton swing the arm across the chest too (a bat, a racket).
 */
export const WORKING: { readonly [K in ActivityKind]: readonly MuscleGroup[] } = {
  walk: LEGS,
  walkBrisk: [...LEGS, ...ARMS],
  run: [...LEGS, ...ARMS, ...TRUNK],
  sitClass: [...TRUNK, 'forearm'],
  football: [...LEGS, ...ARMS, ...TRUNK],
  cricket: [...LEGS, ...ARMS, ...TRUNK, 'chest'],
  badminton: [...LEGS, ...ARMS, ...TRUNK, 'chest'],
}

/** The labels muscles' picture shows (anatomy plan §6). */
export type MusclesLabel = 'legs' | 'arms' | 'belly' | 'tendon'

/**
 * Their anchors and places at rest (the layer moves the limbs' ones with the pose: systems/muscles/
 * paint.ts `limbLabels`): the leg muscles on the viewer's right thigh, the arm muscles on the left
 * upper arm, the belly beside the navel, the tendon below the right knee.
 */
export const LABELS: Readonly<Record<MusclesLabel, Callout>> = {
  legs: { anchor: v(0.42, -2.45, 0), at: v(1.0, -2.3, 0), side: 'right' },
  arms: { anchor: v(-1.19, 1.15, 0), at: v(-1.42, 1.0, 0), side: 'left' },
  belly: { anchor: v(0.16, -0.3, 0), at: v(1.0, -0.55, 0), side: 'right' },
  tendon: { anchor: v(0.36, -3.62, 0), at: v(1.0, -3.75, 0), side: 'right' },
}

/** Where along which limb (viewer's right leg +1, left arm −1) each limb label sits, posed. */
export const LIMB_LABELS: { readonly [L in 'legs' | 'arms' | 'tendon']: { limb: 'leg' | 'arm'; side: 1 | -1; u: number } } = {
  legs: { limb: 'leg', side: 1, u: 0.25 },
  arms: { limb: 'arm', side: -1, u: 0.33 },
  tendon: { limb: 'leg', side: 1, u: 0.505 },
}
