import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ActiveSignalId, Simulation } from '@lifepeek/engine'
import { formatBand, formatSignal } from '../../lib/formatSignal.ts'
import { momentNameKey } from '../../lib/moments.ts'
import { stripDescription } from '../../lib/stripSummary.ts'
import { cellValue, momentRows, tableColumns, type TableColumn, tableTimes } from '../../lib/stripTable.ts'
import { formatDuration } from '../../lib/time.ts'
import { useRunStore } from '../../state/run.ts'
import { useStripTab } from '../../state/stripTab.ts'
import { Segmented } from '../kit/index.ts'
import type { Slot } from '../stage/GraphColumn.tsx'
import Sheet from '../stage/Sheet.tsx'
import { shortMealNames } from '../stage/mealText.ts'

/**
 * "Show as table" (G8, the text alternative of the graphs): one graph's numbers at fixed times
 * (lib/stripTable.ts), this meal beside the kept one and, where the graph draws it, how much
 * people differ; the graph's summary sentence as the caption; and the key moments of both meals,
 * the dock's markers as text. The graphs can be switched here as on the stage's tabs. Opened from
 * each graph's table button or with T; downloaded the first time (pages/Simulator.tsx).
 */
export default function StripTable({
  run,
  kept,
  slots,
  slot,
}: {
  run: Simulation
  kept: Simulation | null
  /** The lit layer's graphs (GraphColumn's slots). */
  slots: readonly Slot[]
  slot: string | null
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [picked, setPicked] = useState(slot)
  const current = slots.find((s) => s.id === picked) ?? slots[0]
  const meal = useRunStore((s) => s.meal)
  const keptItems = useRunStore((s) => s.kept?.items)
  const runName = shortMealNames(meal, lang)
  const keptName = keptItems ? shortMealNames(keptItems, lang) : ''

  const signals = (current?.signals ?? []) as ActiveSignalId[]
  const cols = current ? tableColumns(signals, run, kept) : []
  const two = signals.length > 1
  const header = (c: TableColumn) =>
    c.kind === 'range'
      ? t('table.range')
      : c.kind === 'kept'
        ? t('keep.tag', { meal: keptName })
        : two
          ? t(`${c.series.meta.i18nKey}.short`)
          : t('table.thisMeal', { meal: runName })
  const cell = (c: TableColumn, min: number) => {
    const v = cellValue(c, min, run.stepMin)
    return Array.isArray(v) ? formatBand(v[0], v[1], c.series.meta, t, lang) : formatSignal(v, c.series.meta, t, lang)
  }
  const graphName = (signals: readonly ActiveSignalId[]) =>
    signals.length > 1 ? t('stage.strips.energy') : t(`${run.signals.get(signals[0]!)?.meta.i18nKey}.name`)
  const moments = momentRows(run, kept)
  // "Half the energy has left…" for a meal with energy, "Half has left…" for water: when the two
  // meals would be named differently, the row takes the moment's plain catalog name.
  const momentName = (m: (typeof moments)[number]) => {
    const own = m.run && momentNameKey(m.id, run)
    const other = m.kept && kept && momentNameKey(m.id, kept)
    return own && other && own !== other ? `signals.${m.id}.name` : (own || other)!
  }
  const when = (m: { atMin: number; low?: number; high?: number } | undefined) =>
    !m
      ? t('signals.event.never')
      : m.low != null && m.high != null
        ? t('dock.usually', { time: formatDuration(m.atMin, t), low: formatDuration(m.low, t), high: formatDuration(m.high, t) })
        : formatDuration(m.atMin, t)

  const th = 'px-2 py-1.5 text-left align-bottom text-caption font-semibold text-ink-2'
  const td = 'tabular px-2 py-1.5 whitespace-nowrap'
  return (
    <Sheet title={t('table.title')} wide>
      {!current && <p className="text-ink-2">{t('stage.empty')}</p>}
      {slots.length > 1 && (
        <Segmented
          label={t('stage.graphs')}
          options={slots.map((s) => ({ id: s.id, label: t(`stage.strips.${s.id}`) }))}
          value={current?.id ?? ''}
          onChange={(id) => {
            setPicked(id)
            // The stage's tabs follow, so closing the table shows the same graph.
            useStripTab.getState().show(id)
          }}
          className="mb-3"
        />
      )}
      {current && (
        <div className="overflow-x-auto">
          <table data-strip-table={current.id} className="w-full border-collapse">
            <caption className="mb-2 text-left">
              <span className="block font-semibold">{graphName(signals)}</span>
              <span className="block max-w-[65ch] text-ink-2">{stripDescription(signals[0]!, run, kept, keptName, t, lang)}</span>
            </caption>
            <thead>
              <tr className="border-b-2 border-rule2">
                <th scope="col" className={th}>
                  {t('table.time')}
                </th>
                {cols.map((c, i) => (
                  <th key={i} scope="col" className={th}>
                    {header(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableTimes(run.horizonMin).map((min) => (
                <tr key={min} className="border-b border-rule2/60 last:border-0">
                  <th scope="row" className={`${td} text-left font-semibold`}>
                    {formatDuration(min, t)}
                  </th>
                  {cols.map((c, i) => (
                    <td key={i} className={`${td} ${c.kind === 'run' ? 'text-ink' : 'text-ink-2'}`}>
                      {cell(c, min)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {moments.length > 0 && (
        <div className="mt-5">
          <table data-moments-table="" className="w-full border-collapse">
            <caption className="mb-2 text-left font-semibold">{t('table.moments')}</caption>
            <thead>
              <tr className="border-b-2 border-rule2">
                <th scope="col" className={th}>
                  {t('table.moment')}
                </th>
                <th scope="col" className={th}>
                  {t('table.thisMeal', { meal: runName })}
                </th>
                {kept && (
                  <th scope="col" className={th}>
                    {t('keep.tag', { meal: keptName })}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {moments.map((m) => (
                <tr key={m.id} className="border-b border-rule2/60 last:border-0">
                  <th scope="row" className="px-2 py-1.5 text-left font-semibold">
                    {t(momentName(m))}
                  </th>
                  <td className="tabular px-2 py-1.5 text-ink">{when(m.run)}</td>
                  {kept && <td className="tabular px-2 py-1.5 text-ink-2">{when(m.kept)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sheet>
  )
}
