import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { MODEL_SEALED, MODEL_VERSION } from '../src/index.ts'
import { SEAL_GRID, runCase, sealFile, sealHashes, type SealFile } from './seal.ts'

/**
 * The seal guard (model D12, D13 iii), enforced in CI through `npm test`. Once MODEL_SEALED is
 * true, test/sealed/v<MODEL_VERSION>.json pins a hash of every output over a fixed grid of meals
 * and activity plans. Adding a module, a signal or a moment is fine (a new output, not in the
 * file); changing any output that is in the file fails: that is a new model version.
 */
describe(`the seal (model version ${MODEL_VERSION})`, () => {
  it('a sealed version has its seal file', () => {
    if (!MODEL_SEALED) return
    expect(
      existsSync(sealFile(MODEL_VERSION)),
      `MODEL_SEALED is true but test/sealed/v${MODEL_VERSION}.json is missing: run npm run calibrate -w @lifepeek/engine -- --seal`,
    ).toBe(true)
  })

  it('every grid case is a valid run (every food found, every bout run)', () => {
    for (const key of SEAL_GRID) {
      const act = key.split('|')[1]!
      const meal = key.split('|')[0]!
      const sim = runCase(key)
      expect(sim.activity.length, key).toBe(act ? act.split(',').length : 0)
      expect(sim.meal.items.length, key).toBe(meal ? meal.split(',').length : 0)
    }
  }, 60_000)

  it('no sealed output changed (D13 iii: a new module or signal only adds outputs)', () => {
    if (!MODEL_SEALED || !existsSync(sealFile(MODEL_VERSION))) return
    const sealed = JSON.parse(readFileSync(sealFile(MODEL_VERSION), 'utf8')) as SealFile
    expect(sealed.modelVersion).toBe(MODEL_VERSION)
    const now = sealHashes(sealed.grid)
    const changed = Object.keys(sealed.outputs).filter((id) => now[id] !== sealed.outputs[id])
    const added = Object.keys(now).filter((id) => !(id in sealed.outputs))
    if (added.length) console.log(`seal: ${added.length} new output(s) since the seal (allowed): ${added.join(', ')}`)
    expect(
      changed.map((id) => `${id}: ${now[id] ? 'changed' : 'gone'}`),
      `Model version ${MODEL_VERSION} is sealed and these existing outputs changed for the same input. ` +
        `That needs MODEL_VERSION ${MODEL_VERSION + 1} (model D12): bump it in params.ts with MODEL_SEALED = false, ` +
        `review the diff (calibrate --diff), then seal the new version (calibrate --seal).`,
    ).toEqual([])
  }, 120_000)
})
