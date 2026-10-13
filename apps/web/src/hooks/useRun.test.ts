import { afterEach, describe, expect, it, vi } from 'vitest'

// The engine entry, watched: importing useRun.ts must not load it (E-2: only the stage's
// loadEngine() does, so KeepButton and these tests can use runKey without the engine).
const loaded = vi.hoisted(() => ({ count: 0 }))
vi.mock('@lifepeek/engine/run', async (importOriginal) => {
  loaded.count++
  return importOriginal()
})

const { engineState, loadEngine, resetEngineForTests, runKey } = await import('./useRun.ts')

afterEach(() => {
  resetEngineForTests()
})

describe('the lazy engine (hooks/useRun.ts, architecture §3.1)', () => {
  it('importing useRun.ts (runKey, as KeepButton does) does not load the engine', () => {
    expect(runKey([{ foodId: 'cola', servings: 1 }], 'adult-ref')).toBe('adult-ref|cola:1')
    expect(loaded.count).toBe(0)
  })

  it('loadEngine loads it once; the engine then runs', async () => {
    await Promise.all([loadEngine(), loadEngine()])
    expect(loaded.count).toBe(1)
    const s = engineState()
    expect(s).toMatchObject({ failed: false, attempts: 0 })
    expect(typeof s.engine?.simulate).toBe('function')
  })

  it('a file that does not arrive (rejected, or nothing after main.tsx cancels the preload error) is a failure; "Try again" loads it', async () => {
    await loadEngine(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')))
    expect(engineState()).toMatchObject({ engine: null, failed: true, attempts: 1 })
    await loadEngine(() => Promise.resolve(undefined))
    expect(engineState()).toMatchObject({ engine: null, failed: true, attempts: 2 })
    const retry = loadEngine()
    expect(engineState()).toMatchObject({ failed: false })
    await retry
    expect(engineState().engine).not.toBeNull()
  })
})
