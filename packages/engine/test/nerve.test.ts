import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NERVE_PARAMS, NERVE_SCENARIOS, NERVE_SOURCES, brainRoute, fibreSpeed, nerveTimeline, reflexTime } from '../src/demo/nerve.ts'

// S-7 engine half: the nerve demo (model §2.6; numbers and pages in src/demo/nerveParams.ts, V-7).
const legSum = (t: ReturnType<typeof reflexTime>) => t.inMs + t.synapseMs + t.thinkingMs + t.outMs + t.nmjMs

describe('nerve demo: hot pan', () => {
  it('reflex lands in the measured onset of a spinal pain reflex in the hand (Isoardo 2026: 70.8 ± 8.2 / 70.2 ± 6.5 ms, mean ± 2 SD)', () => {
    const t = reflexTime('hotPan')
    expect(t.totalMs).toBeGreaterThanOrEqual(Math.min(70.8 - 2 * 8.2, 70.2 - 2 * 6.5))
    expect(t.totalMs).toBeLessThanOrEqual(Math.max(70.8 + 2 * 8.2, 70.2 + 2 * 6.5))
  })

  it('worked values (V-7): 58.07 in + 1.00 synapses + 4.74 out + 0.50 NMJ = 64.31 ms; brain route 214.31 ms', () => {
    const t = reflexTime('hotPan')
    expect(t.inMs).toBeCloseTo(58.067, 2)
    expect(t.synapseMs).toBe(1)
    expect(t.outMs).toBeCloseTo(4.744, 2)
    expect(t.nmjMs).toBe(0.5)
    expect(t.thinkingMs).toBe(0)
    expect(t.totalMs).toBeCloseTo(64.31, 1)
    expect(brainRoute('hotPan').totalMs).toBeCloseTo(214.31, 1)
  })

  it('the route through the brain adds exactly the thinking time and is at least 3× the reflex', () => {
    const reflex = reflexTime('hotPan')
    const brain = brainRoute('hotPan')
    expect(brain.route).toBe('brain')
    expect(brain.totalMs - reflex.totalMs).toBeCloseTo(NERVE_PARAMS.thinkingMs, 9)
    expect(brain.totalMs / reflex.totalMs).toBeGreaterThanOrEqual(3)
  })

  // model §2.6 asks for ≥ 5×. With the heat fibre's read speed (Aδ) the reflex is ~64 ms and the
  // brain route ~214 ms: 3.3× (V-7, "Decide" 1). Waits for the orchestrator's ruling.
  it.todo('golden P: route through the brain ≥ 5× the reflex (sourced numbers give 3.3×; needs a ruling)')

  it('counter: the legs add up to the total (± 1 ms) and the timeline ends at the total, both routes, any myelin', () => {
    for (const myelin of [0, 0.1, 0.5, 0.9, 1])
      for (const t of [reflexTime('hotPan', { myelin }), brainRoute('hotPan', { myelin })]) {
        expect(Math.abs(legSum(t) - t.totalMs)).toBeLessThanOrEqual(1)
        const line = nerveTimeline(t)
        expect(line[0]!.startMs).toBe(0)
        for (let i = 1; i < line.length; i++) expect(line[i]!.startMs).toBe(line[i - 1]!.endMs)
        expect(Math.abs(line.at(-1)!.endMs - t.totalMs)).toBeLessThanOrEqual(1)
        expect(line.some((l) => l.leg === 'thinking')).toBe(t.route === 'brain')
      }
  })

  it('myelin off (thin unmyelinated fibres) makes it much slower: ≥ 10× the reflex, and slower at every step of the slider', () => {
    const on = reflexTime('hotPan')
    const off = reflexTime('hotPan', { myelin: 0 })
    expect(off.inSpeedMPerS).toBe(NERVE_PARAMS.fibreSpeedMPerS.c)
    expect(off.outSpeedMPerS).toBe(NERVE_PARAMS.fibreSpeedMPerS.c)
    expect(off.totalMs).toBeCloseTo(882.63, 1)
    expect(off.totalMs / on.totalMs).toBeGreaterThanOrEqual(10)
    let last = Infinity
    for (let m = 0; m <= 1.0001; m += 0.05) {
      const t = reflexTime('hotPan', { myelin: Math.min(1, m) }).totalMs
      expect(t).toBeLessThan(last)
      last = t
    }
  })

  it('speeds stay inside the ranges read (Kiernan: Aα 70–120, Aδ 10–30, C 0.5–2.5 m/s)', () => {
    const s = NERVE_PARAMS.fibreSpeedMPerS
    expect(s.aAlpha).toBeGreaterThanOrEqual(70)
    expect(s.aAlpha).toBeLessThanOrEqual(120)
    expect(s.aDelta).toBeGreaterThanOrEqual(10)
    expect(s.aDelta).toBeLessThanOrEqual(30)
    expect(s.c).toBeGreaterThanOrEqual(0.5)
    expect(s.c).toBeLessThanOrEqual(2.5)
    expect(fibreSpeed('aAlpha', 1)).toBe(s.aAlpha)
    expect(fibreSpeed('aAlpha', 0)).toBe(s.c)
  })

  it('every scenario cites pages that were read', () => {
    for (const s of Object.values(NERVE_SCENARIOS)) for (const id of s.sources) expect(NERVE_SOURCES[id]).toBeDefined()
  })

  it('rejects a myelin value outside 0–1 and an unknown scenario', () => {
    expect(() => reflexTime('hotPan', { myelin: 1.5 })).toThrow(/myelin/)
    expect(() => reflexTime('hotPan', { myelin: Number.NaN })).toThrow(/myelin/)
    expect(() => reflexTime('kneeTap' as 'hotPan')).toThrow(/unknown scenario/)
  })
})

describe('nerve demo: knee tap', () => {
  // Khatun 2024: young adults 17.68 ± 3.708 ms (NERVE_PARAMS.kneeJerkMs). The scenario needs the leg's
  // path lengths from a read page first (V-7).
  it.todo('golden: knee jerk 12–25 ms (Khatun 2024, 17.68 ± 3.708 ms) once the knee-tap scenario has sourced path lengths')
})

describe('nerve demo stays out of the run', () => {
  it('no engine file outside src/demo imports the demo (so it never reaches simulate() or /sim)', () => {
    const srcDir = join(import.meta.dirname, '../src')
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))
    const importers = files(srcDir)
      .filter((f) => f.endsWith('.ts') && !relative(srcDir, f).replaceAll('\\', '/').startsWith('demo/'))
      .filter((f) => /from\s+['"][^'"]*demo\//.test(readFileSync(f, 'utf8')))
    expect(importers).toEqual([])
  })
})
