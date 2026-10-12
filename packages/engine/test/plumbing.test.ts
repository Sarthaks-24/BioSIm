import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ORGANISM,
  HUMAN_MODEL,
  MODEL_VERSION,
  ORGANISM_MODELS,
  PARAMS,
  PROVIDES,
  bluntingFactor,
  buildMeal,
  computeEvents,
  decodeMeal,
  emptyingCurves,
  glucoseCurve,
  makeParticles,
  simulate,
  type Params,
  type SimInput,
} from '../src/index.ts'
import { lookup } from './fixtures.ts'

/**
 * O-0 plumbing (WP-05): the organism-ready input, the run's clock, and the `ctx.params` rule.
 * Plain `it()`: these pin wiring, not physiology. The numbers themselves are pinned in
 * regression.test.ts, which must not move.
 */

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

/** A deep copy of PARAMS with one number changed, for checking that a module reads its argument. */
function paramsWith(path: string, value: number): Params {
  const copy = structuredClone(PARAMS) as unknown as Record<string, unknown>
  const keys = path.split('.')
  let o = copy
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>
  o[keys.at(-1)!] = value
  return copy as unknown as Params
}

describe('simulate input', () => {
  it('SimInput with a lookup gives exactly the same run as a built Meal', () => {
    for (const raw of ['glucose-50:1', 'standard-meal:1,water:1', 'fatty-meal:1.5', 'water:1', '']) {
      const items = decodeMeal(raw)
      const fromMeal = simulate(buildMeal(items, lookup), { particles: 8 })
      const fromInput = simulate({ items }, { lookup, particles: 8 })
      const explicit = simulate({ organism: 'human', items, profile: 'adult-ref' }, { lookup, particles: 8 })
      for (const run of [fromInput, explicit]) {
        expect(run.events).toEqual(fromMeal.events)
        expect(run.particles).toEqual(fromMeal.particles)
        for (const [id, s] of fromMeal.signals) expect(run.signals.get(id)!.values, `${raw} ${id}`).toEqual(s.values)
      }
    }
  })

  it('an unknown organism throws (the UI never passes one)', () => {
    const frog = { organism: 'frog', items: [] } as unknown as SimInput
    expect(() => simulate(frog, { lookup })).toThrow(/unknown organism "frog"/)
  })

  it('a SimInput without a lookup throws instead of guessing', () => {
    const bad = simulate as unknown as (input: SimInput, opts?: object) => unknown
    expect(() => bad({ items: [{ foodId: 'water', servings: 1 }] })).toThrow(/lookup/)
  })
})

describe('the run carries its clock', () => {
  it('horizon, step and length come from the organism model', () => {
    const sim = simulate({ items: decodeMeal('glucose-50:1') }, { lookup })
    expect(sim.horizonMin).toBe(HUMAN_MODEL.horizonMin)
    expect(sim.stepMin).toBe(HUMAN_MODEL.stepMin)
    expect(sim.length).toBe(Math.floor(sim.horizonMin / sim.stepMin) + 1)
    expect(sim.signals.get('blood.glucose')!.values).toHaveLength(sim.length)
    expect(sim.modelVersion).toBe(MODEL_VERSION)
  })

  it('the human model is PARAMS, MODEL_VERSION and PROVIDES.human, and is the only organism', () => {
    expect(Object.keys(ORGANISM_MODELS)).toEqual([DEFAULT_ORGANISM])
    expect(HUMAN_MODEL).toMatchObject({ id: 'human', modelVersion: MODEL_VERSION, params: PARAMS, provides: PROVIDES.human })
    expect([HUMAN_MODEL.horizonMin, HUMAN_MODEL.stepMin]).toEqual([HUMAN_MODEL.params.horizonMin, HUMAN_MODEL.params.stepMin])
  })
})

describe('ctx.params: modules read the params they are given', () => {
  const meal = buildMeal(decodeMeal('standard-meal:1,glucose-50:1'), lookup)

  it('defaults are PARAMS (so existing callers are unchanged)', () => {
    expect(emptyingCurves(meal)).toEqual(emptyingCurves(meal, PARAMS))
    expect(bluntingFactor(meal)).toBe(bluntingFactor(meal, PARAMS))
  })

  it('stomach.ts', () => {
    const slow = emptyingCurves(meal, paramsWith('stomach.energyKcalPerMin', PARAMS.stomach.energyKcalPerMin / 2))
    expect(slow.liquid.linearMin).toBeCloseTo(emptyingCurves(meal).liquid.linearMin * 2, 9)
  })

  it('glucose.ts', () => {
    const rate = new Float64Array(10)
    expect(glucoseCurve(rate, 1, paramsWith('glucose.fastingMgDl', 100)).typical[0]).toBe(100)
    expect(bluntingFactor(meal, paramsWith('glucose.bluntingK', 0))).toBe(1)
  })

  it('events.ts', () => {
    const n = 5
    const flat = (v: number) => new Float64Array(n).fill(v)
    const input = {
      arrival: 0,
      stomachLiquidG: flat(0),
      stomachSolidG: flat(0),
      absorbedG: { carbs: flat(0), protein: flat(0), fat: flat(0), fiber: flat(0), water: flat(0) },
      leftoversInColonCum: flat(0.5),
      glucoseTypical: flat(90),
      step: 1,
      n,
    }
    expect(computeEvents(meal, input).halfLeftoversInColon).toBeNull()
    expect(computeEvents(meal, input, paramsWith('residueThresholdG', 0.1)).halfLeftoversInColon).not.toBeNull()
  })

  it('particles.ts', () => {
    const curves = emptyingCurves(meal)
    const later = makeParticles(meal, curves, 5, 12, paramsWith('smallIntestine.typicalMin', PARAMS.smallIntestine.typicalMin + 60))
    makeParticles(meal, curves, 5, 12).forEach((p, i) => expect(later[i]!.colonIn - p.colonIn).toBeCloseTo(60, 9))
  })

  it('only params.ts, simulate.ts, meal.ts and share.ts read PARAMS.* (comments and strings aside)', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))
    const readers = files(srcDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line) => line.replace(/\s\/\/.*$/, '').trim())
          .some((line) => !/^(\*|\/\/|\/\*|['"`])/.test(line) && /\bPARAMS\./.test(line)),
      )
      .map((f) => relative(srcDir, f).replaceAll('\\', '/'))
      .sort()
    expect(readers.filter((f) => !['params.ts', 'simulate.ts', 'meal.ts', 'share.ts'].includes(f))).toEqual([])
    expect(readers).toContain('simulate.ts') // the scan itself works
  })
})
