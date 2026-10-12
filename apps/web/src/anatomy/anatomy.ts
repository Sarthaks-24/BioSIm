import { CatmullRomCurve3, Vector3 } from 'three'
import type { Particle, StageId } from '@biosim/engine'

/**
 * Stylized but anatomically arranged digestive tract, in scene units (≈ 1 unit = 20 cm).
 * The body faces the viewer, so the person's LEFT (stomach, spleen, descending colon) is on the
 * viewer's RIGHT (+x), and the liver, caecum and appendix are on the viewer's left (−x).
 * +z points out of the body towards the viewer.
 *
 * The same curves drive the 3D models, the flat 2D fallback and the particle paths, so food
 * always travels inside the organs it is drawn in.
 */

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)
const curve = (pts: Vector3[], tension = 0.5) => new CatmullRomCurve3(pts, false, 'catmullrom', tension)

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
  [1.03, 1.8],
  [0.98, 1.97],
  [0.8, 2.08],
  [0.52, 2.17],
  [0.28, 2.23],
  [0.19, 2.3],
  [0.17, 2.46],
]

export const MOUTH = v(0, 2.64, 0.22)

/** Mouth → back of the throat → top of the oesophagus. */
export const PHARYNX = curve([v(0, 2.64, 0.2), v(0, 2.6, 0.08), v(0, 2.48, 0.0), v(0, 2.36, -0.03)])

/** Runs down behind the windpipe and heart, then bends left through the diaphragm. */
export const ESOPHAGUS = curve([
  v(0, 2.36, -0.03),
  v(0, 2.0, -0.06),
  v(0.01, 1.55, -0.07),
  v(0.04, 1.2, -0.04),
  v(0.1, 1.0, 0.0),
  v(0.15, 0.94, 0.03),
])

/** Stomach centre line: cardia → fundus → body → greater curvature → antrum → pylorus. */
export const STOMACH = curve([
  v(0.15, 0.94, 0.03),
  v(0.3, 1.07, 0.05),
  v(0.47, 1.0, 0.08),
  v(0.56, 0.8, 0.11),
  v(0.52, 0.56, 0.14),
  v(0.38, 0.4, 0.16),
  v(0.2, 0.37, 0.16),
  v(0.06, 0.41, 0.13),
  v(-0.02, 0.44, 0.1),
])

/** Smoothly interpolated radius profile (u from 0 = cardia to 1 = pylorus). */
const STOMACH_PROFILE: [number, number][] = [
  [0, 0.05],
  [0.08, 0.15],
  [0.2, 0.215],
  [0.38, 0.235],
  [0.55, 0.215],
  [0.7, 0.165],
  [0.84, 0.11],
  [0.94, 0.065],
  [1, 0.045],
]

export function stomachRadius(u: number): number {
  const x = Math.min(1, Math.max(0, u))
  for (let i = 1; i < STOMACH_PROFILE.length; i++) {
    const [u1, r1] = STOMACH_PROFILE[i]!
    if (x <= u1) {
      const [u0, r0] = STOMACH_PROFILE[i - 1]!
      const k = (x - u0) / (u1 - u0)
      const s = k * k * (3 - 2 * k) // smoothstep between control points
      return r0 + (r1 - r0) * s
    }
  }
  return STOMACH_PROFILE[STOMACH_PROFILE.length - 1]![1]
}

/**
 * Duodenum curls in a C around the head of the pancreas, then the jejunum and ileum fold back
 * and forth in tight loops that fill the space framed by the large intestine.
 */
export const SMALL_INTESTINE = (() => {
  const pts: Vector3[] = [
    v(-0.02, 0.44, 0.1),
    v(-0.13, 0.4, 0.06),
    v(-0.21, 0.27, 0.02),
    v(-0.2, 0.12, 0.02),
    v(-0.08, 0.05, 0.04),
    v(0.08, 0.08, 0.04),
    v(0.2, 0.14, 0.06),
  ]
  // Rows of curling loops (prolate trochoids), each row running the other way, with loop size
  // and depth varying so the coils overlap like real jejunum and ileum.
  const bands = 5
  const loops = 5
  const stepsPerLoop = 10
  for (let b = 0; b < bands; b++) {
    const yc = -0.02 - b * 0.18
    const dir = b % 2 === 0 ? -1 : 1
    const halfWidth = 0.36 - 0.03 * Math.abs(b - 2)
    const total = loops * stepsPerLoop
    for (let k = 0; k <= total; k++) {
      // Irregular winding speed and loop size so the coils don't look machine-made.
      const th = (k / stepsPerLoop) * Math.PI * 2 + 0.9 * Math.sin(k * 0.21 + b * 2.3)
      const s = k / total
      const R = 0.058 + 0.02 * Math.sin(th * 0.37 + b * 1.3) + 0.012 * Math.sin(k * 0.53 + b)
      const x = dir * (halfWidth - 2 * halfWidth * s) + dir * R * Math.cos(th + Math.PI) * 0.95
      const y = yc + R * Math.sin(th + Math.PI) * (0.75 + 0.25 * Math.sin(k * 0.17 + b)) + 0.035 * Math.sin(s * Math.PI * 3 + b * 1.9)
      const z = 0.15 + 0.08 * Math.sin(th * 0.5 + b * 1.7) + 0.035 * Math.cos(th * 1.3)
      pts.push(v(x, y, z))
    }
  }
  pts.push(v(-0.34, -0.86, 0.12), v(-0.44, -0.86, 0.1), v(-0.5, -0.84, 0.1))
  return curve(pts, 0.5)
})()

/** Caecum → ascending → transverse (sagging) → descending → sigmoid → rectum → anal canal. */
export const LARGE_INTESTINE = curve([
  v(-0.5, -0.84, 0.1),
  v(-0.6, -0.92, 0.06),
  v(-0.66, -0.7, 0.03),
  v(-0.67, -0.2, 0.02),
  v(-0.64, 0.22, 0.04),
  v(-0.5, 0.32, 0.12),
  v(-0.26, 0.14, 0.26),
  v(0.0, 0.06, 0.3),
  v(0.28, 0.14, 0.26),
  v(0.56, 0.32, 0.08),
  v(0.7, 0.3, -0.02),
  v(0.72, -0.1, -0.02),
  v(0.68, -0.6, 0.02),
  v(0.56, -0.92, 0.08),
  v(0.3, -0.88, 0.2),
  v(0.12, -1.02, 0.14),
  v(0.03, -1.18, 0.0),
  v(0.0, -1.38, -0.04),
  v(0.0, -1.52, -0.04),
])

export const APPENDIX = curve([v(-0.6, -0.96, 0.07), v(-0.58, -1.07, 0.1), v(-0.52, -1.13, 0.12), v(-0.47, -1.12, 0.1)])

/** Pancreas: head inside the duodenal C, body behind the stomach, tail toward the spleen. */
export const PANCREAS = curve([v(-0.13, 0.22, 0.0), v(0.05, 0.3, -0.04), v(0.28, 0.38, -0.08), v(0.5, 0.5, -0.1), v(0.62, 0.6, -0.12)])

export const LIVER = { center: v(-0.22, 0.98, 0.04) }
export const GALLBLADDER = { center: v(-0.34, 0.66, 0.2) }
export const SPLEEN = { center: v(0.74, 0.74, -0.16) }

export const STAGE_LABEL_ANCHOR: Record<StageId, Vector3> = {
  mouth: MOUTH,
  esophagus: v(0, 1.75, -0.06),
  stomach: v(0.66, 0.82, 0.12),
  smallIntestine: v(0.05, -0.38, 0.26),
  largeIntestine: v(-0.72, -0.3, 0.04),
}

// ---------------------------------------------------------------------------------------------

/** Deterministic pseudo-random offset inside a tube cross-section. */
function jitter(seed: [number, number, number], radius: number, out: Vector3): Vector3 {
  const a = seed[0] * Math.PI * 2
  const r = Math.sqrt(seed[1]) * radius
  return out.set(Math.cos(a) * r, Math.sin(a) * r * 0.9, (seed[2] - 0.5) * radius * 1.1)
}

const tmp = new Vector3()

/** Swallowing takes a few seconds; stretch it so it is visible on the timeline. */
const SWALLOW_MIN = 0.6

/**
 * Where a particle is at time t (minutes), and how big it should be drawn (0 = hidden).
 * Writes into `out` to avoid allocating every frame.
 */
export function particlePosition(p: Particle, t: number, out: Vector3): number {
  const [s0, s1] = p.seed
  if (t < p.stomachIn - SWALLOW_MIN) {
    jitter(p.seed, 0.06, tmp)
    out.copy(MOUTH).add(tmp)
    return 1
  }
  if (t < p.stomachIn) {
    const u = Math.min(1, Math.max(0, (t - (p.stomachIn - SWALLOW_MIN)) / SWALLOW_MIN))
    if (u < 0.15) PHARYNX.getPointAt(u / 0.15, out)
    else ESOPHAGUS.getPointAt((u - 0.15) / 0.85, out)
    return 1
  }
  if (t < p.stomachOut) {
    // Churning: drift slowly through the stomach. Liquids pool lower, nearer the exit.
    const base = p.phase === 'liquid' ? 0.4 + 0.42 * s0 : 0.12 + 0.68 * s0
    const u = Math.min(0.9, Math.max(0.1, base + 0.05 * Math.sin(t * 0.08 + s1 * 6.28)))
    STOMACH.getPointAt(u, out)
    out.add(jitter(p.seed, stomachRadius(u) * 0.6, tmp))
    return 1
  }
  // Absorbed particles shrink away over a few minutes; before that they are full size.
  const fade = p.absorbedAt === null || t <= p.absorbedAt ? 1 : Math.max(0, 1 - (t - p.absorbedAt) / 6)
  if (fade <= 0) return 0
  if (t < p.colonIn) {
    const u = (t - p.stomachOut) / (p.colonIn - p.stomachOut)
    SMALL_INTESTINE.getPointAt(Math.min(1, u), out)
    out.add(jitter(p.seed, 0.025, tmp))
    return fade
  }
  if (t < p.colonOut) {
    const u = (t - p.colonIn) / (p.colonOut - p.colonIn)
    LARGE_INTESTINE.getPointAt(Math.min(1, u), out)
    out.add(jitter(p.seed, 0.045, tmp))
    return fade
  }
  return 0
}
