import { Spline3, type XYZ } from '../spline.ts'

/**
 * The shared body base (anatomy plan §1): the outline every system draws on, in scene units
 * (≈ 1 unit = 20 cm). The body faces the viewer, so the person's LEFT is on the viewer's RIGHT
 * (+x); +z points out of the body towards the viewer. Three.js-free: the flat body draws from these
 * on every device, and the 3D shell (three/geometry.ts) lathes and tubes the same numbers.
 *
 * The other files of the body: digestion.ts (the gut, first paint), limbs.ts (legs and posed arms,
 * loaded when a picture shows them), skeleton.ts (landmarks), lymph.ts (spleen), one per system.
 */

export const v = (x: number, y: number, z: number): XYZ => ({ x, y, z })
export const curve = (pts: XYZ[], tension = 0.5) => new Spline3(pts, tension)

/** Body silhouette as [radius, height] pairs, bottom to neck. The 3D lathe and the flat outline both use it. */
export const TORSO_PROFILE: [number, number][] = [
  [0.0, -1.78],
  [0.5, -1.74],
  [0.82, -1.55],
  [0.93, -1.2],
  [0.9, -0.75],
  [0.8, -0.25],
  [0.79, 0.25],
  [0.88, 0.85],
  [0.98, 1.45],
  [1.02, 1.78],
  [0.97, 1.95],
  [0.82, 2.05],
  [0.6, 2.13],
  [0.38, 2.19],
  [0.24, 2.25],
  [0.19, 2.33],
  [0.18, 2.46],
]

/** The head, front-on: an ellipse (the 3D head is a sphere of 0.37 scaled to these). */
export const HEAD = { center: v(0, 2.84, 0), rx: 0.31, ry: 0.39 }

/**
 * Arms hang from the shoulders, tapering from the upper arm to the wrist, with a flatter hand
 * (the viewer's right arm; the left is its mirror). Shared by the 3D shell and the flat outline.
 * The elbow is at u = ELBOW_U: limbs.ts bends the arm there for an activity pose.
 */
export const ARM = curve([
  v(0.86, 1.9, -0.04),
  v(1.08, 1.74, -0.04),
  v(1.17, 1.3, -0.03),
  v(1.21, 0.86, -0.01),
  v(1.24, 0.36, 0.02),
  v(1.25, 0.0, 0.03),
])

/** Where along ARM the elbow is (the narrowing in armRadius). */
export const ELBOW_U = 0.5

/** Arm radius along ARM (u = 0 at the shoulder joint, 1 at the fingertips). */
export function armRadius(u: number): number {
  const shoulder = 0.2 - 0.07 * smooth(0, 0.3, u) // deltoid into the upper arm
  const elbow = -0.025 * Math.exp(-(((u - ELBOW_U) / 0.06) ** 2))
  const forearm = -0.035 * smooth(0.55, 0.82, u) // forearm narrows to the wrist
  const hand = 0.012 * Math.exp(-(((u - 0.9) / 0.05) ** 2))
  const tip = u > 0.94 ? Math.sqrt(Math.max(0, 1 - ((u - 0.94) / 0.06) ** 2)) : 1
  return (shoulder + elbow + forearm + hand) * tip
}

export function smooth(a: number, b: number, x: number): number {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/**
 * Framings (anatomy plan §1): which part of the body a system's picture shows, as a box in scene
 * units. `SystemDef.camera.framing` names one. Each keeps 0.2 over the top of the head (3.25), so
 * the head never touches the meal bar (FP-2), and the arms' width (±1.45).
 * - torso: digestion, kidneys, heart & blood (flat), hips to head
 * - chest: breathing (and the 3D heart)
 * - upper: brain, hormones
 * - full: muscles, bones, skin, lymph; the whole standing body, feet at −5.8
 */
const box = (minY: number, maxY = 3.5): View => ({ minX: -1.45, maxX: 1.45, minY, maxY })
export const FRAMINGS: { readonly [F in Framing]: View } = { torso: box(-1.9, 3.45), chest: box(-0.6), upper: box(-1.0), full: box(-6.0) }
export type Framing = 'torso' | 'chest' | 'upper' | 'full'

/** A box of the scene, in scene units. */
export interface View {
  minX: number
  maxX: number
  minY: number
  maxY: number
}
