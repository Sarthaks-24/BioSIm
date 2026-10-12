import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActiveSignalId, ChartableSeries, ProfileId, Simulation } from '@lifepeek/engine'
import { formatNumber } from '../../lib/formatSignal.ts'
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
  className?: string
}

/**
 * One signal of this run as a graph, with what is particular to it: the moment ringed on its
 * line, the notes in its "How we know", and (blood sugar) the always-visible medical note.
 */
export function RunStrip({ series, run, kept, keptName, profile, className }: RunStripProps) {
  const { t, i18n } = useTranslation()
  // The run's table holds only active signals.
  const id = series.meta.id as ActiveSignalId
  const moment = markedMoment(id, run)
  const glucose = id === 'blood.glucose'

  const marker = moment && {
    atMin: moment.atMin,
    label:
      moment.id === 'event.glucosePeak'
        ? t('graph.highest', { value: formatNumber(series.values[moment.atMin] ?? 0, series.meta, i18n.language) })
        : t('graph.halfLeft'),
  }
  const notes = glucose ? (
    <>
      <Section title={t('graph.highestTitle')}>{t('graph.highestNote')}</Section>
      <Section title={t('signals.event.glucoseBackToBase.name')}>{t('limits.backToBase')}</Section>
    </>
  ) : id === 'gut.stomach.contentG' ? (
    <Section title={t('signals.event.stomachHalfEmpty.name')}>{t('graph.halfNote')}</Section>
  ) : null

  return (
    <SignalStrip
      series={series}
      kept={kept?.signals.get(id) ?? null}
      keptName={keptName}
      marker={marker}
      className={className}
      info={<HowWeKnow meta={series.meta} sourceIds={series.sourceIds} profile={profile} notes={notes} />}
      // Always visible next to the blood-sugar graph, not only in a panel (legal/medical-note.md).
      footer={glucose ? <MedicalNote text="graph" className="text-caption text-ink-2" /> : undefined}
    />
  )
}
