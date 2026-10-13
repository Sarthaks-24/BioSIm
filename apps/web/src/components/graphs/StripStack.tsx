import { useMemo, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActiveSignalId, ChartableSeries, ProfileId, Series, RunResult } from '@lifepeek/engine'
import type { Domain } from '../../lib/axis.ts'
import { formatNumber } from '../../lib/formatSignal.ts'
import { stripDescription } from '../../lib/stripSummary.ts'
import { useSheet } from '../../state/sheet.ts'
import type { GraphSlotDef, SystemUi } from '../../systems/registry.ts'
import { StatusTag, TableIcon } from '../kit/index.ts'
import MedicalNote from '../MedicalNote.tsx'
import HowWeKnow, { Say, Section } from './HowWeKnow.tsx'
import SignalStrip from './SignalStrip.tsx'
import { stripMarker } from './marks.ts'

/**
 * The stack of graphs (G1, G2): one column, one time axis; all of them read the same meal clock,
 * so their playheads move together. From 1024 px up each graph is three rows of one shared grid
 * (header, plot, footer, through `grid-rows-subgrid`), so every PLOT gets an equal share of the
 * height whatever its header or footer needs (blood sugar's medical note, a wrapped Hindi title).
 * `weights` are the plots' shares, one per graph (an empty frame can take less).
 * On a phone only one graph shows (tabs), and it takes the whole height.
 */
export default function StripStack({ weights, children }: { weights: readonly number[]; children: ReactNode }) {
  const rows = weights.map((w) => `auto minmax(0, ${w}fr) auto`).join(' ')
  return (
    <div
      className="flex min-h-0 flex-1 flex-col lg:grid lg:gap-y-4 lg:[grid-template-rows:var(--strip-rows)]"
      style={{ '--strip-rows': rows } as CSSProperties}
    >
      {children}
    </div>
  )
}

interface RunStripProps {
  /** The graph's slot (systems/registry.ts): its id (tab, table), its "How we know" limits, its ring labels. */
  slot: GraphSlotDef
  /** The lit system's sentence for a graph (its text alternative). */
  summarize: SystemUi['stripSummary']
  series: ChartableSeries
  run: RunResult
  kept: RunResult | null
  /** The meals' short names, for the legend. */
  runName: string
  keptName: string
  profile: ProfileId
  /** The y range, if the organism's registry overrides the catalog's. */
  range?: Domain
  /** A second line on the same axis (energy used at rest beside energy coming in). */
  second?: Series | null
  /** The graphs show one at a time, under tabs that name them. */
  tabbed?: boolean
  className?: string
}

/** A slot with no limits of its own. */
const NO_LIMITS: readonly string[] = []

/** The running total of each rate drawn as a graph, shown after its readout (energy, G6). */
const TOTAL_OF: Partial<Record<ActiveSignalId, ActiveSignalId>> = {
  'energy.inRate': 'energy.inTotal',
  'energy.usedRate': 'energy.usedTotal',
}

/**
 * One signal of this run as a graph, with what is particular to it: the moment ringed on its
 * line, the notes in its "How we know", and (blood sugar) the always-visible medical note.
 * Energy is two lines on one kcal/h axis: coming in (this meal) and used at rest (the same for
 * every meal), each with its running total; it is described, never scored (plan-graphs §3.8).
 */
export function RunStrip({
  slot,
  summarize,
  series,
  run,
  kept,
  runName,
  keptName,
  profile,
  range,
  second,
  tabbed,
  className,
}: RunStripProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  // The run's table holds only active signals.
  const id = series.meta.id as ActiveSignalId
  const glucose = id === 'blood.glucose'
  // Built once per run (and language), not per render: SignalStrip's paths, label placement and
  // playhead are memoised on these objects (verify-1 C10).
  const totals = useMemo(() => {
    const totalOf = (of: ActiveSignalId) => {
      const total = TOTAL_OF[of]
      return (total && run.signals.get(total)) || null
    }
    const runTotal = totalOf(id)
    return runTotal ? { run: runTotal, second: second ? totalOf(second.meta.id as ActiveSignalId) : null } : null
  }, [run, id, second])
  const title = second ? t('stage.strips.energy') : undefined
  // Beside a kept meal the ring's label names its meal ("Cola: half the energy has left the
  // stomach"): the ring is on this meal's line only, and the kept line's dot can sit right by it
  // (council round 2, C3).
  const marker = useMemo(() => {
    const ring = stripMarker(id, run)
    const value = ring && formatNumber(ring.value, series.meta, lang)
    return (
      ring && {
        atMin: ring.atMin,
        value: ring.value,
        label: kept ? t(slot.marks?.[ring.labelKey] ?? ring.labelKey, { meal: runName, value }) : t(ring.labelKey, { value }),
      }
    )
  }, [id, run, kept, runName, series, slot, t, lang])
  const secondLine = useMemo(() => second && { series: second, label: t('status.sameEveryMeal') }, [second, t])
  const clock = useMemo(() => ({ stepMin: run.stepMin, horizonMin: run.horizonMin }), [run.stepMin, run.horizonMin])

  // Read after the graph's name (aria-describedby) and above its table: this meal, then the kept one (G8).
  const description = useMemo(
    () => stripDescription(summarize, id, run, kept, keptName, t, lang),
    [summarize, id, run, kept, keptName, t, lang],
  )
  // Energy: the same sentence, shown at the top of "How we know" too (G6). Described, never scored.
  const summary = second ? summarize(id, run, t, lang) : null

  const notes = glucose ? (
    <>
      <Section title={t('graph.highestTitle')}>{t('graph.highestNote')}</Section>
      <Section title={t('signals.event.glucoseBackToBase.name')}>
        <Say k="limits.backToBase" />
      </Section>
    </>
  ) : id === 'gut.stomach.contentG' ? (
    <Section title={t('graph.halfTitle')}>{t('graph.halfNote')}</Section>
  ) : second ? (
    <>
      <p className="text-ink">{summary}</p>
      <Section title={t(`${second.meta.i18nKey}.name`)}>
        <span className="flex flex-col gap-1">
          <StatusTag status={second.meta.status} />
          <Say k={`${second.meta.i18nKey}.desc`} /> {second.meta.limitKey && <Say k={second.meta.limitKey} />}
        </span>
      </Section>
    </>
  ) : null

  return (
    <SignalStrip
      series={series}
      kept={kept?.signals.get(id) ?? null}
      runName={runName}
      keptName={keptName}
      marker={marker}
      className={className}
      range={range}
      second={secondLine}
      totals={totals}
      title={title}
      summary={description}
      tabbed={tabbed}
      clock={clock}
      info={
        <span className="flex items-center gap-0.5">
          <TableButton slot={slot.id} name={title ?? t(`${series.meta.i18nKey}.name`)} />
          <HowWeKnow
            meta={series.meta}
            title={title}
            sourceIds={second ? [...new Set([...series.sourceIds, ...second.sourceIds])] : series.sourceIds}
            profile={profile}
            notes={notes}
            // The slot's own limits (systems/digestion/def.ts): the steady emptying on every graph, and
            // on blood sugar that more of the same food stays up longer at the same highest point.
            limits={slot.limits ?? NO_LIMITS}
          />
        </span>
      }
      // Always visible next to the blood-sugar graph, not only in a panel (legal/medical-note.md).
      footer={glucose ? <MedicalNote text="graph" className="text-caption text-ink-muted" /> : undefined}
    />
  )
}

/**
 * "Show as table" (G8): the graph's numbers and key moments as a table, in a sheet that is
 * downloaded the first time one is opened (pages/Simulator.tsx). The T key opens it too.
 */
function TableButton({ slot, name }: { slot: string; name: string }) {
  const { t } = useTranslation()
  const label = t('table.showFor', { name })
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      onClick={() => useSheet.getState().open({ kind: 'table', slot })}
      // The size of the ⓘ beside it: 44 px to touch on a phone, 28 px in the header line from 1024 px up.
      className="-my-2 grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-sunk hover:text-ink lg:-my-1 lg:size-7"
    >
      <TableIcon />
    </button>
  )
}
