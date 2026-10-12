/**
 * Golden coverage (A3): which catalog IDs are checked by which kind of test. Pure (no fs), so it
 * can be unit-tested; test/golden-scan.ts finds the calls and test/contract.test.ts applies it.
 *
 * Rules (plan-model M3):
 *   - every active 'simulated' signal and every event needs a `golden()` that names a source;
 *   - every active 'assumption' signal needs a `golden()` or a `pinned()`, and a limitKey;
 *   - IDs and sources named in tests must exist.
 */
import {
  EVENTS,
  EVENT_IDS,
  PROVIDES,
  SIGNALS,
  isActiveSignal,
  isEventId,
  isSignalId,
  type ActiveSignalId,
  type EventId,
} from './catalog.ts'
import type { OrganismId } from './organism.ts'
import { isRegisteredSource, sourceById } from './sources.ts'

/** One `golden(…)`, `golden.fails(…)` or `pinned(…)` call found in a test file. */
export interface GoldenCall {
  /** golden = checked against a published source · fails = known limit (it.fails) · pinned = behaviour pin, no source. */
  kind: 'golden' | 'fails' | 'pinned'
  ids: string[]
  sources: string[]
  file: string
  line: number
  title: string
}

export interface CoverageReport {
  /** Active simulated signals/events with no sourced `golden()` — contract test fails. */
  missingSourced: (ActiveSignalId | EventId)[]
  /** Active assumption signals with neither golden() nor pinned() — fails. */
  missingAny: ActiveSignalId[]
  /** Active assumption signals without limitKey — fails. */
  missingLimit: ActiveSignalId[]
  /** Not in SIGNALS/EVENTS — fails. */
  unknownIds: string[]
  /** Tests on reserved IDs — warning only (allowed while a bundle is being built). */
  reservedTested: string[]
  /** Not in SOURCES and not food:* — fails. */
  unknownSources: string[]
  /** `golden()` calls that name no source (titles) — fails: use pinned() instead. */
  unsourcedGolden: string[]
  /** 'toVerify' sources cited by an active signal or event — warning now, failure at the release gate (RELEASE_GATE=1). */
  toVerifySources: string[]
}

const isKnownSource = (id: string) => isRegisteredSource(id) || /^food:[a-z0-9-]+$/.test(id)
const uniqueSorted = (xs: Iterable<string>) => [...new Set(xs)].sort()

export function goldenCoverage(calls: readonly GoldenCall[], organism: OrganismId = 'human'): CoverageReport {
  const sourced = new Set<string>()
  const any = new Set<string>()
  const unknownIds: string[] = []
  const reservedTested: string[] = []
  const unknownSources: string[] = []
  const unsourcedGolden: string[] = []

  for (const c of calls) {
    for (const id of c.ids) {
      if (!isSignalId(id) && !isEventId(id)) unknownIds.push(id)
      else if (isSignalId(id) && !isActiveSignal(id)) reservedTested.push(id)
    }
    for (const s of c.sources) if (!isKnownSource(s)) unknownSources.push(s)
    const registered = c.sources.filter(isKnownSource)
    if (c.kind === 'golden' && registered.length === 0) unsourcedGolden.push(`${c.file}:${c.line} ${c.title}`)
    for (const id of c.ids) {
      any.add(id)
      if (c.kind === 'golden' && registered.length > 0) sourced.add(id)
    }
  }

  const provided = PROVIDES[organism]
  const simulated = provided.filter((id) => SIGNALS[id].status === 'simulated')
  const assumption = provided.filter((id) => SIGNALS[id].status === 'assumption')

  const cited = [...provided.flatMap((id) => SIGNALS[id].sourceIds), ...EVENT_IDS.flatMap((id) => EVENTS[id].sourceIds)]
  const toVerifySources = cited.filter((s) => sourceById(s)?.check === 'toVerify')

  return {
    missingSourced: [...simulated, ...EVENT_IDS].filter((id) => !sourced.has(id)),
    missingAny: assumption.filter((id) => !any.has(id)),
    missingLimit: assumption.filter((id) => !SIGNALS[id].limitKey),
    unknownIds: uniqueSorted(unknownIds),
    reservedTested: uniqueSorted(reservedTested),
    unknownSources: uniqueSorted(unknownSources),
    unsourcedGolden,
    toVerifySources: uniqueSorted(toVerifySources),
  }
}
