import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_ORGANISM, SIGNALS, isChartable, type ActiveSignalId, type ChartableSeries, type Simulation } from '@lifepeek/engine'
import { useProjector } from '../../hooks/useProjector.ts'
import { ORGANISMS } from '../../registry/index.ts'
import { useRunStore } from '../../state/run.ts'
import { useStripTab } from '../../state/stripTab.ts'
import { Segmented } from '../kit/index.ts'
import StripStack, { RunStrip } from '../graphs/StripStack.tsx'
import StripAnnouncer from '../graphs/StripAnnouncer.tsx'
import { shortMealNames } from './mealText.ts'

/**
 * One graph slot: the signals drawn on one shared axis. Neighbouring signals of the same family
 * share a slot (energy in and energy used are one two-line graph, WP-13); the first is the main line.
 */
export interface Slot {
  /** The family ("gut", "blood", "energy"): the slot's id and its short tab name. */
  id: string
  signals: ActiveSignalId[]
}

export function slotsOf(signals: readonly ActiveSignalId[]): Slot[] {
  const slots: Slot[] = []
  for (const id of signals) {
    const family = id.split('.')[0]!
    const last = slots[slots.length - 1]
    if (last?.id === family) last.signals.push(id)
    else slots.push({ id: family, signals: [id] })
  }
  return slots
}

/** The lit layer's graph slots that have a line to draw for this run: never an empty frame. */
export function useSlots(run: Simulation): Slot[] {
  const layer = useRunStore((s) => s.layer)
  const system = ORGANISMS[DEFAULT_ORGANISM].systems.find((s) => s.id === layer)
  return useMemo(
    () => slotsOf(system?.signals ?? []).filter((s) => isChartable(SIGNALS[s.signals[0]!]) && run.signals.has(s.signals[0]!)),
    [system, run],
  )
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
 * The graph column (UI-1): the lit layer's graphs, from the registry, beside the body. From
 * 1024 px up the slots are stacked and share the height; on a phone, on the projector and on a
 * short screen one shows at a time, picked by tabs. Stomach, blood sugar (WP-12) and energy
 * (WP-13, two lines on one axis) are live graphs; a slot with nothing to draw is left out.
 * The plots start `--plot-gutter` in from the column's edge, exactly where the dock's timeline
 * starts, so the playhead on every graph is straight above the timeline's thumb.
 */
export default function GraphColumn({ run, kept }: { run: Simulation; kept: Simulation | null }) {
  const { t, i18n } = useTranslation()
  const profile = useRunStore((s) => s.profile)
  const meal = useRunStore((s) => s.meal)
  const keptItems = useRunStore((s) => s.kept?.items)
  const { organism } = ORGANISMS[DEFAULT_ORGANISM]
  const slots = useSlots(run)
  // The picked tab lives in a store, so the key map can switch it too (S, B, E: lib/keys.ts).
  const tab = useStripTab((s) => s.tab)
  const [column, tabbed] = useTabbed()
  const shown = slots.some((s) => s.id === tab) ? tab : slots[0]?.id
  const visible = useMemo(() => (tabbed ? slots.filter((s) => s.id === shown) : slots), [tabbed, slots, shown])
  // What the live region reads out when the clock stops: the lines on the graphs in view.
  const spoken = useMemo(() => visible.flatMap((s) => s.signals), [visible])
  // The legend names both meals (council 2026-10-13): "— Cola 145 g   - - Kept: Cheeseburger + French fries 230 g".
  const runName = shortMealNames(meal, i18n.language)
  const keptName = keptItems ? shortMealNames(keptItems, i18n.language) : ''

  return (
    <section
      ref={column}
      aria-labelledby="graphs-title"
      // Size and layout containment: the readouts change ~10 times a second while playing, and the
      // rest of the stage never needs to be laid out again for that (its size comes from the grid).
      className="flex min-h-0 flex-col gap-2 border-rule2 bg-shelf px-3 py-2 [contain:size_layout] max-lg:border-t lg:gap-4 lg:border-l lg:px-4 lg:py-3 in-data-[contrast=high]:gap-2 in-data-[contrast=high]:py-2"
    >
      <h2 id="graphs-title" className="sr-only">
        {t('stage.graphs')}
      </h2>
      {tabbed && (
        <Segmented
          label={t('stage.graphs')}
          options={slots.map((s) => ({ id: s.id, label: t(`stage.strips.${s.id}`) }))}
          value={shown ?? ''}
          onChange={useStripTab.getState().show}
          // On the projector the tab is the graph's only title (the strip hides its own): title size.
          className="in-data-[contrast=high]:*:text-title"
        />
      )}
      <StripStack weights={visible.map(() => 1)}>
        {visible.map((slot) => {
          const [id, secondId] = slot.signals as [ActiveSignalId, ActiveSignalId?]
          return (
            <RunStrip
              key={slot.id}
              slot={slot.id}
              series={run.signals.get(id) as ChartableSeries}
              second={secondId ? run.signals.get(secondId) : null}
              range={organism.signalOverrides[id]?.displayRange}
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
      <StripAnnouncer signals={spoken} run={run} kept={kept} />
    </section>
  )
}
