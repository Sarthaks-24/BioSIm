/**
 * The little vector and curve maths the anatomy needs, without three.js.
 *
 * The flat body, the organ labels and the particle paths run on every device before the 3D body
 * loads (if it loads at all). Taking `Vector3` and `CatmullRomCurve3` from three.js pulled about
 * 13 KB (gzip) of three's maths into the first download of the simulator pages. This file does
 * the same sums in the same order, so every point is bit-for-bit what three.js gives
 * (spline.test.ts checks each anatomy curve against three's own). The 3D body passes its own
 * `Vector3`s as `out`: they have the same shape.
 */

/** A point in scene units (anatomy/human.ts). three.js's `Vector3` has this shape too. */
export interface XYZ {
  x: number
  y: number
  z: number
}

/** A point the curves can write into: ours (`Vec3`) or three.js's `Vector3`. */
export interface Writable extends XYZ {
  set(x: number, y: number, z: number): unknown
}

export class Vec3 implements Writable {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}

  set(x: number, y: number, z: number): this {
    this.x = x
    this.y = y
    this.z = z
    return this
  }
}

/** Cubic through x1 (s = 0) and x2 (s = 1) with Catmull–Rom tangents (three's CubicPoly). */
function catmullRom(x0: number, x1: number, x2: number, x3: number, tension: number, s: number): number {
  const t0 = tension * (x2 - x0)
  const t1 = tension * (x3 - x1)
  const c2 = -3 * x1 + 3 * x2 - 2 * t0 - t1
  const c3 = 2 * x1 - 2 * x2 + t0 + t1
  const s2 = s * s
  const s3 = s2 * s
  return x1 + t0 * s + c2 * s2 + c3 * s3
}

/** Samples along the curve for the arc-length table (three's default `arcLengthDivisions`). */
const DIVISIONS = 200
/** Step either side of t for the tangent (three's `Curve.getTangent`). */
const DELTA = 0.0001

/**
 * An open, uniform Catmull–Rom spline through `points` (three's `CatmullRomCurve3` with
 * `curveType 'catmullrom'`). `getPoint(t)` follows the control points evenly; `getPointAt(u)`
 * moves at an even speed along the curve's length.
 */
export class Spline3 {
  private lengths: Float64Array | null = null

  constructor(
    readonly points: readonly XYZ[],
    readonly tension = 0.5,
  ) {}

  getPoint<T extends Writable = Vec3>(t: number, out?: T): T {
    const target = out ?? (new Vec3() as unknown as T)
    const pts = this.points
    const l = pts.length
    const p = (l - 1) * t
    let i = Math.floor(p)
    let w = p - i
    if (w === 0 && i === l - 1) {
      i = l - 2
      w = 1
    }
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    // Past either end, a control point mirrored through the end point (as three.js does).
    const a = pts[0]!
    const b = pts[1]!
    const y = pts[l - 1]!
    const z = pts[l - 2]!
    const p0 = i > 0 ? pts[i - 1]! : { x: a.x - b.x + a.x, y: a.y - b.y + a.y, z: a.z - b.z + a.z }
    const p3 = i + 2 < l ? pts[i + 2]! : { x: y.x - z.x + y.x, y: y.y - z.y + y.y, z: y.z - z.z + y.z }
    const k = this.tension
    target.set(catmullRom(p0.x, p1.x, p2.x, p3.x, k, w), catmullRom(p0.y, p1.y, p2.y, p3.y, k, w), catmullRom(p0.z, p1.z, p2.z, p3.z, k, w))
    return target
  }

  /** Cumulative length at DIVISIONS + 1 even steps of t, computed once. */
  private arcLengths(): Float64Array {
    if (this.lengths) return this.lengths
    const out = new Float64Array(DIVISIONS + 1)
    const last = this.getPoint(0)
    const current = new Vec3()
    let sum = 0
    for (let n = 1; n <= DIVISIONS; n++) {
      this.getPoint(n / DIVISIONS, current)
      const dx = current.x - last.x
      const dy = current.y - last.y
      const dz = current.z - last.z
      sum += Math.sqrt(dx * dx + dy * dy + dz * dz)
      out[n] = sum
      last.set(current.x, current.y, current.z)
    }
    this.lengths = out
    return out
  }

  /** The t at which a share u of the curve's length has been travelled (three's getUtoTmapping). */
  private tAt(u: number): number {
    const lengths = this.arcLengths()
    const il = lengths.length
    const target = u * lengths[il - 1]!
    let low = 0
    let high = il - 1
    while (low <= high) {
      const i = Math.floor(low + (high - low) / 2)
      const c = lengths[i]! - target
      if (c < 0) low = i + 1
      else if (c > 0) high = i - 1
      else {
        high = i
        break
      }
    }
    const i = high
    if (lengths[i] === target) return i / (il - 1)
    const before = lengths[i]!
    return (i + (target - before) / (lengths[i + 1]! - before)) / (il - 1)
  }

  getPointAt<T extends Writable = Vec3>(u: number, out?: T): T {
    return this.getPoint(this.tAt(u), out)
  }

  /** Unit tangent at a share u of the length. */
  getTangentAt<T extends Writable = Vec3>(u: number, out?: T): T {
    const t = this.tAt(u)
    const a = this.getPoint(Math.max(0, t - DELTA), tmpA)
    const b = this.getPoint(Math.min(1, t + DELTA), tmpB)
    const x = b.x - a.x
    const y = b.y - a.y
    const z = b.z - a.z
    const inv = 1 / (Math.sqrt(x * x + y * y + z * z) || 1)
    const target = out ?? (new Vec3() as unknown as T)
    target.set(x * inv, y * inv, z * inv)
    return target
  }
}

const tmpA = new Vec3()
const tmpB = new Vec3()
