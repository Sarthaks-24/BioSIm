import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  PARAMS,
  PROFILES,
  buildMeal,
  decodeMeal,
  parseFood,
  type ActivityBout,
  type Params,
  type RunSignalId,
  type RunResult,
  type SignalStatus,
} from '../src/index.ts'
import {
  ENERGY_TOTAL,
  HUMAN_MODEL,
  HUMAN_MODULES,
  RUN_SIGNALS,
  RUN_SIGNAL_IDS,
  buildSignalTable,
  effortModule,
  heatLoss,
  runModules,
  simulate,
} from '../src/run.ts'
import { PARAM_SOURCES } from '../src/core/sources.ts'
import { FULL, lookup as fixtureLookup } from './fixtures.ts'
import { golden, pinned } from './golden.ts'
import { paramsWith } from './modules/ctx.ts'

/**
 * Effort: muscles and skin (S-1, model §2.7, §2.9, D13 iii/iv). The published figures are in the
 * test titles; the sources were read for V-1 (core/sources.ts says where and what).
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => fixtureLookup(id) ?? foods.find((f) => f.id === id)
const mealOf = (m: string) => buildMeal(decodeMeal(m), lookup)
const run = (m: string, activity: ActivityBout[] = []) => simulate(mealOf(m), { particles: 0, activity })
const values = (sim: RunResult, id: RunSignalId) => sim.signals.get(id)!.values
const N = 2881
const setupOf = (m: string, activity: ActivityBout[] = [], params: Params = HUMAN_MODEL.params) => ({
  input: { meal: mealOf(m), activity },
  params,
  profile: PROFILES['adult-ref'],
  n: N,
  stepMin: 1,
})
const kg = PROFILES['adult-ref'].weightKg
/** Resting use, kcal/min and kcal/h (62.7 kcal/h for the reference man). */
const R = PROFILES['adult-ref'].restingKcalPerDay / 1440
const Rh = R * 60
const restingMuscle = (13 * 0.384 * kg) / 24

const walk60: ActivityBout = { kind: 'walk', startMin: 60, durMin: 60 }
const run60: ActivityBout = { kind: 'run', startMin: 300, durMin: 60 }
// A drink, a mixed meal and nothing; FULL=1 adds the others (R68).
const meals = FULL
  ? ['cola:1', 'cheeseburger:1,fries:1,cola:1', 'roti:2,dal:1', 'water:1', '']
  : ['cola:1', 'cheeseburger:1,fries:1,cola:1', '']
/** True when two arrays hold the same bytes (faster than toEqual on 2881-value arrays). */
const sameBytes = (a: ArrayLike<number> & ArrayBufferView, b: ArrayLike<number> & ArrayBufferView) =>
  a.constructor === b.constructor &&
  Buffer.from(a.buffer, a.byteOffset, a.byteLength).equals(Buffer.from(b.buffer, b.byteOffset, b.byteLength))

describe('muscles: muscle.energyRate (model §2.7)', () => {
  golden(
    'muscle.energyRate',
    ['wang2012', 'janssen2000'],
    'resting muscle = 13 kcal/kg/day (Elia 1992 via Wang 2012) × 38.4 % of body mass (Janssen 2000) × 65 kg ÷ 24 = 13.5 kcal/h, 18–26 % of resting use (21.6 %)',
    () => {
      expect(PARAMS.effort.muscleKcalPerKgDay).toBe(13)
      expect(PARAMS.effort.muscleMassShare).toBe(0.384)
      const muscle = values(run(''), 'muscle.energyRate')
      expect(muscle[0]!).toBeCloseTo(13.52, 2)
      const share = muscle[600]! / Rh
      expect(share).toBeGreaterThanOrEqual(0.18)
      expect(share).toBeLessThanOrEqual(0.26)
      expect(share).toBeCloseTo(0.216, 3)
    },
  )

  pinned('muscle.energyRate', 'identity: muscle extra = activity extra, every minute (all the energy of moving is used by muscle)', () => {
    for (const m of ['', 'cheeseburger:1,fries:1,cola:1']) {
      const sim = run(m, [walk60, run60, { kind: 'walkBrisk', startMin: 2000, durMin: 30 }])
      const muscle = values(sim, 'muscle.energyRate')
      const activity = values(sim, 'energy.activityRate')
      let worst = 0
      for (let i = 0; i < N; i++) worst = Math.max(worst, Math.abs(muscle[i]! - restingMuscle - activity[i]!))
      expect(worst, m).toBeLessThan(1e-4) // the table rows are Float32
    }
  })

  pinned(
    'muscle.energyRate',
    'muscle share of all energy used: walk ≈ 81 %, run ≈ 92 % (most of the energy of moving is muscle work)',
    () => {
      const sim = run('', [walk60, run60])
      const muscle = values(sim, 'muscle.energyRate')
      const total = runModules(HUMAN_MODULES, setupOf('', [walk60, run60])).signals.get(ENERGY_TOTAL)!.values
      expect(muscle[90]! / (total[90]! * 60)).toBeCloseTo(0.81, 2)
      expect(muscle[330]! / (total[330]! * 60)).toBeCloseTo(0.92, 2)
    },
  )
})

describe('skin: skin.sweatRate and skin.sweatTotal (model §2.9)', () => {
  golden(
    ['skin.sweatRate', 'skin.sweatTotal'],
    ['baker2019', 'bakerwolfe2020'],
    'walk: extra heat ÷ 0.58 kcal/mL (580 kcal per kg evaporated) ≈ 330 mL/h, inside 0.2–0.4 L/h (Baker 2019 “~0.3 L/h … the very low end”; Baker & Wolfe 2020 walking 0.3–0.6 L/h)',
    () => {
      expect(PARAMS.effort.sweatKcalPerMl).toBe(0.58)
      const sim = run('cola:1', [walk60])
      const rate = values(sim, 'skin.sweatRate')[90]!
      expect(rate).toBeCloseTo((((2.8 * 3.5 * kg) / 200) * 60) / 0.58, 2) // 329.5 mL/h
      expect(rate).toBeGreaterThanOrEqual(200)
      expect(rate).toBeLessThanOrEqual(400)
      expect(values(sim, 'skin.sweatTotal')[N - 1]!).toBeCloseTo(rate, 1) // one hour of it
    },
  )

  golden(
    ['skin.sweatRate', 'skin.sweatTotal'],
    ['bakerwolfe2020'],
    'run: ≈ 980 mL/h, inside the reported whole-body sweating rates “~ 0.2 to 3 L/h” (Baker & Wolfe 2020)',
    () => {
      const sim = run('', [run60])
      const rate = values(sim, 'skin.sweatRate')[330]!
      expect(rate).toBeCloseTo((((8.3 * 3.5 * kg) / 200) * 60) / 0.58, 1) // 976.7 mL/h
      expect(rate).toBeGreaterThanOrEqual(200)
      expect(rate).toBeLessThanOrEqual(3000)
    },
  )

  pinned(['skin.sweatRate', 'skin.sweatTotal'], 'sweat is 0 at rest and outside bouts; the total is the running sum of the rate', () => {
    const sim = run('cheeseburger:1,fries:1,cola:1', [walk60, run60])
    const rate = values(sim, 'skin.sweatRate')
    const total = values(sim, 'skin.sweatTotal')
    expect(rate[60]).toBe(0)
    expect(rate[61]!).toBeGreaterThan(0)
    expect(rate[121]).toBe(0)
    let sum = 0
    let worst = 0
    for (let i = 0; i < N; i++) {
      sum += rate[i]! / 60
      worst = Math.max(worst, Math.abs(total[i]! - sum))
    }
    expect(worst).toBeLessThan(0.01)
    // Over 48 h: all the extra heat of moving left as sweat.
    expect(total[N - 1]!).toBeCloseTo(values(sim, 'energy.activityTotal')[N - 1]! / 0.58, 1)
  })

  pinned(
    ['skin.sweatRate', 'muscle.energyRate'],
    'a meal makes no sweat and no muscle work: the food effect’s heat leaves by the dry routes (D5 C12)',
    () => {
      const rest = run('')
      for (const m of meals) {
        const sim = run(m)
        for (const id of ['muscle.energyRate', 'skin.sweatRate', 'skin.sweatTotal'] as const)
          expect(sameBytes(values(sim, id), values(rest, id)), `${m} ${id}`).toBe(true)
      }
    },
  )
})

describe('heat: made and lost (model §2.9, D10 helper)', () => {
  const split = (total: number, activity: number) => heatLoss(total, activity, R, PARAMS.effort)
  const sum = (h: ReturnType<typeof split>) => h.radiation + h.convection + h.conduction + h.evaporation

  pinned('skin.sweatRate', 'identity: resting heat made = R (energy used at rest, e = 0), and all of it leaves', () => {
    const total = runModules(HUMAN_MODULES, setupOf('')).signals.get(ENERGY_TOTAL)!.values
    for (const i of [0, 600, N - 1]) {
      expect(total[i]).toBe(R)
      expect(sum(split(total[i]!, 0))).toBeCloseTo(R, 12)
    }
  })

  golden(
    'skin.sweatRate',
    ['openstax-ap2e-24'],
    'guard: at rest heat leaves about 60 % by radiation, 15 % convection, 3 % conduction, 20 % evaporation (OpenStax A&P 2e §24.6), each within ±3 points',
    () => {
      const h = split(R, 0)
      const pct = (v: number) => (100 * v) / R
      expect(Math.abs(pct(h.radiation) - 60)).toBeLessThanOrEqual(3)
      expect(Math.abs(pct(h.convection) - 15)).toBeLessThanOrEqual(3)
      expect(Math.abs(pct(h.conduction) - 3)).toBeLessThanOrEqual(3)
      expect(Math.abs(pct(h.evaporation) - 20)).toBeLessThanOrEqual(3)
    },
  )

  pinned(
    'skin.sweatRate',
    'in a walk, a run or after a meal every kcal made leaves; moving adds only to evaporation, = sweat × 0.58',
    () => {
      const m = 'cheeseburger:1,fries:1,cola:1'
      const sim = run(m, [walk60, run60])
      const total = runModules(HUMAN_MODULES, setupOf(m, [walk60, run60])).signals.get(ENERGY_TOTAL)!.values
      const activity = values(sim, 'energy.activityRate')
      const sweat = values(sim, 'skin.sweatRate')
      const rest = split(R, 0)
      for (const i of [30, 90, 200, 330, 2000]) {
        const h = split(total[i]!, activity[i]! / 60)
        expect(sum(h), `${i}`).toBeCloseTo(total[i]!, 9)
        expect(h.evaporation - rest.evaporation, `${i}`).toBeCloseTo((sweat[i]! * 0.58) / 60, 4)
        expect(h.radiation, `${i}`).toBeGreaterThanOrEqual(rest.radiation - 1e-12)
      }
    },
  )
})

describe('insertion invariance (model D13 iii) and rest invariance (D13 iv)', () => {
  const without = HUMAN_MODULES.filter((m) => m.id !== 'effort')

  it('adding effort leaves every existing signal, internal array and moment byte-identical', () => {
    for (const m of meals) {
      for (const plan of [[], [walk60, run60]] as ActivityBout[][]) {
        const before = runModules(without, setupOf(m, plan))
        const after = runModules(HUMAN_MODULES, setupOf(m, plan))
        expect(before.signals.size).toBeGreaterThan(0)
        const changed = [...before.signals].filter(([id, w]) => !sameBytes(after.signals.get(id)!.values, w.values)).map(([id]) => id)
        expect(changed, m).toEqual([])
        // The signal table too (Float32 copies), in its row order.
        const tableBefore = buildSignalTable(mealOf(m), before.signals)
        const tableAfter = buildSignalTable(mealOf(m), after.signals)
        // Rows only get added: the earlier rows keep their order (a later pack's rows may follow effort's).
        expect([...tableAfter.keys()].filter((id) => tableBefore.has(id))).toEqual([...tableBefore.keys()])
        for (const [id, sr] of tableBefore) expect(sameBytes(tableAfter.get(id)!.values, sr.values), `${m} ${id}`).toBe(true)
        expect([...after.moments]).toEqual([...before.moments])
        expect([...after.signals.keys()].filter((id) => !before.signals.has(id))).toEqual([
          'muscle.energyRate',
          'skin.sweatRate',
          'skin.sweatTotal',
        ])
      }
    }
  }, 30_000)

  it('the rows before the effort pack keep their place in the signal table', () => {
    const keys = [...run('cola:1').signals.keys()]
    expect(keys).toEqual([...RUN_SIGNAL_IDS])
    const at = keys.indexOf('muscle.energyRate')
    expect(keys.slice(at, at + 3)).toEqual(['muscle.energyRate', 'skin.sweatRate', 'skin.sweatTotal'])
    expect(keys.slice(0, at)).toEqual(RUN_SIGNAL_IDS.slice(0, at))
  })

  it('rest: no plan, an empty plan and bouts at MET 1 give resting muscle and no sweat, to the byte', () => {
    const atRest = paramsWith('activity.met.walk', 1)
    for (const m of meals) {
      const none = simulate(mealOf(m), { particles: 0 })
      const restOnly = runModules(HUMAN_MODULES, setupOf(m, [walk60, { kind: 'walk', startMin: 600, durMin: 120 }], atRest)).signals
      for (const id of ['muscle.energyRate', 'skin.sweatRate', 'skin.sweatTotal'] as const) {
        expect(sameBytes(Float32Array.from(restOnly.get(id)!.values), values(none, id)), `${m} ${id}`).toBe(true)
        expect(sameBytes(values(run(m, []), id), values(none, id)), `${m} ${id}`).toBe(true)
      }
      expect(values(none, 'muscle.energyRate').every((v) => v === Math.fround(restingMuscle))).toBe(true)
      expect(values(none, 'skin.sweatRate').every((v) => v === 0)).toBe(true)
      expect(values(none, 'skin.sweatTotal').every((v) => v === 0)).toBe(true)
    }
  }, 30_000)
})

describe('contract', () => {
  const RANK: { readonly [S in SignalStatus]: number } = { illustration: 0, assumption: 1, simulated: 2 }

  it('status ≤ the weakest of its needs and parameters (model D9): every effort row is a Model estimate', () => {
    const needs = effortModule.needs.filter((id): id is RunSignalId => !id.startsWith('x.'))
    const weakest = Math.min(...needs.map((id) => RANK[RUN_SIGNALS[id].status]))
    for (const id of effortModule.provides) {
      expect(RUN_SIGNALS[id].status, id).toBe('assumption')
      expect(RANK[RUN_SIGNALS[id].status], id).toBeLessThanOrEqual(weakest)
    }
    // Every effort parameter is read from a page (V-1), none hand-picked.
    for (const [path, entry] of Object.entries(PARAM_SOURCES)) if (path.startsWith('effort.')) expect(entry!.basis, path).toBe('measured')
  })

  it('effort reads nothing gas writes: it needs only energy.activityRate (S-1 ‖ S-2, R19)', () => {
    expect(effortModule.needs).toEqual(['energy.activityRate'])
  })

  it('reads ctx.params: 0.29 kcal per mL doubles the sweat, a lighter muscle share lowers resting muscle', () => {
    const plan = [walk60]
    const base = runModules(HUMAN_MODULES, setupOf('', plan)).signals
    const thin = runModules(HUMAN_MODULES, setupOf('', plan, paramsWith('effort.sweatKcalPerMl', 0.29))).signals
    expect(thin.get('skin.sweatRate')!.values[90]!).toBeCloseTo(2 * base.get('skin.sweatRate')!.values[90]!, 9)
    const light = runModules(HUMAN_MODULES, setupOf('', plan, paramsWith('effort.muscleMassShare', 0.306))).signals
    expect(light.get('muscle.energyRate')!.values[0]!).toBeCloseTo((13 * 0.306 * kg) / 24, 9)
  })

  it('the effort module runs in ≤ 2 ms (48 h at 1 min, warm, median of 21)', () => {
    const activity = runModules(HUMAN_MODULES, setupOf('', [walk60, run60])).signals.get('energy.activityRate')!.values
    const ctx = {
      ...setupOf('', [walk60, run60]),
      get: () => activity,
      put: () => {},
      putMoment: () => {},
      putRhythm: () => {},
    }
    for (let i = 0; i < 20; i++) effortModule.run(ctx)
    const times: number[] = []
    for (let i = 0; i < 21; i++) {
      const t0 = performance.now()
      effortModule.run(ctx)
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    console.log(`effort module, warm, 21 runs: fastest ${times[0]!.toFixed(3)} ms, median ${times[10]!.toFixed(3)} ms`)
    expect(times[10]!).toBeLessThanOrEqual(2)
  })
})
