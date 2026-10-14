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
  type RunResult,
  type RunSignalId,
  type SignalStatus,
} from '../src/index.ts'
import {
  ENERGY_TOTAL,
  HUMAN_MODEL,
  HUMAN_MODULES,
  KIDNEY_EVENT_IDS,
  KIDNEY_SIGNAL_IDS,
  RUN_SIGNALS,
  buildSignalTable,
  filtrateTakenBack,
  glucoseSpilled,
  runModules,
  simulate,
  waterModule,
} from '../src/run.ts'
import { PARAM_SOURCES } from '../src/core/sources.ts'
import { FULL, firstDiff, lookup as fixtureLookup } from './fixtures.ts'
import { golden, pinned } from './golden.ts'
import { paramsWith } from './modules/ctx.ts'

/**
 * Water and kidneys (S-4, model §2.4, D17, §5 water tests, D13 iii/iv). The published figures are
 * in the test titles; the sources were read for V-4 (core/sources.ts says where and what). The
 * calibration (Maughan) sets kx and the ADH lag; Crowe 1987 and the 1.25 L drink are hold-outs.
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
/** Resting use, kcal/min. */
const R = PROFILES['adult-ref'].restingKcalPerDay / 1440
/** Background urine, mL/h and mL/min (1.5 L a day). */
const U0h = 1500 / 24
const U0 = 1500 / 1440
/** Least urine, mL/h (about 500 mL a day). */
const UMIN_H = 21

const walk60: ActivityBout = { kind: 'walk', startMin: 60, durMin: 60 }
const run60: ActivityBout = { kind: 'run', startMin: 300, durMin: 60 }
/** 1 L of water: four 250 mL glasses (Maughan's drink); 1.25 L: five (the app's most). */
const LITRE = 'water:4'
const LITRE_AND_A_QUARTER = 'water:5'
// A drink, a mixed meal, water and nothing; FULL=1 adds the others (R68).
const meals = FULL
  ? ['cola:1', 'cheeseburger:1,fries:1,cola:1', 'roti:2,dal:1', 'water:1', LITRE, 'milk:1', '']
  : ['cola:1', 'cheeseburger:1,fries:1,cola:1', 'water:1', '']
/** The ready-made meals of the app's presets (apps/web lib/presets.ts), without "four colas" (a water load). */
const PRESET_MEALS = ['cola:1', 'cheeseburger:1,fries:1', 'roti:1,dal:1', 'white-rice:1', 'apple:1', 'orange-juice:1', 'water:1', 'milk:1']

/** The first minute of the highest urine rate, and that rate. */
function peakOf(rate: ArrayLike<number>): { atMin: number; mlPerH: number } {
  let atMin = 0
  for (let i = 1; i < rate.length; i++) if (rate[i]! > rate[atMin]! + 1e-9) atMin = i
  return { atMin, mlPerH: rate[atMin]! }
}
/** Urine above the background by minute i (mL): the meal's extra urine. */
const extraUrine = (sim: RunResult, i: number) => values(sim, 'kidney.urineTotal')[i]! - U0 * i

describe('calibration and hold-outs: a drink of water (model §2.4)', () => {
  golden(
    ['kidney.urineRate', 'kidney.urineTotal'],
    ['maughan2016'],
    'calibration (kx, τADH): 1 L of water → 1007–1667 mL of urine over 0–4 h, background included (Maughan 2016: 1337 ± 330 g)',
    () => {
      const total = values(run(LITRE), 'kidney.urineTotal')[240]!
      expect(total).toBeGreaterThanOrEqual(1007)
      expect(total).toBeLessThanOrEqual(1667)
      // The background's share is 250 mL; the rest is the drink, capped by the ~0.9 L the gut has absorbed by 4 h.
      expect(total - U0 * 240).toBeLessThanOrEqual(values(run(LITRE), 'gut.absorbed.waterG')[240]!)
    },
  )

  golden(
    'kidney.urineRate',
    ['crowe1987'],
    'hold-out: 1 L of water → urine peaks at 450–900 mL/h, 45–120 min after drinking (Crowe 1987: 10.86 mL/kg per hour after 20 mL/kg, 706 mL/h at 65 kg, 543 mL/h scaled to 1 L; the time window is a labelled model guard, the abstract gives none)',
    () => {
      const peak = peakOf(values(run(LITRE), 'kidney.urineRate'))
      expect(peak.mlPerH).toBeGreaterThanOrEqual(450)
      expect(peak.mlPerH).toBeLessThanOrEqual(900)
      expect(peak.atMin).toBeGreaterThanOrEqual(45)
      expect(peak.atMin).toBeLessThanOrEqual(120)
    },
  )

  golden(
    ['kidney.urineTotal', 'event.mostMealWaterPassed'],
    ['crowe1987'],
    'hold-out: 1.25 L of water (≈ 19 mL/kg) → at least 70 % of it passed as extra urine within 2 h (Crowe 1987: 100.7 % in well-watered young men, 70 % when short of water)',
    () => {
      const sim = run(LITRE_AND_A_QUARTER)
      expect(extraUrine(sim, 120) / 1250).toBeGreaterThanOrEqual(0.7)
      expect(sim.moments.get('event.mostMealWaterPassed')!.atMin!).toBeLessThanOrEqual(120)
    },
  )

  golden(
    'kidney.urineRate',
    ['calvi2024'],
    'the ADH lag τ = 10 min is a vasopressin half-life of 6.9 min, inside the measured 5–20 min (Calvi 2024)',
    () => {
      const halfLife = Math.LN2 * HUMAN_MODEL.params.water.adhTauMin
      expect(halfLife).toBeGreaterThanOrEqual(5)
      expect(halfLife).toBeLessThanOrEqual(20)
    },
  )

  pinned('kidney.urineRate', 'about critically damped (kx·τ = 0.3): after a drink, urine never dips below the background', () => {
    expect(HUMAN_MODEL.params.water.urinePerExtraMlPerMin * HUMAN_MODEL.params.water.adhTauMin).toBeLessThanOrEqual(0.3)
    for (const m of ['water:1', LITRE, LITRE_AND_A_QUARTER, 'cola:1']) {
      const rate = values(run(m), 'kidney.urineRate')
      expect(Math.min(...rate), m).toBeGreaterThanOrEqual(U0h - 0.5)
    }
  })

  golden(
    'kidney.urineRate',
    ['iom2005'],
    'urine never above 1000 mL/h, the top of “600 to 1,000 mL/hour with water loading” (IOM 2005 p83); the model’s ceiling is 750 mL/h (“0.7 to 1.0 L/hour”, p74)',
    () => {
      expect(HUMAN_MODEL.params.water.maxUrineMlPerH).toBe(750)
      for (const m of [LITRE_AND_A_QUARTER, 'water:5,cola:5', ...meals]) {
        const rate = values(run(m, [walk60]), 'kidney.urineRate')
        expect(Math.max(...rate), m).toBeLessThanOrEqual(1000)
      }
      expect(Math.max(...values(run(LITRE_AND_A_QUARTER), 'kidney.urineRate'))).toBeCloseTo(750, 3)
    },
  )
})

describe('a whole day: background, metabolic water, other meals', () => {
  golden(
    'kidney.urineTotal',
    ['openstax-ap2e-25', 'openstax-ap2e-26'],
    'every preset meal at rest: 1.0–2.5 L of urine in 24 h (OpenStax: normal 1–2 L/day, Table 25.2; an average of 1.5 L, §26.2; polyuria above 2.5 L)',
    () => {
      for (const m of [...PRESET_MEALS, '']) {
        const day = values(run(m), 'kidney.urineTotal')[1440]!
        expect(day, m).toBeGreaterThanOrEqual(1000)
        expect(day, m).toBeLessThanOrEqual(2500)
      }
      expect(values(run(''), 'kidney.urineTotal')[1440]!).toBeCloseTo(1500, 6)
    },
  )

  golden(
    'water.mealExtraMl',
    ['iom2005', 'openstax-ap2e-26'],
    'resting metabolic water 0.12 mL/kcal × 1504 kcal = 180 mL a day, inside 140–350 (IOM 2005 p80 “+250 to +350 mL/d”, p85 15/10.5/11.1 g per 100 kcal; OpenStax §26.2 “about 230 mL”); part of the steady background',
    () => {
      expect(HUMAN_MODEL.params.water.metabolicMlPerKcal).toBeGreaterThanOrEqual(0.105)
      expect(HUMAN_MODEL.params.water.metabolicMlPerKcal).toBeLessThanOrEqual(0.15)
      const perDay = HUMAN_MODEL.params.water.metabolicMlPerKcal * R * 1440
      expect(perDay).toBeCloseTo(180.5, 0)
      expect(perDay).toBeGreaterThanOrEqual(140)
      expect(perDay).toBeLessThanOrEqual(350)
    },
  )

  pinned(
    'water.mealExtraMl',
    'a meal adds a little metabolic water through its food effect (0.12 mL per kcal above rest), and all of it is accounted for at 48 h',
    () => {
      const sim = run('cheeseburger:1')
      const total = runModules(HUMAN_MODULES, setupOf('cheeseburger:1')).signals.get(ENERGY_TOTAL)!.values
      let made = 0
      for (let i = 0; i < N; i++) made += 0.12 * (total[i]! - R)
      expect(made).toBeGreaterThan(1)
      expect(made).toBeLessThan(20)
      expect(extraUrine(sim, N - 1) + values(sim, 'water.mealExtraMl')[N - 1]!).toBeCloseTo(
        values(sim, 'gut.absorbed.waterG')[N - 1]! + made,
        2, // the table's Float32 rows
      )
    },
  )

  golden(
    ['kidney.urineTotal', 'kidney.urineRate'],
    ['maughan2016'],
    'equal water in → equal urine: 250 mL of water and the same water with 50 g of glucose pass the same within 1 % by 24 h, and within ±15 % by 4 h (Maughan 2016: cola, juice, tea not different from water)',
    () => {
      const plain = run('water-test:1')
      const sweet = run('glucose-50:1')
      expect(mealOf('water-test:1').liquid.waterG).toBe(mealOf('glucose-50:1').liquid.waterG)
      expect(extraUrine(sweet, 1440) / extraUrine(plain, 1440)).toBeCloseTo(1, 1)
      expect(Math.abs(extraUrine(sweet, 1440) - extraUrine(plain, 1440)) / extraUrine(plain, 1440)).toBeLessThanOrEqual(0.01)
      const at4h = values(sweet, 'kidney.urineTotal')[240]! / values(plain, 'kidney.urineTotal')[240]!
      expect(at4h).toBeGreaterThanOrEqual(0.85)
      expect(at4h).toBeLessThanOrEqual(1.15)
    },
  )
})

describe('sweat and moving', () => {
  pinned(['kidney.urineRate', 'kidney.urineTotal'], 'a walk with sweating → less urine than resting, for the same meal', () => {
    for (const m of ['water:1', 'cola:1', '']) {
      const rest = run(m)
      const walk = run(m, [walk60])
      expect(values(walk, 'kidney.urineTotal')[720]!, m).toBeLessThan(values(rest, 'kidney.urineTotal')[720]!)
      // Before the walk nothing differs.
      expect(values(walk, 'kidney.urineRate')[60]).toBe(values(rest, 'kidney.urineRate')[60])
    }
  })

  golden(
    'kidney.urineRate',
    ['openstax-ap2e-25'],
    'never below the least urine, 21 mL/h (“about 500 mL/day”, OpenStax §25.1), however much is sweated',
    () => {
      for (const plan of [[walk60], [run60], [run60, { kind: 'run', startMin: 400, durMin: 120 }]] as ActivityBout[][]) {
        const rate = values(run('', plan), 'kidney.urineRate')
        expect(Math.min(...rate)).toBeGreaterThanOrEqual(Math.fround(UMIN_H) - 1e-4)
      }
      // A run sweats about 1 L: urine sits at the least for a while.
      expect(Math.min(...values(run('', [run60]), 'kidney.urineRate'))).toBeCloseTo(UMIN_H, 3)
    },
  )

  pinned(
    'water.mealExtraMl',
    'sweat that the meal did not cover leaves the body short (no thirst, D5 C8), and the steady day makes it up within 48 h',
    () => {
      const sim = run('', [walk60])
      const extra = values(sim, 'water.mealExtraMl')
      expect(extra[121]!).toBeLessThan(-250)
      expect(Math.abs(extra[N - 1]!)).toBeLessThan(1)
    },
  )
})

describe('bladder and moments', () => {
  golden(
    ['kidney.bladderMl', 'event.bladderFirstUrge'],
    ['openstax-ap2e-25'],
    'the bladder starts empty, the first urge comes at 150 mL (“about 150 mL, an urge to void is sensed”, OpenStax §25.2): at the background rate after 144 min; it empties at 300 mL',
    () => {
      const sim = run('')
      const b = values(sim, 'kidney.bladderMl')
      expect(b[0]).toBe(0)
      expect(sim.moments.get('event.bladderFirstUrge')!.atMin).toBe(144)
      expect(b[143]!).toBeLessThan(150)
      expect(b[144]!).toBeCloseTo(150, 3)
      expect(b[287]!).toBeCloseTo(300 - U0, 3)
      expect(b[288]).toBe(0)
      // A litre of water brings the urge forward.
      expect(run(LITRE).moments.get('event.bladderFirstUrge')!.atMin!).toBeLessThan(144)
    },
  )

  golden(
    'kidney.bladderMl',
    ['openstax-ap2e-25'],
    'guard: the bladder never holds more than 600 mL (“nearly zero to 500–600 mL”, OpenStax §25.2); it never holds 300',
    () => {
      for (const m of [LITRE_AND_A_QUARTER, 'water:5,cola:5', ...meals]) {
        const b = values(run(m, [walk60]), 'kidney.bladderMl')
        expect(Math.max(...b), m).toBeLessThan(300)
        expect(Math.min(...b), m).toBeGreaterThanOrEqual(0)
      }
    },
  )

  golden(
    'event.mostMealWaterPassed',
    ['maughan2016', 'crowe1987'],
    'half of a drink’s absorbed water has left as extra urine within 2 h (Crowe 1987: all of 20 mL/kg out in 2 h; Maughan 2016: most of 1 L in 4 h); none without water',
    () => {
      for (const m of ['water:1', LITRE, 'cola:1']) {
        const at = run(m).moments.get('event.mostMealWaterPassed')!.atMin!
        expect(at, m).toBeGreaterThan(20)
        expect(at, m).toBeLessThanOrEqual(120)
      }
      expect(run('').moments.get('event.mostMealWaterPassed')!.atMin).toBeNull()
    },
  )

  pinned('event.mostMealWaterPassed', 'equal drinks pass at the same minute; sweat can keep it from happening', () => {
    expect(run('water:1').moments.get('event.mostMealWaterPassed')!.atMin).toBe(
      run('water-test:1').moments.get('event.mostMealWaterPassed')!.atMin,
    )
    expect(run('water:1', [{ kind: 'run', startMin: 5, durMin: 60 }]).moments.get('event.mostMealWaterPassed')!.atMin).toBeNull()
  })
})

describe('filtration (model D15) and the helpers (D10)', () => {
  golden(
    'kidney.filtrationRate',
    ['openstax-ap2e-25'],
    'filtration is a constant 125 mL/min (“about 125 mL/min filtrate produced in males”, OpenStax §25.5); 99 % of it is taken back at rest (“Ninety-nine percent”), at least 90 % at the ceiling',
    () => {
      const sim = run(LITRE, [walk60])
      expect(values(sim, 'kidney.filtrationRate').every((v) => v === 125)).toBe(true)
      expect(filtrateTakenBack(U0h, 125)).toBeGreaterThanOrEqual(0.99)
      expect(filtrateTakenBack(Math.max(...values(sim, 'kidney.urineRate')), 125)).toBeGreaterThanOrEqual(0.9)
    },
  )

  golden(
    'kidney.filtrationRate',
    ['openstax-ap2e-25'],
    'no glucose in urine for any meal: the kidney takes back up to about 375 mg/min (OpenStax §25.6)',
    () => {
      for (const m of [...meals, 'cola:4', 'glucose-50:1']) {
        const g = values(run(m), 'blood.glucose')
        expect(glucoseSpilled(Math.max(...g), 125), m).toBe(0)
      }
      expect(glucoseSpilled(320, 125)).toBeGreaterThan(0)
    },
  )
})

describe('the water balance and drift (model §5)', () => {
  /** Extra metabolic water by minute i (mL), from x.energy.total. */
  function madeBy(m: string, plan: ActivityBout[]): Float64Array {
    const total = runModules(HUMAN_MODULES, setupOf(m, plan)).signals.get(ENERGY_TOTAL)!.values
    const out = new Float64Array(N)
    let sum = 0
    for (let i = 0; i < N; i++) out[i] = sum += HUMAN_MODEL.params.water.metabolicMlPerKcal * (total[i]! - R)
    return out
  }

  pinned(
    ['water.mealExtraMl', 'kidney.urineTotal'],
    'body balance every minute: absorbed + extra metabolic water = (urine − background) + sweat + water still in the body (±0.5 mL)',
    () => {
      for (const m of meals) {
        for (const plan of [[], [walk60, run60]] as ActivityBout[][]) {
          const out = runModules(HUMAN_MODULES, setupOf(m, plan)).signals
          const get = (id: RunSignalId) => out.get(id)!.values
          const made = madeBy(m, plan)
          let worst = 0
          for (let i = 0; i < N; i++) {
            const inn = get('gut.absorbed.waterG')[i]! + made[i]!
            const outs = get('kidney.urineTotal')[i]! - U0 * i + get('skin.sweatTotal')[i]! + get('water.mealExtraMl')[i]!
            worst = Math.max(worst, Math.abs(inn - outs))
          }
          expect(worst, `${m} ${activityKey(plan)}`).toBeLessThanOrEqual(0.5)
        }
      }
    },
  )

  pinned(
    ['kidney.urineRate', 'kidney.urineTotal', 'kidney.bladderMl', 'water.mealExtraMl', 'kidney.filtrationRate'],
    '48 h drift test (empty plan, rest): urine stays U0, nothing is extra, the bladder saw-tooth repeats every 288 min, totals are linear, only bladder moments',
    () => {
      const out = runModules(HUMAN_MODULES, setupOf('')).signals
      const get = (id: RunSignalId) => out.get(id)!.values
      for (const id of ['kidney.urineRate', 'kidney.filtrationRate'] as const) {
        const v = get(id)
        for (let i = 1; i < N; i++) expect(Math.abs(v[i]! - v[0]!) / v[0]!, `${id} @${i}`).toBeLessThanOrEqual(1e-9)
      }
      expect(get('kidney.urineRate')[0]).toBeCloseTo(U0h, 12)
      expect(get('water.mealExtraMl').every((v) => v === 0)).toBe(true)
      const total = get('kidney.urineTotal')
      for (const i of [0, 1, 600, 1440, N - 1]) expect(total[i]!).toBeCloseTo(U0 * i, 6)
      const b = get('kidney.bladderMl')
      for (let i = 288; i < N; i++) expect(Math.abs(b[i]! - b[i - 288]!), `bladder @${i}`).toBeLessThanOrEqual(1e-6)
      const sim = run('')
      expect(sim.moments.get('event.bladderFirstUrge')!.atMin).toBe(144)
      expect(sim.moments.get('event.mostMealWaterPassed')!.atMin).toBeNull()
    },
  )

  pinned(
    ['water.mealExtraMl', 'kidney.urineRate'],
    'after a meal (no activity) the extra water at 48 h is within 2 % of what was absorbed, and urine within 1 % of resting',
    () => {
      for (const m of meals.filter((x) => x !== '')) {
        const sim = run(m)
        const absorbed = values(sim, 'gut.absorbed.waterG')[N - 1]!
        expect(Math.abs(values(sim, 'water.mealExtraMl')[N - 1]!), m).toBeLessThanOrEqual(0.02 * absorbed)
        expect(Math.abs(values(sim, 'kidney.urineRate')[N - 1]! - U0h) / U0h, m).toBeLessThanOrEqual(0.01)
      }
    },
  )
})

describe('insertion invariance (model D13 iii) and rest invariance (D13 iv)', () => {
  const without = HUMAN_MODULES.filter((m) => m.id !== 'water')

  it('adding water leaves every existing signal, internal array, row order and moment byte-identical', () => {
    for (const m of meals) {
      for (const plan of [[], [walk60, run60]] as ActivityBout[][]) {
        const before = runModules(without, setupOf(m, plan))
        const after = runModules(HUMAN_MODULES, setupOf(m, plan))
        const changed = [...before.signals].filter(([id, w]) => firstDiff(w.values, after.signals.get(id)!.values) !== -1).map(([id]) => id)
        expect(changed, m).toEqual([])
        const tableBefore = buildSignalTable(mealOf(m), before.signals)
        const tableAfter = buildSignalTable(mealOf(m), after.signals)
        expect([...tableAfter.keys()].filter((id) => tableBefore.has(id))).toEqual([...tableBefore.keys()])
        for (const [id, s] of tableBefore) expect(firstDiff(s.values, tableAfter.get(id)!.values), `${m} ${id}`).toBe(-1)
        expect([...after.signals.keys()].filter((id) => !before.signals.has(id))).toEqual([...KIDNEY_SIGNAL_IDS])
        expect([...after.moments].slice(0, before.moments.size)).toEqual([...before.moments])
        expect([...after.moments.keys()].slice(before.moments.size)).toEqual([...KIDNEY_EVENT_IDS])
      }
    }
  }, 30_000)

  it('rest: no plan, an empty plan and bouts at MET 1 give the same kidney rows and moments, to the byte', () => {
    const atRest = paramsWith('activity.met.walk', 1)
    for (const m of meals) {
      const none = runModules(HUMAN_MODULES, setupOf(m)).signals
      const empty = simulate(mealOf(m), { particles: 0, activity: [] })
      const restOnly = runModules(HUMAN_MODULES, setupOf(m, [walk60, { kind: 'walk', startMin: 600, durMin: 120 }], atRest))
      for (const id of KIDNEY_SIGNAL_IDS) {
        expect(firstDiff(restOnly.signals.get(id)!.values, none.get(id)!.values), `${m} ${id}`).toBe(-1)
        expect(firstDiff(values(empty, id), Float32Array.from(none.get(id)!.values)), `${m} ${id}`).toBe(-1)
      }
      for (const id of KIDNEY_EVENT_IDS) expect(restOnly.moments.get(id), `${m} ${id}`).toEqual(empty.moments.get(id))
    }
  }, 30_000)
})

describe('contract: status, params, ranges, speed', () => {
  const RANK: { readonly [S in SignalStatus]: number } = { illustration: 0, assumption: 1, simulated: 2 }

  it('status ≤ the weakest of its needs (model D9): every kidney row is a Model estimate', () => {
    const needs = waterModule.needs.filter((id): id is RunSignalId => !id.startsWith('x.'))
    const weakest = Math.min(...needs.map((id) => RANK[RUN_SIGNALS[id].status]), RANK.assumption) // x.energy.total is one
    for (const id of waterModule.provides) {
      expect(RUN_SIGNALS[id].status, id).toBe('assumption')
      expect(RANK[RUN_SIGNALS[id].status], id).toBeLessThanOrEqual(weakest)
    }
    // Every water parameter says what it rests on; kx and τ are the only calibrated ones.
    const own = Object.entries(PARAM_SOURCES).filter(([path]) => path.startsWith('water.'))
    expect(own.map(([path]) => path).sort()).toEqual(
      Object.keys(HUMAN_MODEL.params.water)
        .map((k) => `water.${k}`)
        .sort(),
    )
    expect(
      own
        .filter(([, e]) => e!.basis === 'calibrated')
        .map(([path]) => path)
        .sort(),
    ).toEqual(['water.adhTauMin', 'water.urinePerExtraMlPerMin'])
  })

  it('reads ctx.params: a 2 L background day doubles the resting urine; a slower ADH lag delays the peak', () => {
    const base = runModules(HUMAN_MODULES, setupOf(LITRE)).signals.get('kidney.urineRate')!.values
    const twoLitres = runModules(HUMAN_MODULES, setupOf('', [], paramsWith('water.backgroundUrineMlPerDay', 3000))).signals
    expect(twoLitres.get('kidney.urineRate')!.values[100]!).toBeCloseTo(125, 9)
    const slow = runModules(HUMAN_MODULES, setupOf(LITRE, [], paramsWith('water.adhTauMin', 20))).signals.get('kidney.urineRate')!.values
    expect(peakOf(slow).atMin).toBeGreaterThan(peakOf(base).atMin)
  })

  it(`every kidney row stays finite and inside its validRange (never clamped to pass) for ${FULL ? 300 : 40} meal × activity plans (fixed seed)`, () => {
    let seed = 23
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
    const menu = [...meals, LITRE_AND_A_QUARTER, 'water:5,cola:5', 'glucose-50:1', 'fatty-meal:1']
    for (let k = 0; k < (FULL ? 300 : 40); k++) {
      const plan: ActivityBout[] = []
      let t = Math.floor(rnd() * 600)
      for (let b = 0, count = Math.floor(rnd() * 9); b < count && t <= 2880; b++) {
        const durMin = 5 + Math.floor(rnd() * 116)
        plan.push({ kind: pick(ACTIVITY_KINDS), startMin: t, durMin })
        t += durMin + Math.floor(rnd() * 300)
      }
      const out = runModules(HUMAN_MODULES, setupOf(pick(menu), plan)).signals
      for (const id of KIDNEY_SIGNAL_IDS) {
        const { low, high } = RUN_SIGNALS[id].validRange!
        const v = out.get(id)!.values
        const bad = v.findIndex((x) => !Number.isFinite(x) || x < low || x > high)
        expect(bad, `${id} with ${activityKey(plan)}: ${v[bad]}`).toBe(-1)
      }
    }
  }, 30_000)

  it('the water module runs in ≤ 2 ms (48 h at 1 min, warm, median of 21)', () => {
    const out = runModules(HUMAN_MODULES, setupOf(LITRE, [walk60, run60])).signals
    const upstream: ModelModule = {
      id: 'effort',
      system: 'muscles',
      needs: [],
      provides: ['gut.absorbed.waterG', 'skin.sweatRate'],
      internal: [ENERGY_TOTAL],
      run(ctx) {
        ctx.put('gut.absorbed.waterG', out.get('gut.absorbed.waterG')!.values)
        ctx.put('skin.sweatRate', out.get('skin.sweatRate')!.values)
        ctx.put(ENERGY_TOTAL, out.get(ENERGY_TOTAL)!.values)
      },
    }
    const s = setupOf(LITRE, [walk60, run60])
    const times: number[] = []
    for (let k = 0; k < 21; k++) {
      let ms = 0
      runModules(
        [upstream, { ...waterModule, run: (ctx) => ((ms = -performance.now()), waterModule.run(ctx), (ms += performance.now())) }],
        s,
      )
      times.push(ms)
    }
    times.sort((a, b) => a - b)
    expect(times[10]!).toBeLessThanOrEqual(2)
  })
})
