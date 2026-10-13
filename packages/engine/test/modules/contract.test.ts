import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ACTIVE_SIGNAL_IDS,
  HUMAN_MODEL,
  HUMAN_MODULES,
  MODULE_ORDER,
  PARAMS,
  PROFILES,
  PROVIDES,
  buildMeal,
  decodeMeal,
  moduleGraphErrors,
  runModules,
  simulate,
  type ModelModule,
} from '../../src/index.ts'
import { lookup } from '../fixtures.ts'
import { N } from './ctx.ts'

/**
 * The module contract (architecture §1.1, §1.5 "Contract"; model D4): the frozen order, a graph
 * with no loops, one module per ID, `ctx.get`/`ctx.put` held to the declarations, and modules
 * that read only `ctx.params`. Plain `it()`: wiring, not physiology.
 */

const meal = buildMeal(decodeMeal('standard-meal:1,glucose-50:1'), lookup)
const setup = { input: { meal }, params: PARAMS, profile: PROFILES['adult-ref'], n: N, stepMin: PARAMS.stepMin }

describe('module order (DAG)', () => {
  it('the frozen order is activity → gut → energy → bloodSugar → gas → effort → circulation → water → lymph', () => {
    expect(MODULE_ORDER).toEqual(['activity', 'gut', 'energy', 'bloodSugar', 'gas', 'effort', 'circulation', 'water', 'lymph'])
  })

  it('the human modules follow it, and every need is written by an earlier module', () => {
    expect(HUMAN_MODULES.map((m) => m.id)).toEqual(['gut', 'energy', 'bloodSugar'])
    expect(moduleGraphErrors(HUMAN_MODULES)).toEqual([])
    expect(HUMAN_MODEL.modules).toBe(HUMAN_MODULES)
  })

  it('the check finds a wrong order, a need nobody writes earlier, and a second writer', () => {
    const [gut, energy, bloodSugar] = HUMAN_MODULES as [ModelModule, ModelModule, ModelModule]
    const swapped = moduleGraphErrors([energy, gut, bloodSugar])
    expect(swapped).toContain(`gut: out of order (frozen order: ${MODULE_ORDER.join(' → ')})`)
    expect(swapped).toContain('energy: needs gut.absorbed.carbsG, which no earlier module writes')
    expect(moduleGraphErrors([gut, energy, bloodSugar, { ...gut, id: 'lymph', needs: [] }])).toContain(
      'gut.leftBodyG: written by gut and lymph',
    )
  })
})

describe('one module per ID', () => {
  const written = HUMAN_MODULES.flatMap((m) => [...m.provides, ...(m.internal ?? [])])

  it('no ID is written by two modules', () => {
    expect(written.filter((id, i) => written.indexOf(id) !== i)).toEqual([])
  })

  it('PROVIDES.human is derived from the modules and covers every active catalog signal', () => {
    expect(PROVIDES.human).toEqual(HUMAN_MODULES.flatMap((m) => m.provides))
    expect([...PROVIDES.human].sort()).toEqual([...ACTIVE_SIGNAL_IDS].sort())
  })

  it('internal arrays are x.* and never reach the signal table', () => {
    const internal = HUMAN_MODULES.flatMap((m) => m.internal ?? [])
    expect(internal.length).toBeGreaterThan(0)
    for (const id of internal) expect(id).toMatch(/^x\./)
    const sim = simulate(meal, { particles: 0 })
    expect([...sim.signals.keys()].filter((id) => id.startsWith('x.'))).toEqual([])
  })
})

describe('ctx.get / ctx.put keep a module to what it declared', () => {
  const mod = (over: Partial<ModelModule>): ModelModule => ({ id: 'gas', needs: [], provides: [], run: () => {}, ...over })
  const gut = HUMAN_MODULES[0]!
  const fill = () => new Float64Array(N)

  it('get of an ID not in needs throws, even when it was written', () => {
    const peek = mod({ run: (ctx) => void ctx.get('gut.leftBodyG') })
    expect(() => runModules([gut, peek], setup)).toThrow(/gas: get\("gut\.leftBodyG"\) is not in its needs/)
  })

  it('get of a need nobody wrote yet throws', () => {
    const early = mod({ needs: ['gut.leftBodyG'], run: (ctx) => void ctx.get('gut.leftBodyG') })
    expect(() => runModules([early, gut], setup)).toThrow(/before any module wrote it/)
  })

  it('put of an undeclared ID, a second put, a wrong length or a missing put throws', () => {
    expect(() => runModules([mod({ run: (ctx) => ctx.put('blood.glucose', fill()) })], setup)).toThrow(/not in its provides or internal/)
    const twice = mod({
      internal: ['x.test.a'],
      run: (ctx) => {
        ctx.put('x.test.a', fill())
        ctx.put('x.test.a', fill())
      },
    })
    expect(() => runModules([twice], setup)).toThrow(/put\("x\.test\.a"\) twice/)
    expect(() => runModules([mod({ internal: ['x.test.a'], run: (ctx) => ctx.put('x.test.a', new Float64Array(3)) })], setup)).toThrow(
      /has 3 values/,
    )
    expect(() => runModules([mod({ internal: ['x.test.a'] })], setup)).toThrow(/did not put "x\.test\.a"/)
  })

  it('a band goes with exactly the signals whose catalog row has one', () => {
    const noBand = mod({ provides: ['blood.glucose'], run: (ctx) => ctx.put('blood.glucose', fill()) })
    expect(() => runModules([noBand], setup)).toThrow(/needs its band/)
    const extra = mod({ provides: ['gut.leftBodyG'], run: (ctx) => ctx.put('gut.leftBodyG', fill(), { low: fill(), high: fill() }) })
    expect(() => runModules([extra], setup)).toThrow(/has a band the catalog does not/)
  })
})

describe('no global PARAMS', () => {
  const modulesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/modules')

  it('no module file names PARAMS: modules read ctx.params only', () => {
    const files = readdirSync(modulesDir).filter((f) => f.endsWith('.ts'))
    expect(files.sort()).toEqual(['bloodSugar.ts', 'energy.ts', 'gut.ts', 'index.ts'])
    for (const f of files) expect(readFileSync(join(modulesDir, f), 'utf8'), f).not.toMatch(/\bPARAMS\b/)
  })

  it('PARAMS is read-only, and a run leaves it as it was', () => {
    const before = structuredClone(PARAMS)
    simulate(meal, { particles: 8 })
    expect(PARAMS).toEqual(before)
    // Compile-time guard (npm run typecheck): PARAMS cannot be assigned to.
    const assign = () => {
      // @ts-expect-error PARAMS is `as const`: every field is read-only.
      PARAMS.stepMin = 2
    }
    expect(typeof assign).toBe('function')
  })
})
