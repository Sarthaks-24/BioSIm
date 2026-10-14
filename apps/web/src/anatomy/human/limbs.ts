import type { Spline3, Vec3, XYZ } from '../spline.ts'
import type { ActivityBand } from './bands.ts'

/**
 * Legs and posed arms (anatomy plan §1, D7; R4, R16, R32): the flat body's limbs, three.js-free, in
 * scene units (base.ts). One still pose per activity band, rest, walk, walkBrisk and run, with no
 * swing (swing is A-9b, v3.2+). A pose is a few joint angles; `posedLimbs` turns it into curves
 * through the joints, which the flat body outlines front-on (flat/limbs.ts) and the 3D legs (A-1a)
 * will tube. Loaded only when a picture shows legs or a pose: Digestion at rest never needs it.
 *
 * Sizes (1 unit ≈ 20 cm): thigh 2.15, shin 2.0, ankle to sole 0.3, so the feet stand at y ≈ −5.8
 * and the body is about 1.8 m tall. The hip joints sit inside the torso's hips.
 */

/**
 * What the limbs borrow from the body base (base.ts, spline.ts). It is handed over (`setLimbKit`,
 * with kit.ts's LIMB_KIT) rather than imported: the base is in the first download and in the 3D
 * body, and a third lazy chunk importing it made the bundler move it into a common chunk of its
 * own, +0.33 KB gz on /sim (measured). Handed over, this chunk shares no module with the 3D body.
 */
export interface LimbKit {
  Spline3: typeof Spline3
  Vec3: typeof Vec3
  ARM: Spline3
  ELBOW_U: number
  armRadius: (u: number) => number
  TORSO_PROFILE: readonly (readonly [number, number])[]
}
let kit: LimbKit | null = null

/** Hands the body base to the limbs (once, before the first pose). */
export function setLimbKit(k: LimbKit) {
  kit = k
}

/** The body base the limbs were handed. */
export function limbKit(): LimbKit {
  if (!kit) throw new Error('limbs: setLimbKit first (anatomy/human/kit.ts)')
  return kit
}

const v = (x: number, y: number, z: number): XYZ => ({ x, y, z })
const smooth = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return k * k * (3 - 2 * k)
}

/** Where the viewer's right leg (+x) leaves the hip; the left is its mirror. */
export const HIP = v(0.46, -1.35, 0)
export const THIGH = 2.15
export const SHIN = 2.0
export const FOOT = 0.3
/** Standing, the thighs slope in a little (knees closer than hips) and the shins hang straight. */
const THIGH_IN = 2.8
const SHIN_IN = 0.6

/** The sole of a standing foot. */
export const SOLE_Y = HIP.y - THIGH - SHIN - FOOT

/** Joint angles of one leg, in degrees: hip flexion (+ = thigh forward), knee flexion (≥ 0), ankle (+ = toes down, heel up). */
export interface LegAngles {
  hip: number
  knee: number
  ankle: number
}

/**
 * Joint angles of one arm, in degrees: shoulder flexion (+ = arm forward), elbow flexion (≥ 0),
 * the forearm turned in towards the belly, and the upper arm lifted out to the side.
 */
export interface ArmAngles {
  shoulder: number
  elbow: number
  inward: number
  out: number
}

/** One side's leg and arm. `right` is the viewer's right (+x), the person's left. */
interface Side {
  leg: LegAngles
  arm: ArmAngles
}

export interface LimbPose {
  right: Side
  left: Side
}

const still: Side = { leg: { hip: 0, knee: 0, ankle: 0 }, arm: { shoulder: 0, elbow: 0, inward: 0, out: 0 } }

/**
 * The four still poses, mid-stride. The arms swing against the legs (the leg forward on one side,
 * the arm forward on the other). Front-on, a stride shows as a leg shortened by its bend, its
 * kneecap forward and its foot raised, toes down; the run lifts the front knee, kicks the back heel
 * up (both feet off the ground) and bends both elbows to about a right angle: the front fist comes
 * up to the chest above the liver, the back hand to the waist, both at the torso's side so the
 * organs inside stay clear (R88). Stride and bend grow with the band, so the four read apart at a
 * glance (anatomy plan §2.4; numbers are a drawing's, not
 * measured: walking hip ≈ 20° each way, running knee ≈ 90°+ in swing, per the gait texts).
 */
export const POSES: { readonly [B in ActivityBand]: LimbPose } = {
  rest: { right: still, left: still },
  walk: {
    right: { leg: { hip: 24, knee: 50, ankle: 22 }, arm: { shoulder: -14, elbow: 12, inward: 0, out: 0 } },
    left: { leg: { hip: 0, knee: 0, ankle: 0 }, arm: { shoulder: 16, elbow: 24, inward: 10, out: 0 } },
  },
  walkBrisk: {
    right: { leg: { hip: 32, knee: 60, ankle: 24 }, arm: { shoulder: -22, elbow: 80, inward: 12, out: 6 } },
    left: { leg: { hip: -2, knee: 0, ankle: 0 }, arm: { shoulder: 24, elbow: 78, inward: 42, out: 2 } },
  },
  run: {
    right: { leg: { hip: 52, knee: 72, ankle: 26 }, arm: { shoulder: -30, elbow: 90, inward: 14, out: 8 } },
    left: { leg: { hip: -20, knee: 44, ankle: 30 }, arm: { shoulder: 20, elbow: 85, inward: 45, out: 4 } },
  },
}

const RAD = Math.PI / 180

/** Rotates d about the x axis so that a downward vector swings forward (+z) by `deg`. */
function swing(d: XYZ, deg: number): XYZ {
  const a = deg * RAD
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: d.x, y: d.y * c + d.z * s, z: -d.y * s + d.z * c }
}

/** Rotates d about the vertical axis by `deg`, turning +z towards −x·side (towards the midline). */
function turnIn(d: XYZ, deg: number, side: 1 | -1): XYZ {
  const a = deg * RAD * side
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: d.x * c - d.z * s, y: d.y, z: d.x * s + d.z * c }
}

/** Rotates d in the picture plane by `deg`, lifting a hanging limb out to its side. */
function lift(d: XYZ, deg: number, side: 1 | -1): XYZ {
  const a = deg * RAD * side
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: d.x * c - d.y * s, y: d.x * s + d.y * c, z: d.z }
}

const add = (p: XYZ, d: XYZ, k: number): XYZ => v(p.x + d.x * k, p.y + d.y * k, p.z + d.z * k)
const sub = (a: XYZ, b: XYZ): XYZ => v(a.x - b.x, a.y - b.y, a.z - b.z)
const mid = (a: XYZ, b: XYZ): XYZ => v((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)

/** Hip, knee, ankle and sole of one leg in a pose. */
export function legJoints(a: LegAngles, side: 1 | -1) {
  const hip = v(HIP.x * side, HIP.y, HIP.z)
  // Standing directions (thigh sloping in, shin nearly straight), then swung forward at the hip and back at the knee.
  const thighDir = swing(lift(v(0, -1, 0), -THIGH_IN, side), a.hip)
  const shinDir = swing(lift(v(0, -1, 0), -SHIN_IN, side), a.hip - a.knee)
  const footDir = swing(v(0, -1, 0), a.hip - a.knee + a.ankle)
  const knee = add(hip, thighDir, THIGH)
  const ankle = add(knee, shinDir, SHIN)
  const sole = add(ankle, footDir, FOOT)
  return { hip, knee, ankle, sole }
}

/** Arc-length place (0 hip … 1 sole) of the knee and the ankle along a leg curve. */
export const KNEE_U = THIGH / (THIGH + SHIN + FOOT)
export const ANKLE_U = (THIGH + SHIN) / (THIGH + SHIN + FOOT)

/** A leg as one curve, hip to sole, through the joints (Catmull–Rom rounds the knee). */
export function legCurve(a: LegAngles, side: 1 | -1): Spline3 {
  const j = legJoints(a, side)
  // Points along each bone, so the curve keeps the bones straight and bends only at the joints.
  const along = (p: XYZ, q: XYZ, k: number) => add(p, sub(q, p), k)
  return new (limbKit().Spline3)(
    [j.hip, along(j.hip, j.knee, 0.5), along(j.hip, j.knee, 0.92), along(j.knee, j.ankle, 0.08), mid(j.knee, j.ankle), j.ankle, j.sole],
    0.5,
  )
}

/** Leg radius along legCurve (u = 0 at the hip, 1 at the sole): full upper thigh, knee, calf, slim ankle, a flat-capped foot. */
const LEG_PROFILE: [number, number][] = [
  [0, 0.43],
  [0.12, 0.39],
  [0.3, 0.32],
  [KNEE_U - 0.04, 0.24],
  [KNEE_U, 0.235],
  [KNEE_U + 0.06, 0.25],
  [0.62, 0.275],
  [0.8, 0.19],
  [ANKLE_U - 0.01, 0.135],
  [0.965, 0.2],
  [1, 0.21],
]

export function legRadius(u: number): number {
  const x = Math.min(1, Math.max(0, u))
  let r = LEG_PROFILE[LEG_PROFILE.length - 1]![1]
  for (let i = 1; i < LEG_PROFILE.length; i++) {
    const [u1, r1] = LEG_PROFILE[i]!
    if (x <= u1) {
      const [u0, r0] = LEG_PROFILE[i - 1]!
      const k = (x - u0) / (u1 - u0)
      r = r0 + (r1 - r0) * k * k * (3 - 2 * k)
      break
    }
  }
  // The sole: a flat cap with rounded corners.
  const cap = x > 0.985 ? Math.sqrt(Math.max(0, 1 - ((x - 0.985) / 0.015) ** 2)) : 1
  return r * cap
}

/** Samples of ARM along a posed arm. */
const ARM_SAMPLES = 40
/** An elbow bent more than this (degrees) is a sharp joint (a brisk walk, a run); less, a soft curve. */
const JOINTED = 40

/**
 * The viewer's right arm (+x; mirror it with `side` −1) in a pose, as ONE curve from the shoulder
 * to the fingertips (the flat body outlines it as one shape, so a bent arm is one silhouette with
 * a pointed elbow, never a forearm floating on its own). The shoulder turn fades in over the top of
 * the arm (the root stays in the shoulder); the forearm is bent at the elbow, then turned in last,
 * about the upright through the elbow, so a back-swung arm's hand still points forward and down,
 * as a walker's does.
 */
export function armCurve(a: ArmAngles, side: 1 | -1): Spline3 {
  const { ARM, ELBOW_U, Spline3, Vec3 } = limbKit()
  const shoulder = ARM.getPointAt(0.1)
  const elbow = ARM.getPointAt(ELBOW_U)
  // The whole arm: swung at the shoulder and lifted out a little (`s` fades it in from the root).
  const atShoulder = (q: XYZ, s: number) => add(shoulder, swing(lift(sub(q, shoulder), a.out * s, 1), a.shoulder * s), 1)
  const elbowNow = atShoulder(elbow, 1)
  const p = new Vec3()
  // A sharp bend just round the elbow: the outline's outer edge rounds it, the inner edge creases.
  const half = a.elbow > JOINTED ? 0.03 : 0.1
  const pts: XYZ[] = []
  for (let i = 0; i <= ARM_SAMPLES; i++) {
    const u = i / ARM_SAMPLES
    ARM.getPointAt(u, p)
    const e = smooth(ELBOW_U - half, ELBOW_U + half, u)
    let q: XYZ = v(p.x, p.y, p.z)
    if (e > 0) q = add(elbow, swing(sub(q, elbow), a.elbow * e), 1)
    q = atShoulder(q, smooth(0, 0.16, u))
    if (e > 0) q = add(elbowNow, turnIn(sub(q, elbowNow), a.inward * e, 1), 1)
    pts.push(v(q.x * side, q.y, q.z))
  }
  return new Spline3(pts, 0.5)
}

/**
 * Leg radius along a posed leg: legRadius, reshaped by the pose. A bent knee comes towards the
 * viewer, so the joint shows a little wider and the calf, now behind the shin, a little slimmer;
 * a foot with its toes down shows its top, a rounded point instead of a flat sole.
 */
export function posedLegRadius(a: LegAngles): (u: number) => number {
  const knee = smooth(10, 60, a.knee)
  const toes = smooth(0, 25, a.ankle)
  if (knee === 0 && toes === 0) return legRadius
  const bump = (u: number, at: number, w: number) => Math.exp(-(((u - at) / w) ** 2))
  return (u) => {
    const r = legRadius(u) + 0.035 * knee * (bump(u, KNEE_U, 0.06) - bump(u, 0.63, 0.08))
    if (u <= ANKLE_U || toes === 0) return r
    // The foot from the ankle to the toes: a little wider, then rounded to its tip.
    const k = (u - ANKLE_U) / (1 - ANKLE_U)
    const tip = k > 0.55 ? Math.sqrt(Math.max(0, 1 - ((k - 0.55) / 0.45) ** 2)) : 1
    return r + ((0.135 + 0.03 * smooth(0, 0.5, k)) * tip - r) * toes
  }
}

/** The posed limbs of one band: each leg and arm as a curve, with which side it is on. */
export interface PosedLimbs {
  band: ActivityBand
  /** Each leg: its curve and its radius along it (the kneecap and the foot follow the pose). */
  legs: { side: 1 | -1; curve: Spline3; radius: (u: number) => number }[]
  arms: { side: 1 | -1; curve: Spline3; front: boolean }[]
}

const cache = new Map<ActivityBand, PosedLimbs>()

/**
 * The limbs for a band, built once per band. An arm is `front` when its hand is well in front of
 * the body (the picture draws it over the torso's edge); otherwise it hangs beside the body, drawn
 * under it.
 */
export function posedLimbs(band: ActivityBand): PosedLimbs {
  let limbs = cache.get(band)
  if (!limbs) {
    const pose = POSES[band]
    const sides = [
      [1, pose.right],
      [-1, pose.left],
    ] as const
    limbs = {
      band,
      legs: sides.map(([side, s]) => ({
        side,
        curve: legCurve(s.leg, side),
        radius: posedLegRadius(s.leg),
      })),
      arms: sides.map(([side, s]) => {
        const curve = armCurve(s.arm, side)
        return { side, curve, front: curve.getPointAt(0.9).z > 0.3 }
      }),
    }
    cache.set(band, limbs)
  }
  return limbs
}
