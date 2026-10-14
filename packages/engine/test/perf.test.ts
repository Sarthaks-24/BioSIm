import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PROFILES, buildMeal, decodeMeal, parseFood, type ActivityBout, type Meal, type ModelModule } from '../src/index.ts'
import { HUMAN_MODEL, HUMAN_MODULES, runModules, simulate } from '../src/run.ts'

/**
 * The engine's time gates (H-1, architecture §3.1 "Speed", R61), enforced: `simulate` p50 ≤ 20 ms
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
 * `npm test` runs this file alone, after the others (package.json): parallel test files would share
 * the CPU. A busy machine still slows everything for a while, so each gate takes the best of three
 * batches' medians: a real slowdown shows in all three.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => foods.find((f) => f.id === id)
const meal = (m: string) => buildMeal(decodeMeal(m), lookup)

const MODULE_MAX_MS = 2
const GUT_MAX_MS = 15
const RUN_MAX_MS = 20

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

const WARM = 10
const RUNS = 21
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!
/** The best of three batches' medians of `RUNS` timed calls (after `WARM` untimed ones). */
function bestMedian(time: () => number): number {
  let best = Infinity
  for (let batch = 0; batch < 3; batch++) {
    for (let i = 0; i < WARM; i++) time()
    best = Math.min(best, median(Array.from({ length: RUNS }, time)))
  }
  return best
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
        ms[mod.id] = bestMedian(() => {
          const t0 = performance.now()
          ;(mod as ModelModule<typeof HUMAN_MODEL.params>).run(ctx as never)
          return performance.now() - t0
        })
      }
      const run = bestMedian(() => {
        const t0 = performance.now()
        simulate(m, { activity: plan })
        return performance.now() - t0
      })
      console.log(
        `${name}: simulate ${run.toFixed(2)} ms; modules ${Object.entries(ms)
          .map(([id, t]) => `${id} ${t.toFixed(2)}`)
          .join(', ')}`,
      )
      const over = Object.entries(ms).filter(([id, t]) => t > (id === 'gut' ? GUT_MAX_MS : MODULE_MAX_MS))
      expect(over, 'modules over their limit (ms)').toEqual([])
      expect(run, 'simulate p50 (ms)').toBeLessThanOrEqual(RUN_MAX_MS)
    }, 60_000)
  }
})
