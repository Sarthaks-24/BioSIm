import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DEFAULT_ORGANISM, MODEL_VERSION, PARAMS, buildMeal, decodeMeal, emptyingCurves, type Params, type RunInput } from '../src/index.ts'
import {
  HUMAN_MODEL,
  ORGANISM_MODELS,
  PACK_PARAMS,
  PROVIDES,
  bluntingFactor,
  computeEvents,
  energySignals,
  glucoseCurve,
  makeParticles,
  simulate,
} from '../src/run.ts'
import { firstDiff, lookup, sample } from './fixtures.ts'

/**
 * O-0 plumbing (WP-05): the organism-ready input, the run's clock, and the `ctx.params` rule.
 * Plain `it()`: these pin wiring, not physiology. The numbers themselves are pinned in
 * regression.test.ts, which must not move.
 */

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

/** A deep copy of the human run's params (HUMAN_MODEL.params, R78) with one number changed, for checking that a module reads its argument. */
function paramsWith(path: string, value: number): Params {
  const copy = structuredClone(HUMAN_MODEL.params) as unknown as Record<string, unknown>
  const keys = path.split('.')
  let o = copy
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>
  o[keys.at(-1)!] = value
  return copy as unknown as Params
}

describe('simulate input', () => {
  // 15 runs × every series compared byte for byte (firstDiff: a deep toEqual took seconds on a busy machine, R68).
  // `npm test` compares 3 of the 5 meals (a mixed one, a fatty one, the empty one), FULL=1 all (R68).
  it('RunInput with a lookup gives exactly the same run as a built Meal', { timeout: 20_000 }, () => {
    for (const raw of sample(['standard-meal:1,water:1', 'glucose-50:1', 'fatty-meal:1.5', 'water:1', ''], 2)) {
      const items = decodeMeal(raw)
      const fromMeal = simulate(buildMeal(items, lookup), { particles: 8 })
      const fromInput = simulate({ items }, { lookup, particles: 8 })
      const explicit = simulate({ organism: 'human', items, profile: 'adult-ref' }, { lookup, particles: 8 })
      for (const run of [fromInput, explicit]) {
        expect(run.events).toEqual(fromMeal.events)
        expect(run.particles).toEqual(fromMeal.particles)
        for (const [id, s] of fromMeal.signals) expect(firstDiff(s.values, run.signals.get(id)?.values), `${raw} ${id}`).toBe(-1)
      }
    }
  })

  it('an unknown organism throws (the UI never passes one)', () => {
    const frog = { organism: 'frog', items: [] } as unknown as RunInput
    expect(() => simulate(frog, { lookup })).toThrow(/unknown organism "frog"/)
  })

  it('an unknown profile throws (share.ts drops an unknown `who` before it gets here)', () => {
    const teen = { items: [], profile: 'teen-ref' } as unknown as RunInput
    expect(() => simulate(teen, { lookup })).toThrow(/unknown profile "teen-ref"/)
    expect(simulate({ items: [] }, { lookup }).profile).toBe('adult-ref')
  })

  it('a RunInput without a lookup throws instead of guessing', () => {
    const bad = simulate as unknown as (input: RunInput, opts?: object) => unknown
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

  // P-1 (R75 (1), R77, R78): the packs' numbers live in packParams.ts, which only the run chunk
  // loads; PARAMS (the main thread's half) has none of them, and the run's set is exactly both.
  it('the run’s params are PARAMS and PACK_PARAMS, with no key in both; the pack numbers are not in PARAMS', () => {
    const core = Object.keys(PARAMS)
    const pack = Object.keys(PACK_PARAMS)
    expect(pack.sort()).toEqual(['brain', 'circulation', 'effort', 'gas', 'insulin', 'kinetics', 'water'])
    expect(core.filter((k) => pack.includes(k))).toEqual([])
    expect(HUMAN_MODEL.params).toEqual({ ...PARAMS, ...PACK_PARAMS })
    expect(Object.keys(HUMAN_MODEL.params).sort()).toEqual([...core, ...pack].sort())
  })
})

describe('ctx.params: modules read the params they are given', () => {
  const meal = buildMeal(decodeMeal('standard-meal:1,glucose-50:1'), lookup)

  it('stomach.ts', () => {
    const slow = emptyingCurves(meal, paramsWith('stomach.energyKcalPerMin', PARAMS.stomach.energyKcalPerMin / 2))
    expect(slow.liquid.linearMin).toBeCloseTo(emptyingCurves(meal, PARAMS).liquid.linearMin * 2, 9)
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
    expect(computeEvents(meal, input, PARAMS).halfLeftoversInColon).toBeNull()
    expect(computeEvents(meal, input, paramsWith('residueThresholdG', 0.1)).halfLeftoversInColon).not.toBeNull()
  })

  it('particles.ts', () => {
    const curves = emptyingCurves(meal, PARAMS)
    const later = makeParticles(meal, curves, 5, 12, paramsWith('smallIntestine.typicalMin', PARAMS.smallIntestine.typicalMin + 60))
    makeParticles(meal, curves, 5, 12, PARAMS).forEach((p, i) => expect(later[i]!.colonIn - p.colonIn).toBeCloseTo(60, 9))
  })

  it('energy/energyBalance.ts', () => {
    const n = 3
    const absorbedG = {
      carbs: new Float64Array([0, 1, 2]),
      protein: new Float64Array(n),
      fat: new Float64Array([0, 1, 1]),
      fiber: new Float64Array(n),
      water: new Float64Array(n),
    }
    const person = { restingKcalPerDay: 2400 }
    expect([...energySignals(absorbedG, person, 1, PARAMS).inTotal]).toEqual([0, 13, 17])
    expect([...energySignals(absorbedG, person, 1, paramsWith('energy.atwaterKcalPerG.fat', 0)).inTotal]).toEqual([0, 4, 8])
    expect([...energySignals(absorbedG, person, 1, PARAMS).usedRate]).toEqual([100, 100, 100])
  })

  // R58: helpers take params from their caller, never a `params = PARAMS` default, so a run with
  // other params (a test, a later organism) can never mix in the global set. Any mention of PARAMS
  // in code counts, not only `PARAMS.x`. meal.ts (eating time, size cap) and share.ts (the link's
  // `t`) build the run's input on the main thread, before any run.
  it('only params.ts, simulate.ts, meal.ts and share.ts name PARAMS in code (comments and strings aside)', () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)]))
    const readers = files(srcDir)
      .filter((f) => f.endsWith('.ts'))
      .filter((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line) => line.replace(/\s\/\/.*$/, '').trim())
          .some((line) => !/^(\*|\/\/|\/\*|['"`])/.test(line) && /\bPARAMS\b/.test(line)),
      )
      .map((f) => relative(srcDir, f).replaceAll('\\', '/'))
      .sort()
    expect(readers.filter((f) => !['params.ts', 'simulate.ts', 'meal.ts', 'share.ts'].includes(f))).toEqual([])
    expect(readers).toContain('simulate.ts') // the scan itself works
  })
})
