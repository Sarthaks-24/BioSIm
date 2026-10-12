import { useTranslation } from 'react-i18next'
import type { Range, Simulation } from '@lifepeek/engine'
import { mealLabel, presentMeals, type Sims } from '../state/sim.ts'
import { formatDuration } from '../lib/time.ts'
import { MEAL_COLOR } from '../lib/colors.ts'

/**
 * The comparison in numbers, in plain words. Stomach timings are in the verdict line and on the
 * timeline, so they aren't repeated here.
 */
export default function KeyMoments({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const keys = presentMeals(sims)
  if (keys.length === 0) return null

  const usually = (r: Range) => (
    <>
      {formatDuration(r.typical, t)}
      <span className="block text-xs font-normal whitespace-nowrap text-ink-2">
        {t('events.usually', { low: formatDuration(r.low, t), high: formatDuration(r.high, t) })}
      </span>
    </>
  )

  const rows: { label: string; hint?: string; cell: (s: Simulation) => React.ReactNode }[] = [
    {
      label: t('events.peak'),
      hint: t('events.peakHint'),
      cell: (s) =>
        s.events.glucosePeak ? (
          <>
            {t('events.peakValue', {
              low: Math.round(s.events.glucosePeak.riseMgDl.low),
              high: Math.round(s.events.glucosePeak.riseMgDl.high),
            })}
            <span className="block text-xs font-normal text-ink-2">
              {t('events.peakAt', { time: formatDuration(s.events.glucosePeak.timeMin, t) })}
            </span>
          </>
        ) : (
          t('events.none')
        ),
    },
    {
      label: t('events.absorbed'),
      cell: (s) =>
        s.events.noNutrients
          ? t('events.noNutrients')
          : s.events.absorptionMostlyDoneMin === null
            ? t('events.never')
            : formatDuration(s.events.absorptionMostlyDoneMin, t),
    },
    {
      label: t('events.colon'),
      cell: (s) => (s.events.halfLeftoversInColon ? usually(s.events.halfLeftoversInColon) : t('events.noLeftovers')),
    },
    {
      label: t('events.exit'),
      hint: t('events.exitHint'),
      cell: (s) => (s.events.firstExit ? usually(s.events.firstExit) : t('events.noLeftovers')),
    },
  ]

  return (
    <section aria-labelledby="moments-title">
      <h2 id="moments-title" className="mb-2 font-semibold">
        {t('events.title')}
      </h2>
      {/* Phones: one card per moment, label on top, A and B side by side (a table is too narrow, especially in Hindi). */}
      <ul className="tabular space-y-3 text-sm sm:hidden">
        {rows.map((r) => (
          <li key={r.label} className="border-b border-rule/60 pb-3">
            <p>
              {r.label}
              {r.hint && <span className="block text-xs text-ink-2">{r.hint}</span>}
            </p>
            <div className="mt-1 grid grid-cols-2 gap-3">
              {keys.map((k) => (
                <div key={k} className="min-w-0 font-semibold">
                  <span className="block text-xs font-extrabold" style={{ color: MEAL_COLOR[k] }}>
                    {mealLabel(k, t)}
                  </span>
                  {r.cell(sims[k])}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <table className="tabular hidden w-full text-sm sm:table">
        <thead>
          <tr className="border-b border-rule text-left">
            <th scope="col" className="py-1.5 pr-2 font-normal">
              <span className="sr-only">{t('events.title')}</span>
            </th>
            {keys.map((k) => (
              <th key={k} scope="col" className="py-1.5 pr-2 font-extrabold" style={{ color: MEAL_COLOR[k] }}>
                {mealLabel(k, t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-rule/60 align-top">
              <th scope="row" className="py-2 pr-3 text-left font-normal">
                {r.label}
                {r.hint && <span className="block text-xs text-ink-2">{r.hint}</span>}
              </th>
              {keys.map((k) => (
                <td key={k} className="py-2 pr-2 font-semibold">
                  {r.cell(sims[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
