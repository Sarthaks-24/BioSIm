import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PROFILES, buildMeal, decodeMeal, parseFood, type ActivityBout, type Meal, type ModelModule } from '../src/index.ts'
import { HUMAN_MODEL, HUMAN_MODULES, runModules, simulate } from '../src/run.ts'

/**
 * The engine's time gates (H-1, architecture §3.1 "Speed", R61), enforced: `simulate` ≤ 20 ms a call
 * (Node, warm, as the app calls it: all modules, the moments, 48 particles) and each module ≤ 2 ms,
 * 48 h at 1 min. The browser's first run (engine fetch + parse + run, ≤ 400 ms at 4× CPU) is in
 * apps/web/e2e/perf.spec.ts.
 *
 * One exception, kept as a ratchet: the gut module (v2's stomach and gut transit, unchanged since
 * model version 2) takes 2–8 ms, nearly all of it the transit convolution (transit.ts, O(minutes ×
 * transit time)). Making it O(minutes) changes how its sums are rounded, so every gut output would
 * move by a few parts in 10^15: after the seal that is a new model version. It stays under
 * GUT_MAX_MS until then; the whole run, the user-facing number, is within its 20 ms.
 *
 * How it measures (R110): CPU time, not the wall clock. A machine busy with other work (two browser
 * test runs beside `npm test`) stretches the wall time of every call while the CPU time a call
 * needs moves far less. Each gate is the CPU time of a batch of calls that used at least
 * BATCH_CPU_MS of it, over the number of calls (Windows counts CPU time in 15.6 ms ticks: a single
 * call cannot be timed so), the least of three batches after a warm-up, and a gate over its limit
 * is measured once more before it fails.
 *
 * Where it is strict: in CI's perf job, alone on its runner (ENGINE_PERF=strict, `npm run test:perf`).
 * Anywhere else (`npm test` on a laptop or in CI's check job, beside other work) the limits are
 * LOCAL_SLACK times wider: wide enough for a shared CPU (its cores slow down and share caches: a
 * call's CPU time grew up to 3× beside browser test runs on a laptop), narrow enough to catch a real
 * slowdown (a step that becomes O(n²) is 10× or more). `npm test` runs this file alone, after the others.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => foods.find((f) => f.id === id)
const meal = (m: string) => buildMeal(decodeMeal(m), lookup)

const STRICT = process.env.ENGINE_PERF === 'strict'
const LOCAL_SLACK = 3
const SLACK = STRICT ? 1 : LOCAL_SLACK
const MODULE_MAX_MS = 2 * SLACK
const GUT_MAX_MS = 15 * SLACK
const RUN_MAX_MS = 20 * SLACK

/** The Home and Teach meals with a walk, and the heaviest input the UI allows (6 foods × 5, 8 bouts). */
const WALK: ActivityBout[] = [{ kind: 'walk', startMin: 60, durMin: 20 }]
const HEAVY_PLAN: ActivityBout[] = [
  { kind: 'sitClass', startMin: 0, durMin: 45 },
  { kind: 'walk', startMin: 60, durMin: 30 },
  { kind: 'walkBrisk', startMin: 120, durMin: 30 },
  { kind: 'run', startMin: 200, durMin: 20 },
  { kind: 'football', startMin: 300, durMin: 60 },
  { kind: 'cricket', startMin: 420, durMin: 90 },
  { kind: 'badminton', startMin: 600, durMin: 30 },
  { kind: 'run', startMin: 2860, durMin: 20 },
]
const CASES: [string, Meal, ActivityBout[]][] = [
  ['cola', meal('cola:1'), WALK],
  ['burger + fries', meal('cheeseburger:1,fries:1'), WALK],
  ['roti + dal', meal('roti:1,dal:1'), WALK],
  ['heaviest', meal('cheeseburger:5,fries:5,cola:5,roti:5,dal:5,milk:5'), HEAVY_PLAN],
]

/** CPU time spent calling before the batches are timed: the JIT's optimising compiles (on threads this clock counts) are done by then. */
const WARM_CPU_MS = 60
/** CPU time each batch must use (16 ms ticks: ≤ 16 % of it), and the batches; the least is taken. */
const BATCH_CPU_MS = 100
const BATCHES = 3
/** This process's CPU time so far (user + system), in ms. */
const cpuMs = () => {
  const u = process.cpuUsage()
  return (u.user + u.system) / 1000
}
/** Calls `call` until it has used `ms` of CPU time; returns the CPU ms per call. */
function batch(call: () => void, ms: number): number {
  const start = cpuMs()
  let n = 0
  let used = 0
  do {
    call()
    n++
    used = cpuMs() - start
  } while (used < ms)
  return used / n
}
/** CPU ms per call of `call`: the least of BATCHES batches' (each its CPU time over its calls), after a warm-up. */
function cpuPerCall(call: () => void): number {
  batch(call, WARM_CPU_MS)
  return Math.min(...Array.from({ length: BATCHES }, () => batch(call, BATCH_CPU_MS)))
}
/** As cpuPerCall, measured once more if over `max` (one burst of other work must not fail a gate). */
const gate = (call: () => void, max: number) => {
  const first = cpuPerCall(call)
  return first <= max ? first : Math.min(first, cpuPerCall(call))
}

describe('engine time gates (H-1)', () => {
  for (const [name, m, plan] of CASES) {
    it(`${name}: each module ≤ ${MODULE_MAX_MS} ms (gut ≤ ${GUT_MAX_MS} ms) and the whole run ≤ ${RUN_MAX_MS} ms`, () => {
      const setup = { input: { meal: m, activity: plan }, params: HUMAN_MODEL.params, profile: PROFILES['adult-ref'], n: 2881, stepMin: 1 }
      const ms: Record<string, number> = {}
      for (const mod of HUMAN_MODULES) {
        // Each module alone, on what the modules before it wrote.
        const before = runModules(HUMAN_MODULES.slice(0, HUMAN_MODULES.indexOf(mod)), setup).signals
        const ctx = {
          ...setup,
          get: (id: string) => before.get(id as never)!.values,
          put: () => {},
          putMoment: () => {},
          putRhythm: () => {},
        }
        ms[mod.id] = gate(
          () => (mod as ModelModule<typeof HUMAN_MODEL.params>).run(ctx as never),
          mod.id === 'gut' ? GUT_MAX_MS : MODULE_MAX_MS,
        )
      }
      const run = gate(() => simulate(m, { activity: plan }), RUN_MAX_MS)
      console.log(
        `${name} (CPU ms per call${STRICT ? ', strict' : `, limits × ${LOCAL_SLACK}`}): simulate ${run.toFixed(2)} ms; modules ${Object.entries(
          ms,
        )
          .map(([id, t]) => `${id} ${t.toFixed(2)}`)
          .join(', ')}`,
      )
      const over = Object.entries(ms).filter(([id, t]) => t > (id === 'gut' ? GUT_MAX_MS : MODULE_MAX_MS))
      expect(over, 'modules over their limit (ms)').toEqual([])
      expect(run, 'simulate, CPU ms per call').toBeLessThanOrEqual(RUN_MAX_MS)
    }, 60_000)
  }
})
