import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { PARAMS, PARAM_SOURCES, buildMeal } from '../src/index.ts'
import { HUMAN_PROVIDES, RUN_EVENT_IDS, simulate } from '../src/run.ts'
import { goldenCoverage, type GoldenCall } from '../src/core/coverage.ts'
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
 * Ratchet: the number of calls never goes down, so unwrapping a test (golden → plain it) fails here
 * even when other tests still cover its IDs. Raise these when you add tests.
 */
const AT_LEAST = { golden: 56, fails: 4, pinned: 37 }

describe('golden coverage', () => {
  it('the scan finds the wrapped physiology tests', () => {
    const count = (kind: GoldenCall['kind']) => calls.filter((c) => c.kind === kind).length
    expect(count('golden')).toBeGreaterThanOrEqual(AT_LEAST.golden)
    expect(count('fails')).toBeGreaterThanOrEqual(AT_LEAST.fails)
    expect(count('pinned')).toBeGreaterThanOrEqual(AT_LEAST.pinned)
    expect(calls.find((c) => c.title.startsWith('50 g glucose drink'))?.kind).toBe('golden')
  })

  it('every active simulated signal and every event has a sourced golden test', () => {
    expect(report.missingSourced).toEqual([])
  })

  it('every active assumption signal has a golden or pinned test, and a known-limit text', () => {
    expect(report.missingAny).toEqual([])
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

  it('signals = every active human signal, one value per minute', () => {
    expect([...sim.signals.keys()].sort()).toEqual([...HUMAN_PROVIDES].sort())
    for (const [id, s] of sim.signals) expect(s.values, id).toHaveLength(sim.length)
  })

  it('moments = every event, the packs’ included (S-4)', () => {
    expect([...sim.moments.keys()].sort()).toEqual([...RUN_EVENT_IDS].sort())
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
