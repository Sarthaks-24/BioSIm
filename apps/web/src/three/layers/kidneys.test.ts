import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RunResult, Series } from '@lifepeek/engine'
import {
  AORTA,
  BLADDER_BASE,
  KIDNEY,
  RIBS,
  RIGHT_DROP,
  VENA_CAVA,
  bladderRadius,
  kidneyOutline,
  renalArtery,
  renalVein,
  ureter,
} from '../../anatomy/human/kidneys.ts'
import { KIDNEY_TONE } from '../../anatomy/tones/kidneys.ts'
import { stepMl, ureterSpeed } from '../../systems/kidneys/water.ts'
import { KIT_3D } from '../kit.ts'
import { LAYER_ATTRIBUTES, type LayerState } from '../layer.ts'
import { LRU_BYTES, geometryBytes, mountLayer, pinLayer, releaseLayer } from '../mount.ts'
import KIDNEYS_3D, {
  BLADDER_AT,
  BLADDER_R0,
  DEPTH,
  DROP_DENSITY,
  ORGANS,
  PULSE_HZ,
  URETER_DEPTH,
  URINE_INK,
  WIDTH,
  aortaZ,
  bladderScale,
  kidneyZ,
  renalArtery3d,
  renalVein3d,
  rib3d,
  trunk3d,
  ureter3d,
  venaCavaZ,
  type TubePath,
} from './kidneys.ts'

/** A run whose bladder holds `ml` (one value a minute; a number or a list) and makes `urine` mL an hour. */
function run(ml: number | number[], urine = 60): RunResult {
  const series = (id: string, values: number[]) => [id, { id, t0: 0, values: Float32Array.from(values) } as unknown as Series] as const
  const bladder = typeof ml === 'number' ? Array.from({ length: 10 }, () => ml) : ml
  return {
    stepMin: 1,
    signals: new Map([
      series('kidney.bladderMl', bladder),
      series(
        'kidney.urineRate',
        bladder.map(() => urine),
      ),
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
const triangles = (tier: 'low' | 'high') => KIDNEYS_3D.build(tier, KIT_3D).index!.count / 3

/** The closest two centre lines come (sampled), and the depths of each there. */
function closest(a: TubePath, b: TubePath) {
  let best = { d: Infinity, za: 0, zb: 0 }
  for (let i = 0; i <= 200; i++)
    for (let j = 0; j <= 200; j++) {
      const [p, q] = [a.point(i / 200), b.point(j / 200)]
      const d = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)
      if (d < best.d) best = { d, za: p.z, zb: q.z }
    }
  return best
}

afterEach(() => vi.restoreAllMocks())

describe('3D kidneys, ureters and bladder (A-6)', () => {
  const geo = KIDNEYS_3D.build('high', KIT_3D)
  const pos = geo.getAttribute('position')
  const organ = geo.getAttribute('organ')

  it('every vertex has the shared attribute set (A-0 3D), every organ is in the mesh, no chamber or segment', () => {
    expect(Object.keys(geo.attributes).sort()).toEqual([...LAYER_ATTRIBUTES].sort())
    expect([...new Set(organ.array as Float32Array)].sort()).toEqual(ORGANS.map((_, i) => i))
    expect((geo.getAttribute('chamber').array as Float32Array).every((v) => v === 0)).toBe(true)
    expect((geo.getAttribute('seg').array as Float32Array).every((v) => v === 0)).toBe(true)
  })

  it('fits the GPU budget (anatomy plan §9): drawn twice it leaves room for the shell under 150k (high) and 60k (low)', () => {
    expect(2 * triangles('high')).toBeLessThan(60_000)
    expect(2 * triangles('low')).toBeLessThan(30_000)
    expect(triangles('low')).toBeLessThan(triangles('high') * 0.6)
    expect(geometryBytes(geo)).toBeLessThan(LRU_BYTES / 4)
  })

  it('front-on, each kidney is the flat bean (the person’s right one lower), at the back inside the shell, notch forward', () => {
    for (const side of [1, -1] as const) {
      const bean = kidneyOutline(side)
      const flat = {
        minX: Math.min(...bean.map((p) => p[0])),
        maxX: Math.max(...bean.map((p) => p[0])),
        minY: Math.min(...bean.map((p) => p[1])),
        maxY: Math.max(...bean.map((p) => p[1])),
      }
      let [minX, maxX, minY, maxY, minZ, maxZ] = [Infinity, -Infinity, Infinity, -Infinity, Infinity, -Infinity]
      for (let i = 0; i < pos.count; i++) {
        if (organ.getX(i) !== at('kidneys') || Math.sign(pos.getX(i)) !== side) continue
        const [x, y, z] = [pos.getX(i), pos.getY(i), pos.getZ(i)]
        ;[minX, maxX, minY, maxY, minZ, maxZ] = [
          Math.min(minX, x),
          Math.max(maxX, x),
          Math.min(minY, y),
          Math.max(maxY, y),
          Math.min(minZ, z),
          Math.max(maxZ, z),
        ]
      }
      // The smoothed outline lies within the bean's points, close to them.
      expect(minX).toBeGreaterThan(flat.minX - 0.005)
      expect(maxX).toBeLessThan(flat.maxX + 0.005)
      expect(maxX - minX).toBeGreaterThan(0.9 * (flat.maxX - flat.minX))
      expect(maxY - minY).toBeGreaterThan(0.9 * (flat.maxY - flat.minY))
      expect((minY + maxY) / 2).toBeCloseTo(KIDNEY.y - (side < 0 ? RIGHT_DROP : 0), 1)
      // At the back of the belly (the shell's back is ≈ −0.35 here), in front of the lowest ribs.
      expect(minZ).toBeGreaterThan(-0.34)
      expect(maxZ).toBeLessThan(-0.05)
    }
    // The notch side (towards the backbone) comes forward; the upper pole goes back.
    expect(kidneyZ(1, 0.3, 0.5)).toBeGreaterThan(kidneyZ(1, 0.55, 0.5))
    expect(kidneyZ(1, 0.42, 0.75)).toBeLessThan(kidneyZ(1, 0.42, 0.3))
  })

  it('the vessels and ureters follow the flat paths, one depth a point, from inside each kidney', () => {
    for (const side of [1, -1] as const) {
      const art = renalArtery3d(side)
      const [ax, ay] = renalArtery(side)[0]!
      expect(art.point(0)).toMatchObject({ x: ax, y: ay, z: aortaZ(ay) })
      const vein = renalVein3d(side)
      const [vx, vy] = renalVein(side)[2]!
      expect(vein.point(1).x).toBeCloseTo(vx, 6)
      expect(vein.point(1).y).toBeCloseTo(vy, 6)
      expect(vein.point(1).z).toBeCloseTo(venaCavaZ(vy), 6)
      const ure = ureter3d(side)
      const [ux, uy] = ureter(side)[ureter(side).length - 1]!
      expect(ure.point(1).x).toBeCloseTo(ux, 6)
      expect(ure.point(1).y).toBeCloseTo(uy, 6)
      expect(URETER_DEPTH).toHaveLength(ureter(side).length)
      // Each starts (or ends) inside its kidney, beyond the notch.
      for (const p of [art.point(1), vein.point(0), ure.point(0)]) expect(side * p.x).toBeGreaterThan(KIDNEY.x - 0.05)
    }
    expect(trunk3d(AORTA, aortaZ).point(0)).toMatchObject({ x: AORTA.x, y: AORTA.top })
    expect(trunk3d(VENA_CAVA, venaCavaZ).point(1).y).toBeCloseTo(VENA_CAVA.bottom, 6)
  })

  it('as a book’s figure: the left kidney vein crosses in front of the aorta, the right kidney artery behind the vena cava, no tube through another', () => {
    const aorta = trunk3d(AORTA, aortaZ)
    const cava = trunk3d(VENA_CAVA, venaCavaZ)
    const leftVein = closest(renalVein3d(1), aorta)
    expect(leftVein.d).toBeGreaterThan((WIDTH.vein + AORTA.width) / 2)
    expect(leftVein.za).toBeGreaterThan(leftVein.zb)
    const rightArtery = closest(renalArtery3d(-1), cava)
    expect(rightArtery.d).toBeGreaterThan((WIDTH.artery + VENA_CAVA.width) / 2)
    expect(rightArtery.za).toBeLessThan(rightArtery.zb)
    // The ureters keep clear of the big vessels; the lowest ribs keep behind the kidneys.
    for (const side of [1, -1] as const) {
      expect(closest(ureter3d(side), aorta).d).toBeGreaterThan((WIDTH.ureter + AORTA.width) / 2)
      expect(closest(ureter3d(side), cava).d).toBeGreaterThan((WIDTH.ureter + VENA_CAVA.width) / 2)
    }
    let kidneyBack = Infinity
    for (let i = 0; i < pos.count; i++) if (organ.getX(i) === at('kidneys')) kidneyBack = Math.min(kidneyBack, pos.getZ(i))
    for (const rib of RIBS)
      for (const side of [1, -1] as const) {
        const r = rib3d(rib, side)
        for (let k = 0; k <= 50; k++) {
          const p = r.point(k / 50)
          // Where a rib runs behind a kidney (front-on over it), it is behind the kidney's back.
          if (Math.abs(side * p.x - KIDNEY.x) < 0.1 && p.y > 0.25 && p.y < 0.75)
            expect(p.z + WIDTH.rib / 2).toBeLessThan(kidneyZ(side, p.x, p.y) - 0.04)
        }
      }
    expect(kidneyBack).toBeGreaterThan(DEPTH.ribs[0])
  })

  it('the bladder is built at 300 mL on its base (the flat ellipse, 1.1 times as wide as tall) and only it grows, from the base', () => {
    let [minX, maxX, minY, maxY] = [Infinity, -Infinity, Infinity, -Infinity]
    const inflate = geo.getAttribute('inflate')
    for (let i = 0; i < pos.count; i++) {
      const o = organ.getX(i)
      expect(inflate.getX(i)).toBe(o === at('bladder') ? 1 : 0)
      if (o !== at('bladder')) continue
      ;[minX, maxX, minY, maxY] = [
        Math.min(minX, pos.getX(i)),
        Math.max(maxX, pos.getX(i)),
        Math.min(minY, pos.getY(i)),
        Math.max(maxY, pos.getY(i)),
      ]
    }
    expect(BLADDER_R0).toBe(bladderRadius(300))
    expect(minY).toBeCloseTo(BLADDER_BASE.y, 3)
    expect(maxX - minX).toBeCloseTo(2.2 * BLADDER_R0, 2)
    expect(maxY - minY).toBeGreaterThan(2 * BLADDER_R0)
    expect(maxY - minY).toBeLessThan(2.15 * BLADDER_R0)
    for (const o of KIDNEYS_3D.grow!.origins) expect(o).toEqual([BLADDER_AT.x, BLADDER_AT.y, BLADDER_AT.z])
  })

  it('the bladder’s size follows its gated volume as the flat one, never drawn above 600 mL', () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(10_000)
    for (const [ml, drawn] of [
      [0, 0],
      [160, 150],
      [310, 300],
      [590, 575],
      [900, 575],
    ] as const) {
      const out = state()
      KIDNEYS_3D.write(out, run(ml), 5, 0, true)
      expect(out.fill[at('bladder')]).toBeCloseTo(bladderRadius(drawn) / bladderRadius(300) - 1, 9)
      expect(out.fill[at('bladder')]).toBeLessThanOrEqual(bladderScale(600) - 1 + 1e-12)
    }
    expect(bladderScale(900)).toBe(bladderScale(600))
    expect(stepMl(99)).toBe(600)
    // Nothing else grows; the ribs are faded back, the rest normal; nothing ever changes colour.
    const out = state()
    KIDNEYS_3D.write(out, run(200), 5, 0)
    expect(out.state).toEqual(ORGANS.map((o) => (o === 'ribs' ? -1 : 0)))
    for (const o of ORGANS) if (o !== 'bladder') expect(out.fill[at(o)]).toBe(0)
    now.mockRestore()
  })

  it('scrub-safe: a fast drag changes the drawn size at most once a real second, then lands on the right size (a frame asked for later)', () => {
    let clock = 50_000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    // 0, 100, 200 … 900 mL over ten minutes.
    const sim = run(Array.from({ length: 10 }, (_, i) => i * 100))
    const out = state()
    KIDNEYS_3D.write(out, sim, 0, 0, true)
    expect(out.fill[at('bladder')]).toBeCloseTo(bladderScale(0) - 1, 9)
    // Dragged to minute 3 (300 mL): moves (to 275 mL, half a step short of 300 as the gate's rule).
    clock += 1500
    KIDNEYS_3D.write(out, sim, 3, 0, true)
    const first = out.fill[at('bladder')]
    expect(first).toBeCloseTo(bladderScale(275) - 1, 9)
    // On to minute 6 within the same second: held back, and one more frame is asked for.
    clock += 200
    out.later = 0
    KIDNEYS_3D.write(out, sim, 6, 0, true)
    expect(out.fill[at('bladder')]).toBe(first)
    expect(out.later).toBe(1050)
    // A second later, the frame it asked for lands on the right size (600 mL: its top step, 575).
    clock += 1000
    out.later = 0
    KIDNEYS_3D.write(out, sim, 6, 0, true)
    expect(out.fill[at('bladder')]).toBeCloseTo(bladderScale(575) - 1, 9)
    expect(out.later).toBe(0)
    // Within half a step past a boundary (550 → 580 mL), nothing moves and nothing is asked for.
    const near = run([560, 580])
    KIDNEYS_3D.write(out, near, 0, 0, true)
    const settled = out.fill[at('bladder')]
    expect(settled).toBeCloseTo(bladderScale(550) - 1, 9)
    clock += 2000
    out.later = 0
    KIDNEYS_3D.write(out, near, 1, 0, true)
    expect(out.fill[at('bladder')]).toBe(settled)
    expect(out.later).toBe(0)
  })

  it('with motion, a size change eases over 200 ms; reduced, it is a cut', () => {
    let clock = 90_000
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    // 320 mL: more than half a step past 300, so the gate moves to it at once.
    const sim = run([0, 320])
    const out = state()
    KIDNEYS_3D.write(out, sim, 0, 0, false)
    clock += 1500
    KIDNEYS_3D.write(out, sim, 1, 0, false)
    const start = out.fill[at('bladder')]!
    expect(start).toBeCloseTo(bladderScale(0) - 1, 9)
    clock += 100
    KIDNEYS_3D.write(out, sim, 1, 0, false)
    expect(out.fill[at('bladder')]).toBeGreaterThan(start)
    expect(out.fill[at('bladder')]).toBeLessThan(bladderScale(300) - 1)
    clock += 150
    KIDNEYS_3D.write(out, sim, 1, 0, false)
    expect(out.fill[at('bladder')]).toBeCloseTo(bladderScale(300) - 1, 9)
  })

  it('drops run down the ureters only, as fast as the urine made, in pulses; none with motion reduced', () => {
    const out = state()
    KIDNEYS_3D.write(out, run(100, 300), 5, 0)
    expect(out.dash).toEqual(ORGANS.map((o) => (o === 'ureters' ? DROP_DENSITY : 0)))
    KIDNEYS_3D.write(out, run(100, 300), 5, 0, true)
    expect(out.dash.every((d) => d === 0)).toBe(true)
    // A ureter's `along` is its distance from the kidney (for its drops); elsewhere it stays 0…1.
    const along = geo.getAttribute('along')
    let most = 0
    for (let i = 0; i < pos.count; i++)
      if (organ.getX(i) === at('ureters')) most = Math.max(most, along.getX(i))
      else expect(along.getX(i)).toBeLessThanOrEqual(1)
    expect(most).toBeCloseTo(Math.max(ureter3d(1).getLength(), ureter3d(-1).getLength()), 3)
    // The flat drawing's speed: faster with more urine, in pulses.
    expect(ureterSpeed(400, 0.5)).toBeGreaterThan(ureterSpeed(60, 0.5))
    expect(ureterSpeed(60, 0)).toBeLessThan(ureterSpeed(60, 0.5))
    const r = KIDNEYS_3D.rhythm!
    expect(r.hz(run(0), 0)).toBe(PULSE_HZ)
    expect(r.probe!(run(0), 0, 0, true)).toMatchObject({ drops: 'still' })
    expect(r.probe!(run(0), 0, 0, false)).toMatchObject({ drops: 'moving' })
  })

  it('mounts in the torso framing without the food, with its own program that grows and draws dark drops', () => {
    expect(KIDNEYS_3D).toMatchObject({ framing: 'torso', food: false, dashes: { ink: URINE_INK, cover: 0.25 } })
    expect(URINE_INK).toBe('#2b2107')
    expect(KIDNEY_TONE.ureter).toBe('#d9a521')
    const m = mountLayer(KIDNEYS_3D, 'high')
    expect(m.tissue.customProgramCacheKey()).toBe(`lifepeek-tissue:kidneys:${ORGANS.length}`)
    const shader = {
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <color_fragment>\n#include <opaque_fragment>',
      uniforms: {} as Record<string, unknown>,
    }
    m.tissue.onBeforeCompile(shader as never, undefined as never)
    expect(shader.vertexShader).toContain('uGrowAt')
    expect(shader.fragmentShader).toContain(`uniform float uDash[${ORGANS.length}]`)
    // The drops' colour (linear, not the blood's pale grey) and their width: dots down the tube's middle.
    expect(shader.fragmentShader).toContain('smoothstep(0.75, 0.85, facing)')
    expect(shader.fragmentShader).not.toContain('vec3(0.9000, 0.9000, 0.9000)')
    pinLayer(m)
    releaseLayer(m)
  })
})
