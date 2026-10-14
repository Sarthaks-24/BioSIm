import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PARAMS, PROFILES, buildMeal, decodeMeal, type ModelModule } from '../../src/index.ts'
import { HUMAN_MODEL, HUMAN_MODULES, PROVIDES, RUN_SIGNAL_IDS, runModules, simulate } from '../../src/run.ts'
import { MODULE_ORDER, SYSTEM_IDS, moduleGraphErrors } from '../../src/core/module.ts'
import { lookup } from '../fixtures.ts'
import { N } from './ctx.ts'

/**
 * The module contract (architecture §1.1, §1.5 "Contract"; model D4): the frozen order, a graph
 * with no loops, one module per ID, `ctx.get`/`ctx.put` held to the declarations, and modules
 * that read only `ctx.params`. Plain `it()`: wiring, not physiology.
 */

const meal = buildMeal(decodeMeal('standard-meal:1,glucose-50:1'), lookup)
const setup = { input: { meal, activity: [] }, params: HUMAN_MODEL.params, profile: PROFILES['adult-ref'], n: N, stepMin: PARAMS.stepMin }

describe('module order (DAG)', () => {
  it('the frozen order is activity → gut → energy → bloodSugar → gas → effort → circulation → water → lymph', () => {
    expect(MODULE_ORDER).toEqual(['activity', 'gut', 'energy', 'bloodSugar', 'gas', 'effort', 'circulation', 'water', 'lymph'])
  })

  it('the human modules follow it, and every need is written by an earlier module', () => {
    expect(HUMAN_MODULES.map((m) => m.id)).toEqual([
      'activity',
      'gut',
      'energy',
      'bloodSugar',
      'gas',
      'effort',
      'circulation',
      'water',
      'lymph',
    ])
    expect(moduleGraphErrors(HUMAN_MODULES)).toEqual([])
    expect(HUMAN_MODEL.modules).toBe(HUMAN_MODULES)
  })

  it('the check finds a wrong order, a need nobody writes earlier, and a second writer', () => {
    const [activity, gut, energy, bloodSugar] = HUMAN_MODULES as [ModelModule, ModelModule, ModelModule, ModelModule]
    const swapped = moduleGraphErrors([activity, energy, gut, bloodSugar])
    expect(swapped).toContain(`gut: out of order (frozen order: ${MODULE_ORDER.join(' → ')})`)
    expect(swapped).toContain('energy: needs gut.absorbed.carbsG, which no earlier module writes')
    expect(moduleGraphErrors([gut, energy, bloodSugar])).toContain('energy: needs x.activity.met, which no earlier module writes')
    expect(moduleGraphErrors([activity, gut, energy, bloodSugar, { ...gut, id: 'lymph', needs: [] }])).toContain(
      'gut.leftBodyG: written by gut and lymph',
    )
  })
})

describe('one module per ID', () => {
  const written = HUMAN_MODULES.flatMap((m) => [...m.provides, ...(m.internal ?? [])])

  it('no ID is written by two modules', () => {
    expect(written.filter((id, i) => written.indexOf(id) !== i)).toEqual([])
  })

  it('PROVIDES.human is derived from the modules and covers every active catalog signal and pack row', () => {
    expect(PROVIDES.human).toEqual(HUMAN_MODULES.flatMap((m) => m.provides))
    expect([...PROVIDES.human].sort()).toEqual([...RUN_SIGNAL_IDS].sort())
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
  const mod = (over: Partial<ModelModule>): ModelModule => ({
    id: 'gas',
    system: 'breathing',
    needs: [],
    provides: [],
    run: () => {},
    ...over,
  })
  const gut = HUMAN_MODULES.find((m) => m.id === 'gut')!
  const fill = () => new Float64Array(N)

  it('get of an ID not in needs throws, even when it was written', () => {
    const peek = mod({ run: (ctx) => void ctx.get('gut.leftBodyG') })
    expect(() => runModules([gut, peek], setup)).toThrow('gas: get gut.leftBodyG: not in needs')
  })

  it('get of a need nobody wrote yet throws', () => {
    const early = mod({ needs: ['gut.leftBodyG'], run: (ctx) => void ctx.get('gut.leftBodyG') })
    expect(() => runModules([early, gut], setup)).toThrow(/gas: get gut.leftBodyG: not written yet/)
  })

  it('put of an undeclared ID, a second put, a wrong length or a missing put throws', () => {
    expect(() => runModules([mod({ run: (ctx) => ctx.put('blood.glucose', fill()) })], setup)).toThrow(
      /gas: put blood.glucose: not in provides or internal/,
    )
    const twice = mod({
      internal: ['x.test.a'],
      run: (ctx) => {
        ctx.put('x.test.a', fill())
        ctx.put('x.test.a', fill())
      },
    })
    expect(() => runModules([twice], setup)).toThrow('gas: put x.test.a: twice')
    expect(() => runModules([mod({ internal: ['x.test.a'], run: (ctx) => ctx.put('x.test.a', new Float64Array(3)) })], setup)).toThrow(
      /3 values, not /,
    )
    expect(() => runModules([mod({ internal: ['x.test.a'] })], setup)).toThrow('gas: no put x.test.a')
  })

  it('a band goes with exactly the signals whose catalog row has one', () => {
    const noBand = mod({ provides: ['blood.glucose'], run: (ctx) => ctx.put('blood.glucose', fill()) })
    expect(() => runModules([noBand], setup)).toThrow(/put blood.glucose: band does not match/)
    const extra = mod({ provides: ['gut.leftBodyG'], run: (ctx) => ctx.put('gut.leftBodyG', fill(), { low: fill(), high: fill() }) })
    expect(() => runModules([extra], setup)).toThrow(/put gut.leftBodyG: band does not match/)
  })

  it('what get returns is read only (compile time)', () => {
    const write = mod({
      needs: ['gut.leftBodyG'],
      run: (ctx) => {
        // @ts-expect-error ctx.get gives another module's array to read, never to change.
        ctx.get('gut.leftBodyG')[0] = 1
      },
    })
    expect(write.needs).toHaveLength(1)
  })

  it('putMoment and putRhythm: declared IDs only, each once, and every declared one put', () => {
    const peak = mod({ moments: ['event.glucosePeak'], run: (ctx) => ctx.putMoment('event.glucosePeak', 42) })
    expect(runModules([peak], setup).moments.get('event.glucosePeak')).toMatchObject({ atMin: 42, meta: { id: 'event.glucosePeak' } })
    const ranged = mod({
      moments: ['event.firstLeftovers'],
      run: (ctx) => ctx.putMoment('event.firstLeftovers', 600, { low: 500, high: 900 }),
    })
    expect(runModules([ranged], setup).moments.get('event.firstLeftovers')).toMatchObject({ atMin: 600, low: 500, high: 900 })
    expect(() => runModules([mod({ run: (ctx) => ctx.putMoment('event.glucosePeak', 1) })], setup)).toThrow(
      'gas: putMoment event.glucosePeak: not declared',
    )
    const twice = mod({
      moments: ['event.glucosePeak'],
      run: (ctx) => {
        ctx.putMoment('event.glucosePeak', 1)
        ctx.putMoment('event.glucosePeak', 2)
      },
    })
    expect(() => runModules([twice], setup)).toThrow('gas: putMoment event.glucosePeak: twice')
    expect(() => runModules([mod({ moments: ['event.glucosePeak'] })], setup)).toThrow('gas: no putMoment event.glucosePeak')

    const beat = mod({ rhythms: ['energy.usedRate'], run: (ctx) => ctx.putRhythm('energy.usedRate', { restingPerMin: 66 }) })
    expect(runModules([beat], setup).rhythms.get('energy.usedRate')).toMatchObject({ restingPerMin: 66, meta: { id: 'energy.usedRate' } })
    expect(() => runModules([mod({ run: (ctx) => ctx.putRhythm('energy.usedRate', { restingPerMin: 1 }) })], setup)).toThrow(
      'gas: putRhythm energy.usedRate: not declared',
    )
    expect(() => runModules([mod({ rhythms: ['energy.usedRate'] })], setup)).toThrow('gas: no putRhythm energy.usedRate')
    // Two modules may not put the same moment or rhythm (one writer per ID).
    expect(
      moduleGraphErrors([
        { ...peak, id: 'gas' },
        { ...peak, id: 'lymph' },
      ]),
    ).toContain('event.glucosePeak: written by gas and lymph')
  })

  it('a run of today’s modules has no rhythms; its moments are the five from events.ts, activity’s two, circulation’s one, water’s two and lymph’s one', () => {
    const sim = simulate(meal, { particles: 0 })
    expect(sim.rhythms.size).toBe(0)
    expect(HUMAN_MODULES.flatMap((m) => m.rhythms ?? [])).toEqual([])
    expect(HUMAN_MODULES.flatMap((m) => m.moments ?? [])).toEqual([
      'event.activityStart',
      'event.activityEnd',
      'event.gutFlowPeak',
      'event.bladderFirstUrge',
      'event.halfMealWaterPassed',
      'event.triglyceridePeak',
    ])
    expect(sim.moments.size).toBe(11)
    // Resting: the activity moments do not happen.
    expect(sim.moments.get('event.activityStart')?.atMin).toBeNull()
    expect(sim.moments.get('event.activityEnd')?.atMin).toBeNull()
  })

  it('every module names the system that shows it', () => {
    for (const m of HUMAN_MODULES) expect(SYSTEM_IDS, m.id).toContain(m.system)
    expect(HUMAN_MODULES.map((m) => m.system)).toEqual([
      'digestion',
      'digestion',
      'digestion',
      'digestion',
      'breathing',
      'muscles',
      'circulation',
      'kidneys',
      'lymph',
    ])
  })
})

describe('no global PARAMS', () => {
  // The scan over every engine file (not only modules/), which also catches `params = PARAMS`
  // defaults, is in test/plumbing.test.ts (R58).
  const modulesDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/modules')

  it('no module file names PARAMS: modules read ctx.params only', () => {
    const files = readdirSync(modulesDir).filter((f) => f.endsWith('.ts'))
    expect(files.sort()).toEqual([
      'activity.ts',
      'bloodSugar.ts',
      'circulation.ts',
      'effort.ts',
      'energy.ts',
      'gas.ts',
      'gut.ts',
      'index.ts',
      'lymph.ts',
      'water.ts',
    ])
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
