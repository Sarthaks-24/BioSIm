import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ActivityBout, MealItem, ProfileId, RunResult } from '@lifepeek/engine'
import type { WorkerRunner } from '@lifepeek/engine/run'
import { lookupFood } from '../data/foods.ts'
import { openEngineWorker } from '../lib/engineWorker.ts'
import { useRunStore } from '../state/run.ts'
import { useClock } from '../state/clock.ts'
import type { Moment } from '../lib/moments.ts'

/** A stable empty plan, so a selector without a kept run returns the same value each time. */
const NO_ACTIVITY: readonly ActivityBout[] = []

/** Dots for the body picture. Only the current run is drawn; the kept run is a ghost line (no dots). */
const CURRENT_PARTICLES = 56

/**
 * One run's inputs as a string, so equal runs reuse the result whatever the array identity. The
 * activity plan (in start order, as the store keeps it) is added only when there is one, so a
 * resting run's key is what it was before activity (E-3b-eng).
 */
export const runKey = (items: readonly MealItem[], profile: ProfileId, activity: readonly ActivityBout[] = []) =>
  `${profile}|${items.map((i) => `${i.foodId}:${i.servings}`).join(',')}` +
  (activity.length ? `|${activity.map((b) => `${b.kind}.${b.startMin}.${b.durMin}`).join(',')}` : '')

/** What the stage needs from the engine entry (`@lifepeek/engine/run`): the run, and the worker's page side (W-2). */
export type Engine = Pick<typeof import('@lifepeek/engine/run'), 'simulate' | 'connectWorker'>

/** How a run looks its foods up, and its dots: only the current run draws them. */
const optsFor = (which: 'current' | 'kept') => ({ lookup: lookupFood, particles: which === 'current' ? CURRENT_PARTICLES : 0 })

/** Whether the page's first run is done (the `lifepeek:first-run` mark, below). */
let firstRun = false

/**
 * The page's first run leaves a performance mark: the first-run gate (e2e/perf.spec.ts, R61)
 * measures from the engine file's request to it (fetch + parse + run).
 */
const ran = (run: RunResult) => {
  if (!firstRun) {
    firstRun = true
    performance.mark?.('lifepeek:first-run')
  }
  return run
}

/** Runs the model for one meal and activity plan here on the page, at once (tests; the stage's runs go through `runner`). */
export const computeRun = (
  engine: Engine,
  items: MealItem[],
  profile: ProfileId,
  which: 'current' | 'kept',
  activity: readonly ActivityBout[] = [],
): RunResult => ran(engine.simulate({ items, profile, activity }, optsFor(which)))

/**
 * The engine is not in the stage's first download (E-2, architecture §3.1): `/sim` starts a plain
 * `import()` of it when it mounts (`loadEngine`), so the download overlaps the first render, and
 * the stage draws once it is here. Files that only import this one for `runKey` (KeepButton,
 * tests) never load it.
 */
interface EngineState {
  engine: Engine | null
  /** The last load failed (offline before it was saved, a tab left open over a release). */
  failed: boolean
  /** Failed loads so far: after one, the failure box also offers Reload. */
  attempts: number
}
let state: EngineState = { engine: null, failed: false, attempts: 0 }
let loading: Promise<void> | null = null
/**
 * The engine worker (W-2, architecture §3.2), made once the engine is here: a later run goes to it
 * while the page keeps the old run on show, so a slow phone stays quick to answer. Until it says it
 * is ready, and for the rest of the session once it fails or goes quiet for 3 s, runs are made on
 * the page as before.
 */
let runner: WorkerRunner | null = null
const listeners = new Set<() => void>()
const setState = (next: Partial<EngineState>) => {
  state = { ...state, ...next }
  for (const l of listeners) l()
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => void listeners.delete(l)
}

/**
 * Starts loading the engine; again after a failure ("Try again"). `load` is for tests. A failed
 * file can also arrive as nothing: main.tsx cancels Vite's `vite:preloadError` to reload the page
 * once, and the import then resolves to undefined. That is a load failure too.
 */
export function loadEngine(load: () => Promise<Engine | undefined> = () => import('@lifepeek/engine/run')): Promise<void> {
  if (state.engine) return Promise.resolve()
  if (state.failed) setState({ failed: false })
  loading ??= load()
    .then((m) => {
      if (!m?.simulate) throw new Error('Loading chunk failed')
      runner ??= m.connectWorker(openEngineWorker)
      setState({ engine: m, failed: false })
    })
    .catch(() => {
      loading = null
      setState({ failed: true, attempts: state.attempts + 1 })
    })
  return loading
}

/** The engine's loading state now. */
export const engineState = (): EngineState => state

/** The engine's loading state, for the stage's "Working it out…" and load-failure box. */
export function useEngineState(): EngineState {
  return useSyncExternalStore(subscribe, engineState)
}

/** For tests: forget the loaded engine. */
export function resetEngineForTests() {
  state = { engine: null, failed: false, attempts: 0 }
  loading = null
  runner = null
}

/**
 * The current run or the kept run, recomputed only when its inputs change. This is the ONLY
 * place the stage runs the model. `run` is null until the engine has loaded (and the kept run is
 * null when nothing is kept); `pending` is true while the engine is still on its way.
 *
 * Each run goes to the engine worker (W-2) once it is ready; until then, and for the session once
 * it fails or does not answer within 3 s, it is made here on the page (connectWorker). The last
 * run stays on show until the next one comes (`working`), and only the latest inputs' run is shown.
 */
export function useRun(which: 'current' | 'kept'): { run: RunResult | null; pending: boolean; working: boolean } {
  const { engine, failed } = useEngineState()
  // Both selectors return values already in the store, so the component re-renders only when they change.
  const items = useRunStore((s) => (which === 'current' ? s.meal : (s.kept?.items ?? null)))
  const profile = useRunStore((s) => (which === 'current' ? s.profile : (s.kept?.profile ?? s.profile)))
  const activity = useRunStore((s) => (which === 'current' ? s.activity : (s.kept?.activity ?? NO_ACTIVITY)))
  const key = items ? runKey(items, profile, activity) : null
  const [shown, setShown] = useState<{ key?: string; run?: RunResult }>({})
  useEffect(() => {
    // Nothing kept: no old kept run to show when the next one is kept.
    if (!key) return setShown((s) => (s.run ? {} : s))
    if (!engine) return
    let latest = true
    runner!.run({ items: items!, profile, activity }, optsFor(which)).then(
      (run) => latest && setShown({ key, run: ran(run) }),
      // A run the engine refuses throws while the stage renders, as a run made at once would.
      (error: unknown) =>
        latest &&
        setShown(() => {
          throw error
        }),
    )
    return () => {
      latest = false
    }
  }, [engine, key]) // eslint-disable-line react-hooks/exhaustive-deps
  const run = (key && shown.run) || null
  return { run, pending: !engine && !failed, working: !!run && shown.key !== key }
}

/**
 * Hands the key moments to the meal clock, so "next / previous moment" (PageDown / PageUp, a
 * clicker) steps through every marker on the dock's timeline: this meal's and the kept meal's, in
 * time order, each time once. `moments` gives a run's moments (pages/Simulator.tsx: the lit system's,
 * SystemUi.moments, and each activity bout's start and end; none for a run with nothing in it).
 */
export function useMomentsOnClock(moments: (run: RunResult) => Moment[], run: RunResult | null, kept: RunResult | null = null) {
  useEffect(() => {
    const times = [run, kept].flatMap((sim) => (sim ? moments(sim).map((m) => m.atMin) : []))
    useClock.getState().setMoments(times)
  }, [moments, run, kept])
}
