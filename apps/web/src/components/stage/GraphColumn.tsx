import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_ORGANISM, SIGNALS, type ActiveSignalId } from '@lifepeek/engine'
import { ORGANISMS } from '../../registry/index.ts'
import { useRunStore } from '../../state/run.ts'
import { TIMELINE_TICKS, TIMELINE_TICKS_NARROW, timeToPos } from '../../lib/time.ts'
import { Segmented, StatusTag } from '../kit/index.ts'

/**
 * One graph slot: the signals drawn on one shared axis. Neighbouring signals of the same family
 * share a slot (energy in and energy used are one two-line graph, WP-13).
 */
interface Slot {
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

/**
 * The graph column (UI-1): the lit layer's graphs, from the registry, beside the body. In this
 * build each slot is an empty frame on graph paper, with its name, status and time axis; the
 * lines arrive in WP-12 (stomach, blood sugar) and WP-13 (energy). From 1024 px up the slots are
 * stacked and share the height; on a phone one shows at a time, picked by tabs.
 */
export default function GraphColumn() {
  const { t } = useTranslation()
  const layer = useRunStore((s) => s.layer)
  const system = ORGANISMS[DEFAULT_ORGANISM].systems.find((s) => s.id === layer)
  const slots = useMemo(() => slotsOf(system?.signals ?? []), [system])
  const [tab, setTab] = useState(slots[0]?.id ?? '')
  const shown = slots.some((s) => s.id === tab) ? tab : slots[0]?.id

  return (
    <section
      aria-labelledby="graphs-title"
      className="flex min-h-0 flex-col gap-2 border-rule2 bg-shelf px-3 py-2 max-lg:border-t lg:gap-4 lg:border-l lg:px-4 lg:py-3"
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
      {slots.map((slot, i) => (
        <GraphFrame key={slot.id} slot={slot} hours={i === slots.length - 1} className={slot.id === shown ? '' : 'max-lg:hidden'} />
      ))}
    </section>
  )
}

/** `hours`: this frame labels the shared time axis (the bottom one when stacked; on a phone every frame). */
function GraphFrame({ slot, hours, className }: { slot: Slot; hours: boolean; className: string }) {
  const { t } = useTranslation()
  return (
    <figure className={`flex min-h-0 flex-1 flex-col gap-1.5 ${className}`}>
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
      <GraphPaper hours={hours} />
    </figure>
  )
}

/**
 * Empty axes on graph paper: vertical rules at the timeline's ticks (same squeezed scale as the
 * dock), four horizontal rules. The stacked graphs share one time axis, so only the bottom one
 * labels the hours. Decorative until the lines arrive.
 */
function GraphPaper({ hours }: { hours: boolean }) {
  const { t } = useTranslation()
  return (
    <div aria-hidden="true" className="flex min-h-10 flex-1 flex-col">
      <div className="relative min-h-0 flex-1 border-b-2 border-l-2 border-ink-2/70">
        {[0.25, 0.5, 0.75].map((y) => (
          <span key={y} className="absolute inset-x-0 h-px bg-grid" style={{ top: `${y * 100}%` }} />
        ))}
        {TIMELINE_TICKS.slice(1).map((m) => (
          <span key={m} className="absolute inset-y-0 w-px bg-grid" style={{ left: `${timeToPos(m) * 100}%` }} />
        ))}
      </div>
      <div className={`relative h-5 shrink-0 ${hours ? '' : 'lg:hidden'}`}>
        {TIMELINE_TICKS_NARROW.map((m, i, all) => (
          <span
            key={m}
            className={`tabular absolute top-0.5 text-caption whitespace-nowrap text-ink-2 ${i === 0 ? '' : i === all.length - 1 ? '-translate-x-full' : '-translate-x-1/2'}`}
            style={{ left: `${timeToPos(m) * 100}%` }}
          >
            {t('units.hShort', { n: m / 60 })}
          </span>
        ))}
      </div>
    </div>
  )
}
