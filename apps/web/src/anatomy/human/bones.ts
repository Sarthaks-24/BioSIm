import type { Callout } from '../callouts.ts'

/** A scene point (base.ts `v`, written out: this file loads with the `effort` pack). */
const v = (x: number, y: number, z: number) => ({ x, y, z })

/**
 * Bones (a card in the `effort` pack, Drawing only; anatomy plan §2.6): skull, backbone, ribs,
 * breastbone, collarbones, pelvis and the long bones of the arms and legs, front-on, in scene units
 * as base.ts. Drawn flat in the `full` framing by systems/bones/BonesLayer.tsx, in the same still pose
 * as Muscles: the long bones follow their limb's curve. The hip (ball-and-socket) and the knee
 * (hinge) are marked. Nothing moves: bones don't change during one meal or one game.
 *
 * The backbone, the ribs and the pelvis are skeleton.ts's landmarks written out as plain numbers
 * (effort.test.ts checks they match): this file loads with the pack and imports nothing at run time.
 */

/** A closed outline, [x, y] pairs. */
export type Outline = readonly (readonly [number, number])[]

/** The skull: the braincase (an ellipse inside the head) and the jaw's outline. */
export const SKULL = {
  center: v(0, 2.9, 0),
  rx: 0.25,
  ry: 0.29,
  jaw: [
    [-0.18, 2.78],
    [-0.16, 2.58],
    [-0.07, 2.49],
    [0.07, 2.49],
    [0.16, 2.58],
    [0.18, 2.78],
  ] as Outline,
  /** The eye sockets' centres (the viewer's right; mirrored) and half-sizes. */
  eye: { x: 0.1, y: 2.84, rx: 0.06, ry: 0.05 },
}

/** The backbone front-on (skeleton.ts SPINE's heights; x = 0): the neck under the skull to the tailbone. */
export const SPINE_Y: readonly number[] = [2.5, 2.2, 1.8, 1.1, 0.4, -0.3, -0.9, -1.35, -1.6]

/** Where the vertebrae stop and the sacrum (a triangle in the pelvis) starts. */
export const SACRUM_TOP = -0.95

/** The ribs' rows (skeleton.ts RIB_ROWS): where each leaves the backbone (y) and how wide the cage is there. */
export const RIB_ROWS: readonly (readonly [number, number])[] = [
  [1.92, 0.42],
  [1.8, 0.58],
  [1.67, 0.7],
  [1.54, 0.78],
  [1.41, 0.84],
  [1.28, 0.88],
  [1.15, 0.9],
  [1.02, 0.9],
  [0.89, 0.88],
  [0.76, 0.85],
  [0.63, 0.8],
  [0.52, 0.72],
]

/** The breastbone, the notch between the collarbones to the tip (skeleton.ts STERNUM, as an outline). */
export const STERNUM: Outline = [
  [-0.07, 1.95],
  [0.07, 1.95],
  [0.08, 1.5],
  [0.05, 0.98],
  [0, 0.92],
  [-0.05, 0.98],
  [-0.08, 1.5],
]

/** A collarbone (the viewer's right; mirrored), from the breastbone to the shoulder. */
export const COLLARBONE: Outline = [
  [0.08, 1.97],
  [0.38, 1.94],
  [0.62, 2.0],
  [0.86, 1.94],
]

/** The hip bone, front-on: one side's outline (skeleton.ts PELVIS). */
export const PELVIS: Outline = [
  [0.1, -0.85],
  [0.45, -0.72],
  [0.78, -0.82],
  [0.86, -1.05],
  [0.72, -1.25],
  [0.5, -1.36],
  [0.36, -1.6],
  [0.08, -1.66],
  [0.12, -1.42],
  [0.28, -1.22],
  [0.2, -1.02],
]

/** The long bones on their limb: a stretch of its curve and the bone's half-width (× the limb's radius), `off` × the radius outwards. */
export const LONG_BONES: readonly { limb: 'leg' | 'arm'; u0: number; u1: number; w: number; off: number }[] = [
  // Thigh bone (femur), its head in the hip joint.
  { limb: 'leg', u0: 0.0, u1: 0.47, w: 0.2, off: 0.05 },
  // Shin bone (tibia) and the thin outer bone (fibula).
  { limb: 'leg', u0: 0.5, u1: 0.92, w: 0.2, off: -0.08 },
  { limb: 'leg', u0: 0.53, u1: 0.91, w: 0.08, off: 0.48 },
  // Upper arm (humerus), then the two forearm bones.
  { limb: 'arm', u0: 0.08, u1: 0.48, w: 0.26, off: 0 },
  { limb: 'arm', u0: 0.52, u1: 0.84, w: 0.13, off: 0.3 },
  { limb: 'arm', u0: 0.52, u1: 0.84, w: 0.13, off: -0.3 },
]

/** The labels bones' picture shows (anatomy plan §6). */
export type BonesLabel = 'skull' | 'backbone' | 'ribs' | 'pelvis' | 'ballSocket' | 'hinge'

/** Their anchors and places at rest (the layer moves the knee's with the pose). */
export const LABELS: Readonly<Record<BonesLabel, Callout>> = {
  skull: { anchor: v(0.2, 3.0, 0), at: v(0.5, 3.15, 0), side: 'right' },
  backbone: { anchor: v(0, 0.1, 0), at: v(-0.98, -0.3, 0), side: 'left' },
  ribs: { anchor: v(-0.62, 1.12, 0), at: v(-1.42, 1.45, 0), side: 'left' },
  pelvis: { anchor: v(0.62, -0.92, 0), at: v(1.0, -0.75, 0), side: 'right' },
  ballSocket: { anchor: v(0.46, -1.35, 0), at: v(1.0, -1.4, 0), side: 'right' },
  hinge: { anchor: v(0.36, -3.5, 0), at: v(1.0, -3.5, 0), side: 'right' },
}
