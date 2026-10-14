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
  type RunResult,
  type RunSignalId,
} from '../src/index.ts'
import {
  CIRCULATION_EVENTS,
  CIRCULATION_SIGNAL_IDS,
  HUMAN_MODEL,
  HUMAN_MODULES,
  RUN_SIGNALS,
  circulationModule,
  runModules,
  simulate,
} from '../src/run.ts'
import { FULL, firstDiff, lookup as fixtureLookup } from './fixtures.ts'
import { golden, pinned } from './golden.ts'
import { runAlone } from './modules/ctx.ts'

/**
 * Heart & blood, the circulation module (S-3, model §2.3, D7, D8, D13 iii/iv). The sources were
 * read in V-0, V-0b and V-3 (core/sources.ts says where and what); the published figures are in the
 * test titles. Kinds (model §2): I identity · S sourced · C calibration (pinned) · P property · G guard.
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
const setup = (m: string, activity: ActivityBout[] = []) => ({
  input: { meal: mealOf(m), activity },
  params: HUMAN_MODEL.params,
  profile: PROFILES['adult-ref'],
  n: N,
  stepMin: 1,
})
const max = (xs: ArrayLike<number>) => {
  let m = -Infinity
  for (let i = 0; i < xs.length; i++) m = Math.max(m, xs[i]!)
  return m
}

const walk: ActivityBout = { kind: 'walk', startMin: 30, durMin: 20 }
const runBout: ActivityBout = { kind: 'run', startMin: 30, durMin: 20 }
/** A minute inside the bouts above. */
const IN_BOUT = 40
/** Eriksen & Waaler 1994's "mixed and heavy" 1400–1600 kcal meal: the fixture is 1526 kcal. */
const BIG = 'cheeseburger:2,fries:2,cola:1'
/** About Waaler's small meal (~2 MJ ≈ 480 kcal, sized by Sidery 1994): 491 kcal. */
const SMALL = 'white-rice:2,dal:1'
const meals = ['', 'water:1', 'cola:1', 'cheeseburger:1,fries:1,cola:1', 'roti:2,dal:1', BIG]

describe('the heart at rest and in a bout', () => {
  golden(
    ['heart.output', 'heart.rate', 'heart.strokeVolume'],
    ['openstax-ap2e-19'],
    'S: at rest cardiac output is 4.0–8.0 L/min, heart rate 60–100 and stroke volume 55–100 mL (OpenStax §19.4), with or without a meal',
    () => {
      for (const m of meals) {
        const sim = run(m)
        for (let i = 0; i < N; i += 13) {
          expect(values(sim, 'heart.output')[i]!, `${m} @${i}`).toBeGreaterThanOrEqual(4)
          expect(values(sim, 'heart.output')[i]!, `${m} @${i}`).toBeLessThanOrEqual(8)
          expect(values(sim, 'heart.rate')[i]!, `${m} @${i}`).toBeGreaterThanOrEqual(60)
          expect(values(sim, 'heart.rate')[i]!, `${m} @${i}`).toBeLessThanOrEqual(100)
          expect(values(sim, 'heart.strokeVolume')[i]!, `${m} @${i}`).toBeGreaterThanOrEqual(55)
          expect(values(sim, 'heart.strokeVolume')[i]!, `${m} @${i}`).toBeLessThanOrEqual(100)
        }
      }
    },
  )

  pinned(
    ['heart.output', 'heart.rate', 'heart.strokeVolume', 'blood.flow.muscle', 'blood.flow.gut'],
    'worked values (model §2.3): rest CO 4.31, HR 66, SV 65; walk 7.9 / 94 / 84; run 14.8 / 162 / 91; muscle 905 → 4136 mL/min; gut 1034',
    () => {
      const at = (sim: RunResult, id: RunSignalId, i: number) => values(sim, id)[i]!
      const rest = run('')
      expect(at(rest, 'heart.output', 0)).toBeCloseTo(4.31, 2)
      expect(Math.round(at(rest, 'heart.rate', 0))).toBe(66)
      expect(at(rest, 'heart.strokeVolume', 0)).toBe(65)
      expect(Math.abs(at(rest, 'blood.flow.muscle', 0) - 905)).toBeLessThan(1)
      expect(Math.abs(at(rest, 'blood.flow.gut', 0) - 1034)).toBeLessThan(1)
      const w = run('', [walk])
      expect(at(w, 'heart.output', IN_BOUT)).toBeCloseTo(7.9, 1)
      expect(Math.round(at(w, 'heart.rate', IN_BOUT))).toBe(94)
      expect(Math.round(at(w, 'heart.strokeVolume', IN_BOUT))).toBe(84)
      expect(Math.abs(at(w, 'blood.flow.muscle', IN_BOUT) - 4136)).toBeLessThan(5)
      const r = run('', [runBout])
      expect(at(r, 'heart.output', IN_BOUT)).toBeCloseTo(14.8, 1)
      expect(Math.round(at(r, 'heart.rate', IN_BOUT))).toBe(162)
      expect(Math.round(at(r, 'heart.strokeVolume', IN_BOUT))).toBe(91)
    },
  )

  golden(
    'heart.output',
    ['stringer2005', 'cook2005'],
    'S: in a steady bout cardiac output rises about 5–6 L/min per L/min of extra oxygen used (Stringer 2005 "approximately 5-6"; Cook 2005: 5.8)',
    () => {
      for (const kind of ACTIVITY_KINDS) {
        const rest = run('')
        const moving = run('', [{ kind, startMin: 30, durMin: 20 }])
        const dCo = values(moving, 'heart.output')[IN_BOUT]! - values(rest, 'heart.output')[IN_BOUT]!
        const dVo2 = (values(moving, 'gas.o2UseRate')[IN_BOUT]! - values(rest, 'gas.o2UseRate')[IN_BOUT]!) / 1000
        expect(dCo / dVo2, kind).toBeGreaterThanOrEqual(5)
        expect(dCo / dVo2, kind).toBeLessThanOrEqual(6)
      }
    },
  )

  golden(
    ['heart.strokeVolume', 'heart.rate'],
    ['higginbotham1986'],
    'S: stroke volume rises at most 1.4-fold and then stays flat in hard exercise, so the heart rate carries the rest (Higginbotham 1986: 41 → 58 mL/m², "increased no further"; peak HR 167)',
    () => {
      const svRest = values(run(''), 'heart.strokeVolume')[0]!
      const sv = (kind: ActivityBout['kind']) => values(run('', [{ kind, startMin: 30, durMin: 20 }]), 'heart.strokeVolume')[IN_BOUT]!
      for (const kind of ACTIVITY_KINDS) expect(sv(kind) / svRest, kind).toBeLessThanOrEqual(1.4 + 1e-6)
      // The run and football are past the plateau (moving CO rise ≥ 5 L/min): same stroke volume.
      expect(sv('run')).toBe(sv('football'))
      expect(sv('run') / svRest).toBeCloseTo(1.4, 6)
      const hr = values(run('', [runBout]), 'heart.rate')[IN_BOUT]!
      expect(hr).toBeGreaterThan(150)
      expect(hr).toBeLessThan(175)
    },
  )

  golden(
    ['blood.flow.gut', 'blood.flow.muscle'],
    ['openstax-ap2e-20'],
    'S: at rest the gut gets about 24 % and the muscles about 21 % of the blood (OpenStax Table 20.3: 1400 and 1200 of 5800 mL/min)',
    () => {
      const sim = run('')
      const co = values(sim, 'heart.output')[0]! * 1000
      expect(Math.abs(values(sim, 'blood.flow.gut')[0]! / co - 1400 / 5800)).toBeLessThan(0.01)
      expect(Math.abs(values(sim, 'blood.flow.muscle')[0]! / co - 1200 / 5800)).toBeLessThan(0.01)
    },
  )

  golden(
    'blood.flow.muscle',
    ['openstax-ap2e-20'],
    'S: in a walk about half of the blood goes to the muscles (OpenStax Table 20.3, mild exercise: 4500 of 9500 mL/min, 47 %); model 40–60 %',
    () => {
      for (const kind of ['walk', 'walkBrisk'] as const) {
        const sim = run('', [{ kind, startMin: 30, durMin: 20 }])
        const share = values(sim, 'blood.flow.muscle')[IN_BOUT]! / (values(sim, 'heart.output')[IN_BOUT]! * 1000)
        expect(share, kind).toBeGreaterThanOrEqual(0.4)
        expect(share, kind).toBeLessThanOrEqual(0.6)
      }
    },
  )

  pinned(['heart.output'], 'G: a walk gives 7–11 L/min and a run 13–19 L/min, with or without a meal', () => {
    for (const m of ['', 'cola:1', BIG]) {
      expect(values(run(m, [walk]), 'heart.output')[IN_BOUT]!, m).toBeGreaterThanOrEqual(7)
      expect(values(run(m, [walk]), 'heart.output')[IN_BOUT]!, m).toBeLessThanOrEqual(11)
      expect(values(run(m, [runBout]), 'heart.output')[IN_BOUT]!, m).toBeGreaterThanOrEqual(13)
      expect(values(run(m, [runBout]), 'heart.output')[IN_BOUT]!, m).toBeLessThanOrEqual(19)
    }
  })

  pinned(
    ['heart.rate', 'heart.output', 'heart.strokeVolume', 'blood.flow.muscle'],
    'P: more MET, more blood pumped, faster beats, bigger beats (up to the plateau) and more to the muscles: rest < walk < brisk walk < run',
    () => {
      const at = (kind: ActivityBout['kind'] | null) => run('', kind ? [{ kind, startMin: 30, durMin: 20 }] : [])
      const order = [at(null), at('walk'), at('walkBrisk'), at('run')]
      for (const id of ['heart.rate', 'heart.output', 'heart.strokeVolume', 'blood.flow.muscle'] as const)
        for (let k = 1; k < order.length; k++)
          expect(values(order[k]!, id)[IN_BOUT]!, id).toBeGreaterThan(values(order[k - 1]!, id)[IN_BOUT]!)
    },
  )

  pinned('heart.rate', 'G: the heart rate never passes 191 (220 − age, OpenStax §19.4), even in the hardest bout after a big meal', () => {
    for (const kind of ACTIVITY_KINDS) {
      const hr = values(run(BIG, [{ kind, startMin: 60, durMin: 60 }]), 'heart.rate')
      expect(max(hr), kind).toBeLessThanOrEqual(191)
    }
  })
})

describe('after a meal (model D7)', () => {
  pinned(
    'heart.output',
    'C (gut-flow K, circulation.gutHalfKcalPerMin): a 1526 kcal mixed meal raises cardiac output by 1.0–1.6 L/min (Eriksen 1994: ~1.3 for 1400–1600 kcal), peaking 30–90 min after it starts',
    () => {
      const co = values(run(BIG), 'heart.output')
      const peak = max(co)
      expect(peak - co[0]!).toBeGreaterThanOrEqual(1)
      expect(peak - co[0]!).toBeLessThanOrEqual(1.6)
      expect(Math.abs(peak - co[0]! - 1.3)).toBeLessThan(0.05)
      const at = Array.from(co).indexOf(peak)
      expect(at).toBeGreaterThanOrEqual(30)
      expect(at).toBeLessThanOrEqual(90)
    },
  )

  // The peak minute does not depend on K or the 3 L/min ceiling (the rise is a monotone map of the
  // weighted absorption), so the calibration above cannot place it: a hold-out.
  golden(
    'event.gutFlowPeak',
    ['waaler1991'],
    'S hold-out: after a mixed meal with a sweet drink the gut flow, and so cardiac output, peaks 30–90 min after the meal starts (Waaler 1991: "a maximum level 30 to 60 min after end of the meal")',
    () => {
      for (const m of [BIG, 'cheeseburger:1,fries:1,cola:1', 'cola:1']) {
        const sim = run(m)
        const at = sim.moments.get('event.gutFlowPeak')!.atMin!
        expect(at, m).toBeGreaterThanOrEqual(30)
        expect(at, m).toBeLessThanOrEqual(90)
        expect(values(sim, 'blood.flow.gut')[at]!, m).toBe(max(values(sim, 'blood.flow.gut')))
      }
    },
  )

  golden.fails(
    'event.gutFlowPeak',
    ['waaler1991'],
    'a solid meal (roti and dal; a 1400 kcal fatty meal) also peaks within 30–90 min',
    'solids leave the stomach at a steady rate for hours in this model (deferred emptying change, R45/R67), so gut flow rises to a plateau',
    () => {
      for (const m of ['roti:2,dal:1', 'fatty-meal:2']) expect(run(m).moments.get('event.gutFlowPeak')!.atMin!, m).toBeLessThanOrEqual(90)
    },
  )

  golden(
    'heart.output',
    ['waaler1991', 'sidery1994'],
    'S hold-out: 2 h after a large meal cardiac output is still clearly raised, at least half its peak rise (Waaler 1991 "still markedly elevated 2 hours after a large meal"; Sidery 1994: raised through 120 min after 3 MJ)',
    () => {
      const co = values(run(BIG), 'heart.output')
      expect(co[120]! - co[0]!).toBeGreaterThanOrEqual(0.5 * (max(co) - co[0]!))
    },
  )

  golden.fails(
    'heart.output',
    ['waaler1991', 'sidery1994'],
    'R52: after a small meal (~2 MJ, ~480 kcal) cardiac output is nearly back to fasting by 2 h (rise at most a quarter of its peak)',
    'a 491 kcal rice and dal meal still empties at ~1.2 kcal/min for 5–6 h here (deferred emptying change, R45/R67); a small sweet drink is back by 2 h',
    () => {
      const co = values(run(SMALL), 'heart.output')
      expect(co[120]! - co[0]!).toBeLessThanOrEqual(0.25 * (max(co) - co[0]!))
    },
  )

  pinned('heart.output', 'a small sweet drink (cola, 144 kcal) is back within 10 % of fasting by 2 h', () => {
    const co = values(run('cola:1'), 'heart.output')
    expect(co[120]! / co[0]!).toBeLessThanOrEqual(1.1)
  })

  golden(
    ['heart.output', 'heart.rate'],
    ['eriksen1994'],
    'S hold-out (D7): exercise after a meal adds to the meal’s rise: CO(meal + walk) − rest = (meal alone − rest) + (walk alone − rest), within 1 % (Eriksen 1994 "pure summation")',
    () => {
      for (const m of [BIG, 'roti:2,dal:1']) {
        const rest = values(run(''), 'heart.output')[IN_BOUT]!
        const both = values(run(m, [walk]), 'heart.output')[IN_BOUT]!
        const meal = values(run(m), 'heart.output')[IN_BOUT]!
        const moving = values(run('', [walk]), 'heart.output')[IN_BOUT]!
        expect(Math.abs(both - (meal + moving - rest)) / both, m).toBeLessThanOrEqual(0.01)
      }
    },
  )

  golden(
    'blood.flow.gut',
    ['sieber1992'],
    'P: per kcal absorbed the gut flow rises most for fat and protein and least for carbohydrate: fat ≥ protein > carbohydrate (Sieber 1992: "similar after … fat, and protein, but … significantly … less for carbohydrates")',
    () => {
      const meal = mealOf('')
      const flat = (x: number) => ({ values: new Float64Array(N).fill(x) })
      // The same 1 kcal/min absorbed as each nutrient alone (4, 4, 9 kcal per g), at rest.
      const gutFlow = (g: { carbs: number; protein: number; fat: number }) =>
        runAlone(circulationModule, meal, {
          'gas.o2UseRate': flat(215),
          'energy.foodEffectRate': flat(0),
          'gut.absorbRate.carbs': flat(g.carbs),
          'gut.absorbRate.protein': flat(g.protein),
          'gut.absorbRate.fat': flat(g.fat),
          'x.activity.met': flat(1),
        }).get('blood.flow.gut')!.values[100]!
      const carbs = gutFlow({ carbs: 0.25, protein: 0, fat: 0 })
      const protein = gutFlow({ carbs: 0, protein: 0.25, fat: 0 })
      const fat = gutFlow({ carbs: 0, protein: 0, fat: 1 / 9 })
      const none = gutFlow({ carbs: 0, protein: 0, fat: 0 })
      expect(fat).toBeGreaterThanOrEqual(protein)
      expect(protein).toBeGreaterThan(carbs)
      expect(carbs).toBeGreaterThan(none)
    },
  )

  pinned(
    ['heart.rate', 'heart.output', 'heart.strokeVolume', 'blood.flow.gut', 'blood.flow.muscle'],
    'P: water only changes nothing: every heart and blood row is the fasting rest’s, to the byte, and there is no gut-flow peak',
    () => {
      const rest = run('')
      const water = run('water:1')
      for (const id of CIRCULATION_SIGNAL_IDS) expect(firstDiff(values(water, id), values(rest, id)), id).toBe(-1)
      expect(water.moments.get('event.gutFlowPeak')!.atMin).toBeNull()
      expect(rest.moments.get('event.gutFlowPeak')!.atMin).toBeNull()
    },
  )

  pinned(
    ['heart.output', 'blood.flow.gut', 'heart.strokeVolume', 'blood.flow.muscle'],
    'I (D7, no food-effect oxygen counted twice): without a bout, CO − resting CO = the gut’s rise exactly, though the meal raises O2 use; stroke volume and muscle flow stay at rest',
    () => {
      for (const m of meals) {
        const sim = run(m)
        const co = values(sim, 'heart.output')
        const gut = values(sim, 'blood.flow.gut')
        const o2 = values(sim, 'gas.o2UseRate')
        for (let i = 0; i < N; i += 7) {
          expect(co[i]! - co[0]!, `${m} @${i}`).toBeCloseTo((gut[i]! - gut[0]!) / 1000, 4)
          expect(values(sim, 'heart.strokeVolume')[i]).toBe(values(sim, 'heart.strokeVolume')[0])
          expect(values(sim, 'blood.flow.muscle')[i]).toBe(values(sim, 'blood.flow.muscle')[0])
        }
        if (m === BIG) expect(max(o2) - o2[0]!).toBeGreaterThan(30)
      }
    },
  )
})

describe('insertion and rest invariance (model D13 iii, iv)', () => {
  const plans: ActivityBout[][] = [[], [walk, { kind: 'run', startMin: 600, durMin: 30 }]]

  it('(iii) adding circulation leaves every signal, internal array and moment that existed before it byte-identical', () => {
    const without = HUMAN_MODULES.filter((m) => m.id !== 'circulation')
    expect(without).toHaveLength(HUMAN_MODULES.length - 1)
    for (const m of FULL ? meals : meals.slice(0, 4))
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
        expect([...after.signals.keys()].filter((id) => !before.signals.has(id))).toEqual([...CIRCULATION_SIGNAL_IDS])
        for (const [id, p] of before.moments) expect(after.moments.get(id), `${m} ${id}`).toEqual(p)
        expect([...after.moments.keys()].filter((id) => !before.moments.has(id))).toEqual(['event.gutFlowPeak'])
      }
  }, 30_000)

  it('(iv) no plan and an empty plan give the same rows; a fasting rest is flat for 48 h', () => {
    for (const m of ['', BIG]) {
      const none = simulate(mealOf(m), { particles: 0 })
      const empty = run(m, [])
      for (const id of CIRCULATION_SIGNAL_IDS) expect(firstDiff(values(empty, id), values(none, id)), `${m} ${id}`).toBe(-1)
      expect(empty.moments.get('event.gutFlowPeak')).toEqual(none.moments.get('event.gutFlowPeak'))
    }
    const rest = runModules(HUMAN_MODULES, setup('')).signals
    for (const id of CIRCULATION_SIGNAL_IDS) {
      const v = rest.get(id)!.values
      for (let i = 1; i < v.length; i++) expect(Math.abs(v[i]! - v[0]!) / v[0]!, `${id} @${i}`).toBeLessThanOrEqual(1e-9)
    }
  })

  it('a walk changes the heart only during the bout, and never the gut flow (nothing carries over: no EPOC)', () => {
    for (const m of ['', BIG]) {
      const rest = run(m, [])
      const moving = run(m, [walk])
      for (const id of CIRCULATION_SIGNAL_IDS) {
        expect(values(moving, id)[29], id).toBe(values(rest, id)[29])
        expect(values(moving, id)[51], id).toBe(values(rest, id)[51])
      }
      expect(firstDiff(values(moving, 'blood.flow.gut'), values(rest, 'blood.flow.gut')), m).toBe(-1)
    }
  })
})

describe('contract: status, ranges, speed', () => {
  it('every heart and blood row and the gut-flow peak are Model estimates (status ≤ its needs, D9)', () => {
    for (const id of CIRCULATION_SIGNAL_IDS) expect(RUN_SIGNALS[id].status, id).toBe('assumption')
    expect(CIRCULATION_EVENTS['event.gutFlowPeak'].status).toBe('assumption')
    for (const id of circulationModule.needs.filter((id) => !id.startsWith('x.'))) expect(RUN_SIGNALS[id as RunSignalId], id).toBeDefined()
    expect(RUN_SIGNALS['gas.o2UseRate'].status).toBe('assumption')
  })

  it(`every circulation row stays finite and inside its validRange (never clamped to pass) for ${FULL ? 300 : 40} meal × activity plans (fixed seed)`, () => {
    let seed = 23
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
    const menu = [...meals, 'gribok-carb-70:1', 'gribok-fat-70:1', 'standard-meal:1', 'fatty-meal:2', 'glucose-50:1']
    for (let k = 0; k < (FULL ? 300 : 40); k++) {
      const plan: ActivityBout[] = []
      let t = Math.floor(rnd() * 600)
      for (let b = 0, count = Math.floor(rnd() * 9); b < count && t <= 2880; b++) {
        const durMin = 5 + Math.floor(rnd() * 116)
        plan.push({ kind: pick(ACTIVITY_KINDS), startMin: t, durMin })
        t += durMin + Math.floor(rnd() * 300)
      }
      const out = runModules(HUMAN_MODULES, setup(pick(menu), plan)).signals
      for (const id of CIRCULATION_SIGNAL_IDS) {
        const { low, high } = RUN_SIGNALS[id].validRange!
        const v = out.get(id)!.values
        const bad = v.findIndex((x) => !Number.isFinite(x) || x < low || x > high)
        expect(bad, `${id} with ${activityKey(plan)}: ${v[bad]}`).toBe(-1)
      }
    }
  }, 30_000)

  it('circulation runs in ≤ 2 ms (median of 21 runs, 48 h at 1 min)', () => {
    const store = runModules(
      HUMAN_MODULES.filter((m) => m.id !== 'circulation'),
      setup(BIG, [walk]),
    ).signals
    const ids = ['gas.o2UseRate', 'energy.foodEffectRate', 'gut.absorbRate.carbs', 'gut.absorbRate.protein', 'gut.absorbRate.fat'] as const
    const upstream: ModelModule = {
      id: 'gas',
      system: 'breathing',
      needs: [],
      provides: [...ids],
      internal: ['x.activity.met'],
      run(ctx) {
        for (const id of ids) ctx.put(id, store.get(id)!.values)
        ctx.put('x.activity.met', store.get('x.activity.met')!.values)
      },
    }
    const s = setup('')
    const times: number[] = []
    for (let k = 0; k < 21; k++) {
      let ms = 0
      runModules(
        [
          upstream,
          { ...circulationModule, run: (ctx) => ((ms = -performance.now()), circulationModule.run(ctx), (ms += performance.now())) },
        ],
        s,
      )
      times.push(ms)
    }
    times.sort((a, b) => a - b)
    expect(times[10]!).toBeLessThanOrEqual(2)
  })
})
