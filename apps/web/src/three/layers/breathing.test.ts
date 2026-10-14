import { describe, expect, it } from 'vitest'
import type { RunResult, Series } from '@lifepeek/engine'
import { LEFT_LUNG, LUNG_TOP, RIGHT_LUNG } from '../../anatomy/human/breathing.ts'
import { MAX_BREATH_HZ } from '../../flat/rhythm.ts'
import { STILL_BREATH, lungScale, fillAt } from '../../systems/breathing/breath.ts'
import { KIT_3D } from '../kit.ts'
import { LAYER_ATTRIBUTES, type LayerState } from '../layer.ts'
import { LRU_BYTES, geometryBytes, mountLayer, pinLayer, releaseLayer } from '../mount.ts'
import LUNGS_3D, { ORGANS, radialTable, smoothOutline } from './breathing.ts'

/** A run whose breaths a minute and air per breath (mL) are `rate` and `tidal` all day. */
function run(rate: number, tidal: number): RunResult {
  const flat = (id: string, v: number) =>
    [id, { id, t0: 0, values: Float32Array.from({ length: 10 }, () => v) } as unknown as Series] as const
  return { stepMin: 1, signals: new Map([flat('lungs.breathRate', rate), flat('lungs.tidalVolume', tidal)]) } as unknown as RunResult
}

const triangles = (tier: 'low' | 'high') => LUNGS_3D.build(tier, KIT_3D).index!.count / 3

describe('3D lungs (A-3)', () => {
  const geo = LUNGS_3D.build('high', KIT_3D)

  it('every vertex has the shared attribute set (A-0 3D), no chamber or posing segment', () => {
    expect(Object.keys(geo.attributes).sort()).toEqual([...LAYER_ATTRIBUTES].sort())
    expect((geo.getAttribute('chamber').array as Float32Array).every((v) => v === 0)).toBe(true)
    expect((geo.getAttribute('seg').array as Float32Array).every((v) => v === 0)).toBe(true)
    const organs = new Set(geo.getAttribute('organ').array as Float32Array)
    expect([...organs].sort()).toEqual(ORGANS.map((_, i) => i))
  })

  it('fits the GPU budget (anatomy plan §9): drawn twice it leaves room for the shell under 150k (high) and 60k (low)', () => {
    // Rendered = tissue + outline (2 draws of the layer) + the shell (~10k). Low tier ≤ 60k in all.
    expect(2 * triangles('high')).toBeLessThan(110_000)
    expect(2 * triangles('low')).toBeLessThan(40_000)
    expect(triangles('low')).toBeLessThan(triangles('high') * 0.6)
    expect(geometryBytes(geo)).toBeLessThan(LRU_BYTES / 2)
  })

  it('each lung outline is star-shaped from its centre (one rim point per direction), so the mesh never folds', () => {
    for (const [outline, c] of [
      [RIGHT_LUNG, [-0.47, 1.45]],
      [LEFT_LUNG, [0.52, 1.45]],
    ] as const) {
      const pts = smoothOutline(outline)
      const table = radialTable(pts, c, 360)
      expect(Math.min(...table)).toBeGreaterThan(0.2)
      // Every outline point is the rim in its own direction (nothing hides behind a nearer crossing).
      for (const [x, y] of pts) {
        const th = Math.atan2(y - c[1], x - c[0])
        const i = Math.round(((th / (Math.PI * 2)) * 360 + 360) % 360) % 360
        expect(Math.abs(table[i]! - Math.hypot(x - c[0], y - c[1]))).toBeLessThan(0.03)
      }
    }
  })

  it('front-on, the lungs are the flat drawing’s: the same width and height', () => {
    const pos = geo.getAttribute('position')
    const organ = geo.getAttribute('organ')
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity]
    for (let i = 0; i < pos.count; i++) {
      if (organ.getX(i) !== ORGANS.indexOf('lungs')) continue
      minX = Math.min(minX, pos.getX(i))
      maxX = Math.max(maxX, pos.getX(i))
      minY = Math.min(minY, pos.getY(i))
      maxY = Math.max(maxY, pos.getY(i))
    }
    expect(minX).toBeCloseTo(-0.8, 1)
    expect(maxX).toBeCloseTo(0.79, 1)
    expect(maxY).toBeCloseTo(2.03, 1)
    // The base wraps a little down over the dome, front and back.
    expect(minY).toBeLessThan(0.95)
    expect(minY).toBeGreaterThan(0.6)
  })

  it('grows as the flat drawing scales: from the lungs’ top, by lungScale; the windpipe stays', () => {
    expect(LUNGS_3D.grow!.origins).toHaveLength(ORGANS.length)
    expect(LUNGS_3D.grow!.origins[ORGANS.indexOf('lungs')]).toEqual([LUNG_TOP.x, LUNG_TOP.y, LUNG_TOP.z])
    const out: LayerState = { state: ORGANS.map(() => 9), fill: ORGANS.map(() => 9), dash: ORGANS.map(() => 0), flow: ORGANS.map(() => 0) }
    const walk = run(26, 1100)
    LUNGS_3D.write(out, walk, 5, 0.5)
    const full = lungScale(1100, fillAt(0.5)) - 1
    expect(out.fill[ORGANS.indexOf('lungs')]).toBeCloseTo(full, 6)
    expect(out.fill[ORGANS.indexOf('diaphragm')]).toBeCloseTo(full, 6)
    expect(out.fill[ORGANS.indexOf('airway')]).toBe(9) // never written: zero from the uniforms' start
    expect(out.state.every((s) => s === 0)).toBe(true)
    // A deeper breath swells more: rest vs walk keep the model's ratio of the swell (plan §4).
    const rest = { ...out, state: [...out.state], fill: [...out.fill] }
    LUNGS_3D.write(rest, run(15, 500), 5, 0.5)
    expect(out.fill[ORGANS.indexOf('lungs')]!).toBeGreaterThan(rest.fill[ORGANS.indexOf('lungs')]! * 1.8)
    // The windpipe and food pipe never move; the lungs and the diaphragm move whole.
    const inflate = geo.getAttribute('inflate')
    const organ = geo.getAttribute('organ')
    const pos = geo.getAttribute('position')
    for (let i = 0; i < inflate.count; i++) {
      const o = ORGANS[organ.getX(i)]
      if (o === 'airway' || o === 'foodPipe') expect(inflate.getX(i)).toBe(0)
      if (o === 'lungs' || o === 'diaphragm') expect(inflate.getX(i)).toBe(1)
      // The main bronchi stay joined to the windpipe at the split.
      if (o === 'bronchi' && Math.hypot(pos.getX(i), pos.getY(i) - 1.62) < 0.03) expect(inflate.getX(i)).toBeLessThan(0.2)
    }
  })

  it('the breath is drawn at the model’s rate, at most 0.8 a second; reduced motion stands half breathed in', () => {
    const r = LUNGS_3D.rhythm!
    expect(r.hz(run(15, 500), 0)).toBeCloseTo(0.25, 6)
    expect(r.hz(run(33, 1400), 0)).toBeCloseTo(0.55, 6)
    expect(r.hz(run(70, 1400), 0)).toBe(MAX_BREATH_HZ)
    expect(r.still).toBe(STILL_BREATH)
    expect(r.probe!(run(15, 500), 0, r.still, true)).toEqual({
      breath: 'still',
      breathHz: '0.25',
      lungScale: lungScale(500, fillAt(STILL_BREATH)).toFixed(3),
      breathPhase: STILL_BREATH.toFixed(3),
    })
  })

  it('mounts in the chest framing, without the food, with its own program that grows (not inflates)', () => {
    expect(LUNGS_3D).toMatchObject({ framing: 'chest', food: false })
    const m = mountLayer(LUNGS_3D, 'high')
    expect(m.tissue.customProgramCacheKey()).toBe(`lifepeek-tissue:breathing:${ORGANS.length}`)
    expect(m.uniforms.uGrowAt.value[ORGANS.indexOf('lungs')]!.toArray()).toEqual([LUNG_TOP.x, LUNG_TOP.y, LUNG_TOP.z])
    expect(m.outline.vertexShader).toContain('uGrowAt')
    pinLayer(m)
    releaseLayer(m)
  })
})
