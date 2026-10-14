import type { BufferGeometry } from 'three'
import type { ActivityBand } from '../anatomy/human/bands.ts'
import { ANKLE_U, KNEE_U, legJoints, legRadius, limbKit, posedLimbs, setLimbKit, POSES } from '../anatomy/human/limbs.ts'
import { PELVIS, RIB_POINTS, SPINE_POINTS, STERNUM_POINTS } from '../anatomy/human/landmarks.ts'
import type { Spline3, XYZ } from '../anatomy/spline.ts'
import type { Curve3 } from './geometry.ts'
import type { Kit3d } from './kit.ts'
import type { Limbs3d, Tier } from './layer.ts'

/**
 * The 3D legs (A-1a; anatomy plan §1, §3, D7): thighs, shins, feet and joint caps, and the posed
 * arms, tubed along the very curves the flat body outlines (anatomy/human/limbs.ts `posedLimbs`), so
 * the 3D body and the flat one stand in the same still pose: rest, or one per activity kind (R4,
 * R32). No swing: that is A-9b (v3.2+). Also the merged skeleton ghost (§1 landmarks): the backbone,
 * breastbone, ribs, hip bones and the long bones in the pose, one faint draw.
 *
 * A lazy chunk, loaded the first time a 3D picture shows legs (a bout, the `full` framing, the whole
 * body). Like a lit layer it gets three.js and the geometry kit from three/mount.ts and the body base
 * from anatomy/human/kit.ts (R104): it imports neither React, three.js nor the 3D body.
 *
 * Mannequin parts that overlap at the joints (a cap at the shoulder, elbow, knee and ankle). The shell
 * is a rim-lit ghost, so where two parts overlap both rims would show; the 3D body draws the shell's
 * depth first (three/BodyCanvas.tsx pre-pass), and only the nearest skin is drawn: one outline.
 */

const v = (x: number, y: number, z: number): XYZ => ({ x, y, z })

/** A stretch of a curve (u0…u1 of its length), as a curve of its own. */
function part(c: Spline3, u0: number, u1: number): Curve3 {
  return {
    getPointAt: (u, out) => c.getPointAt(u0 + (u1 - u0) * u, out),
    getTangentAt: (u, out) => c.getTangentAt(u0 + (u1 - u0) * u, out),
  }
}

/** A tube's position and normal only (the shell's attribute set). */
function bare(geo: BufferGeometry): BufferGeometry {
  geo.deleteAttribute('along')
  return geo
}

/** Radial sides and lengthwise segments by tier (a 2 GB phone: half the sides round; plan §9, R99). */
const detail = (tier: Tier) => (tier === 'low' ? { radial: 12, ball: 10, seg: 0.6 } : { radial: 24, ball: 20, seg: 1 })

/** A ball at `c` of radius `r` (a joint cap). */
function ball(kit: Kit3d, c: XYZ, r: number, sides: number): BufferGeometry {
  return kit.sculpt(new kit.SphereGeometry(r, sides, Math.max(6, Math.round(sides * 0.6))), (p) => p.set(p.x + c.x, p.y + c.y, p.z + c.z))
}

/**
 * A foot: a rounded wedge from the heel forward to the toes, its sole on the leg's sole point. It
 * turns with the shin and the ankle (a toes-down foot in a stride), about the left-right axis.
 */
function foot(kit: Kit3d, ankle: XYZ, deg: number, sides: number): BufferGeometry {
  const a = (deg * Math.PI) / 180
  // The shin's "down" and "forward" swung by the pose (anatomy/human/limbs.ts `swing`).
  const down = v(0, -Math.cos(a), Math.sin(a))
  const fwd = v(0, Math.sin(a), Math.cos(a))
  const LONG = 0.62
  const TALL = 0.17
  const WIDE = 0.2
  // Its middle a little forward of the ankle, its sole 0.3 under it (limbs.ts FOOT).
  const c = v(ankle.x, ankle.y + down.y * 0.13 + fwd.y * 0.18, ankle.z + down.z * 0.13 + fwd.z * 0.18)
  return kit.sculpt(new kit.SphereGeometry(1, sides, Math.max(6, Math.round(sides * 0.6))), (p) => {
    const along = p.z * LONG
    // Lower towards the toes, a flat sole, a little wider at the ball of the foot.
    const up = Math.max(-0.82, p.y) * TALL * (1 - 0.35 * Math.max(0, p.z)) * (1 + 0.4 * Math.max(0, -p.z))
    const side = p.x * WIDE * (1 + 0.12 * p.z)
    p.set(c.x + side, c.y + fwd.y * along - down.y * up, c.z + fwd.z * along - down.z * up)
  })
}

const LIMBS_3D: Limbs3d = {
  takeKit: setLimbKit,

  skin(band: ActivityBand, tier: Tier, kit: Kit3d) {
    const d = detail(tier)
    const { ARM, ELBOW_U, armRadius } = limbKit()
    const limbs = posedLimbs(band)
    const out: BufferGeometry[] = []
    const pose = POSES[band]
    for (const leg of limbs.legs) {
      const angles = (leg.side === 1 ? pose.right : pose.left).leg
      const j = legJoints(angles, leg.side)
      const r = (u0: number, u1: number) => (u: number) => legRadius(u0 + (u1 - u0) * u)
      const seg = (n: number) => Math.max(8, Math.round(n * d.seg))
      // Thigh from inside the hip to the knee; shin from the knee to the ankle (anatomy plan §1 THIGH, SHIN).
      // Open where a cap closes them (a capped end's normals would shade a ring round the joint).
      out.push(
        bare(kit.organTube(part(leg.curve, 0, KNEE_U), { segments: seg(24), radial: d.radial, radius: r(0, KNEE_U), caps: 'start' })),
      )
      out.push(bare(kit.organTube(part(leg.curve, KNEE_U, ANKLE_U), { segments: seg(24), radial: d.radial, radius: r(KNEE_U, ANKLE_U) })))
      const knee = leg.curve.getPointAt(KNEE_U, new kit.Vector3())
      // The caps no wider than the tubes, so a straight leg shows no ring at the joint; bent, they fill its outer corner.
      out.push(ball(kit, knee, legRadius(KNEE_U) * 0.99, d.ball))
      out.push(ball(kit, j.ankle, legRadius(ANKLE_U) * 0.99, d.ball))
      out.push(foot(kit, j.ankle, angles.hip - angles.knee + angles.ankle, d.ball))
    }
    for (const arm of limbs.arms) {
      // One tube, shoulder to fingertips, as the rest shell's arm (three/geometry.ts); a sharply bent
      // elbow gets a cap, and the shoulder one rounds the deltoid however the arm swings.
      out.push(
        bare(
          kit.organTube(arm.curve, {
            segments: Math.round(64 * d.seg),
            radial: Math.round(d.radial * 0.8),
            radius: armRadius,
            flatten: 0.85,
            caps: true,
          }),
        ),
      )
      const angles = (arm.side === 1 ? pose.right : pose.left).arm
      if (angles.elbow > 30) out.push(ball(kit, arm.curve.getPointAt(ELBOW_U, new kit.Vector3()), armRadius(ELBOW_U) * 0.99, d.ball))
      const shoulder = ARM.getPointAt(0.04, new kit.Vector3())
      out.push(ball(kit, v(shoulder.x * arm.side, shoulder.y, shoulder.z), armRadius(0.04) * 0.98, d.ball))
    }
    return out
  },

  ghost(band: ActivityBand, kit: Kit3d) {
    const { Spline3, ELBOW_U } = limbKit()
    const out: BufferGeometry[] = []
    const mirror = (pts: readonly XYZ[]) => pts.map((p) => v(-p.x, p.y, p.z))
    const tube = (c: Curve3, segments: number, radial: number, radius: (u: number) => number) =>
      bare(kit.organTube(c, { segments, radial, radius, caps: true }))
    // The backbone, one bump per vertebra; the breastbone, flat.
    out.push(tube(new Spline3([...SPINE_POINTS]), 72, 6, (u) => 0.05 + 0.022 * Math.abs(Math.sin(u * Math.PI * 24))))
    out.push(
      bare(kit.organTube(new Spline3([...STERNUM_POINTS]), { segments: 8, radial: 6, radius: () => 0.06, flatten: 0.4, caps: true })),
    )
    // Twelve pairs of ribs.
    for (const pts of RIB_POINTS)
      for (const side of [pts, mirror(pts)]) out.push(tube(new Spline3([...side]), 14, 4, (u) => 0.026 * (1 - 0.3 * u)))
    // The hip bones' rims, front-on (anatomy/human/landmarks.ts PELVIS), as a loop round each.
    const rim = PELVIS.map(([x, y]) => v(x, y, -0.06))
    for (const side of [rim, mirror(rim)]) out.push(tube(new Spline3([...side, side[0]!, side[1]!]), 36, 4, () => 0.035))
    // The long bones down the posed limbs: a knob at each end.
    const knobs = (u: number) => 0.055 + 0.04 * (Math.exp(-((u / 0.08) ** 2)) + Math.exp(-(((1 - u) / 0.08) ** 2)))
    const limbs = posedLimbs(band)
    for (const leg of limbs.legs) {
      out.push(tube(part(leg.curve, 0.02, KNEE_U - 0.015), 12, 5, knobs))
      out.push(tube(part(leg.curve, KNEE_U + 0.015, ANKLE_U - 0.01), 12, 5, (u) => knobs(u) * 0.85))
    }
    for (const arm of limbs.arms) {
      out.push(tube(part(arm.curve, 0.06, ELBOW_U - 0.02), 10, 5, (u) => knobs(u) * 0.8))
      out.push(tube(part(arm.curve, ELBOW_U + 0.02, 0.86), 10, 5, (u) => knobs(u) * 0.7))
    }
    return out
  },
}

export default LIMBS_3D
