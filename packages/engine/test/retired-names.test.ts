import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { EVENTS, SIGNALS } from '../src/index.ts'

/**
 * Old plan names never come back. Every `retired` name in src/core/catalog.ts is banned as a
 * quoted string ('x', "x" or `x`) in the .ts/.tsx source of apps/ and packages/.
 * i18n JSON is not scanned: v1's `events.*` keys live there until WP-20.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.vite', 'test-results', 'playwright-report'])

/** Always skipped: the catalog lists the retired names, and this file names the exemptions. */
const ALWAYS_EXEMPT = ['packages/engine/src/core/catalog.ts', 'packages/engine/test/retired-names.test.ts']

/**
 * The v1 files that still use v1 keys such as 'events.peak', 'events.half', 'events.exit' and
 * 'events.absorbed'. WP-20 deletes these files and empties this list. Do NOT add new files here:
 * new code uses the catalog IDs.
 */
const V1_EXEMPT = [
  'apps/web/src/components/KeyMoments.tsx',
  'apps/web/src/components/Timeline.tsx',
  'apps/web/src/components/LessonView.tsx',
  'apps/web/src/components/StagePanel.tsx',
  'apps/web/src/components/Verdict.tsx',
  'apps/web/src/components/MealPicker.tsx',
  'apps/web/src/components/charts/SimCharts.tsx',
  'apps/web/src/components/charts/LineChart.tsx',
  'apps/web/src/lib/verdict.ts',
  'apps/web/src/lib/verdict.test.ts',
  'apps/web/src/state/sim.ts',
  'apps/web/src/hooks/useSimulation.ts',
  'apps/web/src/hooks/useUrlSync.ts',
  'apps/web/src/hooks/useClock.ts',
  'apps/web/src/pages/Simulator.tsx',
]

const RETIRED = [...Object.values(SIGNALS), ...Object.values(EVENTS)].flatMap((row) => row.retired)
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const RETIRED_RE = new RegExp(`(['"\`])(${RETIRED.map(escape).join('|')})\\1`, 'g')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) || e.name.startsWith('.') ? [] : sourceFiles(join(dir, e.name))
    return /\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts') ? [join(dir, e.name)] : []
  })
}

const rel = (file: string) => relative(ROOT, file).split('\\').join('/')
const files = ['apps', 'packages'].flatMap((d) => sourceFiles(join(ROOT, d)))

function findRetired(file: string): string[] {
  const hits: string[] = []
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(RETIRED_RE)) hits.push(`${rel(file)}:${i + 1}: ${m[0]}`)
    })
  return hits
}

describe('retired names', () => {
  it('the scan sees the source tree and the retired list', () => {
    expect(RETIRED.length).toBeGreaterThan(30)
    expect(files.map(rel)).toContain('packages/engine/src/simulate.ts')
    expect(files.map(rel)).toContain('apps/web/src/main.tsx')
  })

  it('every exempt file still exists (WP-20 removes the v1 entries when it deletes the files)', () => {
    for (const f of [...ALWAYS_EXEMPT, ...V1_EXEMPT]) expect(existsSync(join(ROOT, f)), f).toBe(true)
  })

  it('no quoted retired name appears outside the exempt files', () => {
    const exempt = new Set([...ALWAYS_EXEMPT, ...V1_EXEMPT])
    const hits = files.filter((f) => !exempt.has(rel(f))).flatMap(findRetired)
    expect(hits).toEqual([])
  })

  it('the scanner catches a quoted retired name (self-check on the catalog)', () => {
    expect(findRetired(join(ROOT, 'packages/engine/src/core/catalog.ts')).length).toBeGreaterThan(0)
  })
})
