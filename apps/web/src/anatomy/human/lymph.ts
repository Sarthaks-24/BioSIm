import type { Writable } from '../spline.ts'
import { v } from './base.ts'

/**
 * Lymph & germ defence (the `lymph` pack; anatomy plan §2.7). The spleen lives here, not in the
 * skin shell (A-0): it is not a digestive organ in NCERT, so the body no longer draws it as a ghost
 * with digestion, and the lymph map (A-11a) draws it lit. Scene units as in base.ts: the spleen is
 * on the person's left (+x), behind the stomach, under the ribs.
 */

/** The spleen: its centre and half-sizes (a bean about 12 cm tall). */
export const SPLEEN = { center: v(0.74, 0.74, -0.16), rx: 0.07, ry: 0.15, rz: 0.06 }

/**
 * A point of the spleen's surface from a point of the unit sphere: the bean is concave on the side
 * facing the stomach (−x). The 3D layer (A-10) sculpts a sphere with it; the flat map samples it.
 */
export function spleenPoint(unit: { x: number; y: number; z: number }, out: Writable): Writable {
  const dent = unit.x < 0 ? 1 - 0.35 * Math.exp(-(unit.y * unit.y) / 0.2) : 1
  const { center: c, rx, ry, rz } = SPLEEN
  out.set(c.x + unit.x * rx * dent, c.y + unit.y * ry, c.z + unit.z * rz)
  return out
}
