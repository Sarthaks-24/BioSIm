import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_KINDS,
  PARAMS,
  PROFILES,
  activityKey,
  buildMeal,
  decodeMeal,
  parseFood,
  type ActivityBout,
  type Food,
  type ModelModule,
  type RunResult,
  type RunSignalId,
  type SignalStatus,
} from '../src/index.ts'
import { BREATHING_SIGNAL_IDS, ENERGY_TOTAL, HUMAN_MODULES, RUN_SIGNALS, gasModule, runModules, simulate } from '../src/run.ts'
import { FULL, firstDiff, gribokShake, lookup as fixtureLookup } from './fixtures.ts'
import { golden, pinned } from './golden.ts'

/**
 * Breathing, the gas engine (S-2, model §2.2, D1, D13 iii/iv). The sources were read in V-2
 * (core/sources.ts says where and what); the published figures are in the test titles.
 * Kinds (model §2): I identity · S sourced · C calibration (pinned: it does not count) · G design guard.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => fixtureLookup(id) ?? foods.find((f) => f.id === id)
const mealOf = (m: string) => buildMeal(decodeMeal(m), lookup)
const run = (m: string, activity: ActivityBout[] = []) => simulate(mealOf(m), { particles: 0, activity })
const runFood = (food: Food) =>
  simulate(
    buildMeal([{ foodId: food.id, servings: 1 }], (id) => (id === food.id ? food : undefined)),
    { particles: 0 },
  )
const values = (sim: RunResult, id: RunSignalId) => sim.signals.get(id)!.values
const setup = (m: string, activity: ActivityBout[] = []) => ({
  input: { meal: mealOf(m), activity },
  params: PARAMS,
  profile: PROFILES['adult-ref'],
  n: 2881,
  stepMin: 1,
})
const max = (xs: ArrayLike<number>) => {
  let m = -Infinity
  for (let i = 0; i < xs.length; i++) m = Math.max(m, xs[i]!)
  return m
}
const min = (xs: ArrayLike<number>) => -max(Array.from(xs, (x) => -x))

const kg = PROFILES['adult-ref'].weightKg
const walk: ActivityBout = { kind: 'walk', startMin: 30, durMin: 20 }
const runBout: ActivityBout = { kind: 'run', startMin: 30, durMin: 20 }
/** A minute inside the bouts above. */
const IN_BOUT = 40
const meals = ['', 'cola:1', 'cheeseburger:1,fries:1,cola:1', 'roti:2,dal:1', 'glucose-50:1', 'water:1']

describe('oxygen and carbon dioxide (Weir, model D1)', () => {
  golden(
    ['gas.o2UseRate', 'gas.co2OutRate', 'gas.exchangeRatio'],
    ['kaiyala2019'],
    'I: every minute the energy used = 3.941·VO2 + 1.106·VCO2 (Weir without protein), and VCO2 = RQ·VO2',
    () => {
      for (const [m, plan] of [
        ['cheeseburger:1,fries:1,cola:1', [walk, { kind: 'run', startMin: 300, durMin: 30 }]],
        ['glucose-50:1', []],
        ['', [runBout]],
      ] as const) {
        const out = runModules(HUMAN_MODULES, setup(m, [...plan])).signals
        const e = out.get(ENERGY_TOTAL)!.values
        const o2 = out.get('gas.o2UseRate')!.values
        const co2 = out.get('gas.co2OutRate')!.values
        const rq = out.get('gas.exchangeRatio')!.values
        for (let i = 0; i < e.length; i += 7) {
          expect((3.941 * o2[i]! + 1.106 * co2[i]!) / 1000, `${m} @${i}`).toBeCloseTo(e[i]!, 12)
          expect(co2[i]!, `${m} @${i}`).toBeCloseTo(rq[i]! * o2[i]!, 9)
        }
      }
    },
  )

  golden('gas.o2UseRate', ['kaiyala2019'], 'S: a litre of oxygen is ~4.7 kcal at RQ 0.7 and ~5.0 kcal at RQ 1.0', () => {
    // gas alone, energy held at 2 kcal/min; glucose far below and far above fasting pins RQ at the clamps.
    const n = 2881
    for (const [glucose, kcalPerL] of [
      [0, 4.7],
      [400, 5.0],
    ] as const) {
      const source: ModelModule = {
        id: 'bloodSugar',
        system: 'digestion',
        needs: [],
        provides: ['blood.glucose'],
        internal: [ENERGY_TOTAL, 'x.activity.met'],
        run(ctx) {
          ctx.put('blood.glucose', new Float64Array(n).fill(glucose), { low: new Float64Array(n), high: new Float64Array(n) })
          ctx.put(ENERGY_TOTAL, new Float64Array(n).fill(2))
          ctx.put('x.activity.met', new Float64Array(n).fill(1))
        },
      }
      const out = runModules([source, gasModule], setup('')).signals
      const perL = 2 / (out.get('gas.o2UseRate')!.values[100]! / 1000)
      expect(perL, `glucose ${glucose}`).toBeGreaterThan(kcalPerL - 0.05)
      expect(perL, `glucose ${glucose}`).toBeLessThan(kcalPerL + 0.06)
    }
  })

  golden(
    'gas.o2UseRate',
    ['byrne2005', 'jette1990'],
    'S: resting O2 use 2.2–3.6 mL/kg/min (Byrne 2005: 2.6 ± 0.4; 1 MET = 3.5, Jetté 1990)',
    () => {
      const sim = run('')
      for (const i of [0, 600, 2880]) {
        const perKg = values(sim, 'gas.o2UseRate')[i]! / kg
        expect(perKg).toBeGreaterThanOrEqual(2.2)
        expect(perKg).toBeLessThanOrEqual(3.6)
      }
    },
  )

  golden(
    'gas.exchangeRatio',
    ['charriere2016', 'gribok2016'],
    'S: fasting RQ 0.78–0.86 (Charrière 2016 baselines 0.78–0.81; Gribok 2016 ~0.83)',
    () => {
      for (const m of ['', 'water:1', 'roti:2,dal:1']) {
        const rq = values(run(m), 'gas.exchangeRatio')
        // Before the meal, and a day after it.
        for (const i of [0, 1440, 2880]) {
          expect(rq[i]!, `${m} @${i}`).toBeGreaterThanOrEqual(0.78)
          expect(rq[i]!, `${m} @${i}`).toBeLessThanOrEqual(0.86)
        }
      }
    },
  )

  pinned(
    'gas.exchangeRatio',
    'C (kRQ, gas.rqPerMgDl): Gribok 2016 carbohydrate shake (123 g) raises RQ by 0.05–0.11 (0.83 → 0.91); fixture GI 50, 70 or 100',
    () => {
      for (const gi of [50, 70, 100]) {
        const rq = values(runFood(gribokShake('carb', gi)), 'gas.exchangeRatio')
        const rise = max(rq.subarray(0, 240)) - rq[0]!
        expect(rise, `GI ${gi}`).toBeGreaterThanOrEqual(0.05)
        expect(rise, `GI ${gi}`).toBeLessThanOrEqual(0.11)
      }
    },
  )

  golden(
    'gas.exchangeRatio',
    ['gribok2016'],
    'S hold-out: the fat shake (12 g carbohydrate, 51 g fat) raises RQ less than the carbohydrate shake (slope 0.0033 vs 0.0049 per min)',
    () => {
      for (const gi of [50, 70, 100]) {
        const carb = values(runFood(gribokShake('carb', gi)), 'gas.exchangeRatio')
        const fat = values(runFood(gribokShake('fat', gi)), 'gas.exchangeRatio')
        const rise = (rq: Float32Array) => max(rq.subarray(0, 240)) - rq[0]!
        expect(rise(fat), `GI ${gi}`).toBeLessThan(rise(carb))
        // Over the first hour, as Gribok measured the slopes.
        expect(fat[60]! - fat[0]!, `GI ${gi}`).toBeLessThan(carb[60]! - carb[0]!)
      }
    },
  )

  golden(
    'gas.exchangeRatio',
    ['bosch1990'],
    'cross-check (R57): in a run the exchange ratio is 0.91–0.96, as measured in runners (Bosch 1990; trained, 68–76 % VO2max)',
    () => {
      const rq = values(run('', [runBout]), 'gas.exchangeRatio')[IN_BOUT]!
      expect(rq).toBeGreaterThanOrEqual(0.91)
      expect(rq).toBeLessThanOrEqual(0.96)
    },
  )

  pinned(
    ['gas.o2UseRate', 'gas.co2OutRate', 'gas.exchangeRatio'],
    'C (exercise RQ floor, R51): RQ in a walk 0.85 and a run 0.92; never below the floor 0.80 + 0.0127·MET in a bout',
    () => {
      expect(values(run('', [walk]), 'gas.exchangeRatio')[IN_BOUT]!).toBeCloseTo(0.848, 3)
      expect(values(run('', [runBout]), 'gas.exchangeRatio')[IN_BOUT]!).toBeCloseTo(0.918, 3)
      for (const kind of ACTIVITY_KINDS) {
        const rq = values(run('cola:1', [{ kind, startMin: 30, durMin: 20 }]), 'gas.exchangeRatio')
        expect(rq[IN_BOUT]!, kind).toBeGreaterThanOrEqual(Math.fround(0.8 + 0.0127 * PARAMS.activity.met[kind]) - 1e-6)
      }
    },
  )
})

describe('breaths and air per breath', () => {
  golden(
    ['lungs.breathRate', 'lungs.tidalVolume'],
    ['openstax-ap2e-22'],
    'S: at rest an adult breathes 12–18 times a minute, about 500 mL a breath (400–600) (OpenStax §22.3)',
    () => {
      for (const m of ['', 'roti:2,dal:1']) {
        const sim = run(m)
        for (const i of [0, 2880]) {
          expect(values(sim, 'lungs.breathRate')[i]!, `${m} @${i}`).toBeGreaterThanOrEqual(12)
          expect(values(sim, 'lungs.breathRate')[i]!, `${m} @${i}`).toBeLessThanOrEqual(18)
          expect(values(sim, 'lungs.tidalVolume')[i]!, `${m} @${i}`).toBeGreaterThanOrEqual(400)
          expect(values(sim, 'lungs.tidalVolume')[i]!, `${m} @${i}`).toBeLessThanOrEqual(600)
        }
      }
    },
  )

  pinned(
    ['gas.o2UseRate', 'gas.co2OutRate', 'lungs.breathRate', 'lungs.tidalVolume'],
    'worked values (model §2.2): rest VO2 215, VCO2 177, f 15, VT 404 mL; walk 866 / 736 / 24 / 807; run 2115 / 1946 / 33 / 1.41 L',
    () => {
      const at = (sim: RunResult, id: RunSignalId, i: number) => values(sim, id)[i]!
      const rest = run('')
      expect(at(rest, 'gas.o2UseRate', 0)).toBeCloseTo(215, -0.5)
      expect(at(rest, 'gas.co2OutRate', 0)).toBeCloseTo(177, -0.5)
      expect(at(rest, 'lungs.breathRate', 0)).toBeCloseTo(15, 5)
      expect(at(rest, 'lungs.tidalVolume', 0)).toBeCloseTo(404, -0.5)
      // VE = f·VT ≈ 6.1 L/min (a helper, D10).
      expect((at(rest, 'lungs.breathRate', 0) * at(rest, 'lungs.tidalVolume', 0)) / 1000).toBeCloseTo(6.1, 1)
      const w = run('', [walk])
      expect(at(w, 'gas.o2UseRate', IN_BOUT)).toBeCloseTo(866, -0.5)
      expect(Math.abs(at(w, 'gas.co2OutRate', IN_BOUT) - 736)).toBeLessThan(2)
      expect(Math.round(at(w, 'lungs.breathRate', IN_BOUT))).toBe(24)
      expect(Math.abs(at(w, 'lungs.tidalVolume', IN_BOUT) - 807)).toBeLessThan(2)
      const r = run('', [runBout])
      expect(Math.abs(at(r, 'gas.o2UseRate', IN_BOUT) - 2115)).toBeLessThan(2)
      // The model's 1946 used RQ 0.92; the floor gives 0.918 (V-2).
      expect(Math.abs(at(r, 'gas.co2OutRate', IN_BOUT) - 1946)).toBeLessThan(5)
      expect(Math.round(at(r, 'lungs.breathRate', IN_BOUT))).toBe(33)
      expect(at(r, 'lungs.tidalVolume', IN_BOUT) / 1000).toBeCloseTo(1.41, 2)
    },
  )

  pinned('lungs.breathRate', 'G: a meal changes the breath rate by at most 3 a minute', () => {
    const foodsToTry = [
      ...meals.map(mealOf),
      ...[gribokShake('carb', 100), gribokShake('fat')].map((f) => buildMeal([{ foodId: f.id, servings: 1 }], () => f)),
    ]
    for (const meal of foodsToTry) {
      const f = values(simulate(meal, { particles: 0 }), 'lungs.breathRate')
      expect(max(f) - f[0]!, meal.items.map((it) => it.food.id).join(',')).toBeLessThanOrEqual(3)
      expect(min(f), meal.items.map((it) => it.food.id).join(',')).toBeGreaterThanOrEqual(f[0]! - 1e-6)
    }
  })

  pinned(['lungs.breathRate', 'lungs.tidalVolume'], 'G (design guard, R51): in a run 25–45 breaths a minute and 1–2.5 L a breath', () => {
    for (const m of ['', 'cheeseburger:1,fries:1,cola:1', 'glucose-50:1']) {
      const sim = run(m, [runBout])
      expect(values(sim, 'lungs.breathRate')[IN_BOUT]!, m).toBeGreaterThanOrEqual(25)
      expect(values(sim, 'lungs.breathRate')[IN_BOUT]!, m).toBeLessThanOrEqual(45)
      expect(values(sim, 'lungs.tidalVolume')[IN_BOUT]!, m).toBeGreaterThanOrEqual(1000)
      expect(values(sim, 'lungs.tidalVolume')[IN_BOUT]!, m).toBeLessThanOrEqual(2500)
    }
  })

  pinned(
    ['gas.o2UseRate', 'gas.co2OutRate', 'lungs.breathRate', 'lungs.tidalVolume'],
    'more MET, more oxygen used, faster and deeper breathing: run > brisk walk > walk > rest',
    () => {
      const at = (kind: ActivityBout['kind'] | null) => run('', kind ? [{ kind, startMin: 30, durMin: 20 }] : [])
      const order = [at(null), at('walk'), at('walkBrisk'), at('run')]
      for (const id of ['gas.o2UseRate', 'gas.co2OutRate', 'lungs.breathRate', 'lungs.tidalVolume'] as const)
        for (let k = 1; k < order.length; k++)
          expect(values(order[k]!, id)[IN_BOUT]!, id).toBeGreaterThan(values(order[k - 1]!, id)[IN_BOUT]!)
    },
  )

  // R54: the older book's exact numbers. No model value goes on screen until this passes (model §2.2;
  // wet or dry gas and the dead-space mixing are open, model §6 Q6). The model gives about 17.4 % O2
  // and 2.9 % CO2 in exhaled air at rest (FECO2 = VCO2 / (f·VT)).
  it.todo(
    '[gas.co2OutRate, gas.o2UseRate, lungs.breathRate, lungs.tidalVolume] exhaled air at rest is 16.4 % oxygen and 4.4 % carbon dioxide (older NCERT Class 7 book 2024-25, ncert-c7-2024)',
  )
})

describe('insertion and rest invariance (model D13 iii, iv)', () => {
  const plans: ActivityBout[][] = [[], [walk, { kind: 'run', startMin: 600, durMin: 30 }]]

  it('(iii) adding gas leaves every signal, internal array and moment that existed before it byte-identical', () => {
    const without = HUMAN_MODULES.filter((m) => m.id !== 'gas')
    expect(without).toHaveLength(HUMAN_MODULES.length - 1)
    for (const m of FULL ? meals : meals.slice(0, 3))
      for (const plan of plans) {
        const before = runModules(without, setup(m, plan))
        const after = runModules(HUMAN_MODULES, setup(m, plan))
        for (const [id, w] of before.signals) {
          const a = after.signals.get(id)!
          expect(firstDiff(w.values, a.values), `${m} ${id}`).toBe(-1)
          if (w.band)
            expect([firstDiff(w.band.low, a.band?.low), firstDiff(w.band.high, a.band?.high)], `${m} ${id} band`).toEqual([-1, -1])
          else expect(a.band, `${m} ${id}`).toBeUndefined()
        }
        expect([...after.signals.keys()].filter((id) => !before.signals.has(id))).toEqual([...BREATHING_SIGNAL_IDS])
        expect(after.moments).toEqual(before.moments)
      }
  }, 30_000)

  it('(iv) no plan and an empty plan give the same gas rows; a fasting rest is flat for 48 h', () => {
    for (const m of ['', 'cheeseburger:1,fries:1,cola:1']) {
      const none = simulate(mealOf(m), { particles: 0 })
      const empty = run(m, [])
      for (const id of BREATHING_SIGNAL_IDS) expect(firstDiff(values(empty, id), values(none, id)), `${m} ${id}`).toBe(-1)
    }
    const rest = runModules(HUMAN_MODULES, setup('')).signals
    for (const id of BREATHING_SIGNAL_IDS) {
      const v = rest.get(id)!.values
      for (let i = 1; i < v.length; i++) expect(Math.abs(v[i]! - v[0]!) / v[0]!, `${id} @${i}`).toBeLessThanOrEqual(1e-9)
    }
  })

  it('a walk and a run change breathing only during the bout (nothing carries over: no EPOC, model limits)', () => {
    const rest = run('', [])
    const moving = run('', [walk])
    for (const id of BREATHING_SIGNAL_IDS) {
      expect(values(moving, id)[30], id).toBe(values(rest, id)[30])
      expect(values(moving, id)[51], id).toBe(values(rest, id)[51])
    }
  })
})

describe('contract: status, ranges, speed', () => {
  const rank: Record<SignalStatus, number> = { illustration: 0, assumption: 1, simulated: 2 }

  it('each module’s signals are no surer than the weakest signal it reads (D9; an x.* array counts as its writer’s weakest row)', () => {
    const weakest = new Map<string, number>()
    for (const m of HUMAN_MODULES) {
      const needs = m.needs.map((id) => weakest.get(id) ?? rank[RUN_SIGNALS[id as RunSignalId].status])
      const cap = Math.min(rank.simulated, ...needs)
      const own = m.provides.map((id) => rank[RUN_SIGNALS[id].status])
      for (const id of m.provides) expect(rank[RUN_SIGNALS[id].status], `${m.id} ${id}`).toBeLessThanOrEqual(cap)
      for (const id of m.provides) weakest.set(id, rank[RUN_SIGNALS[id].status])
      for (const id of m.internal ?? []) weakest.set(id, Math.min(cap, ...own))
    }
    expect(weakest.get(ENERGY_TOTAL)).toBe(rank.assumption)
    for (const id of BREATHING_SIGNAL_IDS) expect(RUN_SIGNALS[id].status).toBe('assumption')
  })

  it(`every gas row stays finite and inside its validRange (never clamped to pass) for ${FULL ? 300 : 40} meal × activity plans (fixed seed)`, () => {
    let seed = 11
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
    const menu = [...meals, 'gribok-carb-70:1', 'gribok-fat-70:1', 'standard-meal:1', 'fatty-meal:1']
    for (let k = 0; k < (FULL ? 300 : 40); k++) {
      const plan: ActivityBout[] = []
      let t = Math.floor(rnd() * 600)
      for (let b = 0, count = Math.floor(rnd() * 9); b < count && t <= 2880; b++) {
        const durMin = 5 + Math.floor(rnd() * 116)
        plan.push({ kind: pick(ACTIVITY_KINDS), startMin: t, durMin })
        t += durMin + Math.floor(rnd() * 300)
      }
      const out = runModules(HUMAN_MODULES, setup(pick(menu), plan)).signals
      for (const id of BREATHING_SIGNAL_IDS) {
        const { low, high } = RUN_SIGNALS[id].validRange!
        const v = out.get(id)!.values
        const bad = v.findIndex((x) => !Number.isFinite(x) || x < low || x > high)
        expect(bad, `${id} with ${activityKey(plan)}: ${v[bad]}`).toBe(-1)
      }
    }
  }, 30_000)

  it('gas runs in ≤ 2 ms (median of 21 runs, 48 h at 1 min)', () => {
    const out = runModules(
      HUMAN_MODULES.filter((m) => m.id !== 'gas'),
      setup('cheeseburger:1,fries:1,cola:1', [walk]),
    )
    const store = out.signals
    const upstream: ModelModule = {
      id: 'bloodSugar',
      system: 'digestion',
      needs: [],
      provides: ['blood.glucose'],
      internal: [ENERGY_TOTAL, 'x.activity.met'],
      run(ctx) {
        ctx.put('blood.glucose', store.get('blood.glucose')!.values, store.get('blood.glucose')!.band)
        ctx.put(ENERGY_TOTAL, store.get(ENERGY_TOTAL)!.values)
        ctx.put('x.activity.met', store.get('x.activity.met')!.values)
      },
    }
    const s = setup('')
    const times: number[] = []
    for (let k = 0; k < 21; k++) {
      let ms = 0
      runModules([upstream, { ...gasModule, run: (ctx) => ((ms = -performance.now()), gasModule.run(ctx), (ms += performance.now())) }], s)
      times.push(ms)
    }
    times.sort((a, b) => a - b)
    expect(times[10]!).toBeLessThanOrEqual(2)
  })
})
