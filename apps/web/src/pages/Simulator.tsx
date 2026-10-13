import { Suspense, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '../i18n/index.ts'
import { useLinkSync } from '../hooks/useLinkSync.ts'
import { runKey, useMomentsOnClock, useRun } from '../hooks/useRun.ts'
import { actionFor, keyBelongsToTarget, useKeys, type KeyAction } from '../lib/keys.ts'
import { HORIZON_MIN, formatDuration } from '../lib/time.ts'
import { useClock, useMealClock } from '../state/clock.ts'
import { useRunStore } from '../state/run.ts'
import { useSheet } from '../state/sheet.ts'
import { useStripTab } from '../state/stripTab.ts'
import { Dock, IconButton, PlayButton, SettingsIcon } from '../components/kit/index.ts'
import BodyPane from '../components/stage/BodyPane.tsx'
import GraphColumn, { useSlots } from '../components/stage/GraphColumn.tsx'
import MealBar from '../components/stage/MealBar.tsx'
import Notes from '../components/stage/Notes.tsx'
import SummaryLine from '../components/stage/SummaryLine.tsx'
import Timeline from '../components/stage/Timeline.tsx'
import { mealNames } from '../components/stage/mealText.ts'
import { announce, readOutSlot } from '../components/graphs/StripAnnouncer.tsx'
import { LoadBoundary, LoadFailedBox, lazyWithRetry } from '../components/LoadBoundary.tsx'

/**
 * The sheets (table, keys) are downloaded the first time one is opened: they are not part of the
 * first paint (size budget). If they don't arrive, a small box says so (review 15, MED 2).
 */
const sheets = lazyWithRetry(() => import('../components/stage/Sheets.tsx'))

/**
 * P keeps the meal, and says what happened (the button shows it; a screen reader hears it): the
 * meal kept, or why nothing was (no food yet, or this meal is already the one kept).
 */
function keep() {
  const { meal, profile, kept } = useRunStore.getState()
  const t = i18n.t.bind(i18n)
  if (!meal.length) return announce(t('stage.empty'))
  if (kept && runKey(kept.items, kept.profile) === runKey(meal, profile)) return announce(t('keep.already'))
  useRunStore.getState().keep()
  announce(t('keep.tag', { meal: mealNames(meal, i18n.language) }))
}

/** S, B, E: show that graph (where they show one at a time) and read its values out. */
const showStrip = (slot: string) => () => {
  useStripTab.getState().show(slot)
  readOutSlot(slot)
}

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
  stripGut: showStrip('gut'),
  stripBlood: showStrip('blood'),
  stripEnergy: showStrip('energy'),
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
 * The phone's rows are in styles.css.
 * The graphs and the dock's timeline share one x scale and one left and right edge (WP-12), so
 * the playhead on every graph stands straight above the timeline's thumb, like a chart recorder.
 */
export default function Simulator() {
  const { t } = useTranslation()
  const run = useRun('current')
  const kept = useRun('kept')
  useMealClock()
  useLinkSync()
  useMomentsOnClock(run, kept)

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

  return (
    // --plot-gutter: the room left of every graph for its y labels. It equals the room left of the
    // dock's timeline (on a phone the Play button and its gap), so graphs and timeline share x.
    // A phone under 680 px tall: the stage is the first screen less the header (3 rem + its rule),
    // and the summary follows it.
    <>
      <div
        data-stage=""
        className="grid flex-1 grid-cols-[minmax(0,1fr)] bg-surface-page max-lg:[@media(height<42.5rem)]:min-h-[calc(100dvh-3rem-1px)] [--plot-gutter:3.75rem] lg:min-h-0 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)] lg:grid-rows-[auto_auto_minmax(0,1fr)_auto] lg:[--plot-gutter:2.75rem]"
      >
        <h1 className="sr-only">{t('sim.title')}</h1>
        <div className="lg:col-span-2">
          <MealBar />
        </div>
        <div className="lg:col-span-2">
          <Notes run={run} kept={kept} />
        </div>
        <BodyPane run={run} kept={kept} />
        {/*
         * On a phone the graph row has one height for every tab (so the body never jumps when the
         * tab changes), a share of the screen's height (styles.css). The body gets the rest of the
         * first screen, never less than its own minimum: under that the page scrolls (FP-1).
         */}
        <div className="flex min-h-0 [&>section]:flex-1">
          <GraphColumn run={run} kept={kept} />
        </div>
        {/* The dock shares the stage's two columns, so its timeline sits right under the graphs. */}
        <div className="lg:col-span-2 lg:grid lg:grid-cols-subgrid">
          <Dock label={t('stage.clock')} play={<Play />} clock={<ClockText />} tools={<Settings />}>
            <Timeline run={run} kept={kept} />
          </Dock>
        </div>
        {sheet && (
          <LoadBoundary
            key={attempt}
            onFail={sheets.reset}
            fallback={
              <LoadFailedBox attempt={attempt} onRetry={() => setAttempt((a) => a + 1)} onClose={() => useSheet.getState().close()} />
            }
          >
            <Suspense fallback={null}>
              <sheets.Component sheet={sheet} run={run} kept={kept} slots={slots} />
            </Suspense>
          </LoadBoundary>
        )}
      </div>
      {/*
       * A phone under 680 px tall: the summary sentence moves under the stage, just past the first
       * screen, which keeps the body, a graph and Play (FP-1). BodyPane hides its own there.
       */}
      {run.meal.items.length > 0 && (
        <div className="hidden max-lg:[@media(height<42.5rem)]:block">
          <SummaryLine run={run} kept={kept} className="border-t border-border px-3 py-1.5" />
        </div>
      )}
    </>
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
      <span className="text-caption font-semibold whitespace-nowrap text-ink-muted">{t('sim.afterEating')}</span>
    </span>
  )
}
