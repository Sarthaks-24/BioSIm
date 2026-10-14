import { Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RunResult } from '@lifepeek/engine'
import i18n from '../i18n/index.ts'
import { useLinkSync } from '../hooks/useLinkSync.ts'
import { useProjector } from '../hooks/useProjector.ts'
import { loadEngine, runKey, useEngineState, useMomentsOnClock, useRun } from '../hooks/useRun.ts'
import { actionFor, keyBelongsToTarget, useKeys, type KeyAction } from '../lib/keys.ts'
import { HORIZON_MIN, formatDuration } from '../lib/time.ts'
import { boutMoments, hasPlan } from '../lib/moments.ts'
import { useClock, useMealClock } from '../state/clock.ts'
import { useRunStore } from '../state/run.ts'
import { useSheet } from '../state/sheet.ts'
import { useStripTab } from '../state/stripTab.ts'
import { systemOf, type GraphSlotDef } from '../systems/registry.ts'
import { useSystemUi } from '../systems/ui.ts'
import { Dock, IconButton, PlayButton, SettingsIcon } from '../components/kit/index.ts'
import BodyPane from '../components/stage/BodyPane.tsx'
import GraphColumn, { useSlots } from '../components/stage/GraphColumn.tsx'
import MealBar from '../components/stage/MealBar.tsx'
import Notes from '../components/stage/Notes.tsx'
import SummaryLine from '../components/stage/SummaryLine.tsx'
import Timeline from '../components/stage/Timeline.tsx'
import { planNames } from '../components/stage/boutText.ts'
import { announce, readOutSlot } from '../components/graphs/StripAnnouncer.tsx'
import { LoadBoundary, LoadFailed, LoadFailedBox, lazyWithRetry } from '../components/LoadBoundary.tsx'

/**
 * The sheets (table, keys) are downloaded the first time one is opened: they are not part of the
 * first paint (size budget). If they don't arrive, a small box says so (review 15, MED 2).
 */
const sheets = lazyWithRetry(() => import('../components/stage/Sheets.tsx'))

// The engine is not in the stage's first download (E-2): its download starts as soon as this page's
// code runs, before the stage's first render, and the stage draws once it is here (hooks/useRun.ts).
// Once only: if it does not arrive, the box in the body's place offers "Try again" (EngineWait).
void loadEngine()

/**
 * P keeps the meal, and says what happened (the button shows it; a screen reader hears it): the
 * meal kept, or why nothing was (no food yet, or this meal is already the one kept).
 */
function keep() {
  const { meal, profile, activity, kept } = useRunStore.getState()
  const t = i18n.t.bind(i18n)
  if (!meal.length && !activity.length) return announce(t('stage.empty'))
  if (kept && runKey(kept.items, kept.profile, kept.activity) === runKey(meal, profile, activity)) return announce(t('keep.already'))
  useRunStore.getState().keep()
  announce(t('keep.tag', { meal: planNames(meal, activity, i18n.language, t) }))
}

/**
 * 1, 2, 3 (and S, B, E: digestion's aliases, v3.0): show that graph of the lit system (where the
 * graphs show one at a time) and read its values out. A key for a graph the system lacks does nothing.
 */
const showSlot = (pick: (slots: readonly GraphSlotDef[]) => GraphSlotDef | undefined) => () => {
  const slot = pick(systemOf(useRunStore.getState().layer)?.slots ?? [])
  if (!slot) return
  useStripTab.getState().show(slot.id)
  readOutSlot(slot.id)
}
const byLetter = (letter: GraphSlotDef['letter']) => showSlot((slots) => slots.find((s) => s.letter === letter))

/** What each key of the map (lib/keys.ts) does on the stage. */
const ACTIONS: Record<KeyAction, () => void> = {
  back: () => useClock.getState().step(-10),
  forward: () => useClock.getState().step(10),
  backHour: () => useClock.getState().step(-60),
  forwardHour: () => useClock.getState().step(60),
  start: () => useClock.getState().step(-HORIZON_MIN),
  end: () => useClock.getState().step(HORIZON_MIN),
  nextMoment: () => useClock.getState().stepToMoment(1),
  prevMoment: () => useClock.getState().stepToMoment(-1),
  play: () => useClock.getState().toggle(),
  keep,
  table: () => useSheet.getState().open({ kind: 'table', slot: useStripTab.getState().tab }),
  help: () => useSheet.getState().open({ kind: 'help' }),
  slot1: showSlot((slots) => slots[0]),
  slot2: showSlot((slots) => slots[1]),
  slot3: showSlot((slots) => slots[2]),
  slotS: byLetter('s'),
  slotB: byLetter('b'),
  slotE: byLetter('e'),
}

/**
 * The one-screen stage (UI-1) at /sim: since WP-19 (built at the unlisted /next, which now redirects
 * here). WP-20 deleted v1's two-meal page and gave this one its file name.
 *
 * Four zones on one grid, rows `auto auto 1fr auto`: the meal bar (and its notes), then the body
 * beside the graph column, then the clock dock. From 1024 px up the columns are
 * `minmax(0,1.4fr) minmax(22rem,1fr)` and the grid is exactly the space the Layout leaves it, so
 * nothing scrolls on a laptop or a projector; the body takes what the other zones don't need.
 * On a phone the zones stack (plan-ui-ux §3.5): the body shares the first screen with one graph
 * and the dock, which is a grid row of its own, so it can never cover the body. The body's row
 * is `1fr` with the body pane's own minimum (its words and a 10 rem picture), so on a short phone
 * the stage grows past the screen instead of squeezing the body to nothing (FP-1, bug B1).
 * The phone's rows are in styles.css, and so is the short, wide window's layout (a phone on its
 * side, a laptop at 200 %: FP-2): the notes and the body down the left, the meal bar, graph and dock
 * on the right, nothing scrolling. On a small projector window the summary sits under the graph (FP-2).
 * The graphs and the dock's timeline share one x scale and one left and right edge (WP-12), so
 * the playhead on every graph stands straight above the timeline's thumb, like a chart recorder.
 */
export default function Simulator() {
  const { t } = useTranslation()
  const { run } = useRun('current')
  const { run: kept } = useRun('kept')
  useMealClock()
  useLinkSync()
  const ui = useSystemUi()
  // The lit system's moments and each bout's start and end (E-3b-ui), for a run with a meal or bouts.
  const moments = useMemo(() => (r: RunResult) => (hasPlan(r) ? [...ui.moments(r), ...boutMoments(r)] : []), [ui.moments])
  useMomentsOnClock(moments, run, kept)

  // The key map (lib/keys.ts): keyboard and presentation clicker. Keys a focused control uses
  // itself (typing, Space on a button, arrows on the slider) are left to it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || keyBelongsToTarget(e.target as Element, e.key)) return
      const action = actionFor(e, useKeys.getState().off)
      if (!action) return
      e.preventDefault()
      ACTIONS[action]()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // A sheet left open (the browser's Back while it showed) must not open again on the next
      // visit to the stage (review 15, MED 1).
      useSheet.setState({ sheet: null, from: null })
    }
  }, [])
  const sheet = useSheet((s) => s.sheet)
  const slots = useSlots(run)
  const [attempt, setAttempt] = useState(0)
  const short = useMedia(SHORT_PHONE)
  // A projector under 1280 px wide or 800 px tall (1024×768, 1366×768): the summary goes under the
  // graph, so the body has more of its column (FP-2, B12). At 1280×800 it fits under the body, and
  // the graph keeps its 250 px plot (WP-17).
  const narrow = useMedia(NARROW)
  const projector = useProjector() && narrow
  const [words, setWords] = useState<HTMLElement | null>(null)

  return (
    // --plot-gutter: the room left of every graph for its y labels. It equals the room left of the
    // dock's timeline (on a phone the Play button and its gap), so graphs and timeline share x.
    // A phone under 680 px tall: the stage is the first screen less the header (3 rem + its rule),
    // and the summary follows it. `data-stage` once the first run is drawn: until the engine is
    // here (E-2) only the meal bar shows, and EngineWait in the body's place.
    <>
      <div
        data-stage={run ? '' : undefined}
        className="grid flex-1 grid-cols-[minmax(0,1fr)] bg-surface-page max-lg:[@media(height<42.5rem)]:min-h-[calc(100dvh-3rem-1px)] [--plot-gutter:3.75rem] lg:min-h-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)] lg:grid-rows-[auto_auto_minmax(0,1fr)_auto] lg:[--plot-gutter:2.75rem]"
      >
        <h1 className="sr-only">{t('sim.title')}</h1>
        <div className="lg:col-span-2">
          <MealBar />
        </div>
        {/* The notes and the body: one column of a short, wide window (styles.css, FP-2); elsewhere two rows of the grid. */}
        <div className="contents">
          <div className="lg:col-span-2">{run && <Notes run={run} kept={kept} />}</div>
          {run ? <BodyPane run={run} kept={kept} summary={!short} summaryTo={projector ? words : null} /> : <EngineWait />}
        </div>
        {/*
         * On a phone the graph row has one height for every tab (so the body never jumps when the
         * tab changes), a share of the screen's height (styles.css). The body gets the rest of the
         * first screen, never less than its own minimum: under that the page scrolls (FP-1).
         */}
        <div className="flex min-h-0 [&>section]:flex-1">{run && <GraphColumn run={run} kept={kept} />}</div>
        {projector && <div ref={setWords} className="border-l border-border bg-surface-raised" />}
        {/* The dock shares the stage's two columns, so its timeline sits right under the graphs. */}
        <div className="lg:col-span-2 lg:grid lg:grid-cols-subgrid">
          {run && (
            <Dock label={t('stage.clock')} play={<Play />} clock={<ClockText />} tools={<Settings />}>
              <Timeline run={run} kept={kept} />
            </Dock>
          )}
        </div>
        {sheet && run && (
          <LoadBoundary
            key={attempt}
            onFail={sheets.reset}
            fallback={
              <LoadFailedBox attempt={attempt} onRetry={() => setAttempt((a) => a + 1)} onClose={() => useSheet.getState().close()} />
            }
          >
            <Suspense fallback={null}>
              <sheets.Component sheet={sheet} run={run} kept={kept} slots={slots} ui={ui} />
            </Suspense>
          </LoadBoundary>
        )}
      </div>
      {/*
       * A phone under 680 px tall: the summary sentence moves under the stage, just past the first
       * screen, which keeps the body, a graph and Play (FP-1). BodyPane leaves its own out then.
       * A short, wide window has no "past the first screen" (FP-2: it never scrolls), so there the
       * sentence is for screen readers only (styles.css); the Now line and the graph's legend say the same.
       */}
      {short && run && run.meal.items.length > 0 && <SummaryLine run={run} kept={kept} className="border-t border-border px-3 py-1.5" />}
    </>
  )
}

/** A phone under 680 px tall (FP-1): its stage is the first screen, the summary sentence past it. */
const SHORT_PHONE = '(max-width: 63.99rem) and (max-height: 42.49rem)'
/** A projector window too small for the summary under the body (FP-2). */
const NARROW = '(min-width: 64rem) and (max-width: 79.99rem), (min-width: 64rem) and (max-height: 49.99rem)'

/** Whether a media query matches; re-renders when that changes. */
function useMedia(query: string) {
  const [match, setMatch] = useState(() => matchMedia(query).matches)
  useEffect(() => {
    const mq = matchMedia(query)
    const update = () => setMatch(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return match
}

/** How long the engine may take before the stage says it is on its way (architecture §3.1). */
const WORKING_AFTER_MS = 300

/**
 * In the body's place until the engine is here (E-2): nothing for the first 300 ms (it usually
 * arrives sooner), then "Working it out…", said once by a screen reader. If it does not arrive,
 * the load-failure box with "Try again" (and, after a failed try, "Reload").
 */
function EngineWait() {
  const { t } = useTranslation()
  const { failed, attempts } = useEngineState()
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSlow(true), WORKING_AFTER_MS)
    return () => clearTimeout(id)
  }, [])
  return (
    <div data-engine-wait="" className="grid min-h-40 place-items-center p-4 text-center">
      {failed ? (
        <div className="max-w-[20rem]">
          <LoadFailed onRetry={() => void loadEngine()} attempt={attempts - 1} focus />
        </div>
      ) : (
        <p role="status" className="text-body text-ink-muted">
          {slow ? t('stage.working') : ''}
        </p>
      )}
    </div>
  )
}

/** "Keys and settings": the key list, and the switches for letter keys and motion (KeysHelp). */
function Settings() {
  const { t } = useTranslation()
  const keysOff = useKeys((s) => s.off)
  return (
    <IconButton
      icon={<SettingsIcon />}
      label={t('keys.button')}
      title={t('keys.button')}
      aria-haspopup="dialog"
      aria-keyshortcuts={keysOff ? undefined : '?'}
      onClick={() => useSheet.getState().open({ kind: 'help' })}
      // Words from 1280 px up; the icon alone (its name stays) where the dock is narrow.
      className="max-xl:w-11 max-xl:justify-center max-xl:px-0 lg:max-xl:w-9 [&>span]:max-xl:sr-only"
    />
  )
}

function Play() {
  const playing = useClock((s) => s.playing)
  return <PlayButton playing={playing} onToggle={() => useClock.getState().toggle()} />
}

/** The widest time the clock shows; its width is kept free so the timeline never shifts while playing. */
const WIDEST_MIN = 11 * 60 + 55

/** "1 h 30 min" + "after eating". Re-renders only when the rounded text changes (every 5 sim minutes). */
function ClockText() {
  const { t } = useTranslation()
  // "after eating" with a meal, "from the start" with a walk or run alone (ui-ux §4).
  const since = useRunStore((s) => (s.meal.length || !s.activity.length ? 'sim.afterEating' : 'sim.fromStart'))
  // The store calls this every frame while playing; the text is only made again when the whole
  // minute changes (formatDuration rounds to it first), not translated anew each frame.
  const text = useClock(
    useMemo(() => {
      let minute = NaN
      let text = ''
      return (s: { simMin: number }) => {
        const m = Math.round(s.simMin)
        if (m !== minute) [minute, text] = [m, formatDuration(m, t)]
        return text
      }
    }, [t]),
  )
  return (
    // Phones: "1 h 30 min after eating" on one line above the track. From 1024 px up the label
    // goes under the time, and the box keeps the widest time's width, so the track never shifts.
    <span className="flex items-baseline gap-2 leading-none lg:flex-col lg:items-start lg:gap-1">
      <span className="grid whitespace-nowrap">
        <span aria-hidden="true" className="invisible col-start-1 row-start-1 max-lg:hidden">
          {formatDuration(WIDEST_MIN, t)}
        </span>
        <span className="col-start-1 row-start-1">{text}</span>
      </span>
      <span className="text-caption font-semibold whitespace-nowrap text-ink-muted">{t(since)}</span>
    </span>
  )
}
