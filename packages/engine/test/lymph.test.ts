import { createHash } from 'node:crypto'
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
} from '../src/index.ts'
import type { ModuleOutput } from '../src/core/module.ts'
import { HUMAN_MODEL, HUMAN_MODULES, LYMPH_EVENTS, LYMPH_SIGNAL_IDS, RUN_SIGNALS, lymphModule, runModules, simulate } from '../src/run.ts'
import { FULL, firstDiff, lookup as fixtureLookup } from './fixtures.ts'
import { golden, pinned } from './golden.ts'

/**
 * Lymph fat and blood fat, the lymph module (S-5, model §2.10, D13 iii/iv). The sources were read in
 * V-5 (core/sources.ts says where and what); the published figures are in the test titles. Kinds
 * (model §2): I identity · S sourced hold-out · C calibration · P property · G guard.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => fixtureLookup(id) ?? foods.find((f) => f.id === id)
const mealOf = (m: string) => buildMeal(decodeMeal(m), lookup)
const N = 2881
const setup = (m: string, activity: readonly ActivityBout[] = []) => ({
  input: { meal: mealOf(m), activity },
  params: HUMAN_MODEL.params,
  profile: PROFILES['adult-ref'],
  n: N,
  stepMin: 1,
})
const run = (m: string, activity: readonly ActivityBout[] = []) => runModules(HUMAN_MODULES, setup(m, activity))
const values = (out: ModuleOutput, id: Parameters<ModuleOutput['signals']['get']>[0]) => out.signals.get(id)!.values
/** The blood-fat curve's top: rise above fasting (mg/dL) and its minute. */
function peakOf(out: ModuleOutput) {
  const tg = values(out, 'blood.triglyceride')
  let at = 0
  for (let i = 1; i < tg.length; i++) if (tg[i]! > tg[at]!) at = i
  return { rise: tg[at]! - 80, atMin: at }
}

/** Everyday meals with 15–30 g fat and at most 500 kcal: the stomach empties them within about 6 h. */
const EVERYDAY = ['fries:1', 'milk:2', 'boiled-egg:3', 'cheeseburger:1,milk:1', 'milk:1,banana:1,boiled-egg:2']
/** Everyday meals with 15–30 g fat but over 500 kcal of solid food: emptying at 1.4 kcal/min takes 7 h or more. */
const BIG_EVERYDAY = ['cheeseburger:2', 'roti:4,dal:2']
/** Meals without any fat. */
const NO_FAT = ['', 'water:1', 'cola:1', 'cola:4', 'glucose-50:1', 'glucose-60:1']

/** The insertion-invariance grid: 34 meals (every food alone, the test meals, everyday mixes) × 9 activity plans. */
const MEALS_34 = [
  ...foods.map((f) => `${f.id}:1`),
  'glucose-50:1',
  'water-test:1',
  'standard-meal:1',
  'bread-50:1',
  'fatty-meal:1',
  'glucose-60:1',
  'gribok-carb-70:1',
  'gribok-fat-70:1',
  '',
  'cheeseburger:1,fries:1',
  'cheeseburger:1,fries:1,cola:1',
  'cheeseburger:2,fries:2,cola:1',
  'roti:2,dal:1',
  'white-rice:2,dal:1',
  'idli:3,dal:1',
  'milk:2,banana:1',
  'boiled-egg:2,white-bread:2',
  'cola:4',
  'fatty-meal:2',
]
const PLANS_9: ActivityBout[][] = [
  [],
  [{ kind: 'walk', startMin: 30, durMin: 20 }],
  [{ kind: 'walkBrisk', startMin: 0, durMin: 60 }],
  [{ kind: 'run', startMin: 30, durMin: 20 }],
  [{ kind: 'run', startMin: 600, durMin: 30 }],
  [
    { kind: 'walk', startMin: 0, durMin: 60 },
    { kind: 'run', startMin: 120, durMin: 60 },
    { kind: 'walkBrisk', startMin: 300, durMin: 60 },
  ],
  [{ kind: 'run', startMin: 2760, durMin: 120 }],
  [
    { kind: 'football', startMin: 90, durMin: 90 },
    { kind: 'cricket', startMin: 400, durMin: 120 },
  ],
  Array.from({ length: 8 }, (_, k) => ({ kind: 'badminton' as const, startMin: 10 + k * 200, durMin: 120 })),
]

describe('fat on its way to the blood', () => {
  pinned(
    'lymph.fatFlowRate',
    'I: the fat delivered by the lymph never passes the fat absorbed, and at least 99 % of it is delivered by 48 h',
    () => {
      for (const m of [
        ...EVERYDAY,
        ...BIG_EVERYDAY,
        'gribok-fat-70:1',
        'oftt-75:1',
        'cheeseburger:2,fries:2,cola:1',
        'fatty-meal:2',
        'apple:1',
      ]) {
        const out = run(m)
        const absorbed = values(out, 'gut.absorbed.fatG')
        const flow = values(out, 'lymph.fatFlowRate')
        let delivered = 0
        for (let i = 0; i < N; i++) {
          delivered += flow[i]!
          expect(delivered, `${m} @${i}`).toBeLessThanOrEqual(absorbed[i]! + 1e-9)
        }
        expect(delivered / absorbed[N - 1]!, m).toBeGreaterThanOrEqual(0.99)
        expect(absorbed[N - 1]!, m).toBeGreaterThan(0)
      }
    },
  )

  pinned(
    ['blood.triglyceride', 'lymph.fatFlowRate', 'event.triglyceridePeak'],
    'P: a meal without fat (water, cola, a glucose drink, nothing) leaves blood fat flat at 80 mg/dL for 48 h, with no peak',
    () => {
      for (const m of NO_FAT) {
        const out = run(m)
        expect(
          values(out, 'lymph.fatFlowRate').every((x) => x === 0),
          m,
        ).toBe(true)
        expect(
          values(out, 'blood.triglyceride').every((x) => x === 80),
          m,
        ).toBe(true)
        expect(out.moments.get('event.triglyceridePeak')?.atMin, m).toBeNull()
      }
    },
  )

  pinned('blood.triglyceride', 'P: more fat in the same food gives a higher blood-fat peak (milk ×1 < ×2 < ×3)', () => {
    const rises = ['milk:1', 'milk:2', 'milk:3'].map((m) => peakOf(run(m)).rise)
    expect(rises[0]!).toBeGreaterThan(1)
    expect(rises[1]!).toBeGreaterThan(rises[0]!)
    expect(rises[2]!).toBeGreaterThan(rises[1]!)
  })

  golden(
    ['blood.triglyceride', 'event.triglyceridePeak'],
    ['nordestgaard2016'],
    'C (lymph.clearTauMin): everyday meals of 15–30 g fat (at most 500 kcal) raise blood fat by 15–40 mg/dL, highest 1–6 h after eating (Nordestgaard 2016: "maximal mean changes at 1-6 h after habitual meals", +18 to +26 mg/dL)',
    () => {
      for (const m of EVERYDAY) {
        const out = run(m)
        const fat = mealOf(m).total.fatG
        expect(fat, m).toBeGreaterThanOrEqual(15)
        expect(fat, m).toBeLessThanOrEqual(30)
        expect(mealOf(m).total.energyKcal, m).toBeLessThanOrEqual(500)
        const { rise, atMin } = peakOf(out)
        expect(rise, m).toBeGreaterThanOrEqual(15)
        expect(rise, m).toBeLessThanOrEqual(40)
        expect(out.moments.get('event.triglyceridePeak')?.atMin, m).toBe(atMin)
        expect(atMin, m).toBeGreaterThanOrEqual(60)
        expect(atMin, m).toBeLessThanOrEqual(360)
      }
    },
  )

  golden.fails(
    ['blood.triglyceride', 'event.triglyceridePeak'],
    ['nordestgaard2016'],
    'everyday meals of 15–30 g fat over 500 kcal of solid food (2 cheeseburgers; 4 roti and 2 dal) also rise 15–40 mg/dL and peak at 1–6 h',
    'solid food empties at a fixed 1.4 kcal/min, so their fat keeps coming for 7–9 h and blood fat peaks late (the deferred emptying change, R45/R67)',
    () => {
      for (const m of BIG_EVERYDAY) {
        const { rise, atMin } = peakOf(run(m))
        expect(rise, m).toBeGreaterThanOrEqual(15)
        expect(atMin, m).toBeLessThanOrEqual(360)
      }
    },
  )

  golden(
    ['blood.triglyceride', 'event.triglyceridePeak', 'lymph.fatFlowRate'],
    ['odoherty2018'],
    "S (hold-out): Gribok 2016's 51 g fat drink peaks 2–5 h after drinking and is back within 10 mg/dL of fasting by 14 h; O'Doherty 2018's 75 g fat drink is back by 14 h too (\"peaking at 3–4 h and returning to baseline 6–8 h later\")",
    () => {
      const shake = run('gribok-fat-70:1')
      const { rise, atMin } = peakOf(shake)
      expect(rise).toBeGreaterThan(10)
      expect(shake.moments.get('event.triglyceridePeak')?.atMin).toBe(atMin)
      expect(atMin).toBeGreaterThanOrEqual(120)
      expect(atMin).toBeLessThanOrEqual(300)
      for (const m of ['gribok-fat-70:1', 'oftt-75:1']) {
        const tg = values(run(m), 'blood.triglyceride')
        for (let i = 14 * 60; i < N; i++) expect(tg[i]! - 80, `${m} @${i}`).toBeLessThanOrEqual(10)
      }
    },
  )

  golden.fails(
    ['blood.triglyceride', 'event.triglyceridePeak'],
    ['odoherty2018'],
    "O'Doherty 2018's own 75.4 g fat, 823 kcal drink peaks at 3–4 h (window 2–5 h)",
    'a drink empties at about 2.1 kcal/min (energy-regulated), so its 823 kcal keep fat coming for about 6.4 h and the model peaks at about 6.5 h (the deferred emptying change, R45/R67)',
    () => {
      const { atMin } = peakOf(run('oftt-75:1'))
      expect(atMin).toBeLessThanOrEqual(300)
    },
  )

  // Liu 2022 (normal fat tolerance, n = 98): a 1500 kcal meal with 60 % of its energy from fat, TG
  // 0.91 → 1.64 mmol/L at 2 h, still 1.53 at 8 h, 0.98 at 10 h. The model empties ~1500 kcal of
  // solid food in about 18 h, so blood fat stays up past 13 h: no golden until the emptying change
  // (R45/R67); the lymph time constants are never tuned to hide it.
  it.todo(
    '[blood.triglyceride] a 1500 kcal meal with 60 % fat (~100 g) is near fasting (within 10 mg/dL) by 10 h (Liu 2022 Table 2, liu2022)',
  )

  pinned(
    'blood.triglyceride',
    'G: blood fat stays inside 60–400 mg/dL and starts at 80 (Liu 2022: 0.91 mmol/L × 88 = 80 mg/dL; model §5 guard)',
    () => {
      for (const m of [...EVERYDAY, 'oftt-75:1', 'fatty-meal:2', 'cheeseburger:2,fries:2,cola:1']) {
        const tg = values(run(m), 'blood.triglyceride')
        expect(tg[0], m).toBe(80)
        for (let i = 0; i < N; i += 7) {
          expect(tg[i]!, `${m} @${i}`).toBeGreaterThanOrEqual(80)
          expect(tg[i]!, `${m} @${i}`).toBeLessThanOrEqual(400)
        }
      }
    },
  )
})

describe('insertion and rest invariance (model D13 iii, iv)', () => {
  /** sha256 of every array, band and moment in `out` whose ID `keep` accepts, in a fixed order. */
  function hashOf(out: ModuleOutput, keep: (id: string) => boolean): string {
    const h = createHash('sha256')
    for (const [id, w] of [...out.signals].sort(([a], [b]) => (a < b ? -1 : 1))) {
      if (!keep(id)) continue
      h.update(id)
      h.update(Buffer.from(w.values.buffer, w.values.byteOffset, w.values.byteLength))
      if (w.band) for (const edge of [w.band.low, w.band.high]) h.update(Buffer.from(edge.buffer, edge.byteOffset, edge.byteLength))
    }
    for (const [id, p] of [...out.moments].sort(([a], [b]) => (a < b ? -1 : 1)))
      if (keep(id)) h.update(JSON.stringify([id, p.atMin, p.low ?? null, p.high ?? null, p.meta]))
    for (const [id, r] of [...out.rhythms].sort(([a], [b]) => (a < b ? -1 : 1))) if (keep(id)) h.update(JSON.stringify([id, r]))
    return h.digest('hex')
  }

  it(`(iii) adding lymph leaves every signal, internal array, band and moment that existed before it byte-identical (${MEALS_34.length} meals × ${PLANS_9.length} plans, hashed)`, () => {
    expect(MEALS_34).toHaveLength(34)
    expect(PLANS_9).toHaveLength(9)
    const without = HUMAN_MODULES.filter((m) => m.id !== 'lymph')
    expect(without).toHaveLength(HUMAN_MODULES.length - 1)
    expect(HUMAN_MODULES.at(-1)!.id).toBe('lymph')
    const before = createHash('sha256')
    const after = createHash('sha256')
    for (const m of MEALS_34)
      for (const plan of PLANS_9) {
        const old = runModules(without, setup(m, plan))
        const now = runModules(HUMAN_MODULES, setup(m, plan))
        const existed = (id: string) => old.signals.has(id as never) || old.moments.has(id as never) || old.rhythms.has(id as never)
        before.update(hashOf(old, () => true))
        after.update(hashOf(now, existed))
        expect(
          [...now.signals.keys()].filter((id) => !old.signals.has(id)),
          m,
        ).toEqual([...LYMPH_SIGNAL_IDS])
        expect(
          [...now.moments.keys()].filter((id) => !old.moments.has(id)),
          m,
        ).toEqual(['event.triglyceridePeak'])
        expect(now.rhythms.size, m).toBe(old.rhythms.size)
      }
    expect(after.digest('hex')).toBe(before.digest('hex'))
  }, 60_000)

  it('(iv) no plan, an empty plan and any activity give the same lymph rows (the gut reads no activity, D6/C3); a fasting rest is flat for 48 h', () => {
    for (const m of ['', 'fries:1', 'oftt-75:1']) {
      const none = runModules(HUMAN_MODULES, setup(m))
      for (const plan of PLANS_9.slice(1, 4)) {
        const moving = run(m, plan)
        for (const id of LYMPH_SIGNAL_IDS) expect(firstDiff(values(moving, id), values(none, id)), `${m} ${id}`).toBe(-1)
        expect(moving.moments.get('event.triglyceridePeak')).toEqual(none.moments.get('event.triglyceridePeak'))
      }
    }
    const sim = simulate(mealOf(''), { particles: 0 })
    expect(sim.signals.get('blood.triglyceride')!.values.every((x) => x === 80)).toBe(true)
    expect(sim.signals.get('lymph.fatFlowRate')!.values.every((x) => x === 0)).toBe(true)
    expect(sim.moments.get('event.triglyceridePeak')?.atMin).toBeNull()
  })
})

describe('contract: status, ranges, speed', () => {
  it('both lymph rows and the blood-fat peak are Model estimates with no band (status ≤ its needs, D9; model §2.10)', () => {
    for (const id of LYMPH_SIGNAL_IDS) {
      expect(RUN_SIGNALS[id].status, id).toBe('assumption')
      expect(RUN_SIGNALS[id].band, id).toBeUndefined()
      expect(RUN_SIGNALS[id].shipsIn, id).toBe('v3.1')
    }
    expect(LYMPH_EVENTS['event.triglyceridePeak'].status).toBe('assumption')
    expect(lymphModule.needs).toEqual(['gut.absorbRate.fat'])
  })

  it(`every lymph row stays finite and inside its validRange (never clamped to pass) for ${FULL ? 300 : 40} meal × activity plans (fixed seed)`, () => {
    let seed = 29
    const rnd = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]!
    const menu = [...MEALS_34, 'oftt-75:1', 'oftt-75:2', 'fatty-meal:3', 'cheeseburger:3,fries:3,milk:2']
    for (let k = 0; k < (FULL ? 300 : 40); k++) {
      const plan: ActivityBout[] = []
      let t = Math.floor(rnd() * 600)
      for (let b = 0, count = Math.floor(rnd() * 9); b < count && t <= 2880; b++) {
        const durMin = 5 + Math.floor(rnd() * 116)
        plan.push({ kind: pick(ACTIVITY_KINDS), startMin: t, durMin })
        t += durMin + Math.floor(rnd() * 300)
      }
      const m = pick(menu)
      const out = runModules(HUMAN_MODULES, setup(m, plan)).signals
      for (const id of LYMPH_SIGNAL_IDS) {
        const { low, high } = RUN_SIGNALS[id].validRange!
        const v = out.get(id)!.values
        const bad = v.findIndex((x) => !Number.isFinite(x) || x < low || x > high)
        expect(bad, `${id} with ${m} ${activityKey(plan)}: ${v[bad]}`).toBe(-1)
      }
    }
  }, 30_000)

  it('lymph runs in ≤ 2 ms (median of 21 runs, 48 h at 1 min)', () => {
    const fatRate = runModules(
      HUMAN_MODULES.filter((m) => m.id !== 'lymph'),
      setup('oftt-75:1'),
    ).signals.get('gut.absorbRate.fat')!.values
    const upstream: ModelModule = {
      id: 'gut',
      system: 'digestion',
      needs: [],
      provides: ['gut.absorbRate.fat'],
      run: (ctx) => ctx.put('gut.absorbRate.fat', fatRate),
    }
    const s = setup('oftt-75:1')
    const times: number[] = []
    for (let k = 0; k < 21; k++) {
      let ms = 0
      runModules(
        [upstream, { ...lymphModule, run: (ctx) => ((ms = -performance.now()), lymphModule.run(ctx), (ms += performance.now())) }],
        s,
      )
      times.push(ms)
    }
    times.sort((a, b) => a - b)
    expect(times[10]!).toBeLessThanOrEqual(2)
  })
})
