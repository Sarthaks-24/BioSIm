import { CatmullRomCurve3, Vector3 } from 'three'
import type { Particle, StageId } from '@biosim/engine'

/**
 * A stylized digestive tract, in scene units (≈ 1 unit = 20 cm). The body faces the viewer,
 * so the person's left (stomach, descending colon) is on the viewer's right (+x).
 * The same curves drive the 3D view and the flat 2D fallback.
 */

const v = (x: number, y: number, z: number) => new Vector3(x, y, z)

export const MOUTH = v(0, 2.62, 0.2)

export const ESOPHAGUS = new CatmullRomCurve3([v(0, 2.5, 0.1), v(0, 2.1, 0), v(0.02, 1.5, -0.02), v(0.1, 1.05, 0.02), v(0.2, 0.92, 0.08)])

/** Stomach centre line from the top (cardia) round the big curve to the exit (pylorus). */
export const STOMACH = new CatmullRomCurve3([
  v(0.2, 0.92, 0.08),
  v(0.42, 1.02, 0.1),
  v(0.58, 0.82, 0.12),
  v(0.55, 0.52, 0.14),
  v(0.36, 0.34, 0.16),
  v(0.14, 0.36, 0.16),
  v(0.0, 0.42, 0.14),
])

/** Radius of the stomach along its centre line (0 = cardia, 1 = pylorus). */
export function stomachRadius(u: number): number {
  const fundus = 0.2 * Math.sin(Math.min(1, u / 0.3) * Math.PI * 0.5)
  const body = 0.24 * Math.exp(-(((u - 0.4) / 0.3) ** 2))
  const antrum = 0.12 * (1 - u)
  return Math.max(0.045, Math.max(fundus, body) * (1 - 0.65 * Math.max(0, u - 0.55) / 0.45) + antrum * 0.2)
}

/** Duodenum C-loop, then coils of jejunum and ileum filling the middle of the abdomen. */
export const SMALL_INTESTINE = (() => {
  const pts: Vector3[] = [v(0.0, 0.42, 0.14), v(-0.12, 0.36, 0.1), v(-0.16, 0.18, 0.08), v(-0.02, 0.06, 0.1), v(0.18, 0.1, 0.12)]
  const rows = 6
  for (let r = 0; r < rows; r++) {
    const y = 0.02 - r * 0.15
    const dir = r % 2 === 0 ? 1 : -1
    for (let k = 0; k <= 4; k++) {
      const x = dir * (-0.38 + (0.76 * k) / 4)
      const z = 0.16 + 0.07 * Math.sin(k * 1.7 + r)
      pts.push(v(x, y - 0.03 * Math.sin(k * 2.1 + r), z))
    }
  }
  pts.push(v(-0.45, -0.9, 0.12), v(-0.55, -0.86, 0.1))
  return new CatmullRomCurve3(pts)
})()

/** Caecum → ascending → transverse → descending → sigmoid → rectum. */
export const LARGE_INTESTINE = new CatmullRomCurve3([
  v(-0.55, -0.86, 0.1),
  v(-0.62, -0.95, 0.06),
  v(-0.66, -0.5, 0.04),
  v(-0.66, 0.1, 0.04),
  v(-0.6, 0.3, 0.08),
  v(-0.3, 0.24, 0.2),
  v(0.0, 0.2, 0.24),
  v(0.3, 0.24, 0.2),
  v(0.62, 0.34, 0.06),
  v(0.68, 0.05, 0.02),
  v(0.66, -0.55, 0.02),
  v(0.5, -0.98, 0.06),
  v(0.15, -1.08, 0.08),
  v(0.02, -1.25, 0.0),
  v(0.0, -1.5, -0.02),
])

export const LIVER = { center: v(-0.38, 0.78, 0.12), scale: v(0.5, 0.26, 0.28) }
export const PANCREAS = { center: v(0.12, 0.47, -0.08), scale: v(0.32, 0.06, 0.06) }

export const STAGE_LABEL_ANCHOR: Record<StageId, Vector3> = {
  mouth: v(0, 2.62, 0.2),
  esophagus: v(0, 1.75, 0),
  stomach: v(0.62, 0.8, 0.12),
  smallIntestine: v(0.1, -0.35, 0.2),
  largeIntestine: v(-0.66, -0.3, 0.04),
}

// ---------------------------------------------------------------------------------------------

/** Deterministic pseudo-random offset inside a tube cross-section. */
function jitter(seed: [number, number, number], radius: number, out: Vector3): Vector3 {
  const a = seed[0] * Math.PI * 2
  const r = Math.sqrt(seed[1]) * radius
  return out.set(Math.cos(a) * r, Math.sin(a) * r * 0.9, (seed[2] - 0.5) * radius * 1.4)
}

const tmp = new Vector3()

/**
 * Where a particle is at time t (minutes), and how big it should be drawn (0 = hidden).
 * Writes into `out` to avoid allocating every frame.
 */
export function particlePosition(p: Particle, t: number, out: Vector3): number {
  const [s0, s1] = p.seed
  if (t < p.stomachIn - 0.6) {
    jitter(p.seed, 0.07, tmp)
    out.copy(MOUTH).add(tmp)
    return 1
  }
  if (t < p.stomachIn) {
    const u = Math.min(1, Math.max(0, (t - (p.stomachIn - 0.6)) / 0.6))
    ESOPHAGUS.getPointAt(u, out)
    return 1
  }
  if (t < p.stomachOut) {
    // Churning: drift slowly along the stomach. Liquids sit lower and nearer the exit.
    const base = p.phase === 'liquid' ? 0.35 + 0.45 * s0 : 0.08 + 0.7 * s0
    const u = Math.min(0.92, Math.max(0.04, base + 0.05 * Math.sin(t * 0.08 + s1 * 6.28)))
    STOMACH.getPointAt(u, out)
    out.add(jitter(p.seed, stomachRadius(u) * 0.7, tmp))
    return 1
  }
  const fade = p.absorbedAt === null ? 1 : Math.max(0, 1 - (t - p.absorbedAt) / 6)
  if (fade <= 0) return 0
  if (t < p.colonIn) {
    const u = (t - p.stomachOut) / (p.colonIn - p.stomachOut)
    SMALL_INTESTINE.getPointAt(Math.min(1, u), out)
    out.add(jitter(p.seed, 0.03, tmp))
    return fade
  }
  if (t < p.colonOut) {
    const u = (t - p.colonIn) / (p.colonOut - p.colonIn)
    LARGE_INTESTINE.getPointAt(Math.min(1, u), out)
    out.add(jitter(p.seed, 0.05, tmp))
    return fade
  }
  return 0
}
