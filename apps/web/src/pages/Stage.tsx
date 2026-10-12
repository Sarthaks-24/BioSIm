import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLinkSync } from '../hooks/useLinkSync.ts'
import { useMomentsOnClock, useRun } from '../hooks/useRun.ts'
import { formatDuration } from '../lib/time.ts'
import { useClock, useMealClock } from '../state/clock.ts'
import { Dock, PlayButton } from '../components/kit/index.ts'
import BodyPane from '../components/stage/BodyPane.tsx'
import GraphColumn from '../components/stage/GraphColumn.tsx'
import MealBar from '../components/stage/MealBar.tsx'
import Notes from '../components/stage/Notes.tsx'
import Scrubber from '../components/stage/Scrubber.tsx'

/**
 * The v2 one-screen stage (UI-1), at the unlisted /next until WP-19 swaps it in for /sim.
 *
 * Four zones on one grid, rows `auto auto 1fr auto`: the meal bar (and its notes), then the body
 * beside the graph column, then the clock dock. From 1024 px up the columns are
 * `minmax(0,1.4fr) minmax(22rem,1fr)` and the grid is exactly the space the Layout leaves it, so
 * nothing scrolls on a laptop or a projector; the body takes what the other zones don't need.
 * On a phone the zones stack (plan-ui-ux §3.5): the body shares the first screen with one graph
 * and the dock, which is a grid row of its own, so it can never cover the body.
 * The graphs and the dock's timeline share one x scale and one left and right edge (WP-12), so
 * the playhead on every graph stands straight above the timeline's thumb, like a chart recorder.
 */
export default function Stage() {
  const { t } = useTranslation()
  const run = useRun('current')
  const kept = useRun('kept')
  useMealClock()
  useLinkSync()
  useMomentsOnClock(run)

  // Space plays and pauses when focus is not on a control that uses it (as on v1 /sim).
  // The full key map (PageDown, K, P, T, ?) and its off-switch come in WP-15.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.code !== 'Space' || el.closest('input, select, textarea, button, a, [role="slider"], dialog, summary')) return
      e.preventDefault()
      useClock.getState().toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    // --plot-gutter: the room left of every graph for its y labels. It equals the room left of the
    // dock's timeline (on a phone the Play button and its gap), so graphs and timeline share x.
    <div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_minmax(0,1fr)_auto_auto] bg-paper2 [--plot-gutter:3.75rem] lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,1fr)] lg:grid-rows-[auto_auto_minmax(0,1fr)_auto] lg:[--plot-gutter:2.75rem]">
      <h1 className="sr-only">{t('sim.title')}</h1>
      <div className="lg:col-span-2">
        <MealBar />
      </div>
      <div className="lg:col-span-2">
        <Notes run={run} kept={kept} />
      </div>
      <BodyPane run={run} />
      {/*
       * On a phone the graph row has a fixed height, the same for every tab (so the body never
       * jumps when the tab changes), sized for the tallest: blood sugar with its medical note.
       * The body gets the rest of the first screen.
       */}
      <div className="flex min-h-0 max-lg:h-[15rem] [&>section]:flex-1">
        <GraphColumn run={run} kept={kept} />
      </div>
      {/* The dock shares the stage's two columns, so its timeline sits right under the graphs. */}
      <div className="lg:col-span-2 lg:grid lg:grid-cols-subgrid">
        <Dock label={t('stage.clock')} play={<Play />} clock={<ClockText />}>
          <Scrubber />
        </Dock>
      </div>
    </div>
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
  const text = useClock((s) => formatDuration(s.simMin, t))
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
      <span className="text-caption font-semibold whitespace-nowrap text-ink-2">{t('sim.afterEating')}</span>
    </span>
  )
}
