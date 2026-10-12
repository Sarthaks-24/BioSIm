import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { type ActiveSignalId, type ChartableSeries, type ProfileId, type Series, type Simulation } from '@lifepeek/engine'
import type { Domain } from '../../lib/axis.ts'
import { formatNumber } from '../../lib/formatSignal.ts'
import { KNEE_MIN, formatDuration } from '../../lib/time.ts'
import { StatusTag } from '../kit/index.ts'
import MedicalNote from '../MedicalNote.tsx'
import HowWeKnow, { Section } from './HowWeKnow.tsx'
import SignalStrip from './SignalStrip.tsx'
import { markedMoment } from './marks.ts'

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
  series: ChartableSeries
  run: Simulation
  kept: Simulation | null
  keptName: string
  profile: ProfileId
  /** The y range, if the organism's registry overrides the catalog's. */
  range?: Domain
  /** A second line on the same axis (energy used at rest beside energy coming in). */
  second?: Series | null
  className?: string
}

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
export function RunStrip({ series, run, kept, keptName, profile, range, second, className }: RunStripProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  // The run's table holds only active signals.
  const id = series.meta.id as ActiveSignalId
  const moment = markedMoment(id, run)
  const glucose = id === 'blood.glucose'
  const totalOf = (of: ActiveSignalId) => {
    const total = TOTAL_OF[of]
    return (total && run.signals.get(total)) || null
  }
  const runTotal = totalOf(id)
  const totals = runTotal && { run: runTotal, second: second ? totalOf(second.meta.id as ActiveSignalId) : null }
  const title = second ? t('stage.strips.energy') : undefined

  const marker = moment && {
    atMin: moment.atMin,
    label:
      moment.id === 'event.glucosePeak'
        ? t('graph.highest', { value: formatNumber(series.values[moment.atMin] ?? 0, series.meta, lang) })
        : t('graph.halfLeft'),
  }

  // Energy: what came in and what the resting body used in the first 6 h (the same window for
  // every meal, so two meals compare), then the G6 sentence: "When more comes in than is used,
  // the body stores the extra for later." Described, never scored.
  const summary =
    totals?.second &&
    t(`${series.meta.i18nKey}.summary`, {
      time: formatDuration(KNEE_MIN, t),
      in: formatNumber(totals.run.values[KNEE_MIN]!, totals.run.meta, lang),
      used: formatNumber(totals.second.values[KNEE_MIN]!, totals.second.meta, lang),
    })

  const notes = glucose ? (
    <>
      <Section title={t('graph.highestTitle')}>{t('graph.highestNote')}</Section>
      <Section title={t('signals.event.glucoseBackToBase.name')}>{t('limits.backToBase')}</Section>
    </>
  ) : id === 'gut.stomach.contentG' ? (
    <Section title={t('signals.event.stomachHalfEmpty.name')}>{t('graph.halfNote')}</Section>
  ) : second ? (
    <>
      <p className="text-ink">{summary}</p>
      <Section title={t(`${second.meta.i18nKey}.name`)}>
        <span className="flex flex-col gap-1">
          <StatusTag status={second.meta.status} />
          {t(`${second.meta.i18nKey}.desc`)} {second.meta.limitKey && t(second.meta.limitKey)}
        </span>
      </Section>
    </>
  ) : null

  return (
    <SignalStrip
      series={series}
      kept={kept?.signals.get(id) ?? null}
      keptName={keptName}
      marker={marker}
      className={className}
      range={range}
      second={second && { series: second, label: t('status.sameEveryMeal') }}
      totals={totals}
      title={title}
      summary={summary || undefined}
      info={
        <HowWeKnow
          meta={series.meta}
          title={title}
          sourceIds={second ? [...new Set([...series.sourceIds, ...second.sourceIds])] : series.sourceIds}
          profile={profile}
          notes={notes}
        />
      }
      // Always visible next to the blood-sugar graph, not only in a panel (legal/medical-note.md).
      footer={glucose ? <MedicalNote text="graph" className="text-caption text-ink-2" /> : undefined}
    />
  )
}
