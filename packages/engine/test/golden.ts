import { it } from 'vitest'
import type { CatalogId } from '../src/core/catalog.ts'
import type { SourceId } from '../src/core/sources.ts'

/**
 * Test wrappers that tie a test to the catalog IDs it checks (A3). They only change the title;
 * the body is a normal vitest test. test/golden-scan.ts reads these calls from the source text
 * and test/contract.test.ts checks every active ID is covered, so:
 *   - write the IDs and sources as literals (a string or an array of strings), not variables;
 *   - write the title as a plain string.
 */

type Ids = CatalogId | readonly CatalogId[]
const list = (ids: Ids): readonly string[] => (typeof ids === 'string' ? [ids] : ids)
const titleOf = (ids: Ids, title: string, tail: string) => `[${list(ids).join(', ')}] ${title} (${tail})`

/** A physiology test checked against a published source. Title becomes "[blood.glucose] … (brouns2005)". */
function goldenTest(ids: Ids, sources: readonly SourceId[], title: string, fn: () => void | Promise<void>): void {
  it(titleOf(ids, title, sources.join(', ')), fn)
}

/** A known limit: the model does not meet the source yet. Passes while the assertion fails (plan-model M3). */
function goldenFails(ids: Ids, sources: readonly SourceId[], title: string, reason: string, fn: () => void): void {
  it.fails(titleOf(ids, `${title} — known limit: ${reason}`, sources.join(', ')), fn)
}

export const golden = Object.assign(goldenTest, { fails: goldenFails })

/** A behaviour pin with no external source (e.g. "water does not change glucose"). Counts for 'assumption' coverage only. */
export function pinned(ids: Ids, title: string, fn: () => void | Promise<void>): void {
  it(titleOf(ids, title, 'pinned'), fn)
}
