import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_KINDS,
  PROFILES,
  activityKey,
  buildMeal,
  decodeMeal,
  parseFood,
  type ActivityBout,
  type ModelModule,
  type Params,
  type RunSignalId,
} from '../src/index.ts'
import {
  CONTROL_EVENTS,
  CONTROL_SIGNAL_IDS,
  HUMAN_MODEL,
  HUMAN_MODULES,
  RUN_SIGNALS,
  bloodSugarModule,
  buildSignalTable,
  runModules,
  simulate,
} from '../src/run.ts'
import { INSULIN_SECRETION, insulinCurve, insulinPeakMin, putGlucose } from '../src/modules/bloodSugar.ts'
import { CARBS_OUT } from '../src/modules/gut.ts'
import { PARAM_SOURCES } from '../src/core/sources.ts'
import { FULL, firstDiff, lookup as fixtureLookup } from './fixtures.ts'
import { golden, pinned } from './golden.ts'
import { paramsWith } from './modules/ctx.ts'

/**
 * Insulin, open loop, and the brain's glucose use (S-6, model §2.5 E1, D13 iii/iv). The sources
 * were read in V-6 (core/sources.ts says where and what); the published figures are in the test
 * titles. Kinds (model §2): S sourced · C calibration · P property · I identity · G guard. Insulin is
 * a multiple of fasting ("× before eating"), never µU/mL.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => fixtureLookup(id) ?? foods.find((f) => f.id === id)
const mealOf = (m: string) => buildMeal(decodeMeal(m), lookup)
const N = 2881
const setupOf = (m: string, activity: readonly ActivityBout[] = [], params: Params = HUMAN_MODEL.params) => ({
  input: { meal: mealOf(m), activity },
  params,
  profile: PROFILES['adult-ref'],
  n: N,
  stepMin: 1,
})
const signalsOf = (m: string, activity: readonly ActivityBout[] = [], params?: Params) =>
  runModules(HUMAN_MODULES, setupOf(m, activity, params)).signals
const insulinOf = (m: string, params?: Params) => signalsOf(m, [], params).get('blood.insulin')!.values

/** Takahashi 2018's test: 75 g glucose drink (fixtures.ts). */
const OGTT = 'glucose-75:1'
/** Mixed meals for Polonsky 1988's hold-out: Home and Teach's meals with carbohydrate, protein and fat, and Abell's test meal. */
const MIXED = [
  'roti:2,dal:1',
  'roti:1,dal:1',
  'cheeseburger:1,fries:1',
  'idli:2,milk:1',
  'standard-meal:1',
  'cheeseburger:1,fries:1,cola:1',
]
/** No glucose comes in: water (one glass, the most, the test fixture) and nothing at all. */
const NO_GLUCOSE = ['water:1', 'water:5', 'water-test:1', '']
// A drink, mixed meals, water and nothing; FULL=1 adds the others (R68).
const meals = FULL
  ? ['cola:1', 'cheeseburger:1,fries:1,cola:1', 'roti:2,dal:1', OGTT, 'fatty-meal:1', 'milk:1', 'water:1', '']
  : ['cola:1', 'cheeseburger:1,fries:1,cola:1', OGTT, 'water:1', '']
const walk60: ActivityBout = { kind: 'walk', startMin: 60, durMin: 60 }
const run60: ActivityBout = { kind: 'run', startMin: 300, durMin: 60 }

describe('calibration and hold-outs: a 75 g glucose drink and mixed meals (model §2.5)', () => {
  golden(
    ['blood.insulin', 'event.insulinPeak'],
    ['takahashi2018'],
    'calibration (c): 75 g glucose → insulin 6–20× fasting at the 30 or 60 min sample, peaking before 60 min (Takahashi 2018, normal type: 74.1 / 6.2 µU/mL = 12.0× at 30 min; c fitted to 12×)',
    () => {
      const sim = simulate(mealOf(OGTT), { particles: 0 })
      const insulin = sim.signals.get('blood.insulin')!.values
      const atSample = Math.max(insulin[30]!, insulin[60]!)
      expect(atSample).toBeGreaterThanOrEqual(6)
      expect(atSample).toBeLessThanOrEqual(20)
      expect(insulin[30]!).toBeCloseTo(12, 0)
      expect(sim.moments.get('event.insulinPeak')!.atMin).toBeLessThanOrEqual(60)
    },
  )

  golden(
    'blood.insulin',
    ['takahashi2018'],
    'hold-out: 75 g glucose → insulin still above 2× fasting at 120 min (Takahashi 2018: 36.1 / 6.2 = 5.8× in the normal type; above 5× in every type)',
    () => {
      expect(insulinOf(OGTT)[120]!).toBeGreaterThan(2)
    },
  )

  golden(
    'blood.insulin',
    ['polonsky1988'],
    'hold-out: the insulin made in the 4 h after a mixed meal is 2–4.5× the basal output over those 4 h (Polonsky 1988: 63–67 nmol vs 4 × 5.4 nmol/h basal, about 3×)',
    () => {
      for (const m of MIXED) {
        const secretion = signalsOf(m).get(INSULIN_SECRETION)!.values
        let sum = 0
        for (let i = 0; i < 240; i++) sum += secretion[i]!
        expect(sum / 240, m).toBeGreaterThanOrEqual(2)
        expect(sum / 240, m).toBeLessThanOrEqual(4.5)
      }
    },
  )

  pinned(['blood.insulin', 'event.insulinPeak'], 'water only, or nothing: insulin is exactly 1 all 48 h and has no peak', () => {
    for (const m of NO_GLUCOSE) {
      const sim = simulate(mealOf(m), { particles: 0 })
      const s = sim.signals.get('blood.insulin')!
      expect(
        [s.values, s.low!, s.high!].map((v) => v.findIndex((x) => x !== 1)),
        m || '(nothing)',
      ).toEqual([-1, -1, -1])
      expect(sim.moments.get('event.insulinPeak')!.atMin, m).toBeNull()
    }
  })

  pinned(
    'blood.insulin',
    'a meal with glucose raises insulin above 1 and it comes back to exactly 1 within 48 h; the band brackets it',
    () => {
      for (const m of ['cola:1', OGTT, ...MIXED, 'fatty-meal:1']) {
        const s = simulate(mealOf(m), { particles: 0 }).signals.get('blood.insulin')!
        expect(Math.max(...s.values), m).toBeGreaterThan(1.5)
        expect(Math.abs(s.values[N - 1]! - 1), m).toBeLessThanOrEqual(0.01)
        for (let i = 0; i < N; i++) if (s.low![i]! > s.values[i]! || s.high![i]! < s.values[i]!) expect.fail(`${m} band @${i}`)
      }
    },
  )

  pinned('blood.insulin', 'more glucose drunk → more insulin (50 g vs 75 g, one cola vs four)', () => {
    const area = (m: string) => insulinOf(m).reduce((a, x) => a + (x - 1), 0)
    expect(area(OGTT)).toBeGreaterThan(area('glucose-50:1'))
    expect(area('cola:4')).toBeGreaterThan(area('cola:1'))
  })
})

describe('the brain’s glucose use (model §2.5, D15)', () => {
  golden(
    'brain.glucoseUse',
    ['cahill1968', 'mergenthaler2013'],
    'the brain uses 100–145 g of glucose a day (Cahill & Owen 1968; Mergenthaler 2013: 5.6 mg per 100 g per min × 1.3 kg = 105 g), the same all day',
    () => {
      const use = signalsOf('cheeseburger:1,fries:1').get('brain.glucoseUse')!.values
      let day = 0
      for (let i = 0; i < 1440; i++) day += use[i]! / 60
      expect(day).toBeGreaterThanOrEqual(100)
      expect(day).toBeLessThanOrEqual(145)
      expect(use.every((x) => x === use[0])).toBe(true)
    },
  )

  pinned('brain.glucoseUse', 'a constant: every meal and every activity plan gives the same 4.4 g/h', () => {
    for (const m of meals)
      for (const plan of [[], [walk60, run60]]) {
        const use = signalsOf(m, plan).get('brain.glucoseUse')!.values
        expect(
          use.findIndex((x) => x !== 4.4),
          m,
        ).toBe(-1)
      }
  })
})

describe('open loop (E1, D5 C1): insulin never moves glucose', () => {
  pinned(['blood.glucose', 'blood.insulin'], 'glucose is the same to the byte whatever the insulin numbers (c, half-life, α, β, K)', () => {
    for (const m of ['cola:1', OGTT, 'roti:2,dal:1']) {
      const base = signalsOf(m).get('blood.glucose')!
      for (const [path, value] of [
        ['insulin.raGainPerGPerMin', 0],
        ['insulin.halfLifeMin', 20],
        ['insulin.alphaPerMin', 0.5],
        ['insulin.betaPerMgDl', 1],
        ['insulin.kDynamic', 0],
      ] as const) {
        const other = signalsOf(m, [], paramsWith(path, value)).get('blood.glucose')!
        expect([firstDiff(base.values, other.values), firstDiff(base.band!.low, other.band!.low)], `${m} ${path}`).toEqual([-1, -1])
      }
    }
  })

  it('reads ctx.params: no gut term lowers the peak; a longer half-life delays it', () => {
    const peakOf = (v: ArrayLike<number>) => {
      let at = 0
      for (let i = 1; i < v.length; i++) if (v[i]! > v[at]!) at = i
      return { at, value: v[at]! }
    }
    const base = peakOf(insulinOf(OGTT))
    expect(peakOf(insulinOf(OGTT, paramsWith('insulin.raGainPerGPerMin', 0))).value).toBeLessThan(base.value)
    expect(peakOf(insulinOf(OGTT, paramsWith('insulin.halfLifeMin', 15))).at).toBeGreaterThan(base.at)
  })
})

describe('insertion invariance (model D13 iii) and rest invariance (D13 iv)', () => {
  /** bloodSugar as it was before S-6: the glucose step only. */
  const glucoseOnly: ModelModule = {
    id: 'bloodSugar',
    system: 'digestion',
    needs: [CARBS_OUT.liquid, CARBS_OUT.solid],
    provides: ['blood.glucose'],
    run: (ctx) => void putGlucose(ctx),
  }
  const before = HUMAN_MODULES.map((m) => (m === bloodSugarModule ? glucoseOnly : m))
  const plans: ActivityBout[][] = [[], [walk60, run60]]

  it('adding insulin and the brain’s use leaves every existing signal, band, internal array, row order and moment byte-identical', () => {
    expect(before).toHaveLength(HUMAN_MODULES.length)
    for (const m of meals)
      for (const plan of plans) {
        const b = runModules(before, setupOf(m, plan))
        const a = runModules(HUMAN_MODULES, setupOf(m, plan))
        for (const [id, w] of b.signals) {
          const x = a.signals.get(id)!
          expect(firstDiff(w.values, x.values), `${m} ${id}`).toBe(-1)
          if (w.band)
            expect([firstDiff(w.band.low, x.band?.low), firstDiff(w.band.high, x.band?.high)], `${m} ${id} band`).toEqual([-1, -1])
          else expect(x.band, `${m} ${id}`).toBeUndefined()
        }
        expect([...a.signals.keys()].filter((id) => !b.signals.has(id)).sort()).toEqual([...CONTROL_SIGNAL_IDS, INSULIN_SECRETION].sort())
        const tableBefore = buildSignalTable(mealOf(m), b.signals)
        const tableAfter = buildSignalTable(mealOf(m), a.signals)
        expect([...tableAfter.keys()].filter((id) => tableBefore.has(id))).toEqual([...tableBefore.keys()])
        expect([...tableAfter.keys()].slice(tableBefore.size)).toEqual([...CONTROL_SIGNAL_IDS])
        for (const [id, p] of b.moments) expect(a.moments.get(id), `${m} ${id}`).toEqual(p)
        expect([...a.moments.keys()].filter((id) => b.moments.has(id))).toEqual([...b.moments.keys()])
        expect([...a.moments.keys()].filter((id) => !b.moments.has(id))).toEqual(['event.insulinPeak'])
      }
  }, 30_000)

  it('rest: no plan, an empty plan and bouts at MET 1 give the same insulin and brain rows and moment, to the byte; activity never moves insulin (D6)', () => {
    const atRest = paramsWith('activity.met.walk', 1)
    for (const m of meals) {
      const none = runModules(HUMAN_MODULES, setupOf(m))
      const empty = simulate(mealOf(m), { particles: 0, activity: [] })
      const restOnly = runModules(HUMAN_MODULES, setupOf(m, [walk60, { kind: 'walk', startMin: 600, durMin: 120 }], atRest))
      const moving = runModules(HUMAN_MODULES, setupOf(m, [walk60, run60]))
      for (const id of CONTROL_SIGNAL_IDS) {
        expect(firstDiff(restOnly.signals.get(id)!.values, none.signals.get(id)!.values), `${m} ${id}`).toBe(-1)
        expect(firstDiff(moving.signals.get(id)!.values, none.signals.get(id)!.values), `${m} ${id} moving`).toBe(-1)
        expect(firstDiff(empty.signals.get(id)!.values, Float32Array.from(none.signals.get(id)!.values)), `${m} ${id}`).toBe(-1)
      }
      for (const run of [restOnly, moving]) expect(run.moments.get('event.insulinPeak'), m).toEqual(none.moments.get('event.insulinPeak'))
    }
  }, 30_000)
})

describe('contract: status, params, ranges, speed', () => {
  it('both rows and the peak are Model estimates (D9); every insulin and brain number says what it rests on, c the only calibration', () => {
    for (const id of CONTROL_SIGNAL_IDS) expect(RUN_SIGNALS[id].status, id).toBe('assumption')
    expect(CONTROL_EVENTS['event.insulinPeak'].status).toBe('assumption')
    const ownKeys = (group: 'insulin' | 'brain') => Object.keys(HUMAN_MODEL.params[group]).map((k) => `${group}.${k}`)
    const own = Object.entries(PARAM_SOURCES).filter(([path]) => path.startsWith('insulin.') || path.startsWith('brain.'))
    expect(own.map(([path]) => path).sort()).toEqual([...ownKeys('insulin'), ...ownKeys('brain')].sort())
    expect(own.filter(([, e]) => e!.basis === 'calibrated').map(([path]) => path)).toEqual(['insulin.raGainPerGPerMin'])
    // Insulin is shown as × before eating, never in µU/mL.
    expect(RUN_SIGNALS['blood.insulin'].unit).toBe('xFasting')
  })

  it(`every insulin and brain row stays finite and inside its validRange (never clamped to pass) for ${FULL ? 300 : 40} meal × activity plans (fixed seed)`, () => {
    let seed = 29
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
    const menu = [...meals, ...MIXED, 'cola:5', 'cheeseburger:2,fries:2', 'gribok-carb-70:1', 'gribok-fat-70:1', 'glucose-50:1', 'water:5']
    for (let k = 0; k < (FULL ? 300 : 40); k++) {
      const plan: ActivityBout[] = []
      let t = Math.floor(rnd() * 600)
      for (let b = 0, count = Math.floor(rnd() * 9); b < count && t <= 2880; b++) {
        const durMin = 5 + Math.floor(rnd() * 116)
        plan.push({ kind: pick(ACTIVITY_KINDS), startMin: t, durMin })
        t += durMin + Math.floor(rnd() * 300)
      }
      const out = signalsOf(pick(menu), plan)
      for (const id of CONTROL_SIGNAL_IDS) {
        const { low, high } = RUN_SIGNALS[id].validRange!
        const w = out.get(id)!
        for (const v of [w.values, w.band?.low, w.band?.high]) {
          if (!v) continue
          const bad = v.findIndex((x) => !Number.isFinite(x) || x < low || x > high)
          expect(bad, `${id} with ${activityKey(plan)}: ${v[bad]}`).toBe(-1)
        }
      }
    }
  }, 30_000)

  it('insulin and the brain’s use add ≤ 2 ms to the bloodSugar module (48 h at 1 min, warm, median of 21; the glucose step before them is unchanged, D13 iii)', () => {
    const sig = signalsOf('cheeseburger:1,fries:1,cola:1')
    const glucose = sig.get('blood.glucose')!.values
    // The glycemic carbohydrate coming in, as putGlucose hands it over (a fixed curve is enough for timing).
    const ra = Float64Array.from(sig.get('gut.absorbRate.carbs')!.values)
    const params = HUMAN_MODEL.params
    const times: number[] = []
    for (let k = 0; k < 21; k++) {
      const t0 = performance.now()
      const insulin = insulinCurve(glucose, ra, 1, params)
      insulinPeakMin(insulin.typical, 1, params.insulin.peakMinRise)
      new Float64Array(N).fill(params.brain.glucoseGPerH)
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    expect(times[10]!).toBeLessThanOrEqual(2)
  })

  it('reads only what it declares: the needs are the gut’s carbohydrate outflows, no other system', () => {
    expect([...bloodSugarModule.needs]).toEqual([CARBS_OUT.liquid, CARBS_OUT.solid])
    expect(bloodSugarModule.provides.filter((id) => !(CONTROL_SIGNAL_IDS as readonly RunSignalId[]).includes(id))).toEqual([
      'blood.glucose',
    ])
  })
})
