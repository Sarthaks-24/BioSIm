import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMeal, decodeMeal, parseFood, type ActivityBout, type RunResult } from '../src/index.ts'
import { simulate } from '../src/run.ts'
import { lookup as fixtureLookup } from './fixtures.ts'

/**
 * The seal guard (model D12, D13 iii). When a model version is sealed, `test/sealed/v<N>.json`
 * holds one hash per output (every signal row, its band, every moment, rhythm, the events, the
 * particles and the emptying curves) over a fixed grid of meals × activity plans. After the seal a
 * new module or signal may only ADD outputs: every output in the file must stay byte-identical.
 *
 * Written by `npm run calibrate -w @lifepeek/engine -- --seal` and checked by test/seal.test.ts.
 */

const here = dirname(fileURLToPath(import.meta.url))
export const SEAL_DIR = resolve(here, 'sealed')

const foodsDir = resolve(here, '../../../content/foods')
const foods = readdirSync(foodsDir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(foodsDir, f), 'utf8'))))
const lookup = (id: string) => fixtureLookup(id) ?? foods.find((f) => f.id === id)

/**
 * The grid: every Home and Teach meal, the calibration meals and nothing at all, each at rest and
 * with plans that use every activity kind (public or not), short and long bouts and the 48 h edge.
 * Written into the seal file, which the test reads it back from, so the grid cannot drift.
 */
const MEALS = [
  '',
  'water:1',
  'cola:1',
  'cola:4',
  'milk:1',
  'orange-juice:1',
  'apple:1',
  'white-rice:1',
  'roti:1,dal:1',
  'roti:2,dal:1,green-salad:1',
  'idli:2,banana:1',
  'boiled-egg:2,white-bread:2',
  'cheeseburger:1,fries:1',
  'cheeseburger:2,fries:2,cola:1',
  'water-test:1',
  'glucose-50:1',
  'standard-meal:1',
  'fatty-meal:1',
]
const PLANS = [
  '',
  'walk.30.20',
  'walkBrisk.60.30',
  'run.240.20',
  'sitClass.0.45,football.120.60,walk.600.120',
  'cricket.30.90,badminton.300.30,run.2860.20',
]
export const SEAL_GRID: readonly string[] = MEALS.flatMap((m) => PLANS.map((a) => `${m}|${a}`))

/** One grid case: `meal|act`, as in a share link's `m` and `act` (hidden kinds too; simulate checks the limits). */
export function runCase(key: string): RunResult {
  const [meal, act] = key.split('|') as [string, string]
  const activity = act
    ? act.split(',').map((b): ActivityBout => {
        const [kind, startMin, durMin] = b.split('.')
        return { kind: kind as ActivityBout['kind'], startMin: Number(startMin), durMin: Number(durMin) }
      })
    : []
  return simulate(buildMeal(decodeMeal(meal), lookup), { activity })
}

const bytes = (x: Float32Array) => Buffer.from(x.buffer, x.byteOffset, x.byteLength)

/** Each output of one run, as the bytes the hash takes (Float32 rows as stored, the rest as JSON). */
function outputs(sim: RunResult): Map<string, Buffer> {
  const out = new Map<string, Buffer>()
  for (const [id, s] of sim.signals) {
    out.set(id, bytes(s.values))
    if (s.low) out.set(`${id}.low`, bytes(s.low))
    if (s.high) out.set(`${id}.high`, bytes(s.high))
  }
  for (const [id, p] of sim.moments) out.set(`moment:${id}`, Buffer.from(JSON.stringify([p.atMin, p.low ?? null, p.high ?? null])))
  for (const [id, r] of sim.rhythms) out.set(`rhythm:${id}`, Buffer.from(JSON.stringify({ ...r, meta: undefined })))
  out.set('run.events', Buffer.from(JSON.stringify(sim.events)))
  out.set('run.particles', Buffer.from(JSON.stringify(sim.particles)))
  out.set('run.curves', Buffer.from(JSON.stringify(sim.curves)))
  out.set('run.stomachArrivalMin', Buffer.from(JSON.stringify(sim.stomachArrivalMin)))
  return out
}

/**
 * One hash per output over the whole grid (sha256, first 24 hex). A case where a run lacks the
 * output feeds an "absent" marker, so an output that disappears from some runs also changes.
 */
export function sealHashes(grid: readonly string[]): Record<string, string> {
  const runs = grid.map((key) => ({ key, out: outputs(runCase(key)) }))
  const ids = [...new Set(runs.flatMap((r) => [...r.out.keys()]))]
  const hashes: Record<string, string> = {}
  for (const id of ids) {
    const h = createHash('sha256')
    for (const { key, out } of runs) {
      h.update(`${key}\n`)
      const b = out.get(id)
      h.update(b ?? Buffer.from('absent'))
    }
    hashes[id] = h.digest('hex').slice(0, 24)
  }
  return hashes
}

export interface SealFile {
  modelVersion: number
  note: string
  grid: string[]
  outputs: Record<string, string>
}

export const sealFile = (version: number) => join(SEAL_DIR, `v${version}.json`)

/** The seal file for a model version, from this model. */
export function makeSeal(version: number): SealFile {
  return {
    modelVersion: version,
    note:
      'Sealed model outputs (model D12, D13 iii). Never edit by hand. A changed hash means an existing output changed: ' +
      'that needs the next MODEL_VERSION. Written by: npm run calibrate -w @lifepeek/engine -- --seal',
    grid: [...SEAL_GRID],
    outputs: sealHashes(SEAL_GRID),
  }
}
