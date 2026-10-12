import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EVENT_IDS, HUMAN_PROVIDES, PARAMS, PARAM_SOURCES, buildMeal, goldenCoverage, simulate, type GoldenCall } from '../src/index.ts'
import { parseGoldenCalls, scanGoldenCalls } from './golden-scan.ts'
import { lookup } from './fixtures.ts'

/**
 * The contract between the catalog and the tests (A3, plan-model M3):
 *   - every active 'simulated' signal and every event has a test that names a published source;
 *   - every active 'assumption' signal has a sourced or pinned test, and a known-limit text;
 *   - every ID and source a test names exists;
 *   - every number in PARAMS says what it rests on (PARAM_SOURCES).
 * The coverage rules live in src/core/coverage.ts; the calls are read from the test files' text.
 */

const calls = scanGoldenCalls(dirname(fileURLToPath(import.meta.url)))
const report = goldenCoverage(calls)

/**
 * Active signals the engine does not produce yet: they need the stated person (core/profile.ts).
 * WP-06 builds them with their golden tests and EMPTIES this list.
 */
const BUILT_IN_WP06 = ['energy.inRate', 'energy.inTotal', 'energy.usedRate', 'energy.usedTotal']

/**
 * Ratchet: the number of calls never goes down, so unwrapping a test (golden → plain it) fails here
 * even when other tests still cover its IDs. Raise these when you add tests.
 */
const AT_LEAST = { golden: 17, fails: 1, pinned: 7 }

describe('golden coverage', () => {
  it('the scan finds the wrapped physiology tests', () => {
    const count = (kind: GoldenCall['kind']) => calls.filter((c) => c.kind === kind).length
    expect(count('golden')).toBeGreaterThanOrEqual(AT_LEAST.golden)
    expect(count('fails')).toBeGreaterThanOrEqual(AT_LEAST.fails)
    expect(count('pinned')).toBeGreaterThanOrEqual(AT_LEAST.pinned)
    expect(calls.find((c) => c.title.startsWith('50 g glucose drink'))?.kind).toBe('golden')
  })

  it('every active simulated signal and every event has a sourced golden test', () => {
    expect(report.missingSourced.filter((id) => !BUILT_IN_WP06.includes(id))).toEqual([])
  })

  it('every active assumption signal has a golden or pinned test, and a known-limit text', () => {
    expect(report.missingAny.filter((id) => !BUILT_IN_WP06.includes(id))).toEqual([])
    expect(report.missingLimit).toEqual([])
  })

  it('tests name only known IDs and sources, and every golden names a source', () => {
    expect(report.unknownIds).toEqual([])
    expect(report.unknownSources).toEqual([])
    expect(report.unsourcedGolden).toEqual([])
  })

  it('warnings: tests on reserved IDs, toVerify sources (fail at the release gate)', () => {
    if (report.reservedTested.length) console.warn('golden tests on reserved IDs:', report.reservedTested)
    if (report.toVerifySources.length) console.warn('sources still to verify before release:', report.toVerifySources)
    if (process.env.RELEASE_GATE) expect(report.toVerifySources).toEqual([])
  })
})

describe('what the engine produces', () => {
  const sim = simulate(buildMeal([{ foodId: 'standard-meal', servings: 1 }], lookup))

  it('signals = every active human signal except those WP-06 builds', () => {
    expect([...sim.signals.keys()].sort()).toEqual(HUMAN_PROVIDES.filter((id) => !BUILT_IN_WP06.includes(id)).sort())
  })

  it('the WP-06 list is exactly what is not built and not covered (empty it when WP-06 lands)', () => {
    const notBuilt = HUMAN_PROVIDES.filter((id) => !sim.signals.has(id))
    expect(notBuilt).toEqual(BUILT_IN_WP06)
    expect([...report.missingSourced, ...report.missingAny].sort()).toEqual([...BUILT_IN_WP06].sort())
  })

  it('moments = every event', () => {
    expect([...sim.moments.keys()].sort()).toEqual([...EVENT_IDS].sort())
  })

  it('every number in PARAMS has a PARAM_SOURCES line', () => {
    const leaves = (o: object, path: string[] = []): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'number' ? [[...path, k].join('.')] : leaves(v as object, [...path, k])))
    expect(leaves(PARAMS).filter((p) => !(p in PARAM_SOURCES))).toEqual([])
  })
})

describe('the coverage check itself', () => {
  const call = (kind: GoldenCall['kind'], ids: string[], sources: string[] = []): GoldenCall => ({
    kind,
    ids,
    sources,
    file: 'x.test.ts',
    line: 1,
    title: 't',
  })
  const realGoldens = calls.filter((c) => c.kind === 'golden')

  it('an ID loses coverage when its only golden test becomes plain or pinned', () => {
    const without = calls.filter((c) => !c.ids.includes('event.glucoseBackToBase') || c.kind !== 'golden')
    expect(goldenCoverage(without).missingSourced).toContain('event.glucoseBackToBase')
    const pinnedInstead = [...without, call('pinned', ['event.glucoseBackToBase'])]
    expect(goldenCoverage(pinnedInstead).missingSourced).toContain('event.glucoseBackToBase')
  })

  it('flags unknown IDs and sources, empty goldens and reserved IDs', () => {
    const r = goldenCoverage([
      ...realGoldens,
      call('golden', ['blood.sugar'], ['ada2001']),
      call('golden', ['blood.glucose'], ['smith1999', 'food:cola']),
      call('golden', ['blood.glucose'], []),
      call('pinned', ['blood.insulin']),
    ])
    expect(r.unknownIds).toEqual(['blood.sugar'])
    expect(r.unknownSources).toEqual(['smith1999'])
    expect(r.unsourcedGolden).toHaveLength(1)
    expect(r.reservedTested).toEqual(['blood.insulin'])
  })

  it('known limits (golden.fails) do not count as sourced coverage', () => {
    expect(goldenCoverage([call('fails', ['event.glucosePeak'], ['freckmann2007'])]).missingSourced).toContain('event.glucosePeak')
  })

  it('the scanner reads multi-line calls and refuses calls it cannot read', () => {
    const fn = ['gol', 'den'].join('')
    const text = [
      `${fn}(`,
      `  ['blood.glucose', 'event.glucosePeak'],`,
      `  ['freckmann2007'],`,
      `  'a title',`,
      `  () => {},`,
      `)`,
      `${fn}.fails('blood.glucose', ["ada2001"], "t2", 'why', () => {})`,
      `pinned('gut.leftBodyG', \`t3\`, () => {})`,
      `export function ${fn}(ids, sources, title, fn) {}`,
    ].join('\n')
    const parsed = parseGoldenCalls(text, 'demo.ts')
    expect(parsed.map((c) => [c.kind, c.ids, c.sources, c.title, c.line])).toEqual([
      ['golden', ['blood.glucose', 'event.glucosePeak'], ['freckmann2007'], 'a title', 1],
      ['fails', ['blood.glucose'], ['ada2001'], 't2', 7],
      ['pinned', ['gut.leftBodyG'], [], 't3', 8],
    ])
    expect(() => parseGoldenCalls(`${fn}(IDS, ['ada2001'], 'x', () => {})`, 'bad.ts')).toThrow(/bad\.ts:1/)
  })
})
