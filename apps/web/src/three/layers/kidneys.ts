import type { BufferGeometry, Color, Vector3 } from 'three'
import { valueAt, type RunResult, type Series } from '@lifepeek/engine'
import {
  AORTA,
  BLADDER_BASE,
  BLADDER_MAX_ML,
  KIDNEY,
  LABELS,
  RIBS,
  URETHRA,
  VENA_CAVA,
  bladderRadius,
  hilum,
  kidneyOutline,
  renalArtery,
  renalVein,
  ureter,
  type KidneyLabel,
  type Outline,
} from '../../anatomy/human/kidneys.ts'
import { KIDNEY_TONE } from '../../anatomy/tones/kidneys.ts'
import { levelGate } from '../../flat/drives.ts'
import { onTick } from '../../lib/ticker.ts'
import { BLADDER_BOUNDS, EASE_MS, EMPTIES_ML, URGE_ML, seriesOf, stepMl, ureterSpeed } from '../../systems/kidneys/water.ts'
import type { Part } from '../geometry.ts'
import type { Kit3d } from '../kit.ts'
import type { Layer3d, LayerState, OverlayProps, Tier } from '../layer.ts'

/**
 * Kidneys & water's lit layer (A-6; anatomy plan §2.3): the flat drawing (systems/kidneys/drawing.tsx)
 * given depth, from the same outlines and paths (anatomy/human/kidneys.ts), so front-on the 3D
 * kidneys, vessels, ureters and bladder are the flat ones, in the same `torso` framing. A lazy chunk,
 * loaded the first time Kidneys & water is lit on a device with WebGL (R71; ≤ 20 KB gz, plan §8). It
 * imports nothing of the 3D body: three.js and the geometry kit come with `build` (three/kit.ts).
 *
 * Depth, as a book's figure of the urinary system: the kidneys lie at the back of the belly either
 * side of the backbone, the person's right one lower, each turned so its notch (hilum) faces
 * forward and in, the upper pole a little further back, the lowest ribs behind them. The aorta and
 * the vena cava run down in front of the backbone; the left kidney's vein crosses in front of the
 * aorta, the right kidney's artery behind the vena cava. Each ureter leaves its notch from a small
 * funnel (the renal pelvis), runs down in front of the back muscles, over the brim of the pelvis
 * and back into it, into the back of the bladder, which sits low in the middle behind the pubic bone.
 *
 * The bladder is the flat drawing's rule (one place: systems/kidneys/water.ts): it grows with the
 * cube root of the urine in it, upwards from its base (`grow`, uFill = its size against 300 mL,
 * less 1), its volume drawn in 25 mL steps through flat/drives.ts `levelGate` (half a step past a
 * boundary, at most once a real second, however fast the clock is played or dragged), each change
 * eased over 200 ms (a cut with motion reduced); never drawn above 600 mL. The gauge beside it, with
 * its marks at 150 mL (starts to feel full) and 300 mL (empties), is the overlay's. Drops of urine run
 * down the ureters in pulses as dark dashes in the tissue shader (Layer3d.dashes), faster when more
 * urine is made (`ureterSpeed`), on the real clock. Nothing changes colour. Motion reduced: no drops,
 * a still arrow down each ureter.
 */

export const ORGANS = ['kidneys', 'ureters', 'bladder', 'urethra', 'artery', 'vein', 'ribs'] as const
type Organ = (typeof ORGANS)[number]
const AT = Object.fromEntries(ORGANS.map((o, i) => [o, i])) as Record<Organ, number>

/** The lowest ribs: the skin's outline colour as the flat drawing's, a faded ghost (state −1) here. */
const RIB_TONE = '#a3adc0'

const TONES: Record<Organ, string> = {
  kidneys: KIDNEY_TONE.kidney,
  ureters: KIDNEY_TONE.ureter,
  bladder: KIDNEY_TONE.bladder,
  urethra: KIDNEY_TONE.ureter,
  artery: KIDNEY_TONE.artery,
  vein: KIDNEY_TONE.vein,
  ribs: RIB_TONE,
}

/** Mesh density by tier (anatomy plan §9: a 2 GB phone builds about half). */
const DETAIL = {
  high: { kidney: [64, 40], bladder: [48, 32], radial: [12, 10], rib: 6, step: 0.03 },
  low: { kidney: [36, 22], bladder: [28, 18], radial: [8, 6], rib: 5, step: 0.06 },
} as const

/**
 * Depth (scene z, + towards the viewer). `kidney`: each kidney's middle plane at its centre and its
 * half-thickness (≈ 3.5 cm thick); `bladder`: its middle plane; `ribs`: the lowest ribs' depth where
 * they leave the backbone, at their bend and at their front ends (behind the kidneys, as the flat
 * drawing paints them under the kidneys). The body's shell reaches about ±0.4 here.
 */
export const DEPTH = {
  kidney: { cz: -0.18, rz: 0.09 },
  bladder: 0,
  ribs: [-0.37, -0.36, -0.08],
} as const

/** The tubes' widths (scene units), the flat drawing's; the ureters a little wider, so their drops show on a phone. */
export const WIDTH = { artery: 0.035, vein: 0.04, ureter: 0.04, urethra: 0.035, rib: 0.016 } as const

/** The aorta's depth down its length: in front of the backbone, which comes forward in the low back. */
export function aortaZ(y: number): number {
  const pts = [
    [1.0, -0.225],
    [0.4, -0.19],
    [-0.3, -0.07],
  ] as const
  if (y >= pts[1][0]) return lerp(pts[1][1], pts[0][1], (y - pts[1][0]) / (pts[0][0] - pts[1][0]))
  return lerp(pts[2][1], pts[1][1], (y - pts[2][0]) / (pts[1][0] - pts[2][0]))
}
/** The vena cava lies a little in front of the aorta. */
export const venaCavaZ = (y: number) => aortaZ(y) + 0.03

/** A side's kidney centre (1 = the person's left, +x; −1 = the right, lower). */
const centreOf = (side: 1 | -1) => {
  const h = hilum(side)
  return [side * KIDNEY.x, h.y] as const
}

/**
 * A kidney's middle plane at (x, y): turned so its inner edge (towards the backbone) comes forward
 * and its upper pole goes back a little.
 */
export function kidneyZ(side: 1 | -1, x: number, y: number): number {
  const [cx, cy] = centreOf(side)
  return DEPTH.kidney.cz + 0.035 * ((side * (cx - x)) / 0.15) - 0.02 * ((y - cy) / 0.28)
}

/** Where the vessels and the ureter enter a kidney: the notch's middle, in its middle plane. */
export function hilum3d(side: 1 | -1): P3 {
  const h = hilum(side)
  return v3(h.x, h.y, kidneyZ(side, h.x, h.y))
}

/** A scene point (plain: three's Vector3 comes with the kit, at build). */
export interface P3 {
  x: number
  y: number
  z: number
}
const v3 = (x: number, y: number, z: number): P3 => ({ x, y, z })
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const mixP = (a: P3, b: P3, t: number) => v3(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t))

/**
 * A tube's centre line through its points: quadratic curves through each inner point to the
 * midpoint after it, the last to the end (as the flat drawings' curves), sampled by length. What a
 * tube needs (geometry.ts Curve3). (The 3D heart has the same helper; each lazy layer keeps its own.)
 */
export class TubePath {
  readonly pts: P3[] = []
  private at: number[] = []
  constructor(ctrl: readonly P3[], per = 12) {
    const n = ctrl.length
    this.pts.push(ctrl[0]!)
    if (n < 3) for (let k = 1; k <= per; k++) this.pts.push(mixP(ctrl[0]!, ctrl[1]!, k / per))
    let from = ctrl[0]!
    for (let i = 1; i < n - 1; i++) {
      const c = ctrl[i]!
      const end = i === n - 2 ? ctrl[n - 1]! : mixP(c, ctrl[i + 1]!, 0.5)
      for (let k = 1; k <= per; k++) {
        const t = k / per
        this.pts.push(mixP(mixP(from, c, t), mixP(c, end, t), t))
      }
      from = end
    }
    this.pts.forEach((p, i) => {
      const q = this.pts[i - 1]
      this.at.push(q ? this.at[i - 1]! + Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) : 0)
    })
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
  /** The point on the path at height `y` (the first from its start), or its end. */
  atHeight(y: number): { p: P3; u: number } {
    for (let i = 1; i < this.pts.length; i++) {
      const [a, b] = [this.pts[i - 1]!, this.pts[i]!]
      if ((a.y - y) * (b.y - y) <= 0 && a.y !== b.y) {
        const k = (y - a.y) / (b.y - a.y)
        return { p: mixP(a, b, k), u: lerp(this.at[i - 1]!, this.at[i]!, k) / this.getLength() }
      }
    }
    return { p: this.pts[this.pts.length - 1]!, u: 1 }
  }
}

/** A flat path ([x, y] points) with a depth per point. */
const inDepth = (path: Outline, z: readonly number[]) => path.map(([x, y], i) => v3(x, y, z[i]!))

/** Inside a kidney, beyond its notch: where its vessels and ureter start or end (hidden in it, no cap shows). */
const inside = (side: 1 | -1, dy: number) => {
  const h = hilum3d(side)
  return v3(side * (KIDNEY.x - 0.02), h.y + dy, h.z)
}

/** A side's renal artery: the flat path (aorta to the notch) in depth; the right one passes behind the vena cava. */
export function renalArtery3d(side: 1 | -1): TubePath {
  const flat = renalArtery(side)
  const y = flat[0]![1]
  return new TubePath([...inDepth(flat, [aortaZ(y), side < 0 ? -0.32 : aortaZ(y), hilum3d(side).z]), inside(side, 0.02)])
}

/** A side's renal vein: the flat path (the notch to the vena cava) in depth; the left one crosses in front of the aorta. */
export function renalVein3d(side: 1 | -1): TubePath {
  const flat = renalVein(side)
  const y = flat[2]![1]
  return new TubePath([inside(side, -0.01), ...inDepth(flat, [hilum3d(side).z, side > 0 ? -0.04 : venaCavaZ(y) + 0.01, venaCavaZ(y)])])
}

/** The aorta and the vena cava, from above the kidneys to where they split for the legs (as the flat drawing's). */
export const trunk3d = (v: typeof AORTA, z: (y: number) => number) =>
  new TubePath([v3(v.x, v.top, z(v.top)), v3(v.x, (v.top + v.bottom) / 2, z((v.top + v.bottom) / 2)), v3(v.x, v.bottom, z(v.bottom))])

/** The bladder's middle plane and its base: it grows upwards from here (the flat drawing's). */
export const BLADDER_AT = v3(BLADDER_BASE.x, BLADDER_BASE.y, DEPTH.bladder)

/** Each ureter's depth at each point of its flat path: out of the notch, forward over the back muscles, over the brim of the pelvis and back into it, then forward into the bladder's back. */
export const URETER_DEPTH = [0.01, -0.11, -0.1, -0.12, -0.2, DEPTH.bladder - 0.06] as const

/** A side's ureter: the flat path in depth, from inside the kidney. */
export function ureter3d(side: 1 | -1): TubePath {
  const z = URETER_DEPTH.map((d, i) => (i ? d : hilum3d(side).z + d))
  return new TubePath([inside(side, -0.03), ...inDepth(ureter(side), z)])
}

/** The urethra: from inside the bladder's neck down, a little forward (the flat drawing's line). */
export const URETHRA_3D = new TubePath([
  v3(URETHRA[0]![0], URETHRA[0]![1] + 0.03, BLADDER_AT.z),
  v3(URETHRA[1]![0], (URETHRA[0]![1] + URETHRA[1]![1]) / 2, BLADDER_AT.z + 0.02),
  v3(URETHRA[1]![0], URETHRA[1]![1], BLADDER_AT.z + 0.05),
])

/** A side's lowest rib: the flat drawing's three points (a quadratic curve), from the backbone round to the side. */
export const rib3d = (rib: Outline, side: 1 | -1) => new TubePath(rib.map(([x, y], i) => v3(side * x, y, DEPTH.ribs[i]!)))

/**
 * The closed outline as the flat drawing draws it (quadratic curves through the points' midpoints,
 * drawing.tsx `smooth`), as `per` points per point of the outline.
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

/** Distances from `c` to the outline along each of `steps` directions (the outermost crossing). */
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
 * A kidney: a sculpted sphere whose front-on rim is the flat bean (its poles face the viewer), full
 * and rounded, thinner round the notch where the vessels go in, in its turned middle plane; a shade
 * darker towards the notch and a faint grain, set once (nothing changes colour after).
 */
function kidney(side: 1 | -1, tier: Tier, kit: Kit3d): Part<Organ> {
  const c = centreOf(side)
  const notch = [side * (KIDNEY.x - 0.05), c[1]] as const
  const table = radialTable(smoothOutline(kidneyOutline(side)), c)
  const near = (x: number, y: number) => Math.exp(-((Math.hypot(x - notch[0], y - notch[1]) / 0.08) ** 2))
  const [w, h] = DETAIL[tier].kidney
  const geo = kit.sculpt(new kit.SphereGeometry(1, w, h), (v) => {
    const rho = Math.min(1, Math.hypot(v.x, v.z))
    const th = Math.atan2(-v.z, v.x)
    const r = radiusAt(table, th) * rho
    const x = c[0] + Math.cos(th) * r
    const y = c[1] + Math.sin(th) * r
    const d = v.y
    v.set(x, y, kidneyZ(side, x, y) + Math.sign(d) * Math.pow(Math.abs(d), 0.6) * DEPTH.kidney.rz * (1 - 0.55 * near(x, y)))
  })
  return { organ: 'kidneys', geo }
}

/** Per vertex, after the merge: the kidneys a shade darker into the notch, with a faint grain. */
function finish(geo: BufferGeometry, kit: Kit3d) {
  const pos = geo.getAttribute('position')
  const col = geo.getAttribute('color')
  const organ = geo.getAttribute('organ')
  const c: Color = new kit.Color()
  for (let i = 0; i < pos.count; i++) {
    if (organ.getX(i) !== AT.kidneys) continue
    const [x, y] = [pos.getX(i), pos.getY(i)]
    const side = x > 0 ? 1 : -1
    const h = hilum(side)
    const notch = Math.exp(-((Math.hypot(x - h.x, y - h.y) / 0.1) ** 2))
    const grain = 0.97 + 0.03 * Math.sin(x * 41 + y * 13) * Math.sin(y * 53)
    c.fromBufferAttribute(col, i).multiplyScalar(grain * (1 - 0.22 * notch))
    col.setXYZ(i, c.r, c.g, c.b)
  }
}

/** The bladder's size it is built at (300 mL, where it empties); uFill scales it from there. */
export const BLADDER_R0 = bladderRadius(EMPTIES_ML)

/** The drawn bladder's size for `ml` against the built one (the flat drawing's scale): never above 600 mL. */
export const bladderScale = (ml: number) => bladderRadius(Math.min(BLADDER_MAX_ML, ml)) / BLADDER_R0

/**
 * The bladder at 300 mL: a bag 1.1 times as wide as tall (the flat ellipse), a little flatter
 * underneath, narrowing into a short neck at its lowest point, which sits on the base (BLADDER_AT):
 * it grows from there (`grow`), so it fills upwards as the flat one does.
 */
function bladder(tier: Tier, kit: Kit3d): Part<Organ> {
  const [w, h] = DETAIL[tier].bladder
  const NECK = 0.16
  const lowest = -(0.92 + NECK)
  const geo = kit.sculpt(new kit.SphereGeometry(1, w, h), (v) => {
    const rho = Math.min(1, Math.hypot(v.x, v.z))
    const y = v.y < 0 ? v.y * 0.92 - NECK * (1 - rho) ** 3 : v.y
    v.set(BLADDER_AT.x + v.x * 1.1 * BLADDER_R0, BLADDER_AT.y + (y - lowest) * BLADDER_R0, BLADDER_AT.z + v.z * 0.95 * BLADDER_R0)
  })
  return { organ: 'bladder', geo, inflate: () => 1 }
}

/** A tube along a path. `along` for the ureters is the distance from the notch (scene units), for their drops. */
function tube(organ: Organ, path: TubePath, width: number, tier: Tier, kit: Kit3d, radius?: (u: number) => number): Part<Organ> {
  const d = DETAIL[tier]
  const length = path.getLength()
  const geo = kit.organTube(path, {
    segments: Math.max(3, Math.round(length / d.step)),
    radial: organ === 'ribs' ? d.rib : width >= 0.05 ? d.radial[0] : d.radial[1],
    radius: radius ?? (() => width / 2),
    caps: true,
  })
  if (organ === 'ureters') {
    const along = geo.getAttribute('along')
    for (let i = 0; i < along.count; i++) along.setX(i, along.getX(i) * length)
  }
  return { organ, geo }
}

/** A ureter's radius: a small funnel out of the notch (the renal pelvis), then the ureter's own. */
const ureterRadius = (length: number) => (u: number) => {
  const s = u * length
  return (WIDTH.ureter / 2) * (1 + 1.3 * Math.max(0, 1 - s / 0.09) ** 2)
}

const SIDES = [1, -1] as const

function build(tier: Tier, kit: Kit3d): BufferGeometry {
  const ureters = SIDES.map((s) => ureter3d(s))
  const parts: Part<Organ>[] = [
    ...SIDES.map((s) => kidney(s, tier, kit)),
    ...ureters.map((p) => tube('ureters', p, WIDTH.ureter, tier, kit, ureterRadius(p.getLength()))),
    bladder(tier, kit),
    tube('urethra', URETHRA_3D, WIDTH.urethra, tier, kit),
    tube('artery', trunk3d(AORTA, aortaZ), AORTA.width, tier, kit),
    ...SIDES.map((s) => tube('artery', renalArtery3d(s), WIDTH.artery, tier, kit)),
    tube('vein', trunk3d(VENA_CAVA, venaCavaZ), VENA_CAVA.width, tier, kit),
    ...SIDES.map((s) => tube('vein', renalVein3d(s), WIDTH.vein, tier, kit)),
    ...RIBS.flatMap((rib) => SIDES.map((s) => tube('ribs', rib3d(rib, s), WIDTH.rib, tier, kit))),
  ]
  const geo = kit.layerGeometry(parts, ORGANS, TONES)
  finish(geo, kit)
  return geo
}

/** The run's series the picture reads (once per run). */
interface Water {
  bladder: Series
  urine: Series
}
const runs = new WeakMap<RunResult, Water | null>()
function water(sim: RunResult): Water | null {
  let w = runs.get(sim)
  if (w !== undefined) return w
  const [bladder, urine] = [seriesOf(sim, 'kidney.bladderMl'), seriesOf(sim, 'kidney.urineRate')]
  w = bladder && urine ? { bladder, urine } : null
  runs.set(sim, w)
  return w
}

/**
 * The bladder as drawn, per run (the flat drawing's rule, systems/kidneys/water.ts): the gate, the
 * step shown and its mL, and the ease from the size before (`from`) to its size (`to`) since `at`.
 */
interface Shown {
  gate: (ml: number, nowMs: number) => number
  step: number
  ml: number
  from: number
  to: number
  at: number
}
const shownOf = new WeakMap<RunResult, Shown>()

/** The bladder's drawn size at `now`: eased out over EASE_MS from the size before. */
const sizeAt = (s: Shown, now: number) => {
  const k = Math.min(1, Math.max(0, (now - s.at) / EASE_MS))
  return lerp(s.from, s.to, 1 - (1 - k) * (1 - k))
}

/** How many bounds `ml` is past, `margin` beyond each (the gate's own count). */
const past = (ml: number, margin: number) => BLADDER_BOUNDS.filter((b) => ml >= b + margin).length
const HALF_STEP = (BLADDER_BOUNDS[1]! - BLADDER_BOUNDS[0]!) / 2

/** How dense the drops are (the flat drawing's: one about every 10 px at its usual scale) and how many px a scene unit is there. */
export const DROP_DENSITY = 1.5
export const PX_PER_UNIT = 110

/**
 * The drops' state, on the real clock: how far they have moved down the ureters (scene units), the
 * seconds the ureters have squeezed for (their pulse), and the urine made now (mL an hour, the last
 * frame's). Moved by the rhythm's ticker, so nothing moves with motion reduced. Wrapped now and then
 * to keep the shader's numbers small.
 */
const drops = { offset: 0, clock: 0, urine: 0 }
const WRAP = 2000

/** What the last frame drew (the overlay's gauge reads it): the bladder's mL. One 3D body draws at a time. */
const drawn = { ml: -1 }

function write(out: LayerState, sim: RunResult, t: number, _phase: number, reduced = false) {
  out.state.fill(0)
  out.state[AT.ribs] = -1
  out.fill.fill(0)
  out.dash.fill(0)
  out.flow.fill(0)
  const w = water(sim)
  if (!w) return
  const now = performance.now()
  const ml = valueAt(w.bladder, t, sim.stepMin)
  let s = shownOf.get(sim)
  if (!s) shownOf.set(sim, (s = { gate: levelGate(BLADDER_BOUNDS), step: -1, ml: 0, from: 1, to: 1, at: 0 }))
  const step = s.gate(ml, now)
  if (step !== s.step) {
    const size = bladderScale(stepMl(step))
    s.from = s.step < 0 || reduced ? size : sizeAt(s, now)
    s.to = size
    s.at = now
    s.step = step
    s.ml = stepMl(step)
  }
  // A change the gate held back (the minute moved past half a step within a second of the last
  // change): one more frame once that second is up, so a fast drag that stops still lands on the
  // right size (the flat drawing's re-check), with motion reduced too.
  const raw = past(ml, 0)
  if ((raw > step && past(ml, HALF_STEP) > step) || (raw < step && past(ml, -HALF_STEP) < step)) out.later = 1050
  out.fill[AT.bladder] = (reduced ? s.to : sizeAt(s, now)) - 1
  drawn.ml = s.ml
  drops.urine = valueAt(w.urine, t, sim.stepMin)
  if (reduced) return
  out.dash[AT.ureters] = DROP_DENSITY
  out.flow[AT.ureters] = drops.offset
}

/** The labels, most needed first (as the flat layer's). */
const LABEL_KEYS: readonly KidneyLabel[] = ['kidney', 'bladder', 'ureter', 'artery', 'vein', 'urethra']

/** A point on a path at height `y`, on its front (towards the viewer). */
const front = (path: TubePath, y: number, r: number) => {
  const { p } = path.atHeight(y)
  return v3(p.x, p.y, p.z + r)
}

/**
 * The labels' places in 3D: the flat ones (anatomy/human/kidneys.ts LABELS) with their dots on the
 * organ's front in depth.
 */
const LABELS_3D: Record<KidneyLabel, (typeof LABELS)[KidneyLabel]> = {
  kidney: { ...LABELS.kidney, anchor: v3(-0.5, 0.4, kidneyZ(-1, -0.5, 0.4) + 0.07) },
  bladder: { ...LABELS.bladder, anchor: v3(-0.12, -1.45, BLADDER_AT.z + 0.12) },
  ureter: { ...LABELS.ureter, anchor: front(ureter3d(1), -0.6, WIDTH.ureter / 2) },
  artery: { ...LABELS.artery, anchor: front(renalArtery3d(1), 0.56, 0) },
  vein: { ...LABELS.vein, anchor: front(renalVein3d(-1), 0.38, 0) },
  urethra: { ...LABELS.urethra, anchor: front(URETHRA_3D, -1.68, WIDTH.urethra / 2) },
}

/** The gauge's marks: where the bladder starts to feel full, and where it empties (anatomy plan §2.3). */
const MARKS = [
  { ml: URGE_ML, key: 'urge' },
  { ml: EMPTIES_ML, key: 'empties' },
] as const

/** The gauge's place: beside the bladder (scene x 0.4), from its base up, 0–600 mL over one scene unit (as the flat one). */
const GAUGE_X = 0.4

/** Where each still arrow sits (motion reduced): on each ureter at the flat drawing's height, pointing down it. */
const ARROW_Y = -0.7

/** An organ colour's outline (flat/look.ts outlineOf): the colour shaded, 0.42 (0.2 on the projector). */
const inkOf = (hex: string, shade: number) =>
  `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * shade)).join(',')})`

/** The urine's drops and still arrows: the ureters' colour, deeply shaded (the flat drawing's). */
export const URINE_INK = `#${[1, 3, 5]
  .map((i) =>
    Math.round(parseInt(KIDNEY_TONE.ureter.slice(i, i + 2), 16) * 0.2)
      .toString(16)
      .padStart(2, '0'),
  )
  .join('')}`

const SVG = 'http://www.w3.org/2000/svg'
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, parent?: Element) => {
  const e = document.createElementNS(SVG, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  parent?.appendChild(e)
  return e
}

/**
 * Over the 3D kidneys: the bladder's gauge (0–600 mL, its fill the drawn volume, marks at 150 and
 * 300 mL with their words when the picture is big enough: the flat drawing's), and, with motion
 * reduced, a still arrow down each ureter. Moved with the picture each frame it draws. It also
 * writes the drawn volume on the body (`data-bladder-drawn`, the frame it changes: the e2e scrub
 * check reads it, as the flat layer's).
 */
function kidneysOverlay(host: HTMLElement, { reduced, t, register }: OverlayProps) {
  const body = host.closest<HTMLElement>('[data-body]')
  const root = el('svg', { 'aria-hidden': 'true', class: 'pointer-events-none absolute inset-0 h-full w-full overflow-visible' })
  const arrows = el(
    'g',
    { 'data-arrows': '', fill: 'none', stroke: URINE_INK, 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    root,
  )
  const arrowPaths = reduced ? SIDES.map(() => el('path', {}, arrows)) : []
  if (!reduced) arrows.remove()
  const gauge = el('g', { 'data-gauge': '', class: 'text-ink-muted' }, root)
  const back = el('rect', { fill: 'var(--color-surface-raised, #fff)' }, gauge)
  const fill = el('rect', { fill: KIDNEY_TONE.ureter }, gauge)
  fill.style.transform = 'scaleY(0)'
  if (!reduced) fill.style.transition = `transform ${EASE_MS}ms ease-out`
  const marks = MARKS.map((mark) => {
    const g = el('g', { 'data-mark': String(mark.ml) }, gauge)
    return { mark, line: el('line', { stroke: 'currentColor' }, g), text: el('text', { fill: 'currentColor', dy: '0.35em' }, g) }
  })
  host.append(root)
  const paths = SIDES.map((s) => ureter3d(s))

  // The last thing written, so a frame whose camera and volume have not changed writes nothing.
  let placed = ''
  let shownMl = -1
  const stop = register((project, width, height) => {
    const projector = document.documentElement.dataset.contrast === 'high'
    const ml = drawn.ml
    if (ml !== shownMl && ml >= 0) {
      shownMl = ml
      fill.style.transform = `scaleY(${(ml / BLADDER_MAX_ML).toFixed(3)})`
      if (body) body.dataset.bladderDrawn = String(ml)
    }
    const base = project(v3(GAUGE_X, BLADDER_AT.y, BLADDER_AT.z))
    const up = project(v3(GAUGE_X, BLADDER_AT.y + 1, BLADDER_AT.z))
    const arrowAt = reduced
      ? paths.map((p) => {
          const { p: at, u } = p.atHeight(ARROW_Y)
          const ahead = p.point(Math.min(1, u + 0.01))
          return [project(at), project(ahead), project(v3(at.x + 0.05, at.y, at.z))] as const
        })
      : []
    const key = [base, up, ...arrowAt.flat()].map((p) => (p ? `${p[0].toFixed(1)},${p[1].toFixed(1)}` : '-')).join(' ')
    const next = `${key} ${width}x${height} ${projector}`
    if (next === placed) return
    placed = next
    if (!base || !up) {
      gauge.setAttribute('visibility', 'hidden')
      return
    }
    gauge.removeAttribute('visibility')
    // One scene unit in px: the gauge's height (at least 56 px) and whether its words fit (as the flat one).
    const unit = Math.hypot(up[0] - base[0], up[1] - base[1])
    const [x, bottom] = base
    const h = Math.max(56, unit)
    const w = Math.max(6, 0.06 * unit)
    const line = projector ? 2 : 1.25
    for (const r of [back, fill]) {
      r.setAttribute('x', x.toFixed(1))
      r.setAttribute('y', (bottom - h).toFixed(1))
      r.setAttribute('width', w.toFixed(1))
      r.setAttribute('height', h.toFixed(1))
      r.setAttribute('rx', (w / 2).toFixed(1))
    }
    back.setAttribute('stroke', inkOf(KIDNEY_TONE.ureter, projector ? 0.2 : 0.42))
    back.setAttribute('stroke-width', String(line))
    fill.style.transformOrigin = `${x.toFixed(1)}px ${bottom.toFixed(1)}px`
    const words = unit >= 90
    for (const { mark, line: l, text } of marks) {
      const y = (bottom - (mark.ml / BLADDER_MAX_ML) * h).toFixed(1)
      l.setAttribute('x1', (x - 3).toFixed(1))
      l.setAttribute('x2', (x + w + 3).toFixed(1))
      l.setAttribute('y1', y)
      l.setAttribute('y2', y)
      l.setAttribute('stroke-width', projector ? '2' : '1.5')
      text.setAttribute('x', (x + w + 5).toFixed(1))
      text.setAttribute('y', y)
      text.setAttribute('font-size', projector ? '14' : '11')
      text.textContent = `${mark.ml} ${t('sys.kidneys.gauge.unit')}${words ? ` · ${t(`sys.kidneys.gauge.${mark.key}`)}` : ''}`
    }
    arrowAt.forEach(([at, ahead, side], i) => {
      if (!at || !ahead || !side) return arrowPaths[i]!.setAttribute('d', '')
      const len = Math.hypot(ahead[0] - at[0], ahead[1] - at[1]) || 1
      const [ux, uy] = [(ahead[0] - at[0]) / len, (ahead[1] - at[1]) / len]
      const s = Math.max(5, Math.hypot(side[0] - at[0], side[1] - at[1]))
      const wing = (n: 1 | -1) =>
        `${(at[0] - ux * s * 0.9 - uy * s * 0.6 * n).toFixed(1)} ${(at[1] - uy * s * 0.9 + ux * s * 0.6 * n).toFixed(1)}`
      arrowPaths[i]!.setAttribute('d', `M${wing(1)}L${(at[0] + ux * s * 0.5).toFixed(1)} ${(at[1] + uy * s * 0.5).toFixed(1)}L${wing(-1)}`)
    })
  })
  return () => {
    stop()
    root.remove()
    if (body) delete body.dataset.bladderDrawn
  }
}

/** Every organ grows from the bladder's base; only the bladder's vertices move (`inflate` is 0 elsewhere). */
const ORIGINS = ORGANS.map(() => [BLADDER_AT.x, BLADDER_AT.y, BLADDER_AT.z] as const)

/** The ureters' squeeze: one pulse a second (`ureterSpeed`'s), drawn only while motion is allowed. */
export const PULSE_HZ = 1

const KIDNEYS_3D: Layer3d = {
  id: 'kidneys',
  organs: ORGANS,
  build,
  write,
  // The flat kidneys' framing (U-4): the kidneys under the lowest ribs down to the bladder.
  framing: 'torso',
  food: false,
  // The lower ribs and the backbone for a bearing, as the flat drawing has them (A-1a skeleton ghost).
  landmarks: true,
  grow: { origins: ORIGINS },
  // The urine's drops: dark dots down the middle of the ureters, as the flat drawing's.
  dashes: { ink: URINE_INK, cover: 0.25 },
  rhythm: {
    hz: () => PULSE_HZ,
    still: 0,
    onTick: (tick) =>
      onTick((dt) => {
        drops.clock = (drops.clock + dt) % WRAP
        drops.offset = (drops.offset + (ureterSpeed(drops.urine, drops.clock) / PX_PER_UNIT) * dt) % WRAP
        tick(dt)
      }),
    probe: (_sim, _t, _phase, reduced) => ({
      drops: reduced ? 'still' : 'moving',
      dropsFlow: drops.offset.toFixed(3),
      urineRate: drops.urine.toFixed(0),
    }),
  },
  labels: {
    table: LABELS_3D,
    specs: (t, _width, height) =>
      LABEL_KEYS.map((key, i) => ({
        key,
        text: t(`sys.kidneys.label.${key}`),
        tone: i ? ('stage' as const) : ('active' as const),
        hidden: (height < 260 && i > 1) || (height < 420 && i > 3),
      })),
  },
  overlay: kidneysOverlay,
}
export default KIDNEYS_3D
