import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_ORGANISM, type ChartableSeries, type RunResult } from '@lifepeek/engine'
import { useProjector } from '../../hooks/useProjector.ts'
import { ORGANISMS } from '../../registry/index.ts'
import { useRunStore } from '../../state/run.ts'
import { useStripTab } from '../../state/stripTab.ts'
import { systemOf, tabKey, type GraphSlotDef } from '../../systems/registry.ts'
import { useSystemUi } from '../../systems/ui.ts'
import { Segmented } from '../kit/index.ts'
import StripStack, { RunStrip } from '../graphs/StripStack.tsx'
import StripAnnouncer from '../graphs/StripAnnouncer.tsx'
import { shortPlanNames } from './boutText.ts'

/**
 * The lit system's graph slots (systems/registry.ts) that have a line to draw for this run: never an
 * empty frame. Each slot is one shared axis: a main line, and maybe a second (energy coming in and
 * used at rest, WP-13). Every slot's main line is a graph signal: registry.test checks it, so the
 * stage needs no catalog row to know it (W-1: the rows load with the run).
 */
export function useSlots(run: RunResult | null): readonly GraphSlotDef[] {
  const layer = useRunStore((s) => s.layer)
  return useMemo(() => (systemOf(layer)?.slots ?? []).filter((s) => !!run?.signals.has(s.signals[0])), [layer, run])
}

/**
 * Below this column height (in rem, so Hindi and projector sizes count), the graphs stacked would
 * leave each plot too short to read, so they show one at a time, picked by tabs, as on a phone.
 * Projector mode always shows one big graph at a time (WP-13 council; plan-graphs §3.5).
 */
const STACK_MIN_REM = 37.5

/**
 * True when the graphs show one at a time: on a phone, in projector mode, or when the column is
 * too short for all of them. The column's size comes from the stage grid (`contain: size`), never
 * from its content, so switching cannot change the size it is decided from. Projector mode and
 * Hindi change the root font size, so the column's height changes and this checks again.
 */
function useTabbed() {
  const ref = useRef<HTMLElement>(null)
  const projector = useProjector()
  const [short, setShort] = useState(true)
  useLayoutEffect(() => {
    const el = ref.current!
    const html = document.documentElement
    const ro = new ResizeObserver(() =>
      setShort(innerWidth < 1024 || el.clientHeight < STACK_MIN_REM * parseFloat(getComputedStyle(html).fontSize)),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, projector || short] as const
}

/**
 * The graph column (UI-1): the lit system's graphs, from the systems registry, beside the body. From
 * 1024 px up the slots are stacked and share the height; on a phone, on the projector and on a
 * short screen one shows at a time, picked by tabs. Stomach, blood sugar (WP-12) and energy
 * (WP-13, two lines on one axis) are live graphs; a slot with nothing to draw is left out.
 * The plots start `--plot-gutter` in from the column's edge, exactly where the dock's timeline
 * starts, so the playhead on every graph is straight above the timeline's thumb.
 */
export default function GraphColumn({ run, kept }: { run: RunResult; kept: RunResult | null }) {
  const { t, i18n } = useTranslation()
  const profile = useRunStore((s) => s.profile)
  const meal = useRunStore((s) => s.meal)
  const activity = useRunStore((s) => s.activity)
  const keptRun = useRunStore((s) => s.kept)
  const { organism } = ORGANISMS[DEFAULT_ORGANISM]
  const slots = useSlots(run)
  const { stripSummary, card: Card, note: Note } = useSystemUi()
  // The picked tab lives in a store, so the key map can switch it too (1–3, and S, B, E: lib/keys.ts).
  const tab = useStripTab((s) => s.tab)
  const [column, tabbed] = useTabbed()
  const shown = slots.some((s) => s.id === tab) ? tab : slots[0]?.id
  const visible = useMemo(() => (tabbed ? slots.filter((s) => s.id === shown) : slots), [tabbed, slots, shown])
  // The legend names both meals (council 2026-10-13): "— Cola 145 g   - - Kept: Cheeseburger + French fries 230 g".
  const runName = shortPlanNames(meal, activity, i18n.language, t)
  const keptName = keptRun ? shortPlanNames(keptRun.items, keptRun.activity, i18n.language, t) : ''

  return (
    <section
      ref={column}
      aria-labelledby="graphs-title"
      // Size and layout containment: the readouts change ~10 times a second while playing, and the
      // rest of the stage never needs to be laid out again for that (its size comes from the grid).
      className="flex min-h-0 flex-col gap-2 border-border bg-surface-raised px-3 py-2 [contain:size_layout] max-lg:border-t lg:gap-4 lg:border-l lg:px-4 lg:py-3 in-data-[contrast=high]:gap-2 in-data-[contrast=high]:py-2"
    >
      <h2 id="graphs-title" className="sr-only">
        {t('stage.graphs')}
      </h2>
      {/* A Drawing-only row (R11: lymph in v3.0) has no graphs: its card stands in their place. */}
      {Card && !slots.length && <Card />}
      {slots.length > 0 && (
        <>
          {tabbed && (
            <Segmented
              label={t('stage.graphs')}
              options={slots.map((s) => ({ id: s.id, label: t(tabKey(s)) }))}
              value={shown ?? ''}
              onChange={useStripTab.getState().show}
              // On the projector the tab is the graph's only title (the strip hides its own): title size,
              // from 640 px up. On a phone the three tabs keep their usual size, so none is cut (B10).
              className="sm:in-data-[contrast=high]:*:text-title"
            />
          )}
          <StripStack weights={visible.map(() => 1)}>
            {visible.map((slot) => {
              const [id, secondId] = slot.signals
              return (
                <RunStrip
                  key={slot.id}
                  slot={slot}
                  summarize={stripSummary}
                  series={run.signals.get(id) as ChartableSeries}
                  second={secondId ? run.signals.get(secondId) : null}
                  range={slot.range ?? organism.signalOverrides[id]?.displayRange}
                  note={Note && <Note slot={slot} />}
                  run={run}
                  kept={kept}
                  runName={runName}
                  keptName={keptName}
                  profile={profile}
                  tabbed={tabbed}
                  className="flex-1"
                />
              )
            })}
          </StripStack>
        </>
      )}
      {/* What the live region reads out when the clock stops: the lines on the graphs in view. */}
      <StripAnnouncer slots={slots} shown={visible} run={run} kept={kept} />
    </section>
  )
}
