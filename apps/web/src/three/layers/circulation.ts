import type { BufferGeometry, Color, Vector3 } from 'three'
import { valueAt, type RunResult, type Series } from '@lifepeek/engine'
import {
  APEX,
  ATRIA,
  ATRIA_ORIGIN,
  GUT,
  KIDNEYS,
  LABELS,
  LIVER,
  LUNGS,
  SEPTUM,
  VENTRICLES,
  VENTRICLE_ORIGIN,
  VESSELS,
  type Bed,
  type CirculationLabel,
  type Outline,
  type Vessel,
} from '../../anatomy/human/circulation.ts'
import { CIRCULATION_TONE } from '../../anatomy/tones/circulation.ts'
import { onTick } from '../../lib/ticker.ts'
import {
  GUT_MAX,
  GUT_REST_SHARE,
  LEGS_MAX,
  MUSCLE_REST_SHARE,
  atriaScale,
  beatRate,
  dashDensity,
  dashSpeed,
  restingOutput,
  seriesOf,
  squeezeOf,
  ventricleScale,
} from '../../systems/circulation/beat.ts'
import type { Part } from '../geometry.ts'
import type { Kit3d } from '../kit.ts'
import type { Layer3d, LayerState, OverlayProps, Tier } from '../layer.ts'

/**
 * Heart & blood's lit layer (A-5; anatomy plan §2.2, §3): the heart (two atria over the two
 * ventricles) and both loops of blood as tubes, built from the flat drawing's outlines and paths
 * (anatomy/human/circulation.ts) given depth, so front-on the 3D heart and vessels are the flat
 * ones. The lungs, liver, gut and kidneys are pale ghosts behind the vessels, as the flat drawing
 * paints them under its tubes. A lazy chunk, loaded the first time Heart & blood is lit on a device
 * with WebGL (R71; ≤ 20 KB gz, plan §8). It imports nothing of the 3D body: three.js and the
 * geometry kit come with `build` (three/kit.ts).
 *
 * Depth, as a book's figure of the heart and great vessels: the heart sits in the middle of the
 * chest, its right ventricle in front; the pulmonary trunk is the most forward vessel and splits
 * under the aortic arch; the arch runs from front to back and the aorta goes down behind the heart,
 * in front of the backbone; the venae cavae and the head and arm veins lie in front of the arteries
 * they run beside (the left arm vein crosses in front of the arch's branches; the left kidney vein
 * in front of the aorta). Each vertex of the heart carries its chamber (`chamber`: 1 right atrium,
 * 2 left atrium, 3 right ventricle, 4 left ventricle); the left ventricle is the fuller.
 *
 * The beat is the flat drawing's (systems/circulation/beat.ts, the one place data becomes a
 * picture): on the real clock at the model's beats a minute, at most 2.5 a second (above it the
 * chip says "animation slowed"), the atria squeeze, then the ventricles, each towards its own point
 * (`grow`), by the blood pushed out per beat. Size only: no colour ever changes with a beat (flash
 * safety, WCAG 2.3.1). The blood moves as pale dashes along the vessels' middles (Layer3d.dashes,
 * in the tissue shader, so the heart hides those behind it as the flat drawing's does): as fast as
 * the blood pumped a minute against resting, denser on the gut's vessels with the blood to the gut
 * and on the legs' with the blood to the muscles. Motion reduced: a still, relaxed heart, still
 * dashes and an arrow on each main vessel of both loops. Red and blue carry the colour key, "blue
 * is a convention: blood is always red".
 */

export const ORGANS = ['atria', 'ventricles', 'toBody', 'toLungs', 'toGut', 'toLegs', 'lungs', 'ghost'] as const
type Organ = (typeof ORGANS)[number]
const AT = Object.fromEntries(ORGANS.map((o, i) => [o, i])) as Record<Organ, number>

/** A vessel's organ: its bed (where its dashes take their density from). */
const BED: Record<Bed, Organ> = { body: 'toBody', lungs: 'toLungs', gut: 'toGut', legs: 'toLegs' }

const TONES: Record<Organ, string> = {
  atria: CIRCULATION_TONE.heart,
  ventricles: CIRCULATION_TONE.heart,
  // A vessel's colour is its blood's (`tint`), whatever its bed.
  toBody: CIRCULATION_TONE.rich,
  toLungs: CIRCULATION_TONE.rich,
  toGut: CIRCULATION_TONE.rich,
  toLegs: CIRCULATION_TONE.rich,
  lungs: CIRCULATION_TONE.lungs,
  ghost: CIRCULATION_TONE.ghost,
}

/** Mesh density by tier (anatomy plan §9: a 2 GB phone builds about half). */
const DETAIL = {
  high: { ventricles: [72, 48], atrium: [40, 28], ghost: [32, 20], kidney: [24, 14], radial: [12, 8], step: 0.035 },
  low: { ventricles: [44, 28], atrium: [24, 16], ghost: [24, 14], kidney: [14, 8], radial: [8, 6], step: 0.06 },
} as const

/**
 * Depth (scene z, + towards the viewer). `heart`: the ventricles' middle plane and how far their
 * front and back reach; the atria's centres and depths. `ghost`: the lungs, liver, gut and kidneys
 * sit behind every vessel (their front no nearer than −0.3), as the flat drawing paints them under
 * its tubes. The body's shell reaches about ±0.5 here.
 */
export const DEPTH = {
  heart: { mid: 0.02, front: 0.22, back: 0.2 },
  atria: [
    { cz: -0.03, rz: 0.12 },
    { cz: -0.1, rz: 0.11 },
  ],
  lungs: { mid: -0.4, front: 0.06, back: 0.05 },
  belly: { mid: -0.38, front: 0.07, back: 0.05 },
  kidneys: { cz: -0.33, rz: 0.06 },
} as const

/**
 * Each vessel's depth at each point of its flat path (VESSELS order of points, the blood's way).
 * Where it leaves the heart or a branch point, the same depth as the vessel it leaves.
 */
export const VESSEL_DEPTH: Readonly<Record<string, readonly number[]>> = {
  aorta: [0.02, 0.05, 0.0, -0.08, -0.17, -0.27, -0.3, -0.3, -0.28, -0.25, -0.22],
  neckL: [-0.08, -0.04, -0.02],
  neckR: [0.0, -0.02, -0.02],
  armL: [-0.13, -0.1, -0.06],
  armR: [0.0, -0.04, -0.06],
  kidneyArtL: [-0.28, -0.32],
  kidneyArtR: [-0.28, -0.32],
  gutArt: [-0.3, -0.16, -0.12, -0.12],
  gutTwigL: [-0.12, -0.12, -0.12],
  gutTwigR: [-0.12, -0.11, -0.12],
  legArtL: [-0.22, -0.16, -0.1, -0.06],
  legArtR: [-0.22, -0.16, -0.1, -0.06],
  legVeinL: [-0.1, -0.13, -0.19, -0.25],
  legVeinR: [-0.1, -0.13, -0.19, -0.25],
  ivc: [-0.25, -0.25, -0.23, -0.22, -0.2, -0.09],
  kidneyVeinL: [-0.32, -0.2, -0.22],
  kidneyVeinR: [-0.32, -0.23],
  portal: [-0.11, -0.16, -0.22, -0.3],
  hepatic: [-0.32, -0.25, -0.19],
  svcHead: [0.0, 0.02, 0.03],
  svcArmR: [0.0, 0.02, 0.03],
  svcArmL: [0.0, 0.05, 0.03],
  svc: [0.03, 0.02, -0.02],
  lungArt: [0.08, 0.08, 0.0],
  lungArtL: [0.0, -0.1, -0.34],
  lungArtR: [0.0, -0.1, -0.34],
  lungVeinL: [-0.34, -0.2, -0.12],
  lungVeinR: [-0.34, -0.22, -0.2, -0.13],
}

/** The legs' vessels stop here, inside the shell's lower edge (the 3D body has no legs yet; flat, they leave the picture). */
export const LEG_CUT = -1.68

/** A scene point (plain: three's Vector3 comes with the kit, at build). */
interface P3 {
  x: number
  y: number
  z: number
}
const v3 = (x: number, y: number, z: number): P3 => ({ x, y, z })
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}
const mixP = (a: P3, b: P3, t: number) => v3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t))

/**
 * A vessel's centre line: the flat drawing's curve (systems/circulation/drawing.tsx `vesselPath`:
 * quadratic curves through each inner point to the midpoint after it, the last to the end), with
 * depth, sampled by length. What a tube needs (geometry.ts Curve3). Points below `cut` are dropped.
 */
export class VesselPath {
  readonly pts: P3[] = []
  private at: number[] = []
  constructor(ctrl: readonly P3[], cut = -Infinity, per = 12) {
    const raw: P3[] = [ctrl[0]!]
    const n = ctrl.length
    if (n < 3) for (let k = 1; k <= per; k++) raw.push(mixP(ctrl[0]!, ctrl[1]!, k / per))
    let from = ctrl[0]!
    for (let i = 1; i < n - 1; i++) {
      const c = ctrl[i]!
      const end = i === n - 2 ? ctrl[n - 1]! : mixP(c, ctrl[i + 1]!, 0.5)
      for (let k = 1; k <= per; k++) {
        const t = k / per
        raw.push(mixP(mixP(from, c, t), mixP(c, end, t), t))
      }
      from = end
    }
    // Kept above the cut, ending (or starting) exactly on it.
    raw.forEach((p, i) => {
      const q = raw[i - 1]
      if (q && q.y >= cut !== p.y >= cut) this.pts.push(mixP(q, p, (cut - q.y) / (p.y - q.y)))
      if (p.y >= cut) this.pts.push(p)
    })
    this.pts.forEach((p, i) =>
      this.at.push(i ? this.at[i - 1]! + Math.hypot(p.x - this.pts[i - 1]!.x, p.y - this.pts[i - 1]!.y, p.z - this.pts[i - 1]!.z) : 0),
    )
  }
  getLength() {
    return this.at[this.at.length - 1]!
  }
  point(u: number): P3 {
    const s = Math.min(1, Math.max(0, u)) * this.getLength()
    let i = 1
    while (i < this.at.length - 1 && this.at[i]! < s) i++
    return mixP(this.pts[i - 1]!, this.pts[i]!, (s - this.at[i - 1]!) / (this.at[i]! - this.at[i - 1]! || 1))
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
}

/** A vessel's path in 3D: its flat points with their depths. */
export const vesselPath = (v: Vessel) =>
  new VesselPath(
    v.path.map(([x, y], i) => v3(x, y, VESSEL_DEPTH[v.id]![i]!)),
    v.bed === 'legs' ? LEG_CUT : -Infinity,
  )

/**
 * The closed outline as the flat drawing draws it (quadratic curves through the points' midpoints,
 * drawing.tsx `smooth`), as `per` points per point of the outline. (The 3D lungs have the same
 * helper; each lazy layer keeps its own, so neither loads the other.)
 */
export function smoothOutline(o: Outline, per = 8): [number, number][] {
  const out: [number, number][] = []
  const n = o.length
  for (let i = 0; i < n; i++) {
    const [p, c, q] = [o[(i - 1 + n) % n]!, o[i]!, o[(i + 1) % n]!]
    const a = [(p[0] + c[0]) / 2, (p[1] + c[1]) / 2]
    const b = [(c[0] + q[0]) / 2, (c[1] + q[1]) / 2]
    for (let k = 0; k < per; k++) {
      const t = k / per
      const [u, w, s] = [(1 - t) * (1 - t), 2 * (1 - t) * t, t * t]
      out.push([u * a[0]! + w * c[0] + s * b[0]!, u * a[1]! + w * c[1] + s * b[1]!])
    }
  }
  return out
}

/** Distances from `c` to the outline along each of `steps` directions (the outline is star-shaped from `c`). */
export function radialTable(pts: readonly (readonly [number, number])[], c: readonly [number, number], steps = 720): Float32Array {
  const out = new Float32Array(steps)
  for (let s = 0; s < steps; s++) {
    const th = (s / steps) * Math.PI * 2
    const [dx, dy] = [Math.cos(th), Math.sin(th)]
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i]!
      const [bx, by] = pts[(i + 1) % pts.length]!
      const [ex, ey] = [bx - ax, by - ay]
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-12) continue
      const t = ((ax - c[0]) * ey - (ay - c[1]) * ex) / den
      const u = ((ax - c[0]) * dy - (ay - c[1]) * dx) / den
      if (t > 0 && u >= 0 && u < 1) out[s] = Math.max(out[s]!, t)
    }
  }
  return out
}

const radiusAt = (table: Float32Array, th: number) => {
  const f = ((th / (Math.PI * 2)) * table.length + table.length) % table.length
  const i = Math.floor(f)
  return lerp(table[i]!, table[(i + 1) % table.length]!, f - i)
}

/**
 * A solid from a flat outline: a sculpted sphere whose front-on rim is the outline (star-shaped from
 * `c`), `depth` giving how far each rim-relative point reaches to the front (sign +) or back. The
 * sphere is turned so its poles face the viewer: (x, −z) spans the outline, y is the depth.
 */
function fromOutline(
  kit: Kit3d,
  outline: Outline,
  c: readonly [number, number],
  segments: readonly [number, number],
  depth: (x: number, y: number, d: number) => number,
): BufferGeometry {
  const table = radialTable(smoothOutline(outline), c)
  return kit.sculpt(new kit.SphereGeometry(1, segments[0], segments[1]), (v) => {
    const rho = Math.min(1, Math.hypot(v.x, v.z))
    const th = Math.atan2(-v.z, v.x)
    const r = radiusAt(table, th) * rho
    const x = c[0] + Math.cos(th) * r
    const y = c[1] + Math.sin(th) * r
    v.set(x, y, depth(x, y, v.y))
  })
}

/** The ventricles' centre front-on (their outline is star-shaped from it). */
export const VENTRICLES_CENTRE = [0.1, 1.18] as const

/** Signed distance (front-on) from the septum line: + on the left ventricle's side (the viewer's right). */
export function septumSide(x: number, y: number): number {
  let best = Infinity
  let sign = 1
  const last = SEPTUM.length - 2
  for (let i = 0; i <= last; i++) {
    const [ax, ay] = SEPTUM[i]!
    const [bx, by] = SEPTUM[i + 1]!
    const [dx, dy] = [bx - ax, by - ay]
    // The first and last stretches run on past their ends, so every point has a side.
    const k = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)
    const t = Math.min(i === last ? Infinity : 1, Math.max(i === 0 ? -Infinity : 0, k))
    const d = Math.hypot(x - (ax + dx * t), y - (ay + dy * t))
    if (d < best) {
      best = d
      sign = Math.sign(dx * (y - ay) - dy * (x - ax)) || 1
    }
  }
  return sign * best
}

/** How far from the ventricles' base (0) to the apex (1), front-on. */
const towardsApex = (x: number, y: number) => {
  const [bx, by] = [VENTRICLE_ORIGIN.x, 1.42]
  const [dx, dy] = [APEX.x - bx, APEX.y - by]
  return Math.min(1.2, Math.max(0, ((x - bx) * dx + (y - by) * dy) / (dx * dx + dy * dy)))
}

/** The grooves between the ventricles, front and back (0…1, 1 on the septum's line). */
const inGroove = (x: number, y: number) => Math.exp(-((septumSide(x, y) / 0.022) ** 2)) * (1 - smoothstep(0.85, 1.05, towardsApex(x, y)))

/**
 * The ventricles: the flat outline in depth, fullest near the base, narrowing to the apex; the left
 * ventricle (the viewer's right of the septum) the fuller, its wall the thicker; the groove between
 * them pressed in down the front and the back.
 */
function ventricles(tier: Tier, kit: Kit3d): Part<Organ> {
  const { mid, front, back } = DEPTH.heart
  return {
    organ: 'ventricles',
    inflate: () => 1,
    geo: fromOutline(kit, VENTRICLES, VENTRICLES_CENTRE, DETAIL[tier].ventricles, (x, y, d) => {
      const taper = 1 - 0.5 * smoothstep(0.3, 1.05, towardsApex(x, y))
      const fuller = 1 + 0.14 * smoothstep(-0.06, 0.16, septumSide(x, y))
      const z = Math.sign(d) * Math.pow(Math.abs(d), 0.62) * (d > 0 ? front : back) * taper * fuller
      return mid + z - Math.sign(d) * 0.016 * inGroove(x, y) * Math.min(1, Math.abs(d) * 3)
    }),
  }
}

/** One atrium: an ellipsoid round the flat ellipse, a little flatter where it sits on the ventricles. */
function atrium(i: 0 | 1, tier: Tier, kit: Kit3d): Part<Organ> {
  const a = ATRIA[i]
  const { cz, rz } = DEPTH.atria[i]
  const [w, h] = DETAIL[tier].atrium
  return {
    organ: 'atria',
    chamber: i + 1,
    inflate: () => 1,
    geo: kit.sculpt(new kit.SphereGeometry(1, w, h), (v) =>
      v.set(a.cx + v.x * a.rx, a.cy + v.y * a.ry, cz + v.z * rz * (v.y < 0 ? 0.85 : 1)),
    ),
  }
}

/** One vessel as a tube along its path; `along` is the distance from its start (scene units), for its dashes. */
function vessel(v: Vessel, tier: Tier, kit: Kit3d): Part<Organ> {
  const d = DETAIL[tier]
  const path = vesselPath(v)
  const length = path.getLength()
  const geo = kit.organTube(path, {
    segments: Math.max(3, Math.round(length / d.step)),
    radial: v.width >= 0.05 ? d.radial[0] : d.radial[1],
    radius: () => v.width / 2,
    caps: true,
  })
  const along = geo.getAttribute('along')
  for (let i = 0; i < along.count; i++) along.setX(i, along.getX(i) * length)
  const tone = CIRCULATION_TONE[v.blood]
  return { organ: BED[v.bed], geo, tint: (_u, _base, out) => out.set(tone) }
}

/** A pale ghost from a flat outline (the lungs, liver, gut): a shallow lens behind the vessels. */
function ghost(organ: Organ, outline: Outline, tier: Tier, kit: Kit3d, at: { mid: number; front: number; back: number }): Part<Organ> {
  let [cx, cy] = [0, 0]
  for (const [x, y] of outline) [cx, cy] = [cx + x / outline.length, cy + y / outline.length]
  const white = new kit.Color(1, 1, 1)
  return {
    organ,
    geo: fromOutline(
      kit,
      outline,
      [cx, cy],
      DETAIL[tier].ghost,
      (_x, _y, d) => at.mid + Math.sign(d) * Math.sqrt(Math.abs(d)) * (d > 0 ? at.front : at.back),
    ),
    tint: organ === 'lungs' ? (_u, base, out) => out.copy(base).lerp(white, 0.45) : undefined,
  }
}

/** The kidneys: small ghost ellipsoids at the back (the person's right one lower, as the flat). */
function kidney(i: 0 | 1, tier: Tier, kit: Kit3d): Part<Organ> {
  const k = KIDNEYS[i]
  const [w, h] = DETAIL[tier].kidney
  const { cz, rz } = DEPTH.kidneys
  return {
    organ: 'ghost',
    geo: kit.sculpt(new kit.SphereGeometry(1, w, h), (v) => v.set(k.cx + v.x * k.rx, k.cy + v.y * k.ry, cz + v.z * rz)),
  }
}

/**
 * Per vertex, after the parts are merged: the heart's chamber (the ventricles split by the
 * septum's line), the groove between the ventricles a shade darker, a faint grain on the muscle.
 * Colours are set once here; nothing in the heart changes colour after.
 */
function finish(geo: BufferGeometry, kit: Kit3d) {
  const pos = geo.getAttribute('position')
  const col = geo.getAttribute('color')
  const organ = geo.getAttribute('organ')
  const chamber = geo.getAttribute('chamber')
  const c: Color = new kit.Color()
  for (let i = 0; i < pos.count; i++) {
    const o = ORGANS[Math.round(organ.getX(i))]
    if (o !== 'ventricles' && o !== 'atria') continue
    const [x, y] = [pos.getX(i), pos.getY(i)]
    c.fromBufferAttribute(col, i)
    const grain = 0.97 + 0.03 * Math.sin(x * 37 + y * 11) * Math.sin(y * 45)
    if (o === 'ventricles') {
      chamber.setX(i, septumSide(x, y) < 0 ? 3 : 4)
      c.multiplyScalar(grain * (1 - 0.3 * inGroove(x, y)))
    } else c.multiplyScalar(grain * 1.06)
    col.setXYZ(i, c.r, c.g, c.b)
  }
}

function build(tier: Tier, kit: Kit3d): BufferGeometry {
  const parts: Part<Organ>[] = [
    ventricles(tier, kit),
    atrium(0, tier, kit),
    atrium(1, tier, kit),
    ...VESSELS.map((v) => vessel(v, tier, kit)),
    ghost('lungs', LUNGS[0]!, tier, kit, DEPTH.lungs),
    ghost('lungs', LUNGS[1]!, tier, kit, DEPTH.lungs),
    ghost('ghost', LIVER, tier, kit, DEPTH.belly),
    ghost('ghost', GUT, tier, kit, DEPTH.belly),
    kidney(0, tier, kit),
    kidney(1, tier, kit),
  ]
  const geo = kit.layerGeometry(parts, ORGANS, TONES)
  finish(geo, kit)
  return geo
}

/** The run's series the heart reads, and its resting output (the least pumped a minute; once per run). */
interface Blood {
  rate: Series
  stroke: Series
  output: Series
  gut: Series
  muscle: Series
  coRest: number
}
const runs = new WeakMap<RunResult, Blood | null>()
function blood(sim: RunResult): Blood | null {
  let b = runs.get(sim)
  if (b !== undefined) return b
  const [rate, stroke, output, gut, muscle] = [
    'heart.rate',
    'heart.strokeVolume',
    'heart.output',
    'blood.flow.gut',
    'blood.flow.muscle',
  ].map((id) => seriesOf(sim, id))
  b = rate && stroke && output && gut && muscle ? { rate, stroke, output, gut, muscle, coRest: restingOutput(output) } : null
  runs.set(sim, b)
  return b
}

/** What the picture shows at meal-clock minute `t`: the beat's drawn rate and squeeze, the dashes' speed and densities. */
function look(sim: RunResult, t: number) {
  const b = blood(sim)
  if (!b) return { hz: 0, squeeze: 0, speed: 1, gut: 1, legs: 1 }
  const at = (s: Series) => valueAt(s, t, sim.stepMin)
  return {
    hz: beatRate(at(b.rate)).hz,
    squeeze: squeezeOf(at(b.stroke)),
    speed: dashSpeed(at(b.output), b.coRest),
    gut: dashDensity(at(b.gut), GUT_REST_SHARE * b.coRest * 1000, GUT_MAX),
    legs: dashDensity(at(b.muscle), MUSCLE_REST_SHARE * b.coRest * 1000, LEGS_MAX),
  }
}

/** The dashes' speed at rest (scene units a second; the flat heart's 36 px a second at its usual scale). */
export const DASH_SPEED = 0.33

/**
 * How far the dashes have moved (scene units) and at what speed (against resting, the last frame's).
 * Moved by the rhythm's ticker, so nothing moves with motion reduced. Wrapped now and then to keep
 * the shader's numbers small (a step of a dash's pattern once in a long while).
 */
const flow = { offset: 0, speed: 1 }
const WRAP = 2000

function write(out: LayerState, sim: RunResult, t: number, phase: number) {
  const l = look(sim, t)
  flow.speed = l.speed
  out.fill[AT.atria] = atriaScale(phase, l.squeeze) - 1
  out.fill[AT.ventricles] = ventricleScale(phase, l.squeeze) - 1
  out.state.fill(0)
  out.state[AT.lungs] = out.state[AT.ghost] = -1
  out.dash.fill(0)
  out.dash[AT.toBody] = out.dash[AT.toLungs] = 1
  out.dash[AT.toGut] = l.gut
  out.dash[AT.toLegs] = l.legs
  out.flow.fill(flow.offset)
}

/** The labels, most needed first (as the flat layer's). */
const LABEL_KEYS: readonly CirculationLabel[] = ['heart', 'aorta', 'venaCava', 'legs', 'pulmonaryArtery', 'pulmonaryVein']

/**
 * The labels' places in 3D: the flat ones (anatomy/human/circulation.ts LABELS) with their dots on
 * the vessel or the heart's front in depth; the legs' dot on the leg artery above where it stops.
 */
const LABELS_3D: Record<CirculationLabel, (typeof LABELS)[CirculationLabel]> = {
  heart: { ...LABELS.heart, anchor: v3(0.24, 1.12, 0.21) },
  aorta: { ...LABELS.aorta, anchor: v3(0.12, 1.93, -0.04) },
  venaCava: { ...LABELS.venaCava, anchor: v3(-0.12, 0.4, -0.23) },
  pulmonaryArtery: { ...LABELS.pulmonaryArtery, anchor: v3(-0.4, 1.73, -0.18) },
  pulmonaryVein: { ...LABELS.pulmonaryVein, anchor: v3(0.46, 1.42, -0.22) },
  legs: { ...LABELS.legs, anchor: v3(0.33, -1.55, -0.1) },
}

/**
 * Where each main vessel's still arrow sits (motion reduced): the middle of the flat path's middle
 * stretch, as the flat drawing's, but the aorta's below the heart (the flat one is hidden behind
 * the heart; an arrow over the 3D picture would not be).
 */
const ARROW_AT: Readonly<Record<string, number>> = { aorta: 7 }

const SVG = 'http://www.w3.org/2000/svg'
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, parent?: Element) => {
  const e = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  parent?.appendChild(e)
  return e
}

/**
 * Over the 3D heart: the colour key (red, blue, "blue is a convention", as the flat drawing's,
 * bottom left beside the body) and, with motion reduced, an arrow on each main vessel of both loops,
 * the way its blood goes. Moved with the picture each frame it draws.
 */
function heartOverlay(host: HTMLElement, { reduced, t, register }: OverlayProps) {
  const key = document.createElement('div')
  key.dataset.bloodKey = ''
  key.className =
    'absolute flex flex-col gap-0.5 rounded-control bg-surface-raised/85 px-1.5 py-0.5 text-caption leading-tight text-ink-muted'
  Object.assign(key.style, { left: '4px', bottom: '4px', maxWidth: '184px' })
  const row = document.createElement('span')
  row.className = 'flex flex-wrap gap-x-2'
  for (const b of ['rich', 'poor'] as const) {
    const item = document.createElement('span')
    item.className = 'inline-flex items-center gap-1 whitespace-nowrap text-ink'
    const swatch = document.createElement('span')
    swatch.setAttribute('aria-hidden', 'true')
    swatch.className = 'inline-block rounded-full'
    Object.assign(swatch.style, { width: '14px', height: '4px', background: CIRCULATION_TONE[b] })
    item.append(swatch, t(`sys.circulation.key.${b}`))
    row.append(item)
  }
  const caption = document.createElement('span')
  caption.textContent = t('sys.circulation.key.convention')
  key.append(row, caption)
  host.append(key)

  const arrows = reduced ? VESSELS.filter((v) => v.arrow) : []
  const root = el('svg', { 'aria-hidden': 'true', class: 'pointer-events-none absolute inset-0 h-full w-full overflow-visible' })
  const group = el(
    'g',
    { 'data-arrows': '', fill: 'none', stroke: '#14213d', 'stroke-width': '1.75', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    root,
  )
  const paths = arrows.map(() => el('path', {}, group))
  if (reduced) host.append(root)
  // The last thing written, so a frame whose camera has not moved writes nothing.
  const drawn: string[] = []
  const write = (i: number, d: string) => {
    if (drawn[i] !== d) paths[i]!.setAttribute('d', (drawn[i] = d))
  }
  let keyWidth = ''
  const stop = register((project, width, height) => {
    // Beside the hips, never over the body's outline (its widest, ±0.95 units: as the flat drawing's).
    const edge = project(v3(-0.95, 0, 0))
    const w = `${Math.round(Math.min(184, Math.max(112, (edge?.[0] ?? 120) - 8)))}px`
    if (w !== keyWidth) key.style.maxWidth = keyWidth = w
    arrows.forEach((v, i) => {
      const k = ARROW_AT[v.id] ?? Math.floor((v.path.length - 1) / 2)
      const z = VESSEL_DEPTH[v.id]!
      const [a, b] = [v.path[k]!, v.path[k + 1]!]
      const p0 = project(v3(a[0], a[1], z[k]!))
      const p1 = project(v3(b[0], b[1], z[k + 1]!))
      const mid = project(v3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (z[k]! + z[k + 1]!) / 2))
      const side = project(v3((a[0] + b[0]) / 2 + 0.07, (a[1] + b[1]) / 2, (z[k]! + z[k + 1]!) / 2))
      if (!p0 || !p1 || !mid || !side || mid[0] < 0 || mid[1] < 0 || mid[0] > width || mid[1] > height) return write(i, '')
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1
      const [ux, uy] = [(p1[0] - p0[0]) / len, (p1[1] - p0[1]) / len]
      const s = Math.max(5, Math.hypot(side[0] - mid[0], side[1] - mid[1]))
      const back = (n: 1 | -1) => `${(mid[0] - ux * s - uy * s * 0.7 * n).toFixed(1)} ${(mid[1] - uy * s + ux * s * 0.7 * n).toFixed(1)}`
      write(i, `M${back(1)}L${mid[0].toFixed(1)} ${mid[1].toFixed(1)}L${back(-1)}`)
    })
  })
  return () => {
    stop()
    key.remove()
    root.remove()
  }
}

/** The ventricles' and atria's points: each squeezes towards its own (as the flat drawing's layers), in the heart's middle plane. */
const ORIGINS = ORGANS.map((o) =>
  o === 'atria'
    ? ([ATRIA_ORIGIN.x, ATRIA_ORIGIN.y, DEPTH.heart.mid] as const)
    : o === 'ventricles'
      ? ([VENTRICLE_ORIGIN.x, VENTRICLE_ORIGIN.y, DEPTH.heart.mid] as const)
      : ([0, 0, 0] as const),
)

const HEART_3D: Layer3d = {
  id: 'circulation',
  organs: ORGANS,
  build,
  write,
  // The flat heart's framing (U-3): hips to head, so the legs' vessels and their dashes show.
  framing: 'torso',
  food: false,
  grow: { origins: ORIGINS },
  dashes: true,
  rhythm: {
    hz: (sim, t) => look(sim, t).hz,
    // A still heart is relaxed: full size (as the flat drawing's).
    still: 0,
    onTick: (tick) =>
      onTick((dt) => {
        flow.offset = (flow.offset + DASH_SPEED * flow.speed * dt) % WRAP
        tick(dt)
      }),
    probe: (sim, t, phase, reduced) => {
      const l = look(sim, t)
      return {
        beat: reduced ? 'still' : 'moving',
        beatHz: l.hz.toFixed(2),
        ventricleScale: ventricleScale(phase, l.squeeze).toFixed(3),
        // The beat's squeeze at its strongest (its share of the ventricles' size): what a sample of the size can miss.
        squeeze: l.squeeze.toFixed(3),
        dashGut: String(l.gut),
        dashLegs: String(l.legs),
        dashSpeed: l.speed.toFixed(2),
      }
    },
  },
  labels: {
    table: LABELS_3D,
    specs: (t, width, height) =>
      LABEL_KEYS.map((key, i) => ({
        key,
        text: t(`sys.circulation.label.${key}`),
        tone: i ? ('stage' as const) : ('active' as const),
        hidden: (height < 260 && i > 2) || (width < 640 && i > 3),
      })),
  },
  overlay: heartOverlay,
}
export default HEART_3D
