import { describe, expect, it } from 'vitest'
import type { RunResult, Series } from '@lifepeek/engine'
import { ATRIA_ORIGIN, SEPTUM, VENTRICLES, VENTRICLE_ORIGIN, VESSELS } from '../../anatomy/human/circulation.ts'
import { MAX_DRAWN_HZ } from '../../flat/rate.ts'
import { SQUEEZED, atriaScale, squeezeOf, ventricleScale } from '../../systems/circulation/beat.ts'
import { KIT_3D } from '../kit.ts'
import { LAYER_ATTRIBUTES, type LayerState } from '../layer.ts'
import { DASH } from '../materials.ts'
import { LRU_BYTES, geometryBytes, mountLayer, pinLayer, releaseLayer } from '../mount.ts'
import HEART_3D, {
  DEPTH,
  LEG_CUT,
  ORGANS,
  VENTRICLES_CENTRE,
  VESSEL_DEPTH,
  radialTable,
  septumSide,
  smoothOutline,
  vesselPath,
} from './circulation.ts'

/** A run whose heart beats `rate` a minute pushing `stroke` mL a beat, `output` L a minute, with gut and muscle flows (mL a minute), all day. */
function run(rate: number, stroke = 65, output = 4.3, gut = 1030, muscle = 900): RunResult {
  const flat = (id: string, v: number) =>
    [id, { id, t0: 0, values: Float32Array.from({ length: 10 }, (_, i) => (i ? v : Math.min(v, 4.3))) } as unknown as Series] as const
  return {
    stepMin: 1,
    signals: new Map([
      flat('heart.rate', rate),
      flat('heart.strokeVolume', stroke),
      flat('heart.output', output),
      flat('blood.flow.gut', gut),
      flat('blood.flow.muscle', muscle),
    ]),
  } as unknown as RunResult
}
const state = (): LayerState => ({
  state: ORGANS.map(() => 9),
  fill: ORGANS.map(() => 9),
  dash: ORGANS.map(() => 9),
  flow: ORGANS.map(() => 9),
})
const at = (o: (typeof ORGANS)[number]) => ORGANS.indexOf(o)
const triangles = (tier: 'low' | 'high') => HEART_3D.build(tier, KIT_3D).index!.count / 3

describe('3D heart and both loops (A-5)', () => {
  const geo = HEART_3D.build('high', KIT_3D)
  const pos = geo.getAttribute('position')
  const organ = geo.getAttribute('organ')
  const chamber = geo.getAttribute('chamber')

  it('every vertex has the shared attribute set (A-0 3D); the heart’s carry their chamber, nothing else does', () => {
    expect(Object.keys(geo.attributes).sort()).toEqual([...LAYER_ATTRIBUTES].sort())
    expect((geo.getAttribute('seg').array as Float32Array).every((v) => v === 0)).toBe(true)
    expect([...new Set(organ.array as Float32Array)].sort()).toEqual(ORGANS.map((_, i) => i))
    const chambers = new Map<number, Set<number>>()
    for (let i = 0; i < pos.count; i++) {
      const o = organ.getX(i)
      const c = chamber.getX(i)
      if (o !== at('atria') && o !== at('ventricles')) expect(c).toBe(0)
      else chambers.set(o, (chambers.get(o) ?? new Set()).add(c))
      // The ventricles split by the septum: right (3) on the viewer's left of its line, left (4) on the right.
      if (o === at('ventricles')) expect(c).toBe(septumSide(pos.getX(i), pos.getY(i)) < 0 ? 3 : 4)
    }
    expect([...chambers.get(at('atria'))!].sort()).toEqual([1, 2])
    expect([...chambers.get(at('ventricles'))!].sort()).toEqual([3, 4])
    // The septum's side: the apex is the left ventricle's, the base's left end the right's.
    expect(septumSide(0.3, 1.0)).toBeGreaterThan(0)
    expect(septumSide(-0.15, 1.3)).toBeLessThan(0)
    expect(Math.abs(septumSide(...SEPTUM[1]!))).toBeLessThan(1e-9)
  })

  it('fits the GPU budget (anatomy plan §9): drawn twice it leaves room for the shell under 150k (high) and 60k (low)', () => {
    // Rendered = tissue + outline (2 draws of the layer) + the shell (~10k). Plan: heart ≈ 40k drawn.
    expect(2 * triangles('high')).toBeLessThan(80_000)
    expect(2 * triangles('low')).toBeLessThan(40_000)
    expect(triangles('low')).toBeLessThan(triangles('high') * 0.6)
    expect(geometryBytes(geo)).toBeLessThan(LRU_BYTES / 2)
  })

  it('the ventricles’ outline is star-shaped from their centre, so the mesh never folds', () => {
    const pts = smoothOutline(VENTRICLES)
    const table = radialTable(pts, VENTRICLES_CENTRE, 360)
    expect(Math.min(...table)).toBeGreaterThan(0.1)
    for (const [x, y] of pts) {
      const th = Math.atan2(y - VENTRICLES_CENTRE[1], x - VENTRICLES_CENTRE[0])
      const i = Math.round(((th / (Math.PI * 2)) * 360 + 360) % 360) % 360
      expect(Math.abs(table[i]! - Math.hypot(x - VENTRICLES_CENTRE[0], y - VENTRICLES_CENTRE[1]))).toBeLessThan(0.02)
    }
  })

  it('front-on, the heart is the flat drawing’s: the same width and height; the left ventricle the fuller', () => {
    let [minX, maxX, minY, maxY, rightZ, leftZ] = [Infinity, -Infinity, Infinity, -Infinity, 0, 0]
    for (let i = 0; i < pos.count; i++) {
      if (organ.getX(i) !== at('ventricles')) continue
      const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)]
      ;[minX, maxX, minY, maxY] = [Math.min(minX, x), Math.max(maxX, x), Math.min(minY, y), Math.max(maxY, y)]
      if (chamber.getX(i) === 3) rightZ = Math.max(rightZ, z)
      else leftZ = Math.max(leftZ, z)
    }
    expect(minX).toBeCloseTo(-0.21, 1)
    expect(maxX).toBeCloseTo(0.4, 1)
    expect(minY).toBeCloseTo(0.93, 1)
    expect(maxY).toBeCloseTo(1.43, 1)
    expect(leftZ).toBeGreaterThan(rightZ)
    expect(Math.max(leftZ, rightZ)).toBeLessThan(0.3) // inside the shell's front (≈ 0.5)
  })

  it('every vessel follows its flat path, one depth a point; the legs’ stop inside the shell', () => {
    for (const v of VESSELS) {
      expect(VESSEL_DEPTH[v.id], v.id).toHaveLength(v.path.length)
      const p = vesselPath(v)
      const [x0, y0] = v.path[0]!
      const [x1, y1] = v.path[v.path.length - 1]!
      if (v.bed !== 'legs') {
        expect(p.point(0)).toMatchObject({ x: x0, y: y0 })
        expect(p.point(1).x).toBeCloseTo(x1, 6)
        expect(p.point(1).y).toBeCloseTo(y1, 6)
      } else expect(Math.min(p.point(0).y, p.point(1).y)).toBeCloseTo(LEG_CUT, 6)
    }
    // Ghosts sit behind every vessel; the heart in front of the aorta behind it.
    for (const v of VESSELS) for (const z of VESSEL_DEPTH[v.id]!) expect(z).toBeGreaterThan(DEPTH.lungs.mid + DEPTH.lungs.front - 1e-9)
    let ghostFront = -Infinity
    for (let i = 0; i < pos.count; i++)
      if (organ.getX(i) === at('lungs') || organ.getX(i) === at('ghost')) ghostFront = Math.max(ghostFront, pos.getZ(i))
    expect(ghostFront).toBeLessThan(-0.26)
  })

  it('a vessel’s `along` is its distance from its start (for its dashes); the heart and ghosts have none', () => {
    const along = geo.getAttribute('along')
    const aorta = vesselPath(VESSELS.find((v) => v.id === 'aorta')!).getLength()
    let most = 0
    for (let i = 0; i < pos.count; i++) {
      const o = organ.getX(i)
      if (o >= at('toBody') && o <= at('toLegs')) most = Math.max(most, along.getX(i))
      else expect(along.getX(i)).toBe(0)
    }
    expect(most).toBeCloseTo(aorta, 3)
    expect(DASH.length).toBeLessThan(DASH.gap)
  })

  it('beats as the flat drawing: atria then ventricles, each towards its own point, size only (no state, no colour)', () => {
    const origins = HEART_3D.grow!.origins
    expect(origins[at('atria')]).toEqual([ATRIA_ORIGIN.x, ATRIA_ORIGIN.y, DEPTH.heart.mid])
    expect(origins[at('ventricles')]).toEqual([VENTRICLE_ORIGIN.x, VENTRICLE_ORIGIN.y, DEPTH.heart.mid])
    const out = state()
    const r = run(66, 65)
    const squeeze = squeezeOf(65)
    for (const phase of [0, 0.12, SQUEEZED, 0.8]) {
      HEART_3D.write(out, r, 5, phase)
      expect(out.fill[at('atria')]).toBeCloseTo(atriaScale(phase, squeeze) - 1, 9)
      expect(out.fill[at('ventricles')]).toBeCloseTo(ventricleScale(phase, squeeze) - 1, 9)
      // Nothing else moves, and no organ's look depends on the phase: the ghosts faded back, the rest normal.
      for (const o of ['toBody', 'toLungs', 'toGut', 'toLegs', 'lungs', 'ghost'] as const) expect(out.fill[at(o)]).toBe(9)
      expect(out.state).toEqual(ORGANS.map((o) => (o === 'lungs' || o === 'ghost' ? -1 : 0)))
    }
    HEART_3D.write(out, r, 5, SQUEEZED)
    expect(out.fill[at('ventricles')]).toBeCloseTo(-squeeze, 9)
    // Only the heart grows or shrinks; every vessel and ghost vertex stays put.
    const inflate = geo.getAttribute('inflate')
    for (let i = 0; i < pos.count; i++) expect(inflate.getX(i)).toBe(organ.getX(i) <= at('ventricles') ? 1 : 0)
  })

  it('dashes: none on the heart and ghosts; denser on the gut’s with blood to the gut, on the legs’ with blood to the muscles', () => {
    const rest = state()
    HEART_3D.write(rest, run(66, 65, 4.3, 1030, 900), 5, 0)
    expect(rest.dash).toEqual([0, 0, 1, 1, 1, 1, 0, 0])
    const walk = state()
    HEART_3D.write(walk, run(120, 90, 10, 1030, 6000), 5, 0)
    expect(walk.dash[at('toLegs')]).toBe(4)
    const meal = state()
    HEART_3D.write(meal, run(70, 66, 4.6, 1900, 900), 5, 0)
    expect(meal.dash[at('toGut')]).toBeGreaterThan(1.5)
    // Every vessel's dashes have moved the same way (one speed: the blood pumped a minute).
    expect(new Set(walk.flow.slice(at('toBody'), at('toLegs') + 1)).size).toBe(1)
  })

  it('the beat is drawn at the model’s rate, at most 2.5 a second; reduced motion stands still, relaxed', () => {
    const r = HEART_3D.rhythm!
    expect(r.hz(run(66), 5)).toBeCloseTo(1.1, 6)
    expect(r.hz(run(162), 5)).toBe(MAX_DRAWN_HZ)
    expect(r.still).toBe(0)
    expect(ventricleScale(r.still, 0.12)).toBe(1)
    expect(r.probe!(run(66, 65, 8.6, 1030, 2700), 5, r.still, true)).toEqual({
      beat: 'still',
      beatHz: '1.10',
      ventricleScale: '1.000',
      squeeze: squeezeOf(65).toFixed(3),
      dashGut: '1',
      dashLegs: '3',
      dashSpeed: '2.00',
    })
  })

  it('mounts in the chest framing, without the food, with its own program that grows and draws dashes', () => {
    expect(HEART_3D).toMatchObject({ framing: 'chest', food: false, dashes: true })
    const m = mountLayer(HEART_3D, 'high')
    expect(m.tissue.customProgramCacheKey()).toBe(`lifepeek-tissue:circulation:${ORGANS.length}`)
    expect(m.state.dash).toBe(m.uniforms.uDash.value)
    expect(m.state.flow).toBe(m.uniforms.uFlow.value)
    const shader = {
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>',
      uniforms: {} as Record<string, unknown>,
    }
    m.tissue.onBeforeCompile(shader as never, undefined as never)
    expect(shader.vertexShader).toContain('vAlong = along')
    expect(shader.fragmentShader).toContain('uniform float uDash[8]')
    expect(shader.uniforms).toHaveProperty('uFlow', m.uniforms.uFlow)
    pinLayer(m)
    releaseLayer(m)
  })
})
