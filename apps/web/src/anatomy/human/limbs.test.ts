import { describe, expect, it } from 'vitest'
import { Vec3 } from '../spline.ts'
import { ARM, FRAMINGS, TORSO_PROFILE } from './base.ts'
import { ACTIVITY_BANDS } from './bands.ts'
import { LIMB_KIT } from './kit.ts'
import { KNEE_U, POSES, SOLE_Y, legJoints, legRadius, posedLimbs, setLimbKit } from './limbs.ts'

setLimbKit(LIMB_KIT)
import { SPLEEN, spleenPoint } from './lymph.ts'
import { PELVIS, RIBS, SPINE, STERNUM } from './skeleton.ts'

/** Half the torso's width at height y (TORSO_PROFILE, linear between its points). */
function torsoHalfWidth(y: number): number {
  for (let i = 1; i < TORSO_PROFILE.length; i++) {
    const [r0, y0] = TORSO_PROFILE[i - 1]!
    const [r1, y1] = TORSO_PROFILE[i]!
    if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)
  }
  return 0
}

describe('legs and poses (anatomy plan §1, D7)', () => {
  const soles = (band: (typeof ACTIVITY_BANDS)[number]) =>
    (['right', 'left'] as const).map((side, i) => legJoints(POSES[band][side].leg, i === 0 ? 1 : -1).sole.y)

  it('stands about 1.8 m tall, feet at y ≈ −5.8, inside the full framing', () => {
    expect(SOLE_Y).toBeCloseTo(-5.8, 5)
    for (const y of soles('rest')) expect(y).toBeCloseTo(SOLE_Y, 2)
    for (const band of ACTIVITY_BANDS) for (const y of soles(band)) expect(y).toBeGreaterThan(FRAMINGS.full.minY)
  })

  it('walking keeps one foot on the ground and lifts the other; running lifts both (no swing: one still pose each)', () => {
    for (const band of ['walk', 'walkBrisk'] as const) {
      const [a, b] = soles(band).sort((x, y) => x - y) as [number, number]
      expect(a, band).toBeCloseTo(SOLE_Y, 1)
      expect(b - SOLE_Y, band).toBeGreaterThan(0.3)
    }
    for (const y of soles('run')) expect(y - SOLE_Y).toBeGreaterThan(0.5)
    // Stride and bend grow with the band.
    const bend = (band: (typeof ACTIVITY_BANDS)[number]) => Math.max(POSES[band].right.leg.knee, POSES[band].left.leg.knee)
    expect(bend('rest')).toBeLessThan(bend('walk'))
    expect(bend('walk')).toBeLessThan(bend('walkBrisk'))
    expect(bend('walkBrisk')).toBeLessThan(bend('run'))
  })

  it('bent knees show their kneecap; a bent elbow brings the hand in front of the belly', () => {
    expect(posedLimbs('rest').legs.every((l) => l.kneecap === null)).toBe(true)
    expect(posedLimbs('run').legs.every((l) => l.kneecap !== null)).toBe(true)
    expect(posedLimbs('rest').arms.some((a) => a.front)).toBe(false)
    for (const band of ['walkBrisk', 'run'] as const)
      expect(
        posedLimbs(band).arms.some((a) => a.front),
        band,
      ).toBe(true)
  })

  it('keeps every bone its length in every pose', () => {
    for (const band of ACTIVITY_BANDS)
      for (const [side, s] of [
        [1, POSES[band].right],
        [-1, POSES[band].left],
      ] as const) {
        const j = legJoints(s.leg, side)
        const len = (a: typeof j.hip, b: typeof j.hip) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
        expect(len(j.hip, j.knee)).toBeCloseTo(2.15, 5)
        expect(len(j.knee, j.ankle)).toBeCloseTo(2.0, 5)
      }
  })

  it('a resting arm is ARM; a posed arm keeps its root in the shoulder', () => {
    for (const band of ACTIVITY_BANDS)
      for (const a of posedLimbs(band).arms) {
        const root = a.parts[0]!.curve.getPointAt(0)
        expect(root.x * a.side).toBeCloseTo(ARM.getPointAt(0).x, 5)
        expect(root.y).toBeCloseTo(ARM.getPointAt(0).y, 5)
      }
  })

  it('the leg is widest at the hip, narrows at the knee, ends in a flat foot', () => {
    expect(legRadius(0)).toBeGreaterThan(legRadius(KNEE_U))
    expect(legRadius(0.6)).toBeGreaterThan(legRadius(KNEE_U))
    expect(legRadius(0.97)).toBeGreaterThan(0.15)
    expect(legRadius(1)).toBe(0)
  })
})

describe('landmarks and the spleen sit inside the body', () => {
  const inTorso = (x: number, y: number) => Math.abs(x) <= torsoHalfWidth(y) + 1e-9

  it('backbone, breastbone, ribs and hip bones', () => {
    const p = new Vec3()
    for (const c of [SPINE, STERNUM, ...RIBS])
      for (let i = 0; i <= 20; i++) {
        c.getPointAt(i / 20, p)
        expect(inTorso(p.x, p.y), `${p.x.toFixed(2)}, ${p.y.toFixed(2)}`).toBe(true)
      }
    expect(RIBS).toHaveLength(12)
    for (const [x, y] of PELVIS) expect(inTorso(x, y), `${x}, ${y}`).toBe(true)
  })

  it('the spleen is on the person’s left, under the ribs, concave towards the stomach', () => {
    expect(SPLEEN.center.x).toBeGreaterThan(0)
    expect(inTorso(SPLEEN.center.x + SPLEEN.rx, SPLEEN.center.y)).toBe(true)
    const inner = spleenPoint({ x: -1, y: 0, z: 0 }, new Vec3())
    const outer = spleenPoint({ x: 1, y: 0, z: 0 }, new Vec3())
    expect(SPLEEN.center.x - inner.x).toBeLessThan(outer.x - SPLEEN.center.x)
  })
})
