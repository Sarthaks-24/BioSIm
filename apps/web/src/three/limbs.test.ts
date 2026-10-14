import { describe, expect, it } from 'vitest'
import { Box3, BufferGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { FRAMINGS, TORSO_PROFILE } from '../anatomy/human/base.ts'
import { ACTIVITY_BANDS, type ActivityBand } from '../anatomy/human/bands.ts'
import { LIMB_KIT } from '../anatomy/human/kit.ts'
import { KNEE_U, POSES, SOLE_Y, legJoints, posedLimbs } from '../anatomy/human/limbs.ts'
import { buildShell, shellTrunk } from './geometry.ts'
import { KIT_3D } from './kit.ts'
import { bodyView, CAMERA, LEGS, PHONE_PX } from './framing.ts'
import { mountGhost, mountPosed, mountStats, pinGhost, pinPosed, releaseGhost, releasePosed } from './mount.ts'
import LIMBS_3D from './limbs.ts'

LIMBS_3D.takeKit(LIMB_KIT)

const triangles = (g: BufferGeometry) => (g.index ? g.index.count : g.getAttribute('position').count) / 3
const shellOf = (band: ActivityBand, tier: 'low' | 'high') =>
  mergeGeometries([...shellTrunk(tier, true), ...LIMBS_3D.skin(band, tier, KIT_3D)])!

describe('3D legs (A-1a; anatomy plan §1, §3, §9)', () => {
  it('the posed shell merges with the torso and head: position and normal only, like the resting shell', () => {
    for (const band of ACTIVITY_BANDS) {
      const g = shellOf(band, 'high')
      expect(Object.keys(g.attributes).sort(), band).toEqual(Object.keys(buildShell('high').attributes).sort())
    }
  })

  it('stands on the flat legs’ curves: its knees and feet where anatomy/human/limbs.ts puts them, in every pose', () => {
    for (const band of ACTIVITY_BANDS) {
      const box = new Box3().setFromBufferAttribute(shellOf(band, 'high').getAttribute('position') as never)
      // The lowest sole is the flat legs' (a foot on the ground at rest and in a walk; both off it in a run).
      const soles = ([1, -1] as const).map((side) => legJoints(POSES[band][side === 1 ? 'right' : 'left'].leg, side).sole.y)
      expect(box.min.y, band).toBeCloseTo(Math.min(...soles), 1)
      expect(box.min.y, band).toBeGreaterThan(FRAMINGS.full.minY)
      // As wide as the arms' reach, no wider (the framings' ±1.45).
      expect(Math.max(-box.min.x, box.max.x), band).toBeLessThan(FRAMINGS.full.maxX)
      // A knee cap sits on each leg's curve at the knee.
      const pos = shellOf(band, 'high').getAttribute('position')
      for (const leg of posedLimbs(band).legs) {
        const knee = leg.curve.getPointAt(KNEE_U, new Vector3())
        let near = Infinity
        for (let i = 0; i < pos.count; i++) near = Math.min(near, new Vector3().fromBufferAttribute(pos, i).distanceTo(knee))
        expect(near, `${band} knee`).toBeLessThan(0.3)
      }
    }
    expect(SOLE_Y).toBeCloseTo(-5.8, 5)
  })

  it('keeps the four poses apart (one still pose per band, R32), and the same band gives the same shell', () => {
    const tops = ACTIVITY_BANDS.map((band) => {
      const box = new Box3().setFromBufferAttribute(shellOf(band, 'high').getAttribute('position') as never)
      return `${box.min.y.toFixed(2)}:${box.max.z.toFixed(2)}`
    })
    expect(new Set(tops).size).toBe(4)
    expect(triangles(shellOf('run', 'high'))).toBe(triangles(shellOf('run', 'high')))
  })

  it('flattens the hips only with legs: the resting shell is today’s', () => {
    const lowest = (g: BufferGeometry) => new Box3().setFromBufferAttribute(g.getAttribute('position') as never).min.y
    expect(lowest(shellTrunk('high')[0]!)).toBeCloseTo(TORSO_PROFILE[0]![1], 5)
    expect(lowest(shellTrunk('high', true)[0]!)).toBeGreaterThan(TORSO_PROFILE[0]![1] + 0.15)
  })

  it('a 2 GB phone builds a lighter shell (plan §9): its shell with legs is at most 14k triangles, the high one at most 30k', () => {
    for (const band of ACTIVITY_BANDS) {
      const low = triangles(shellOf(band, 'low'))
      const high = triangles(shellOf(band, 'high'))
      expect(low, band).toBeLessThanOrEqual(14_000)
      expect(high, band).toBeLessThanOrEqual(30_000)
      expect(low, band).toBeLessThan(high * 0.5)
    }
  })

  it('the skeleton ghost is one merged mesh of at most 6k triangles in every pose (plan §1)', () => {
    for (const band of ACTIVITY_BANDS) {
      const g = mergeGeometries(LIMBS_3D.ghost(band, KIT_3D))!
      expect(triangles(g), band).toBeLessThanOrEqual(6_000)
      expect(Object.keys(g.attributes).sort()).toEqual(['normal', 'position'])
    }
  })

  it('mounts and frees: a posed shell and a ghost are built once a band and their GPU side goes when no body shows them', () => {
    const freed: string[] = []
    // As a renderer listens (three's WebGLGeometries): the listener goes with the dispose.
    const watch = (geo: BufferGeometry, name: string) => {
      const listener = () => {
        freed.push(name)
        geo.removeEventListener('dispose', listener)
      }
      geo.addEventListener('dispose', listener)
    }
    const a = mountPosed(LIMBS_3D, 'high', 'walk')
    const b = mountPosed(LIMBS_3D, 'high', 'walk')
    expect(b.shell).toBe(a.shell)
    expect(a.prepass).not.toBeNull()
    expect(mountPosed(LIMBS_3D, 'low', 'walk').prepass).toBeNull()
    watch(a.shell, 'shell')
    pinPosed(a)
    pinPosed(b)
    releasePosed(a)
    expect(freed).toEqual([])
    releasePosed(b)
    expect(freed).toEqual(['shell'])
    const g = mountGhost(LIMBS_3D, 'run', false)
    watch(g.geometry, 'ghost')
    pinGhost(g)
    releaseGhost(g)
    expect(freed).toEqual(['shell', 'ghost'])
    expect(mountStats().uploaded).toBe(0)
  })
})

describe('3D framings and the whole-body switch (A-1a; anatomy plan §1)', () => {
  it('torso and chest keep their views (the body keeps its size); a bout gives them legs', () => {
    expect(bodyView('torso', 'rest', false, 840)).toMatchObject({
      framing: 'torso',
      goal: CAMERA.torso,
      legs: false,
      offerWhole: true,
      maxDistance: 11,
    })
    expect(bodyView('torso', 'run', false, 840)).toMatchObject({ framing: 'torso', goal: CAMERA.torso, legs: true })
    expect(bodyView('chest', 'walk', false, 390)).toMatchObject({ framing: 'chest', goal: CAMERA.chest, legs: true })
  })

  it('the whole-body switch shows the whole standing body, legs and all, from any framing', () => {
    for (const own of ['torso', 'chest', 'full'] as const)
      expect(bodyView(own, 'rest', true, 840)).toMatchObject({
        framing: 'full',
        goal: CAMERA.full,
        legs: true,
        offerWhole: true,
        maxDistance: 19,
      })
  })

  it('the full framing: the whole body on a wide pane (no switch); on a phone, close up on the working region with the switch', () => {
    expect(bodyView('full', 'walk', false, 840)).toMatchObject({ goal: CAMERA.full, offerWhole: false })
    expect(bodyView('full', 'walk', false, PHONE_PX - 1)).toMatchObject({ goal: LEGS, legs: true, offerWhole: true })
    expect(bodyView('full', 'rest', false, PHONE_PX - 1)).toMatchObject({ goal: CAMERA.chest, offerWhole: true })
    expect(bodyView('full', 'rest', true, PHONE_PX - 1)).toMatchObject({ goal: CAMERA.full })
  })

  it('the full preset fits the standing body (scene y −6.0 … 3.5) in the camera’s 32° view', () => {
    const half = CAMERA.full!.distance * Math.tan((16 * Math.PI) / 180)
    expect(CAMERA.full!.y - half).toBeLessThan(FRAMINGS.full.minY)
    expect(CAMERA.full!.y + half).toBeGreaterThan(FRAMINGS.full.maxY - 0.05)
  })
})
