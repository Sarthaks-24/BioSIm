import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { STAGES, activeStage, type Simulation, type StageId } from '@biosim/engine'
import { useSim, type MealKey } from '../state/sim.ts'
import { MEAL_COLOR } from '../lib/colors.ts'

/**
 * The stages are a real sequence, so they are numbered. The panel follows the meal as time
 * moves, unless the user picks a stage to read.
 */
export default function StagePanel({ sims }: { sims: Partial<Record<MealKey, Simulation>> }) {
  const { t } = useTranslation()
  const time = useSim((s) => Math.round(s.time))
  const [picked, setPicked] = useState<StageId | null>(null)

  const where: Partial<Record<MealKey, StageId>> = {}
  for (const k of ['a', 'b'] as const) {
    const sim = sims[k]
    if (sim && sim.meal.items.length > 0) where[k] = activeStage(sim, time)
  }
  const following = where.a ?? where.b ?? 'mouth'
  const shown = picked ?? following

  return (
    <section aria-labelledby="stage-title" className="rounded-xl border border-rule bg-panel p-4">
      <ol className="mb-4 grid grid-cols-5 gap-1" aria-label={t('lesson.stage')}>
        {STAGES.map((s, i) => {
          const selected = s === shown
          return (
            <li key={s}>
              <button
                type="button"
                onClick={() => setPicked(s === picked ? null : s)}
                aria-pressed={selected}
                className={`flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-center text-[11px] leading-tight ${
                  selected ? 'bg-ink text-white' : 'hover:bg-sunk'
                }`}
              >
                <span className="tabular font-extrabold">{i + 1}</span>
                <span className="line-clamp-2">{t(`stages.${s}.name`).replace(/\s*\(.*\)/, '')}</span>
                <span className="flex h-3 gap-0.5" aria-hidden="true">
                  {(['a', 'b'] as const).map((k) =>
                    where[k] === s ? (
                      <span
                        key={k}
                        className="grid size-3 place-items-center rounded-full text-[8px] font-bold text-white"
                        style={{ background: MEAL_COLOR[k] }}
                      >
                        {k.toUpperCase()}
                      </span>
                    ) : null,
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <h2 id="stage-title" className="text-xl font-extrabold">
        {t(`stages.${shown}.name`)}
      </h2>
      <p className="mb-3 text-sm text-ink-2" aria-live="polite">
        {(['a', 'b'] as const)
          .filter((k) => where[k] === shown)
          .map((k) => (k === 'a' ? t('sim.mealA') : t('sim.mealB')))
          .join(' · ')}
      </p>

      <p className="mb-3 text-[15px] leading-relaxed">{t(`stages.${shown}.what`)}</p>
      <dl className="space-y-3 text-[15px] leading-relaxed">
        <div>
          <dt className="font-semibold">{t('lesson.chemistry')}</dt>
          <dd>{t(`stages.${shown}.chemistry`)}</dd>
        </div>
        <div>
          <dt className="font-semibold">{t('charts.absorbed')}</dt>
          <dd>{t(`stages.${shown}.absorbed`)}</dd>
        </div>
      </dl>
      <p className="mt-4 border-l-4 border-tissue pl-3 text-sm text-ink-2">{t(`stages.${shown}.fact`)}</p>

      {picked && (
        <button type="button" onClick={() => setPicked(null)} className="mt-3 text-sm font-semibold underline underline-offset-4">
          {t('sim.follow')}
        </button>
      )}
    </section>
  )
}
