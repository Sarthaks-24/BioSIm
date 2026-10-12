import { useTranslation } from 'react-i18next'
import type { Range, Simulation } from '@biosim/engine'
import type { MealKey } from '../state/sim.ts'
import { formatDuration } from '../lib/time.ts'
import { MEAL_COLOR } from '../lib/colors.ts'

/** The comparison in numbers: one row per moment, one column per meal. */
export default function KeyMoments({ sims }: { sims: Partial<Record<MealKey, Simulation>> }) {
  const { t } = useTranslation()
  const keys = (['a', 'b'] as const).filter((k) => sims[k] && sims[k]!.meal.items.length > 0)
  if (keys.length === 0) return null

  const dur = (m: number | null) => (m === null ? t('events.never') : formatDuration(m, t))
  const range = (r: Range) => (
    <>
      {formatDuration(r.typical, t)}
      <span className="block text-xs text-ink-2">
        {t('events.range', { low: formatDuration(r.low, t), high: formatDuration(r.high, t) })}
      </span>
    </>
  )

  const rows: { label: string; cell: (s: Simulation) => React.ReactNode }[] = [
    { label: t('events.half'), cell: (s) => dur(s.events.stomachHalfEmptyMin) },
    { label: t('events.mostly'), cell: (s) => dur(s.events.stomachMostlyEmptyMin) },
    {
      label: t('events.peak'),
      cell: (s) =>
        s.events.glucosePeak ? (
          <>
            {formatDuration(s.events.glucosePeak.timeMin, t)}
            <span className="block text-xs text-ink-2">
              {t('events.peakValue', {
                low: Math.round(s.events.glucosePeak.riseMgDl.low),
                high: Math.round(s.events.glucosePeak.riseMgDl.high),
              })}
            </span>
          </>
        ) : (
          t('events.none')
        ),
    },
    { label: t('events.absorbed'), cell: (s) => dur(s.events.absorptionMostlyDoneMin) },
    { label: t('events.colon'), cell: (s) => range(s.events.firstReachesColon) },
    { label: t('events.exit'), cell: (s) => range(s.events.firstExit) },
  ]

  return (
    <section aria-labelledby="moments-title">
      <h2 id="moments-title" className="mb-2 font-semibold">
        {t('events.title')}
      </h2>
      <table className="tabular w-full text-sm">
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="py-1.5 pr-2 font-normal text-ink-2">
              <span className="sr-only">{t('events.title')}</span>
            </th>
            {keys.map((k) => (
              <th key={k} scope="col" className="py-1.5 pr-2 font-extrabold" style={{ color: MEAL_COLOR[k] }}>
                {k === 'a' ? t('sim.mealA') : t('sim.mealB')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-rule/60 align-top">
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                {r.label}
              </th>
              {keys.map((k) => (
                <td key={k} className="py-2 pr-2 font-semibold">
                  {r.cell(sims[k]!)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
