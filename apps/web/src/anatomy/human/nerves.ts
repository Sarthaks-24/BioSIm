import type { Callout } from '../callouts.ts'

/** A scene point (base.ts `v`, written out: this file loads with the pack and shares no code with the first paint). */
const v = (x: number, y: number, z: number) => ({ x, y, z })

/**
 * Brain & nerves (the `control` pack; anatomy plan §2.8), front-on, in scene units as base.ts (≈ 1
 * unit = 20 cm; the person's left is +x). Drawn flat in the `upper` framing by
 * systems/nerves/drawing.tsx, which loads with the pack. Like the NCERT Class 10 figure of the
 * central nervous system (Ch 6): the brain in the skull, the spinal cord down the back, nerves out
 * to the body.
 *
 * - Brain: the fore-brain (the big, thinking part) fills most of the skull; seen from the front the
 *   cerebellum shows as two small lobes under it, and the medulla joins the brain to the cord.
 * - Spinal cord: from the medulla down the back to near the first lumbar vertebrae (L1–L2), about
 *   waist height, where it ends in a point; nerves to the legs go on below it.
 * - About ten nerves: one to each arm (from the neck), three pairs between the ribs, and one to each
 *   leg from the low back (they leave the `upper` framing at its bottom edge).
 * - The neck arteries (carotids) carry blood, and the sugar the brain uses, up to the head.
 */

/** An open path or a closed outline, [x, y] pairs. */
export type Outline = readonly (readonly [number, number])[]

/** The fore-brain: an ellipse inside the head (base.ts HEAD: centre 2.84, rx 0.31, ry 0.39). */
export const FOREBRAIN = { x: 0, y: 2.96, rx: 0.25, ry: 0.22 }
/** One cerebellum lobe (the person's left, +x); the other is its mirror. */
export const CEREBELLUM = { x: 0.12, y: 2.73, rx: 0.1, ry: 0.065 }
/** The medulla (brainstem): from under the fore-brain down to the top of the spinal cord. */
export const MEDULLA = { top: 2.78, bottom: 2.5, width: 0.075 }
/** The spinal cord: down the midline to near L1–L2 (waist height), where it tapers to a point. */
export const CORD = { top: 2.5, bottom: 0.32, width: 0.05 }

/** The nerves, each from the cord out (the person's left; `NERVES` adds the mirrors). */
const LEFT_NERVES: readonly Outline[] = [
  // To the arm: from the neck out under the collarbone to the shoulder.
  [
    [0.02, 2.08],
    [0.3, 2.02],
    [0.6, 1.94],
    [0.84, 1.86],
  ],
  // Between the ribs: three pairs.
  ...[1.62, 1.28, 0.94].map((y): Outline => [
    [0.02, y],
    [0.35, y - 0.04],
    [0.62, y - 0.14],
    [0.74, y - 0.26],
  ]),
  // To the leg: from the low back, below the cord's end, down to the hip.
  [
    [0.02, 0.36],
    [0.1, -0.1],
    [0.22, -0.55],
    [0.32, -0.98],
  ],
]

/** Every nerve drawn: five a side (about ten, anatomy plan §2.8). */
export const NERVES: readonly Outline[] = [...LEFT_NERVES, ...LEFT_NERVES.map((n): Outline => n.map(([x, y]) => [-x, y]))]

/** The left neck artery (carotid), from the chest up beside the windpipe to under the skull; the right is its mirror. */
export const CAROTID: Outline = [
  [0.09, 1.98],
  [0.1, 2.2],
  [0.11, 2.42],
  [0.1, 2.6],
]

/** The labels the picture can show (anatomy plan §6): Brain, Spinal cord, Nerves first; the brain's parts with room. */
export type NerveLabel = 'brain' | 'cord' | 'nerves' | 'forebrain' | 'cerebellum' | 'medulla'

/** Each label's dot on its part and its pill beside it, in empty space, never on the part. */
export const LABELS: Readonly<Record<NerveLabel, Callout>> = {
  brain: { anchor: v(0.18, 3.06, 0), at: v(0.48, 3.22, 0), side: 'right' },
  cord: { anchor: v(0.0, 1.45, 0), at: v(0.32, 1.48, 0), side: 'right' },
  nerves: { anchor: v(-0.6, 1.2, 0), at: v(-0.98, 1.05, 0), side: 'left' },
  forebrain: { anchor: v(-0.14, 3.04, 0), at: v(-0.48, 3.22, 0), side: 'left' },
  cerebellum: { anchor: v(-0.15, 2.72, 0), at: v(-0.5, 2.62, 0), side: 'left' },
  medulla: { anchor: v(0.03, 2.58, 0), at: v(0.42, 2.6, 0), side: 'right' },
}
