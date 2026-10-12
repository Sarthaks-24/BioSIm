import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { PARAMS, indexAt, type Simulation } from '@biosim/engine'
import { useSim, type MealKey } from '../../state/sim.ts'
import { MEAL_COLOR } from '../../lib/colors.ts'
import LineChart, { type Series } from './LineChart.tsx'

type Sims = Partial<Record<MealKey, Simulation>>

const present = (sims: Sims) => (['a', 'b'] as const).filter((k) => sims[k] && sims[k]!.meal.items.length > 0)

export function StomachChart({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const time = useSim((s) => Math.round(s.time))
  const series = useMemo<Series[]>(
    () =>
      present(sims).map((k) => {
        const sim = sims[k]!
        const total = sim.meal.total.massG
        const values = Array.from({ length: sim.length }, (_, i) => ((sim.stomachLiquidG[i]! + sim.stomachSolidG[i]!) / total) * 100)
        return { key: k, label: k === 'a' ? t('sim.mealA') : t('sim.mealB'), color: MEAL_COLOR[k], values, dashed: k === 'b' }
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
      present(sims).map((k) => {
        const g = sims[k]!.glucose
        const rel = (arr: ArrayLike<number>) => Array.from(arr, (v) => v - fasting)
        return {
          key: k,
          label: k === 'a' ? t('sim.mealA') : t('sim.mealB'),
          color: MEAL_COLOR[k],
          values: rel(g.typical),
          low: rel(g.low),
          high: rel(g.high),
          dashed: k === 'b',
        }
      }),
    [sims, t, fasting],
  )
  const peak = Math.max(20, ...series.flatMap((s) => Array.from(s.high ?? [])).slice(0, 6 * 60))
  const yMax = Math.ceil(peak / 20) * 20
  const ticks = Array.from({ length: yMax / 20 + 1 }, (_, i) => i * 20)
  return (
    <LineChart
      title={t('charts.glucose')}
      description={t('charts.glucoseDesc')}
      series={series}
      xMaxMin={5 * 60}
      yMax={yMax}
      yTicks={ticks}
      yUnit=" mg/dL"
      cursorMin={time}
      xLabel={t('charts.hoursAxis')}
    />
  )
}

/** Stacked bar per meal: where everything that was eaten is right now. */
export function WhereChart({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const time = useSim((s) => Math.round(s.time))
  const parts = [
    { key: 'stomach', label: t('stages.stomach.name'), color: '#e0707f' },
    { key: 'small', label: t('stages.smallIntestine.name'), color: '#e7998a' },
    { key: 'large', label: t('stages.largeIntestine.name'), color: '#a9745f' },
    { key: 'absorbed', label: t('charts.absorbed'), color: '#14213d' },
  ] as const

  const rows = present(sims).map((k) => {
    const sim = sims[k]!
    const i = indexAt(sim, time)
    const m = sim.meal
    const tracked = (p: typeof m.total) => p.carbsG + p.proteinG + p.fatG + p.fiberG + p.waterG
    const stomach =
      (m.liquid.massG ? (sim.stomachLiquidG[i]! / m.liquid.massG) * tracked(m.liquid) : 0) +
      (m.solid.massG ? (sim.stomachSolidG[i]! / m.solid.massG) * tracked(m.solid) : 0)
    const absorbed = Object.values(sim.absorbedG).reduce((a, arr) => a + arr[i]!, 0)
    const values = { stomach, small: sim.smallIntestineG[i]!, large: sim.colonG[i]!, absorbed }
    const total = tracked(m.total) || 1
    return { k, values, total }
  })

  return (
    <figure>
      <figcaption className="mb-2">
        <span className="block font-semibold">{t('charts.where')}</span>
        <span className="block text-sm text-ink-2">{t('charts.whereDesc')}</span>
      </figcaption>
      <div className="space-y-2">
        {rows.map(({ k, values, total }) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-5 text-center text-sm font-extrabold" style={{ color: MEAL_COLOR[k] }}>
              {k.toUpperCase()}
            </span>
            <div
              className="flex h-6 flex-1 overflow-hidden rounded-md bg-sunk"
              role="img"
              aria-label={parts.map((p) => `${p.label} ${Math.round((values[p.key] / total) * 100)}%`).join(', ')}
            >
              {parts.map((p) => (
                <div key={p.key} style={{ width: `${(values[p.key] / total) * 100}%`, background: p.color }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
            {p.label.replace(/\s*\(.*\)/, '')}
          </li>
        ))}
      </ul>
    </figure>
  )
}
