import type { ActivityBand } from '../anatomy/human/bands.ts'
import { SOLE_Y, legRadius, limbKit, partRadius, posedLimbs, setLimbKit, type LimbKit } from '../anatomy/human/limbs.ts'
import type { Spline3, XYZ } from '../anatomy/spline.ts'

/**
 * The flat body with legs, in one of the four still poses (R4, R16, R32): a lazy chunk, loaded only
 * when a picture shows legs (the `full` framing) or a pose (a bout on the meal clock). Digestion at
 * rest never loads it and draws today's outline (FlatBody).
 *
 * The torso and both legs are ONE outline, so the skin has no seam at the hips: down the torso's
 * side to the hip, down the outside of the leg, round the foot, up the inside to the groin (a soft
 * mannequin curve), and the same on the other side. An arm whose hand is in front of the belly (the
 * bent arms of a brisk walk or a run) is drawn over the torso; a hanging arm under it, as at rest.
 *
 * Front-on, a stride is mostly depth, so the limbs get a weak perspective (only they move in depth;
 * the torso and organs sit at z ≈ 0, where it changes nothing): a foot or hand towards the viewer
 * is drawn a little lower and larger, one behind a little higher and smaller, as in a photograph
 * taken from the front. A faint shadow on the ground shows which feet are off it.
 */

/** A polygon in scene units, front-on (x, y). */
type Outline = [number, number][]

/**
 * The two edges of a tube along a curve, each from its start to its end, front-on. "Left" is the
 * left of the curve's direction: for a curve running down the picture, the viewer's right (+x).
 * (FlatBody outlines its resting arms the same way; this chunk has its own copy so it shares no
 * module with the 3D body: anatomy/human/limbs.ts LimbKit.)
 */
function tubeEdges(curve: Spline3, radius: (u: number) => number, n: number): [Outline, Outline] {
  const { Vec3 } = limbKit()
  const left: Outline = []
  const right: Outline = []
  const p = new Vec3()
  const t = new Vec3()
  for (let i = 0; i <= n; i++) {
    const u = i / n
    curve.getPointAt(u, p)
    curve.getTangentAt(u, t)
    const len = Math.hypot(t.x, t.y) || 1
    const r = radius(u)
    left.push([p.x - (t.y / len) * r, p.y + (t.x / len) * r])
    right.push([p.x + (t.y / len) * r, p.y - (t.x / len) * r])
  }
  return [left, right]
}

/** A tube's outline as one closed polygon: the left edge, then the right edge back. */
function tubeOutline(curve: Spline3, radius: (u: number) => number, n: number): Outline {
  const [left, right] = tubeEdges(curve, radius, n)
  return [...left, ...right.reverse()]
}

/**
 * The same with a round end at the elbow (a jointed mannequin's limb part): a half circle, so two
 * parts that overlap at a joint show a rounded joint, not a cut.
 */
function cappedOutline(curve: Spline3, radius: (u: number) => number, n: number, end: 'start' | 'end'): Outline {
  const [left, right] = tubeEdges(curve, radius, n)
  const cap = (u: number, from: number): Outline => {
    const c = curve.getPointAt(u)
    const t = curve.getTangentAt(u)
    const r = radius(u)
    const a0 = Math.atan2(t.y, t.x) + from
    const out: Outline = []
    for (let k = 1; k < 12; k++) out.push([c.x + r * Math.cos(a0 - (k * Math.PI) / 12), c.y + r * Math.sin(a0 - (k * Math.PI) / 12)])
    return out
  }
  return [...left, ...(end === 'end' ? cap(1, Math.PI / 2) : []), ...right.reverse(), ...(end === 'start' ? cap(0, -Math.PI / 2) : [])]
}

/** Where the torso's side hands over to the leg: its widest point at the hips. */
const HIP_Y = -1.2
/** Below this the two thighs part: the inside edges end here and meet in a small curve. */
const GROIN_Y = -1.8
/** The weak perspective: a camera this far in front of the body (scene units), level with the chest. */
const DEPTH = 30
const EYE_Y = 1.0

/** A limb point as the picture draws it, and how much nearer parts grow (`s`). */
function project(p: XYZ): XYZ & { s: number } {
  const s = DEPTH / (DEPTH - p.z)
  return { x: p.x * s, y: EYE_Y + (p.y - EYE_Y) * s, z: p.z, s }
}

/** A limb's curve in the picture, and its radius there (larger when nearer). */
function drawn(curve: Spline3, radius: (u: number) => number) {
  const { Spline3, Vec3 } = limbKit()
  const flat = new Spline3(curve.points.map(project), curve.tension)
  const p = new Vec3()
  return { curve: flat, radius: (u: number) => radius(u) * project(curve.getPointAt(u, p)).s }
}

/** Hands the limbs the body base (anatomy/human/limbs.ts `LimbKit`); the stage calls it as it loads this chunk. */
export const takeKit = (k: LimbKit) => setLimbKit(k)

export interface Figure {
  /** Arms drawn under the torso, the torso with both legs, then arms drawn over it (scene units). */
  under: Outline[]
  body: Outline
  over: Outline[]
  /** Kneecaps of the bent knees: where they are drawn, and their size (scene units). */
  kneecaps: { x: number; y: number; r: number }[]
  /** The ground shadow under the feet: centre x, y and half-width (only where the feet stand). */
  ground: { x: number; y: number; rx: number }
}

const figures = new Map<ActivityBand, Figure>()

/** The pose's outlines, built once per band. */
export function figure(band: ActivityBand): Figure {
  let f = figures.get(band)
  if (f) return f
  const limbs = posedLimbs(band)
  const { ARM, TORSO_PROFILE, armRadius } = limbKit()
  // At rest the arms are ARM itself, as the outline without legs draws them.
  // Posed, each arm is its upper arm and its forearm, overlapping at a rounded elbow.
  const arm = ({ side, parts }: (typeof limbs.arms)[number]): Outline[] => {
    if (band === 'rest') return [tubeOutline(ARM, armRadius, 48).map(([x, y]) => [x * side, y])]
    return parts.map(({ curve, range, caps }) => {
      const d = drawn(curve, partRadius(range))
      return caps === 'none' ? tubeOutline(d.curve, d.radius, 48) : cappedOutline(d.curve, d.radius, 32, caps)
    })
  }
  const edges = (side: 1 | -1) => {
    const d = drawn(limbs.legs.find((l) => l.side === side)!.curve, legRadius)
    return tubeEdges(d.curve, d.radius, 80)
  }
  const [rOuter, rInner] = edges(1)
  const [lInner, lOuter] = edges(-1)
  const torso = [...TORSO_PROFILE].reverse().filter(([, y]) => y >= HIP_Y)
  const body: Outline = [
    ...torso.map(([x, y]) => [x, y] as [number, number]),
    ...rOuter,
    ...rInner.reverse().filter(([, y]) => y < GROIN_Y),
    [0.03, GROIN_Y - 0.01],
    [0, GROIN_Y + 0.02],
    [-0.03, GROIN_Y - 0.01],
    ...lInner.filter(([, y]) => y < GROIN_Y),
    ...lOuter.reverse(),
    ...[...torso].reverse().map(([x, y]) => [-x, y] as [number, number]),
  ]
  f = {
    under: limbs.arms.filter((a) => !a.front).flatMap(arm),
    body,
    over: limbs.arms.filter((a) => a.front).flatMap(arm),
    kneecaps: limbs.legs.flatMap(({ kneecap }) => {
      if (!kneecap) return []
      const p = project(kneecap)
      return [{ x: p.x, y: p.y, r: 0.12 * p.s }]
    }),
    ground: { x: 0, y: project({ x: 0, y: SOLE_Y, z: 0 }).y, rx: 0.95 },
  }
  figures.set(band, f)
  return f
}

/**
 * Paints the posed body's skin (not the head) with the context's current skin fill and line, in
 * the picture's pixels: `X` and `Y` map scene units to them, `scale` is pixels per unit.
 */
export function paintFigure(
  ctx: CanvasRenderingContext2D,
  X: (x: number) => number,
  Y: (y: number) => number,
  scale: number,
  band: ActivityBand,
) {
  const f = figure(band)
  // The ground shadow first, under everything, in the skin's fill (no outline).
  ctx.beginPath()
  ctx.ellipse(X(f.ground.x), Y(f.ground.y), f.ground.rx * scale, 0.09 * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  const shape = (pts: Outline) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))))
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  f.under.forEach(shape)
  shape(f.body)
  // A bent knee faces the viewer: its kneecap, a small oval in the skin's line, tells it from a straight leg.
  for (const k of f.kneecaps) {
    ctx.beginPath()
    ctx.ellipse(X(k.x), Y(k.y), k.r * scale, k.r * 0.85 * scale, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  f.over.forEach(shape)
}
