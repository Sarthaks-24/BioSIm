import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_ORGANISM, SIGNALS, isChartable, type ActiveSignalId, type ChartableSeries, type Simulation } from '@lifepeek/engine'
import { ORGANISMS } from '../../registry/index.ts'
import { useRunStore } from '../../state/run.ts'
import { HORIZON_MIN, KNEE_MIN, TIMELINE_TICKS, timeToPos } from '../../lib/time.ts'
import { Segmented, StatusTag } from '../kit/index.ts'
import StripStack, { RunStrip } from '../graphs/StripStack.tsx'
import { STRIP_ROWS } from '../graphs/layout.ts'
import { mealNames } from './mealText.ts'

/**
 * One graph slot: the signals drawn on one shared axis. Neighbouring signals of the same family
 * share a slot (energy in and energy used are one two-line graph, WP-13).
 */
export interface Slot {
  /** The family ("gut", "blood", "energy"): the slot's id and its short tab name. */
  id: string
  signals: ActiveSignalId[]
}

function slotsOf(signals: readonly ActiveSignalId[]): Slot[] {
  const slots: Slot[] = []
  for (const id of signals) {
    const family = id.split('.')[0]!
    const last = slots[slots.length - 1]
    if (last?.id === family) last.signals.push(id)
    else slots.push({ id: family, signals: [id] })
  }
  return slots
}

/** Signals drawn as live graphs so far. Energy (two lines on one axis) comes in WP-13. */
const LIVE: readonly ActiveSignalId[] = ['gut.stomach.contentG', 'blood.glucose']

/**
 * The graph column (UI-1): the lit layer's graphs, from the registry, beside the body. From
 * 1024 px up the slots are stacked and share the height; on a phone one shows at a time, picked
 * by tabs. Stomach and blood sugar are live graphs (WP-12); energy is still an empty frame.
 * The plots start `--plot-gutter` in from the column's edge, exactly where the dock's timeline
 * starts, so the playhead on every graph is straight above the timeline's thumb.
 */
export default function GraphColumn({ run, kept }: { run: Simulation; kept: Simulation | null }) {
  const { t, i18n } = useTranslation()
  const layer = useRunStore((s) => s.layer)
  const profile = useRunStore((s) => s.profile)
  const keptItems = useRunStore((s) => s.kept?.items)
  const system = ORGANISMS[DEFAULT_ORGANISM].systems.find((s) => s.id === layer)
  const slots = useMemo(() => slotsOf(system?.signals ?? []), [system])
  const [tab, setTab] = useState(slots[0]?.id ?? '')
  const shown = slots.some((s) => s.id === tab) ? tab : slots[0]?.id
  const keptName = keptItems ? mealNames(keptItems, i18n.language) : ''

  return (
    <section
      aria-labelledby="graphs-title"
      // Size and layout containment: the readouts change ~10 times a second while playing, and the
      // rest of the stage never needs to be laid out again for that (its size comes from the grid).
      className="flex min-h-0 flex-col gap-2 border-rule2 bg-shelf px-3 py-2 [contain:size_layout] max-lg:border-t lg:gap-4 lg:border-l lg:px-4 lg:py-3"
    >
      <h2 id="graphs-title" className="sr-only">
        {t('stage.graphs')}
      </h2>
      <div className="lg:hidden">
        <Segmented
          label={t('stage.graphs')}
          options={slots.map((s) => ({ id: s.id, label: t(`stage.strips.${s.id}`) }))}
          value={shown ?? ''}
          onChange={setTab}
        />
      </div>
      {/* An empty frame (energy, until WP-13) gets half a share, so the live graphs get the height. */}
      <StripStack weights={slots.map((s) => (LIVE.includes(s.signals[0]!) ? 1 : 0.5))}>
        {slots.map((slot) => {
          const className = `flex-1 ${slot.id === shown ? '' : 'max-lg:hidden'}`
          const id = slot.signals[0]!
          const series = run.signals.get(id)
          if (LIVE.includes(id) && series && isChartable(series.meta))
            return (
              <RunStrip
                key={slot.id}
                series={series as ChartableSeries}
                run={run}
                kept={kept}
                keptName={keptName}
                profile={profile}
                className={className}
              />
            )
          return <EmptyFrame key={slot.id} slot={slot} className={className} />
        })}
      </StripStack>
    </section>
  )
}

/** A slot whose lines are not drawn yet (energy, until WP-13): its names, status and graph paper. */
function EmptyFrame({ slot, className }: { slot: Slot; className: string }) {
  const { t } = useTranslation()
  return (
    <figure className={`flex min-h-0 flex-col gap-1.5 ${STRIP_ROWS} ${className}`}>
      <figcaption className="flex flex-col gap-0.5">
        {slot.signals.map((id, i) => (
          <span key={id} className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className={i === 0 ? 'text-control font-semibold text-ink' : 'text-caption font-semibold text-ink-2'}>
              {t(`${SIGNALS[id].i18nKey}.name`)}
            </span>
            <StatusTag status={SIGNALS[id].status} />
          </span>
        ))}
      </figcaption>
      <div aria-hidden="true" className="grid min-h-10 flex-1 grid-cols-[var(--plot-gutter)_minmax(0,1fr)]">
        <div className="border-r-2 border-ink-2/70" />
        <div className="relative border-b-2 border-ink-2/70">
          {[0.25, 0.5, 0.75].map((y) => (
            <span key={y} className="absolute inset-x-0 h-px bg-grid" style={{ top: `${y * 100}%` }} />
          ))}
          {TIMELINE_TICKS.filter((m) => m > 0 && m < HORIZON_MIN && m !== KNEE_MIN).map((m) => (
            <span key={m} className="absolute inset-y-0 w-px bg-grid" style={{ left: `${timeToPos(m) * 100}%` }} />
          ))}
          <span className="absolute inset-y-0 border-l-2 border-dotted border-ink-2/60" style={{ left: `${timeToPos(KNEE_MIN) * 100}%` }} />
        </div>
      </div>
    </figure>
  )
}
