import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PARAMS, indexAt, mealLocation, stomachFraction, type MealLocation } from '@lifepeek/engine'
import { useSim, mealLabel, presentMeals, type Sims } from '../../state/sim.ts'
import { INK, LEFT_BODY, MEAL_COLOR, ORGAN_COLOR } from '../../lib/colors.ts'
import LineChart, { type Series } from './LineChart.tsx'

export function StomachChart({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const time = useSim((s) => Math.round(s.time))
  const series = useMemo<Series[]>(
    () =>
      presentMeals(sims).map((k) => {
        const sim = sims[k]
        const values = Array.from({ length: sim.length }, (_, i) => stomachFraction(sim, i) * 100)
        return { key: k, label: mealLabel(k, t), color: MEAL_COLOR[k], values, dashed: k === 'b' }
      }),
    [sims, t],
  )
  return (
    <LineChart
      title={t('charts.stomach')}
      description={t('charts.stomachDesc')}
      series={series}
      xMaxMin={8 * 60}
      yMax={100}
      yTicks={[0, 25, 50, 75, 100]}
      yUnit="%"
      cursorMin={time}
      xLabel={t('charts.hoursAxis')}
    />
  )
}

export function GlucoseChart({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const time = useSim((s) => Math.round(s.time))
  const fasting = PARAMS.glucose.fastingMgDl
  const series = useMemo<Series[]>(
    () =>
      presentMeals(sims).map((k) => {
        const g = sims[k].glucose
        const rel = (arr: ArrayLike<number>) => Array.from(arr, (v) => v - fasting)
        return {
          key: k,
          label: mealLabel(k, t),
          color: MEAL_COLOR[k],
          values: rel(g.typical),
          low: rel(g.low),
          high: rel(g.high),
          dashed: k === 'b',
        }
      }),
    [sims, t, fasting],
  )
  // Show until both meals are back within +3 mg/dL (at least 5 h, at most 12 h), so nothing is cut off mid-curve.
  const settled = Math.max(
    ...series.map((s) => {
      let last = 0
      for (let i = 0; i < Math.min(s.values.length, 12 * 60); i++) if (s.values[i]! > 3) last = i
      return last
    }),
  )
  const xMax = Math.min(12, Math.max(5, Math.ceil((settled + 30) / 60))) * 60
  const peak = Math.max(20, ...series.flatMap((s) => Array.from(s.high ?? []).slice(0, xMax)))
  const yMax = Math.ceil(peak / 20) * 20
  const ticks = Array.from({ length: yMax / 20 + 1 }, (_, i) => i * 20)
  const chart = (
    <LineChart
      title={t('charts.glucose')}
      description={t('charts.glucoseDesc')}
      series={series}
      xMaxMin={xMax}
      yMax={yMax}
      yTicks={ticks}
      yUnit={t('charts.mgdlAxis')}
      cursorMin={time}
      xLabel={t('charts.hoursAxis')}
    />
  )
  return xMax > 5 * 60 ? (
    <div>
      {chart}
      <p className="mt-1 text-xs text-ink-2">{t('charts.glucoseTail')}</p>
    </div>
  ) : (
    chart
  )
}

/** Stacked bar per meal: where everything that was eaten is right now. Segments are labelled, not just coloured. */
export function WhereChart({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const time = useSim((s) => Math.round(s.time))
  const parts: { key: keyof Omit<MealLocation, 'total'>; label: string; color: string; dark: boolean }[] = [
    { key: 'stomach', label: t('stages.stomach.short'), color: ORGAN_COLOR.stomach, dark: true },
    { key: 'smallIntestine', label: t('stages.smallIntestine.short'), color: ORGAN_COLOR.smallIntestine, dark: false },
    { key: 'largeIntestine', label: t('stages.largeIntestine.short'), color: ORGAN_COLOR.largeIntestine, dark: true },
    { key: 'absorbed', label: t('charts.absorbed'), color: INK, dark: true },
    { key: 'leftBody', label: t('charts.leftBody'), color: LEFT_BODY, dark: false },
  ]

  return (
    <figure>
      <figcaption className="mb-2">
        <span className="block font-semibold">{t('charts.where')}</span>
        <span className="block text-sm text-ink-2">{t('charts.whereDesc')}</span>
      </figcaption>
      <div className="space-y-2">
        {presentMeals(sims).map((k) => {
          const loc = mealLocation(sims[k], indexAt(sims[k], time))
          const total = loc.total || 1
          return (
            <div key={k} className="flex items-center gap-2">
              <span className="w-5 text-center text-sm font-extrabold" style={{ color: MEAL_COLOR[k] }} aria-hidden="true">
                {k.toUpperCase()}
              </span>
              <div
                className="flex h-8 min-w-0 flex-1 overflow-hidden rounded-md bg-sunk"
                role="img"
                aria-label={`${mealLabel(k, t)}: ${parts.map((p) => `${p.label} ${Math.round((loc[p.key] / total) * 100)}%`).join(', ')}`}
              >
                {parts.map((p) => {
                  const pct = (loc[p.key] / total) * 100
                  return (
                    <div
                      key={p.key}
                      className={`flex items-center justify-center overflow-hidden text-xs font-semibold ${p.dark ? 'text-white' : 'text-ink'}`}
                      style={{ width: `${pct}%`, background: p.color }}
                    >
                      {pct >= 14 ? `${Math.round(pct)}%` : ''}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
            {p.label}
          </li>
        ))}
      </ul>
    </figure>
  )
}
