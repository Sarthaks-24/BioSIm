import type { BufferGeometry, Color, Vector3 } from 'three'
import { valueAt, type RunResult } from '@lifepeek/engine'
import {
  BRONCHI,
  DEPTH,
  DIAPHRAGM,
  DIAPHRAGM_THICK,
  FOOD_PIPE,
  LABELS,
  LEFT_LUNG,
  LUNG_BASE,
  LUNG_TOP,
  NASAL,
  RIGHT_LUNG,
  WINDPIPE,
  type BreathingLabel,
  type Outline,
} from '../../anatomy/human/breathing.ts'
import { BREATHING_TONE } from '../../anatomy/tones/breathing.ts'
import { onTick } from '../../lib/ticker.ts'
import { STILL_BREATH, breathRate, breathingIn, fillAt, lungScale, seriesOf } from '../../systems/breathing/breath.ts'
import type { Part } from '../geometry.ts'
import type { Kit3d } from '../kit.ts'
import type { Layer3d, LayerState, OverlayProps, Tier } from '../layer.ts'

/**
 * Breathing's lit layer (A-3; anatomy plan §2.1, §3): the nasal passage, the windpipe with its rings,
 * the bronchi, both lungs and the diaphragm's dome, with the food pipe as a pale ghost behind the
 * windpipe. Built from the flat drawing's outlines (anatomy/human/breathing.ts), given depth
 * (`DEPTH`), so the 3D lungs and the flat ones are the same shape front-on. A lazy chunk, loaded the
 * first time Breathing is lit on a device with WebGL (R71; ≤ 20 KB gz, plan §8).
 *
 * Shape cues a student can name: the right lung (viewer's left) has two fissures, so three lobes; the
 * left has one, so two lobes, and the heart's notch. The left lung is shown cut open down the front,
 * as a book's figure shows it, so the bronchi branch on its cut face. The diaphragm is a dome under
 * each lung, muscle round a pale central tendon.
 *
 * Breathing moves only the size, as the flat drawing does (systems/breathing/breath.ts, the one
 * place data becomes a picture): the lungs and their bronchi grow from the lungs' top by
 * `lungScale` (the model's air per breath at the meal-clock minute on screen), and the diaphragm, the
 * main cue, goes down with their base. The phase runs on the
 * real clock at the model's breaths a minute, at most 0.8 a second; with motion reduced it stands
 * half breathed in. No colour ever changes with a breath (flash safety, WCAG 2.3.1).
 *
 * It imports nothing of the 3D body: three.js and the geometry kit come with `build` (three/kit.ts).
 */

export const ORGANS = ['airway', 'bronchi', 'lungs', 'diaphragm', 'foodPipe'] as const
type Organ = (typeof ORGANS)[number]

const TONES: Record<Organ, string> = {
  airway: BREATHING_TONE.airway,
  bronchi: BREATHING_TONE.airway,
  lungs: BREATHING_TONE.lungs,
  diaphragm: BREATHING_TONE.diaphragm,
  foodPipe: BREATHING_TONE.ghost,
}

const AT = Object.fromEntries(ORGANS.map((o, i) => [o, i])) as Record<Organ, number>

/** Mesh density by tier (anatomy plan §9: a 2 GB phone builds about half). */
const DETAIL = {
  high: { lung: [96, 64], dome: [72, 28], radial: 16, twig: 8, groove: 0.022 },
  low: { lung: [56, 36], dome: [40, 16], radial: 10, twig: 6, groove: 0.034 },
} as const

/** A scene point (plain: three's Vector3 comes with the kit, at build). */
interface P3 {
  x: number
  y: number
  z: number
}
const v3 = (x: number, y: number, z: number): P3 => ({ x, y, z })
const dist = (a: P3, b: P3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/**
 * A smooth curve through the points (Catmull–Rom, as the anatomy's), sampled by length: what a tube
 * needs (geometry.ts Curve3), written out with plain numbers.
 */
class Path {
  private pts: P3[] = []
  private at: number[] = [0]
  constructor(ctrl: readonly P3[], samples = 64) {
    const n = ctrl.length - 1
    const p = (i: number) => ctrl[Math.max(0, Math.min(n, i))]!
    for (let k = 0; k <= samples; k++) {
      const t = (k / samples) * n
      const i = Math.min(n - 1, Math.floor(t))
      const w = t - i
      const [a, b, c, d] = [p(i - 1), p(i), p(i + 1), p(i + 2)]
      const f = (x0: number, x1: number, x2: number, x3: number) => {
        const t1 = (x2 - x0) * 0.5
        const t2 = (x3 - x1) * 0.5
        return (2 * x1 - 2 * x2 + t1 + t2) * w ** 3 + (-3 * x1 + 3 * x2 - 2 * t1 - t2) * w * w + t1 * w + x1
      }
      this.pts.push(v3(f(a.x, b.x, c.x, d.x), f(a.y, b.y, c.y, d.y), f(a.z, b.z, c.z, d.z)))
      if (k) this.at.push(this.at[k - 1]! + dist(this.pts[k]!, this.pts[k - 1]!))
    }
  }
  getLength() {
    return this.at[this.at.length - 1]!
  }
  point(u: number): P3 {
    const s = Math.min(1, Math.max(0, u)) * this.getLength()
    let i = 1
    while (i < this.at.length - 1 && this.at[i]! < s) i++
    const k = (s - this.at[i - 1]!) / (this.at[i]! - this.at[i - 1]! || 1)
    const [a, b] = [this.pts[i - 1]!, this.pts[i]!]
    return v3(lerp(a.x, b.x, k), lerp(a.y, b.y, k), lerp(a.z, b.z, k))
  }
  getPointAt(u: number, out: Vector3) {
    const p = this.point(u)
    return out.set(p.x, p.y, p.z)
  }
  getTangentAt(u: number, out: Vector3) {
    const a = this.point(Math.max(0, u - 0.002))
    const b = this.point(Math.min(1, u + 0.002))
    return out.set(b.x - a.x, b.y - a.y, b.z - a.z).normalize()
  }
  getSpacedPoints(n: number) {
    return Array.from({ length: n + 1 }, (_, i) => this.point(i / n))
  }
}
const curve = (pts: P3[]) => new Path(pts)
const mid = (a: readonly [number, number], b: readonly [number, number]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const

/**
 * The closed outline as the flat drawing draws it (quadratic curves through the points' midpoints,
 * systems/breathing/drawing.tsx `smooth`), as `per` points per point of the outline.
 */
export function smoothOutline(o: Outline, per = 8): [number, number][] {
  const out: [number, number][] = []
  const n = o.length
  for (let i = 0; i < n; i++) {
    const a = mid(o[(i - 1 + n) % n]!, o[i]!)
    const c = o[i]!
    const b = mid(o[i]!, o[(i + 1) % n]!)
    for (let k = 0; k < per; k++) {
      const t = k / per
      const [p, q, r] = [(1 - t) * (1 - t), 2 * (1 - t) * t, t * t]
      out.push([p * a[0] + q * c[0] + r * b[0], p * a[1] + q * c[1] + r * b[1]])
    }
  }
  return out
}

/** Distances from `c` to the outline along each of `steps` directions (the outline is star-shaped from `c`). */
export function radialTable(pts: readonly (readonly [number, number])[], c: readonly [number, number], steps = 720): Float32Array {
  const out = new Float32Array(steps)
  for (let s = 0; s < steps; s++) {
    const th = (s / steps) * Math.PI * 2
    const dx = Math.cos(th)
    const dy = Math.sin(th)
    let best = 0
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i]!
      const [bx, by] = pts[(i + 1) % pts.length]!
      const ex = bx - ax
      const ey = by - ay
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-12) continue
      const t = ((ax - c[0]) * ey - (ay - c[1]) * ex) / den
      const u = ((ax - c[0]) * dy - (ay - c[1]) * dx) / den
      if (t > 0 && u >= 0 && u < 1) best = Math.max(best, t)
    }
    out[s] = best
  }
  return out
}

const radiusAt = (table: Float32Array, th: number) => {
  const f = ((th / (Math.PI * 2)) * table.length + table.length) % table.length
  const i = Math.floor(f)
  return lerp(table[i]!, table[(i + 1) % table.length]!, f - i)
}

/** A point is inside the outline (even-odd rule). */
function inside(pts: readonly (readonly [number, number])[], x: number, y: number) {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]!
    const [xj, yj] = pts[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** The diaphragm's upper edge front-on (the flat outline), at x. */
function domeEdge(x: number) {
  const d = DIAPHRAGM
  if (x <= d[0]![0]) return d[0]![1]
  for (let i = 1; i < d.length; i++) {
    const [x1, y1] = d[i]!
    const [x0, y0] = d[i - 1]!
    if (x <= x1) {
      const k = smoothstep(0, 1, (x - x0) / (x1 - x0))
      return lerp(y0, y1, k)
    }
  }
  return d[d.length - 1]![1]
}

/** Front (+1) to back (−1) across the diaphragm at depth z. */
const domeDepth = (z: number) => (z >= 0 ? z / DEPTH.diaphragm.front : z / DEPTH.diaphragm.back)

/**
 * The diaphragm's upper surface at (x, z): the flat outline along the middle; to the front and the
 * back it comes down to the rib margin, which rises to the breastbone in the middle (the arch under
 * the ribs, an upside-down V front-on). The back is drawn no lower than the front, so the view under
 * the front arch meets the front, not the dome's underside.
 */
export function domeTop(x: number, z: number) {
  const n = Math.max(-1, Math.min(1, domeDepth(z)))
  const side = Math.min(1, Math.abs(x) / 0.88)
  return domeEdge(x) - (0.07 + 0.19 * side * side) * n * n
}

/** The 3D lungs' centres front-on (each outline is star-shaped from its own). */
const CENTRE = { right: [-0.47, 1.45], left: [0.52, 1.45] } as const

/**
 * Lobes (anatomy): both lungs' oblique fissure, high at the back and low at the front (signed distance
 * `oblique`); the right lung's horizontal one (`horizontal`), only in front of and above the oblique.
 */
function fissures(x: number, y: number, z: number, side: number) {
  const lateral = Math.min(1, Math.max(0, (side * x - 0.12) / 0.68))
  const oblique = y - 1.38 - 0.22 * lateral + (z - DEPTH.lungs.mid)
  const upper = side < 0 ? smoothstep(0, 0.06, oblique) * smoothstep(DEPTH.lungs.mid - 0.15, DEPTH.lungs.mid, z) : 0
  return { oblique, horizontal: y - 1.52, upper }
}

/** How much a vertex lies in a fissure (0…1), with fissure half-width `w`. */
const inFissure = (f: ReturnType<typeof fissures>, w: number) =>
  Math.max(Math.exp(-((f.oblique / w) ** 2)), f.upper * Math.exp(-((f.horizontal / w) ** 2)))

/**
 * One lung, from its flat outline: a sculpted sphere whose front-on rim is the outline, deeper at
 * the back and the outer side than at the thin front-inner edge, its base wrapped down over the dome,
 * with its fissures as soft grooves. The left lung is cut flat at `DEPTH.lungs.cut`.
 */
function buildLung(outline: Outline, side: -1 | 1, tier: Tier, kit: Kit3d): BufferGeometry {
  const d = DETAIL[tier]
  const pts = smoothOutline(outline)
  const c = side < 0 ? CENTRE.right : CENTRE.left
  const table = radialTable(pts, c)
  const { mid, front, back, cut } = DEPTH.lungs
  const w = d.groove
  return kit.sculpt(new kit.SphereGeometry(1, d.lung[0], d.lung[1]), (v) => {
    // The sphere turned so its poles face the viewer and away: (v.x, −v.z) spans the outline, v.y is depth.
    const X = v.x
    const Y = -v.z
    const rho = Math.min(1, Math.hypot(X, Y))
    const th = Math.atan2(Y, X)
    const r = radiusAt(table, th) * rho
    let x = c[0] + Math.cos(th) * r
    let y = c[1] + Math.sin(th) * r
    const lateral = Math.min(1, Math.max(0, (side * x - 0.12) / 0.68))
    // Fuller towards the outer side (the ribs' curve), a thinner edge in front of the heart; a narrower apex.
    const e = lerp(0.78, 0.55, lateral)
    const apex = 1 - 0.35 * smoothstep(1.7, 2.05, y)
    const depth = Math.sign(v.y) * Math.pow(Math.abs(v.y), e) * apex
    let z = mid + depth * (v.y > 0 ? front * (0.55 + 0.45 * lateral) : back * (0.75 + 0.25 * lateral))
    // The base follows the dome down at the front and the back (the recesses round the diaphragm).
    y -= Math.min(0.07, domeTop(x, 0) - domeTop(x, z)) * (1 - smoothstep(LUNG_BASE - 0.05, LUNG_BASE + 0.45, y))
    // Fissures: a soft groove, pressed in towards the lung's core.
    const g = inFissure(fissures(x, y, z, side), w)
    if (g > 0.01) {
      const ox = (x - c[0]) * 0.4
      const oy = (y - c[1]) * 0.4
      const oz = z - mid
      const len = Math.hypot(ox, oy, oz) || 1
      const k = 0.024 * g
      x -= (ox / len) * k
      y -= (oy / len) * k
      z -= (oz / len) * k
    }
    if (side > 0) z = Math.min(z, cut)
    v.set(x, y, z)
  })
}

/** A vertex of the left lung's cut face (tinted in `finish`). */
const isCutFace = (x: number, z: number, nz: number) => x > 0.05 && z > DEPTH.lungs.cut - 1e-4 && nz > 0.9

/** One airway tube along `pts`, `r` its radius; `tip`: a rounded free end (a bronchus that branches no more). */
function airTube(kit: Kit3d, pts: P3[], r: number, radial: number, tip = false) {
  const path = curve(pts)
  return kit.organTube(path, {
    segments: Math.max(4, Math.round(path.getLength() / 0.03)),
    radial,
    radius: (u) => r * (tip && u > 0.8 ? Math.sqrt(Math.max(0.05, 1 - ((u - 0.8) / 0.2) ** 2)) : 1),
    caps: true,
  })
}

/** The direction from a to b. */
const unit = (a: P3, b: P3) => {
  const l = dist(a, b) || 1
  return v3((b.x - a.x) / l, (b.y - a.y) / l, (b.z - a.z) / l)
}

/**
 * The bronchi: the flat drawing's two levels (the main bronchi and their first branches), then, in
 * the cut left lung where they show, three more levels, each pair at ±30° and 0.6 of their parent's
 * length, kept inside the lung. In the whole right lung only the first two levels are built (they
 * are hidden inside it).
 */
function bronchi(tier: Tier, kit: Kit3d): Part<Organ>[] {
  const d = DETAIL[tier]
  const parts: Part<Organ>[] = []
  const zOf = (side: number, r: number) => (side < 0 ? -0.02 : DEPTH.lungs.cut + 0.25 * r)
  const leftLung = smoothOutline(LEFT_LUNG, 4)
  BRONCHI.forEach((b, i) => {
    const side = Math.sign(b.path[b.path.length - 1]![0])
    const r = b.width / 2
    const main = i < 2
    const pts = b.path.map(([x, y], k) => v3(x, y, main ? lerp(DEPTH.windpipe, zOf(side, r), k / (b.path.length - 1)) : zOf(side, r)))
    parts.push({ organ: 'bronchi', geo: airTube(kit, pts, r, main ? d.radial : d.twig, side < 0 && !main) })
    if (main || side < 0) return
    // Smaller branches on the cut face.
    const grow = (from: P3, dir: P3, len: number, rr: number, level: number) => {
      for (const turn of [-0.52, 0.52]) {
        const a = Math.atan2(dir.y, dir.x) + turn
        let l = len
        let end = v3(from.x + Math.cos(a) * l, from.y + Math.sin(a) * l, zOf(1, rr))
        for (let k = 0; k < 3 && !inside(leftLung, end.x, end.y); k++) {
          l /= 2
          end = v3(from.x + Math.cos(a) * l, from.y + Math.sin(a) * l, zOf(1, rr))
        }
        if (!inside(leftLung, end.x, end.y)) continue
        // A slight bend, away from the parent's line.
        const bend = v3((from.x + end.x) / 2 - Math.sin(a) * turn * 0.06 * l, (from.y + end.y) / 2 + Math.cos(a) * turn * 0.06 * l, end.z)
        const start = v3(from.x, from.y, zOf(1, rr))
        const last = level === 5
        parts.push({ organ: 'bronchi', geo: airTube(kit, [start, bend, end], rr, d.twig, last) })
        if (!last) grow(end, unit(start, end), l * 0.6, rr * 0.74, level + 1)
      }
    }
    const end = pts[pts.length - 1]!
    const start = pts[pts.length - 2]!
    grow(end, unit(start, end), dist(end, start) * 0.6, r * 0.74, 3)
  })
  return parts
}

/** The windpipe: the larynx's bulge at the top, C-shaped rings of cartilage (bumps) down the front. */
function windpipe(tier: Tier, kit: Kit3d): Part<Organ> {
  const white = new kit.Color(1, 1, 1)
  const length = WINDPIPE.top - WINDPIPE.split
  const ring = (u: number) => Math.pow(0.5 + 0.5 * Math.cos(((u * length - 0.06) / 0.09) * 2 * Math.PI), 3)
  return {
    organ: 'airway',
    geo: kit.organTube(curve([v3(0, WINDPIPE.top, DEPTH.windpipe), v3(0, WINDPIPE.split, DEPTH.windpipe)]), {
      segments: tier === 'high' ? 72 : 40,
      radial: DETAIL[tier].radial,
      radius: (u) => (WINDPIPE.width / 2) * (1 + 0.3 * (1 - smoothstep(0, 0.14, u))),
      // The rings stand out at the front and sides; the back wall (muscle, sin a < 0) is flatter.
      shape: (u, a) => (Math.sin(a) > -0.4 ? 1 + 0.08 * ring(u) : 1 - 0.12 * Math.abs(Math.sin(a))),
      caps: 'end',
    }),
    tint: (u, base, out) => out.copy(base).lerp(white, 0.28 * ring(u)),
  }
}

/** The nasal passage: in at the nose, back over the palate, down the throat to the voice box (front-on, the flat line). */
function nasal(tier: Tier, kit: Kit3d): Part<Organ> {
  const [top] = NASAL
  return {
    organ: 'airway',
    geo: kit.organTube(
      curve([v3(0, top![1] - 0.12, 0.33), v3(0, top![1], 0.2), v3(0, 2.84, -0.04), v3(0, 2.6, -0.06), v3(0, WINDPIPE.top, DEPTH.windpipe)]),
      { segments: tier === 'high' ? 48 : 28, radial: DETAIL[tier].radial, radius: () => 0.034, caps: 'start' },
    ),
  }
}

/** The food pipe, a ghost behind the windpipe (Digestion draws it; here it only gives a bearing). */
function foodPipe(tier: Tier, kit: Kit3d): Part<Organ> {
  return {
    organ: 'foodPipe',
    geo: kit.organTube(curve(FOOD_PIPE.map(([x, y]) => v3(x, y, DEPTH.foodPipe))), {
      segments: 32,
      radial: DETAIL[tier].twig,
      radius: () => 0.033,
      caps: true,
    }),
  }
}

/**
 * The diaphragm: a sheet of muscle, its upper edge front-on the flat outline (the right dome higher),
 * lower towards the front and lowest at the back, its rim turning down to the ribs.
 */
function diaphragm(tier: Tier, kit: Kit3d): Part<Organ> {
  const [ws, hs] = DETAIL[tier].dome
  const T = DIAPHRAGM_THICK
  return {
    organ: 'diaphragm',
    geo: kit.sculpt(new kit.SphereGeometry(1, ws, hs), (v) => {
      const r = Math.min(1, Math.hypot(v.x, v.z))
      const x = v.x * 0.88
      const z = v.z * (v.z > 0 ? DEPTH.diaphragm.front : DEPTH.diaphragm.back)
      // At the sides the rim turns down to the lower ribs.
      const skirt = 0.1 * smoothstep(0.72, 1, r) ** 2 * Math.abs(v.x)
      const y = domeTop(x, z) - skirt - T / 2 + Math.sign(v.y) * Math.pow(Math.abs(v.y), 0.35) * (T / 2)
      v.set(x, y, z)
    }),
  }
}

/**
 * Colour and movement that depend on where a vertex is (after the parts are merged): the lungs'
 * fissure lines, cut face and a faint lobular grain; the diaphragm's central tendon and muscle fibres;
 * how much each vertex grows with a breath (`inflate`: the lungs, bronchi and diaphragm wholly, the
 * main bronchi less near the windpipe, where they stay joined to it).
 */
function finish(geo: BufferGeometry, tier: Tier, kit: Kit3d) {
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const col = geo.getAttribute('color')
  const organ = geo.getAttribute('organ')
  const inflate = geo.getAttribute('inflate')
  const c: Color = new kit.Color()
  const white = new kit.Color(1, 1, 1)
  const w = DETAIL[tier].groove
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)]
    c.fromBufferAttribute(col, i)
    let grow = 0
    switch (ORGANS[Math.round(organ.getX(i))]) {
      case 'lungs': {
        grow = 1
        const side = x < 0 ? -1 : 1
        const cutFace = side > 0 && isCutFace(x, z, nor.getZ(i))
        const grain = 0.965 + 0.035 * Math.sin(x * 43) * Math.sin(y * 41)
        c.multiplyScalar(grain * (cutFace ? 0.86 : 1) * (1 - 0.42 * inFissure(fissures(x, y, z, side), w * 1.1)))
        break
      }
      case 'bronchi':
        // The main bronchi stay joined to the windpipe at the split.
        grow = smoothstep(0, 0.2, Math.hypot(x, y - WINDPIPE.split))
        break
      case 'diaphragm': {
        const dx = x / 0.88
        const dz = domeDepth(z)
        // The whole dome goes down with the lungs' base, as the flat drawing's (a pinned rim would
        // turn the shallow dome inside out on a deep breath).
        grow = 1
        // The central tendon: a pale trefoil in the middle, a little to the front.
        const a = Math.atan2(dz - 0.12, dx)
        const tendon = 1 - smoothstep(0.24, 0.36, Math.hypot(dx, (dz - 0.12) * 1.25) / (1 + 0.18 * Math.cos(3 * a + Math.PI / 2)))
        c.lerp(white, 0.14 * tendon).multiplyScalar(1 - 0.07 * (1 - tendon) * (0.5 + 0.5 * Math.cos(Math.atan2(dz, dx) * 44)))
        break
      }
    }
    col.setXYZ(i, c.r, c.g, c.b)
    inflate.setX(i, grow)
  }
}

function build(tier: Tier, kit: Kit3d): BufferGeometry {
  const parts: Part<Organ>[] = [
    nasal(tier, kit),
    windpipe(tier, kit),
    ...bronchi(tier, kit),
    { organ: 'lungs', geo: buildLung(RIGHT_LUNG, -1, tier, kit) },
    { organ: 'lungs', geo: buildLung(LEFT_LUNG, 1, tier, kit) },
    diaphragm(tier, kit),
    foodPipe(tier, kit),
  ]
  const geo = kit.layerGeometry(parts, ORGANS, TONES)
  finish(geo, tier, kit)
  return geo
}

/** The run's breaths a minute and air per breath, at meal-clock minute `t`. */
function breath(sim: RunResult, t: number) {
  const rate = seriesOf(sim, 'lungs.breathRate')
  const tidal = seriesOf(sim, 'lungs.tidalVolume')
  return {
    hz: rate ? breathRate(valueAt(rate, t, sim.stepMin)).hz : 0,
    tidal: tidal ? valueAt(tidal, t, sim.stepMin) : 0,
  }
}

/** The lungs' drawn size at this phase (1 = breathed out): systems/breathing/breath.ts, as the flat drawing. */
const scaleAt = (sim: RunResult, t: number, phase: number) => lungScale(breath(sim, t).tidal, fillAt(phase))

function write(out: LayerState, sim: RunResult, t: number, phase: number) {
  const extra = scaleAt(sim, t, phase) - 1
  out.fill[AT.lungs] = extra
  out.fill[AT.bronchi] = extra
  out.fill[AT.diaphragm] = extra
  out.state.fill(0)
}

/** The labels, most needed first: a short picture (a phone's) names only the lungs and the diaphragm (as the flat layer). */
const LABEL_KEYS: readonly BreathingLabel[] = ['lungs', 'diaphragm', 'trachea', 'nasal']

/**
 * The air's path drawn as dashes (as the flat drawing's): nose to the split, and the two main bronchi
 * as far as they show (the right one goes into its lung at the first bend; the left lung is cut open).
 */
const AIR: readonly P3[][] = [
  [
    ...curve([v3(0, NASAL[0]![1], 0.24), v3(0, 2.62, 0.08), v3(0, WINDPIPE.top, DEPTH.windpipe + 0.05)]).getSpacedPoints(10),
    v3(0, WINDPIPE.split, DEPTH.windpipe + 0.05),
  ],
  BRONCHI[0]!.path.slice(0, 2).map(([x, y]) => v3(x, y, DEPTH.windpipe)),
  BRONCHI[1]!.path.map(([x, y], k) => v3(x, y, lerp(DEPTH.windpipe, DEPTH.lungs.cut + 0.03, k / 2))),
]

const SVG = 'http://www.w3.org/2000/svg'
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, parent?: Element) => {
  const el = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  parent?.appendChild(el)
  return el
}

/**
 * Over the 3D lungs: the air as dashes, running down while breathing in and up while breathing out,
 * faster with faster breaths (as the flat drawing's, ≤ 20 moves a second); with motion reduced, two
 * still arrows beside the windpipe instead (in, out). Moved with the picture each frame it draws.
 */
function airOverlay(host: HTMLElement, { reduced, rhythm, register }: OverlayProps) {
  const root = svg('svg', { 'aria-hidden': 'true', class: 'pointer-events-none absolute inset-0 h-full w-full overflow-visible' })
  const look = { fill: 'none', stroke: BREATHING_TONE.air, 'stroke-width': '2', 'stroke-linecap': 'round' }
  const group = svg(
    'g',
    reduced ? { 'data-arrows': '', ...look, 'stroke-linejoin': 'round' } : { ...look, 'stroke-dasharray': '2 7' },
    root,
  )
  const paths = (reduced ? [0, 1] : AIR).map(() => svg('path', {}, group))
  // Each path's last drawing: a frame whose camera has not moved writes nothing (no SVG re-layout).
  const drawn: string[] = []
  const draw = (i: number, d: string) => {
    if (drawn[i] === d) return
    drawn[i] = d
    paths[i]!.setAttribute('d', d)
  }
  host.appendChild(root)
  let dash = 0
  let last = performance.now()
  let since = 0
  const stop = register((project) => {
    if (reduced) {
      const at = (x: number, down: boolean, i: number) => {
        const c = project(v3(x, 2.05, DEPTH.windpipe))
        const up = project(v3(x, 2.11, DEPTH.windpipe))
        if (!c || !up) return
        const s = Math.max(6, Math.hypot(up[0] - c[0], up[1] - c[1]))
        const [cx, cy] = c
        const tip = down ? cy + s : cy - s
        const wing = down ? cy + s * 0.3 : cy - s * 0.3
        draw(i, `M${cx} ${cy - s}V${cy + s}M${cx - s * 0.6} ${wing}L${cx} ${tip}L${cx + s * 0.6} ${wing}`)
      }
      at(-0.16, true, 0)
      at(0.16, false, 1)
      return
    }
    AIR.forEach((pts, i) => {
      const xy = pts.map((p) => project(p))
      if (xy.every(Boolean)) draw(i, xy.map((p, k) => `${k ? 'L' : 'M'}${p![0].toFixed(1)} ${p![1].toFixed(1)}`).join(''))
    })
    const now = performance.now()
    since += Math.min(0.25, (now - last) / 1000)
    last = now
    if (since >= 0.05) {
      dash += (breathingIn(rhythm.phase) ? -1 : 1) * 120 * rhythm.hz * since
      since = 0
      group.style.strokeDashoffset = dash.toFixed(1)
    }
  })
  return () => {
    stop()
    root.remove()
  }
}

/** The labels' places (anatomy/human/breathing.ts LABELS); the diaphragm's dot on its front slope, which shows in 3D under the lungs. */
const LABELS_3D = { ...LABELS, diaphragm: { ...LABELS.diaphragm, anchor: v3(0.5, domeTop(0.5, 0.42) + 0.01, 0.42) } }

const LUNGS_3D: Layer3d = {
  id: 'breathing',
  organs: ORGANS,
  build,
  write,
  framing: 'chest',
  food: false,
  // The ribs and backbone for a bearing, as the flat drawing has its ribs (A-1a skeleton ghost).
  landmarks: true,
  // Everything that grows, grows from the lungs' top, as the flat drawing's rhythm layer does.
  grow: { origins: ORGANS.map(() => [LUNG_TOP.x, LUNG_TOP.y, LUNG_TOP.z] as const) },
  rhythm: {
    hz: (sim, t) => breath(sim, t).hz,
    still: STILL_BREATH,
    onTick: (tick) => onTick((dt) => tick(dt)),
    probe: (sim, t, phase, reduced) => ({
      breath: reduced ? 'still' : 'moving',
      breathHz: breath(sim, t).hz.toFixed(2),
      lungScale: scaleAt(sim, t, phase).toFixed(3),
    }),
  },
  labels: {
    table: LABELS_3D,
    specs: (t, _width, height) =>
      LABEL_KEYS.map((key, i) => ({
        key,
        text: t(`sys.breathing.label.${key}`),
        tone: i ? ('stage' as const) : ('active' as const),
        hidden: height < 260 && i > 1,
      })),
  },
  overlay: airOverlay,
}
export default LUNGS_3D
