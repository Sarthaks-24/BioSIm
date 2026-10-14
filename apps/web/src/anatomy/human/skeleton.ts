import { curve, v } from './base.ts'

/**
 * Landmarks (anatomy plan §1): the backbone, breastbone, ribs and hip bones, in scene units
 * (base.ts). Faint in the flat body of the systems that need a bearing (breathing's ribs, the
 * Bones card's skeleton, U-1); in 3D a one-draw ghost (A-1a). Digestion does not draw them.
 * Front-on, the backbone runs down the middle behind the organs (its S-curve is in depth), the ribs
 * leave it, sweep out to the sides and come round to the breastbone in front, and the lowest ribs
 * stop short of the hips.
 */

/** Backbone, top of the neck (under the skull) to the tailbone: forward at the neck and the low back, back at the chest. */
export const SPINE = curve([
  v(0, 2.5, -0.12),
  v(0, 2.2, -0.08),
  v(0, 1.8, -0.24),
  v(0, 1.1, -0.34),
  v(0, 0.4, -0.3),
  v(0, -0.3, -0.18),
  v(0, -0.9, -0.24),
  v(0, -1.35, -0.36),
  v(0, -1.6, -0.3),
])

/** Breastbone, the notch between the collarbones to the tip under the heart. */
export const STERNUM = curve([v(0, 1.95, 0.3), v(0, 1.45, 0.4), v(0, 0.95, 0.42)])

/** Twelve pairs of ribs: where each leaves the backbone (y), and how wide the cage is there (x). */
const RIB_ROWS: [number, number][] = [
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

/**
 * The viewer's right ribs (+x; the left are their mirror), each from the backbone round to the
 * front. The first seven reach the breastbone, the next three join the rib above, the last two
 * float (they end at the side).
 */
export const RIBS = RIB_ROWS.map(([y, cage], i) => {
  // Inside the chest wall: the skin outline is the body's, the cage sits a little within it.
  const w = cage * 0.88
  const back = v(0.06, y, -0.3)
  const side = v(w, y - 0.16, -0.02)
  if (i >= 10) return curve([back, v(w * 0.8, y - 0.08, -0.2), side])
  const front = i < 7 ? v(0.08, Math.min(1.9, y - 0.3 - 0.02 * i), 0.36) : v(0.3 + 0.05 * (i - 7), y - 0.34, 0.3)
  return curve([back, v(w * 0.78, y - 0.06, -0.24), side, v(w * 0.72, y - 0.28, 0.22), front])
})

/** The hip bone, front-on: one side's outline (the viewer's right, +x), from the top of the hip down to the joint and the pubic bone. */
export const PELVIS: [number, number][] = [
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
