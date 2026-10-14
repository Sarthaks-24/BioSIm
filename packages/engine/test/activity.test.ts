import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACTIVITY_KINDS,
  PUBLIC_ACTIVITY_KINDS,
  ACTIVE_SIGNAL_IDS,
  PARAMS,
  PROFILES,
  activityKey,
  buildMeal,
  decodeMeal,
  parseFood,
  type ActivityBout,
  type ActiveSignalId,
  type Params,
  type RunResult,
} from '../src/index.ts'
import { ACTIVITY_CODES, ENERGY_TOTAL, HUMAN_MODEL, HUMAN_MODULES, LEFT_WATER, activityProblems, runModules, simulate } from '../src/run.ts'
import { FULL, firstDiff, lookup as fixtureLookup } from './fixtures.ts'
import { golden, pinned } from './golden.ts'
import { paramsWith } from './modules/ctx.ts'

/**
 * Activity + energy (E-3b-eng, model §2.1, D3, D13 iv). The published figures are in the test
 * titles; the sources were read for this step (core/sources.ts says where and what).
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => fixtureLookup(id) ?? foods.find((f) => f.id === id)
const mealOf = (m: string) => buildMeal(decodeMeal(m), lookup)
const run = (m: string, activity: ActivityBout[] = []) => simulate(mealOf(m), { particles: 0, activity })
const values = (sim: RunResult, id: ActiveSignalId) => sim.signals.get(id)!.values
/** The run's modules again, for the arrays they wrote (Float64, internal ones too). */
const arrays = (m: string, activity: ActivityBout[] = [], params: Params = HUMAN_MODEL.params) =>
  runModules(HUMAN_MODULES, { input: { meal: mealOf(m), activity }, params, profile: PROFILES['adult-ref'], n: 2881, stepMin: 1 }).signals
const kg = PROFILES['adult-ref'].weightKg
const R = PROFILES['adult-ref'].restingKcalPerDay / 1440

/** kcal of the food effect from minute 0 to minute `to` (the rate is per hour, one value per minute). */
function foodEffectKcal(sim: RunResult, to: number): number {
  const r = values(sim, 'energy.foodEffectRate')
  let sum = 0
  for (let i = 1; i <= to; i++) sum += r[i]! / 60
  return sum
}
const peakMin = (r: ArrayLike<number>) => {
  let at = 0
  for (let i = 1; i < r.length; i++) if (r[i]! > r[at]!) at = i
  return at
}

const walk20: ActivityBout = { kind: 'walk', startMin: 30, durMin: 20 }
const run10: ActivityBout = { kind: 'run', startMin: 240, durMin: 10 }

describe('the activity plan (core/activity.ts)', () => {
  it('seven kinds; walk, brisk walk and run are offered, the other four stay hidden (V-0 item 9)', () => {
    expect(ACTIVITY_KINDS).toEqual(['walk', 'walkBrisk', 'run', 'sitClass', 'football', 'cricket', 'badminton'])
    expect(PUBLIC_ACTIVITY_KINDS).toEqual(['walk', 'walkBrisk', 'run'])
  })

  it('≤ 8 bouts, start 0–2880, 5–120 min, whole minutes, no overlap (a bout may start as another ends)', () => {
    const b = (kind: ActivityBout['kind'], startMin: number, durMin: number): ActivityBout => ({ kind, startMin, durMin })
    expect(activityProblems([b('walk', 0, 5), b('run', 5, 120), b('walk', 2880, 5)])).toEqual([])
    expect(activityProblems([b('walk', 0, 4)])).toHaveLength(1)
    expect(activityProblems([b('walk', 0, 121)])).toHaveLength(1)
    expect(activityProblems([b('walk', 2881, 5)])).toHaveLength(1)
    expect(activityProblems([b('walk', -1, 5)])).toHaveLength(1)
    expect(activityProblems([b('walk', 0.5, 5)])).toHaveLength(1)
    expect(activityProblems([b('walk', 0, 20), b('run', 19, 10)])).toEqual(['bouts walk.0.20 and run.19.10 overlap'])
    expect(activityProblems(Array.from({ length: 9 }, (_, i) => b('walk', i * 10, 5)))).toEqual(['more than 8 bouts'])
    expect(activityKey([run10, walk20])).toBe('walk.30.20,run.240.10')
  })

  it('simulate refuses a plan outside the limits (the codec drops bad bouts before a run)', () => {
    expect(() => run('cola:1', [walk20, { kind: 'run', startMin: 40, durMin: 10 }])).toThrow(/overlap/)
    expect(() => run('cola:1', [{ kind: 'jog' as ActivityBout['kind'], startMin: 0, durMin: 10 }])).toThrow(/outside the limits/)
  })

  it('a run carries its plan, in start order', () => {
    expect(run('cola:1', [run10, walk20]).activity).toEqual([walk20, run10])
    expect(run('cola:1').activity).toEqual([])
  })
})

describe('activity: Compendium METs and the cost of moving', () => {
  golden(
    ['energy.activityRate', 'energy.activityTotal'],
    ['herrmann2024'],
    '2024 Compendium rows: walk 17190 = 3.8, brisk 17200 = 4.8, run 12050 = 9.3; hidden 09065 1.8, 15610 7.0, 15150 4.8, 15030 5.5',
    () => {
      expect(PARAMS.activity.met).toEqual({
        walk: 3.8,
        walkBrisk: 4.8,
        run: 9.3,
        sitClass: 1.8,
        football: 7.0,
        cricket: 4.8,
        badminton: 5.5,
      })
      expect(ACTIVITY_CODES).toEqual({
        walk: '17190',
        walkBrisk: '17200',
        run: '12050',
        sitClass: '09065',
        football: '15610',
        cricket: '15150',
        badminton: '15030',
      })
      // "1 MET = 3.5 ml/kg/min"; "METS to Kcal/min = multiply METS x 3.5 x body weight in kg then divide by 200".
      expect((PARAMS.activity.restO2MlPerKgMin * PARAMS.activity.kcalPerLO2) / 1000).toBeCloseTo(3.5 / 200, 12)
    },
  )

  golden(
    ['energy.activityRate', 'energy.activityTotal', 'event.activityStart', 'event.activityEnd'],
    ['herrmann2024'],
    'a 20-min walk at 65 kg adds (3.8 − 1)·3.5·65/200 = 3.185 kcal/min above rest, from its start moment to its end moment: 63.7 kcal',
    () => {
      const sim = run('cola:1', [walk20])
      const rate = values(sim, 'energy.activityRate')
      expect(sim.moments.get('event.activityStart')?.atMin).toBe(30)
      expect(sim.moments.get('event.activityEnd')?.atMin).toBe(50)
      expect(rate[30]).toBe(0)
      for (const i of [31, 40, 50]) expect(rate[i]!).toBeCloseTo(3.185 * 60, 3)
      expect(rate[51]).toBe(0)
      expect(values(sim, 'energy.activityTotal')[2880]!).toBeCloseTo(63.7, 3)
    },
  )

  // Gross O2 use of the model = all energy used ÷ kcal per L O2 (Weir without protein, 3.941 + 1.106·RQ;
  // model D1). RQ is breathing's (S-2), so the check holds for any RQ from 0.80 to 1.0.
  golden(
    ['energy.activityRate'],
    ['herrmann2024'],
    'gross VO2 in a walk and a run is within ±5 % of the Compendium’s MET·3.5·kg (walk 864.5, run 2115.75 mL/min)',
    () => {
      const total = arrays('', [walk20, run10]).get(ENERGY_TOTAL)!.values
      for (const [i, met] of [
        [40, 3.8],
        [245, 9.3],
      ] as const) {
        const compendium = met * 3.5 * kg
        for (const rq of [0.8, 0.85, 0.92, 1.0]) {
          const vo2 = (total[i]! / (3.941 + 1.106 * rq)) * 1000
          expect(Math.abs(vo2 / compendium - 1), `MET ${met}, RQ ${rq}: ${vo2.toFixed(0)} mL/min`).toBeLessThanOrEqual(0.05)
        }
      }
    },
  )

  pinned(['energy.activityRate', 'energy.activityTotal'], 'more MET, more energy used: run > brisk walk > walk > rest', () => {
    const at = (kind: ActivityBout['kind']) => values(run('', [{ kind, startMin: 0, durMin: 30 }]), 'energy.activityRate')[15]!
    expect(at('run')).toBeGreaterThan(at('walkBrisk'))
    expect(at('walkBrisk')).toBeGreaterThan(at('walk'))
    expect(at('walk')).toBeGreaterThan(0)
  })

  pinned(['energy.usedRate', 'energy.usedTotal'], 'energy.usedRate keeps its frozen meaning: resting only, whatever the activity', () => {
    const rest = run('cola:1')
    const moving = run('cola:1', [walk20, run10])
    for (const id of ['energy.usedRate', 'energy.usedTotal'] as const) expect(values(moving, id), id).toEqual(values(rest, id))
  })
})

describe('the food effect (thermic effect of food)', () => {
  golden(
    'energy.foodEffectRate',
    ['westerterp2004'],
    'over 6 h a mixed meal’s food effect is 5–15 % of its energy (Westerterp 2004: mixed diet 5 to 15 %)',
    () => {
      for (const m of ['standard-meal:1', 'white-rice:1,dal:1', 'idli:2,dal:1', 'roti:2,dal:1']) {
        const share = foodEffectKcal(run(m), 360) / mealOf(m).total.energyKcal
        expect(share, m).toBeGreaterThanOrEqual(0.05)
        expect(share, m).toBeLessThanOrEqual(0.15)
      }
    },
  )

  // Hold-out: tau was not fitted to this drink.
  golden(
    'energy.foodEffectRate',
    ['charriere2016'],
    '60 g glucose in 500 mL water: food effect over 150 min 4–10 % of its energy (Charrière 2016: 6.9 %)',
    () => {
      const share = foodEffectKcal(run('glucose-60:1'), 150) / 240
      expect(share).toBeGreaterThanOrEqual(0.04)
      expect(share).toBeLessThanOrEqual(0.1)
    },
  )

  golden.fails(
    'energy.foodEffectRate',
    ['charriere2016'],
    '60 g glucose: the food effect peaks at 30–90 min (Charrière 2016: 50–60 min)',
    'the stomach lets a glucose drink through at a steady 2.13 kcal/min (Brener 1983), so absorption is flat for ~2 h and the food effect peaks when the stomach is empty, at ~115 min',
    () => {
      const at = peakMin(values(run('glucose-60:1'), 'energy.foodEffectRate'))
      expect(at).toBeGreaterThanOrEqual(30)
      expect(at).toBeLessThanOrEqual(90)
    },
  )

  // Calibration target (C) for PARAMS.energy.foodEffect.tauMin on the consensus test meal; the other
  // meals are checks it was not fitted to. Meals only: a sugary drink's effect is nearly all in by
  // 3 h (cola 99 %), as Charrière 2016 found for glucose (> 90 % by 150 min).
  golden(
    'energy.foodEffectRate',
    ['reed1996'],
    '50–75 % of the 6 h food effect comes in the first 3 h (Reed & Hill 1996: 60 % after 3 h, 131 six-hour tests)',
    () => {
      for (const m of ['standard-meal:1', 'white-rice:1,dal:1', 'idli:2', 'cheeseburger:1,fries:1,cola:1']) {
        const sim = run(m)
        const share = foodEffectKcal(sim, 180) / foodEffectKcal(sim, 360)
        expect(share, m).toBeGreaterThanOrEqual(0.5)
        expect(share, m).toBeLessThanOrEqual(0.75)
      }
    },
  )

  golden.fails(
    'energy.foodEffectRate',
    ['reed1996'],
    'roti or idli with dal: 50–75 % of the 6 h food effect in the first 3 h',
    'solids leave the stomach at ~1.4 kcal/min after a lag, so in this model most of a 370 kcal roti-dal (42 %) or idli-dal (47 %) meal is absorbed after 3 h',
    () => {
      for (const m of ['roti:2,dal:1', 'idli:2,dal:1']) {
        const sim = run(m)
        expect(foodEffectKcal(sim, 180) / foodEffectKcal(sim, 360), m).toBeGreaterThanOrEqual(0.5)
      }
    },
  )

  pinned(
    'energy.foodEffectRate',
    'the lag keeps the area: over 48 h the food effect is the Westerterp shares of the absorbed energy',
    () => {
      const sim = run('standard-meal:1')
      const g = (id: ActiveSignalId) => values(sim, id)[2880]!
      const shares = 0.075 * 4 * g('gut.absorbed.carbsG') + 0.25 * 4 * g('gut.absorbed.proteinG') + 0.02 * 9 * g('gut.absorbed.fatG')
      expect(Math.abs(foodEffectKcal(sim, 2880) - shares)).toBeLessThan(0.05)
      expect(values(run(''), 'energy.foodEffectRate').every((v) => v === 0)).toBe(true)
    },
  )

  pinned('energy.foodEffectRate', 'moving never changes the food effect (activity has no arrow into the gut, D6)', () => {
    expect(values(run('standard-meal:1', [walk20, run10]), 'energy.foodEffectRate')).toEqual(
      values(run('standard-meal:1'), 'energy.foodEffectRate'),
    )
  })
})

describe('x.energy.total: the one "energy used" later modules read (model D2)', () => {
  it('= resting + moving + food effect, every minute', () => {
    const m = 'cheeseburger:1,fries:1,cola:1'
    const sim = run(m, [walk20, run10])
    const total = arrays(m, [walk20, run10]).get(ENERGY_TOTAL)!.values
    const moving = values(sim, 'energy.activityRate')
    const effect = values(sim, 'energy.foodEffectRate')
    let worst = 0
    for (let i = 0; i <= 2880; i++) worst = Math.max(worst, Math.abs(total[i]! - (R + moving[i]! / 60 + effect[i]! / 60)))
    expect(worst).toBeLessThan(1e-4) // the table rows are Float32
  })

  it('at rest with nothing eaten it is the resting use, exactly', () => {
    expect(
      arrays('')
        .get(ENERGY_TOTAL)!
        .values.every((v) => v === R),
    ).toBe(true)
  })
})

describe('rest invariance (model D13 iv) and what activity never moves', () => {
  /** Every signal a version-3 run had before E-3b-eng, byte for byte (the new rows are D13 iii additions). */
  const BEFORE = ACTIVE_SIGNAL_IDS.slice(0, ACTIVE_SIGNAL_IDS.indexOf('gut.absorbRate.carbs'))
  // A drink, a mixed meal and nothing; FULL=1 adds the others (R68).
  const meals = FULL
    ? ['cola:1', 'cheeseburger:1,fries:1,cola:1', 'roti:2,dal:1', 'water:1', '']
    : ['cola:1', 'cheeseburger:1,fries:1,cola:1', '']

  it('no plan, an empty plan and bouts at MET 1 give the same run, to the byte', () => {
    const atRest = paramsWith('activity.met.walk', 1)
    for (const m of meals) {
      const base = run(m)
      const none = simulate(buildMeal(decodeMeal(m), lookup), { particles: 0 })
      const restOnly = runModules(HUMAN_MODULES, {
        input: { meal: mealOf(m), activity: [walk20, { kind: 'walk', startMin: 600, durMin: 120 }] },
        params: atRest,
        profile: PROFILES['adult-ref'],
        n: 2881,
        stepMin: 1,
      }).signals
      for (const [id, s] of base.signals) {
        expect(firstDiff(s.values, none.signals.get(id)?.values), `${m} ${id}`).toBe(-1)
        expect(firstDiff(s.values, Float32Array.from(restOnly.get(id)!.values)), `${m} ${id} rest-only`).toBe(-1)
      }
      expect(firstDiff(restOnly.get(ENERGY_TOTAL)!.values, arrays(m).get(ENERGY_TOTAL)!.values)).toBe(-1)
      for (const id of [
        'event.stomachHalfEmpty',
        'event.glucosePeak',
        'event.glucoseBackToBase',
        'event.mostlyAbsorbed',
        'event.firstLeftovers',
      ] as const)
        expect(none.moments.get(id), `${m} ${id}`).toEqual(base.moments.get(id))
    }
  }, 30_000)

  it('a walk and a run move only the activity rows: gut.*, blood glucose and energy in stay to the byte', () => {
    for (const m of meals) {
      const rest = run(m)
      const moving = run(m, [walk20, run10, { kind: 'walkBrisk', startMin: 2000, durMin: 60 }])
      for (const id of [
        ...BEFORE,
        'gut.absorbRate.carbs',
        'gut.absorbRate.protein',
        'gut.absorbRate.fat',
        'gut.absorbRate.water',
        'energy.foodEffectRate',
      ] as const)
        expect(firstDiff(values(moving, id), values(rest, id)), `${m} ${id}`).toBe(-1)
      expect([...rest.moments].filter(([id]) => !id.startsWith('event.activity'))).toEqual(
        [...moving.moments].filter(([id]) => !id.startsWith('event.activity')),
      )
      expect(moving.particles).toEqual(rest.particles)
    }
  }, 30_000)

  it('the rows that existed before E-3b-eng keep their order in the signal table', () => {
    expect([...run('cola:1').signals.keys()].slice(0, BEFORE.length)).toEqual(BEFORE)
  })
})

describe('the gut: absorbed per minute and the water balance', () => {
  golden(
    ['gut.absorbRate.carbs', 'gut.absorbRate.protein', 'gut.absorbRate.fat', 'gut.absorbRate.water'],
    ['openstax-ap2e-23'],
    'the absorbed-per-minute rates add up to the absorbed totals; about 90 % of a drink’s water is absorbed in the small intestine (OpenStax §23.7)',
    () => {
      const sim = run('cheeseburger:1,fries:1,cola:1')
      for (const k of ['carbs', 'protein', 'fat', 'water'] as const) {
        const rate = values(sim, `gut.absorbRate.${k}`)
        const total = values(
          sim,
          `gut.absorbed.${k === 'carbs' ? 'carbsG' : k === 'protein' ? 'proteinG' : k === 'fat' ? 'fatG' : 'waterG'}`,
        )
        expect(
          rate.every((v) => v >= 0),
          k,
        ).toBe(true)
        const sum = rate.reduce((a, v) => a + v, 0)
        expect(Math.abs(sum - total[2880]!), k).toBeLessThan(0.01)
      }
      // A water drink: by the end of the small intestine (≈ 4 h after it leaves the stomach) ≈ 90 % is in.
      const water = run('water-test:1')
      expect(values(water, 'gut.absorbed.waterG')[300]! / 250).toBeCloseTo(0.9, 1)
    },
  )

  pinned(
    'gut.leftBodyG',
    'water balance: a drink’s water is in the stomach, the intestines, the body or has left it, ±0.5 g every minute',
    () => {
      for (const m of ['water-test:1', 'water:2']) {
        const sim = run(m)
        const left = arrays(m).get(LEFT_WATER)!.values
        const water = mealOf(m).total.waterG
        const where = ['gut.stomach.contentG', 'gut.small.contentG', 'gut.colon.contentG', 'gut.absorbed.waterG'] as const
        const arrived = Math.ceil(mealOf(m).eatingMin + PARAMS.esophagus.transitMin)
        let worst = 0
        for (let i = arrived; i <= 2880; i++) {
          const sum = where.reduce((a, id) => a + values(sim, id)[i]!, 0) + left[i]!
          worst = Math.max(worst, Math.abs(sum - water))
        }
        expect(worst, m).toBeLessThanOrEqual(0.5)
        // All of a water drink that leaves the body is water.
        expect(left[2880]!).toBeCloseTo(values(sim, 'gut.leftBodyG')[2880]!, 3)
      }
    },
  )

  pinned('gut.leftBodyG', 'the water that leaves the body is part of what leaves, and never goes down', () => {
    const m = 'cheeseburger:1,fries:1,cola:1'
    const left = arrays(m).get(LEFT_WATER)!.values
    const leftBody = values(run(m), 'gut.leftBodyG')
    let bad = -1
    for (let i = 1; i <= 2880 && bad < 0; i++) if (left[i]! < left[i - 1]! || left[i]! > leftBody[i]! + 1e-3) bad = i
    expect(bad).toBe(-1)
    expect(left[2880]!).toBeGreaterThan(0)
  })
})

describe('fuzz: meals × activity plans', () => {
  // 20 plans in a normal run, 300 with FULL=1 (model §5 fuzz; R68). Same seed, so the first 20 are the same.
  const PLANS = FULL ? 300 : 20
  it(`every signal stays finite and not below 0 for ${PLANS} random plans (fixed seed)`, () => {
    let seed = 7
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
    const menu = ['cola:1', 'cheeseburger:1,fries:1', 'roti:2,dal:1', 'water:1', 'standard-meal:1', '']
    for (let k = 0; k < PLANS; k++) {
      const plan: ActivityBout[] = []
      let t = Math.floor(rnd() * 600)
      for (let b = 0, count = 1 + Math.floor(rnd() * 8); b < count && t <= 2880; b++) {
        const durMin = 5 + Math.floor(rnd() * 116)
        plan.push({ kind: pick(ACTIVITY_KINDS), startMin: t, durMin })
        t += durMin + Math.floor(rnd() * 300)
      }
      const sim = run(pick(menu), plan)
      for (const [id, s] of sim.signals) {
        // Not below 0 beyond rounding: energy.inRate dips by 1e-12 where nothing is absorbed.
        const bad = s.values.findIndex((v) => !Number.isFinite(v) || v < -1e-6)
        expect(bad, `${id} with ${activityKey(plan)}`).toBe(-1)
      }
    }
  }, 30_000)
})
