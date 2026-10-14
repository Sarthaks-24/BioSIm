import type { Callout } from '../callouts.ts'

/** A scene point (base.ts `v`, written out: this file loads with the pack and shares no code with the first paint). */
const v = (x: number, y: number, z: number) => ({ x, y, z })

/**
 * Hormones (the `control` pack; anatomy plan §2.8, U-6): the pancreas with the stomach and liver
 * around it for a bearing, the vein that takes the pancreas's blood to the liver (the portal vein,
 * with the splenic vein along the pancreas), and the other glands NCERT Class 10 names (Ch 6,
 * pp. 109–110: pituitary, thyroid, adrenal), front-on, in scene units as base.ts (≈ 1 unit = 20 cm;
 * the person's left is +x). Drawn flat in the `upper` framing by systems/hormones/drawing.tsx, which
 * loads with the pack.
 *
 * The pancreas, stomach and liver are Digestion's (anatomy/human/digestion.ts), written out here as
 * outlines so the pack shares no code with the first paint: the stomach's outline is its centre line
 * and wall (an empty stomach, a quarter stretched) sampled front-on, the pancreas its centre line,
 * the liver its outline as drawn. hormones.test.ts checks each against the original.
 *
 * The pancreas lies behind the stomach, so the stomach is drawn see-through over it. Insulin leaves
 * the pancreas in its blood, which runs to the liver first (the portal vein), then on round the body.
 */

/** A closed outline or an open path, [x, y] pairs. */
export type Outline = readonly (readonly [number, number])[]

/** The stomach, front-on (digestion.ts STOMACH and stomachFillRadius(u, 0.25)), as a closed outline. */
export const STOMACH_OUTLINE: Outline = [
  [0.12, 0.97],
  [0.14, 1.1],
  [0.31, 1.23],
  [0.51, 1.2],
  [0.65, 1.08],
  [0.74, 0.94],
  [0.77, 0.77],
  [0.74, 0.63],
  [0.69, 0.49],
  [0.58, 0.37],
  [0.46, 0.28],
  [0.29, 0.26],
  [0.16, 0.28],
  [0.06, 0.35],
  [-0.03, 0.41],
  [-0.01, 0.47],
  [0.09, 0.46],
  [0.19, 0.46],
  [0.27, 0.48],
  [0.31, 0.53],
  [0.35, 0.58],
  [0.35, 0.64],
  [0.36, 0.71],
  [0.36, 0.77],
  [0.35, 0.81],
  [0.33, 0.86],
  [0.31, 0.92],
  [0.18, 0.91],
]

/** The liver, front-on (digestion.ts LIVER_OUTLINE). */
export const LIVER_OUTLINE: Outline = [
  [-0.8, 1.05],
  [-0.62, 1.24],
  [-0.3, 1.28],
  [0.05, 1.2],
  [0.38, 1.1],
  [0.58, 1.02],
  [0.4, 0.96],
  [0.1, 0.92],
  [-0.2, 0.78],
  [-0.5, 0.56],
  [-0.72, 0.6],
]

/** The pancreas's centre line, head (inside the duodenum's C, −x) to tail (towards the spleen, +x): digestion.ts PANCREAS, evenly sampled. */
export const PANCREAS_LINE: Outline = [
  [-0.13, 0.22],
  [-0.03, 0.26],
  [0.06, 0.3],
  [0.16, 0.34],
  [0.26, 0.37],
  [0.36, 0.42],
  [0.45, 0.47],
  [0.54, 0.53],
  [0.62, 0.6],
]

/** Its half-thickness along the line, from the broad head to the narrow tail (≈ 3 cm to 1.5 cm across). */
export const pancreasRadius = (u: number) => 0.085 - 0.04 * Math.min(1, Math.max(0, u))

/** The pancreas as a closed outline: its centre line, widened by `pancreasRadius` either side. */
export function pancreasOutline(): Outline {
  const n = PANCREAS_LINE.length
  const side = (sign: 1 | -1) =>
    PANCREAS_LINE.map(([x, y], i) => {
      const [ax, ay] = PANCREAS_LINE[Math.max(0, i - 1)]!
      const [bx, by] = PANCREAS_LINE[Math.min(n - 1, i + 1)]!
      const len = Math.hypot(bx - ax, by - ay)
      const r = pancreasRadius(i / (n - 1))
      return [x - (sign * r * (by - ay)) / len, y + (sign * r * (bx - ax)) / len] as const
    })
  return [...side(1), ...side(-1).reverse()]
}

/**
 * The way the pancreas's blood (and the insulin in it) goes: along the splenic vein behind the
 * pancreas to its neck, then up the portal vein into the liver. Dots run along it, tail to liver.
 */
export const INSULIN_PATH: Outline = [
  [0.46, 0.45],
  [0.26, 0.35],
  [0.06, 0.28],
  [-0.06, 0.32],
  [-0.14, 0.44],
  [-0.22, 0.58],
  [-0.3, 0.74],
  [-0.36, 0.9],
]
/** Where the path enters the liver: the dots fade out over the last part. */
export const INTO_LIVER_U = 0.82

/** A point at `u` (0…1) along an open path, by its length. */
export function along(path: Outline, u: number): readonly [number, number] {
  const lens = path.slice(1).map(([x, y], i) => Math.hypot(x - path[i]![0], y - path[i]![1]))
  let d = Math.min(1, Math.max(0, u)) * lens.reduce((a, b) => a + b, 0)
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i]! || i === lens.length - 1) {
      const k = lens[i]! ? Math.min(1, d / lens[i]!) : 0
      const [ax, ay] = path[i]!
      const [bx, by] = path[i + 1]!
      return [ax + (bx - ax) * k, ay + (by - ay) * k]
    }
    d -= lens[i]!
  }
  return path[path.length - 1]!
}

/**
 * The other glands NCERT Class 10 names (Ch 6, pp. 109–110), drawn only, never moved by the model
 * (their cards say "Drawing only"): the pituitary under the brain, the thyroid's two lobes on the
 * windpipe, and an adrenal on top of each kidney (the person's right one a little lower).
 */
export const PITUITARY = { x: 0, y: 2.78, rx: 0.035, ry: 0.028 }
export const THYROID = { x: 0, y: 2.31, lobe: 0.055, rx: 0.045, ry: 0.07 }
export const ADRENALS = [
  { x: 0.4, y: 0.8 },
  { x: -0.4, y: 0.71 },
] as const
/** An adrenal's cap, about its top centre: a small rounded triangle. */
export const ADRENAL_CAP: Outline = [
  [-0.07, -0.02],
  [-0.03, 0.06],
  [0.02, 0.07],
  [0.07, -0.02],
]

/** The labels its picture shows (anatomy plan §6), most needed first. */
export type HormoneLabel = 'pancreas' | 'liver' | 'stomach' | 'vein' | 'thyroid' | 'pituitary' | 'adrenal'

/** Their anchors on the organ and their places beside it, like anatomy/callouts.ts. */
export const LABELS: Readonly<Record<HormoneLabel, Callout>> = {
  pancreas: { anchor: v(0.5, 0.48, 0.2), at: v(0.9, 0.3, 0.1), side: 'right' },
  liver: { anchor: v(-0.5, 1.12, 0.26), at: v(-0.86, 1.36, 0.1), side: 'left' },
  stomach: { anchor: v(0.7, 0.9, 0.16), at: v(0.92, 1.0, 0.12), side: 'right' },
  vein: { anchor: v(-0.2, 0.55, 0.2), at: v(-0.86, 0.3, 0.1), side: 'left' },
  thyroid: { anchor: v(0.05, 2.31, 0.2), at: v(0.4, 2.2, 0.1), side: 'right' },
  pituitary: { anchor: v(0, 2.78, 0.2), at: v(-0.5, 2.6, 0.1), side: 'left' },
  adrenal: { anchor: v(0.42, 0.83, 0.2), at: v(0.92, 0.7, 0.1), side: 'right' },
}
