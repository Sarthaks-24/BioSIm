import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { STAGES, activeStage, type StageId } from '@lifepeek/engine'
import { useSim, mealLabel, presentMeals, type MealKey, type Sims } from '../state/sim.ts'
import { MEAL_COLOR } from '../lib/colors.ts'

/**
 * Where each meal is, and what that organ does. Follows meal A by default; the status line shows
 * where meal B is (often somewhere else — that's the comparison) and lets you switch.
 */
export default function StagePanel({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const time = useSim((s) => Math.round(s.time))
  const [picked, setPicked] = useState<StageId | null>(null)
  const [follow, setFollow] = useState<MealKey>('a')

  const keys = presentMeals(sims)
  const where: Partial<Record<MealKey, StageId>> = {}
  for (const k of keys) where[k] = activeStage(sims[k], time)
  const followed = keys.includes(follow) ? follow : (keys[0] ?? 'a')
  const shown = picked ?? where[followed] ?? 'mouth'

  return (
    <section aria-labelledby="stage-title" className="rounded-xl border border-rule bg-panel p-4">
      <ol className="mb-3 grid grid-cols-5 gap-1" aria-label={t('lesson.stage')}>
        {STAGES.map((s, i) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => setPicked(s === picked ? null : s)}
              aria-current={s === shown ? 'step' : undefined}
              className={`flex w-full flex-col items-center gap-1 rounded-lg px-0.5 py-2 text-center text-xs leading-tight ${
                s === shown ? 'bg-ink text-white' : 'hover:bg-sunk'
              }`}
            >
              <span className="tabular font-extrabold">{i + 1}</span>
              <span className="line-clamp-2">{t(`stages.${s}.short`)}</span>
              <span className="flex h-4 gap-0.5">
                {keys.map((k) =>
                  where[k] === s ? (
                    <span
                      key={k}
                      className="grid size-4 place-items-center rounded-full text-[0.625rem] font-bold text-white"
                      style={{ background: MEAL_COLOR[k] }}
                    >
                      <span aria-hidden="true">{k.toUpperCase()}</span>
                      <span className="sr-only">{t('sim.isHere', { meal: mealLabel(k, t) })}</span>
                    </span>
                  ) : null,
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {keys.length > 0 && (
        <p className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-sm" aria-live="polite">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setFollow(k)
                setPicked(null)
              }}
              aria-pressed={picked === null && followed === k}
              className={`rounded-full px-2 py-0.5 font-semibold ${picked === null && followed === k ? 'bg-sunk' : 'hover:bg-sunk'}`}
              style={{ color: MEAL_COLOR[k] }}
            >
              {t('sim.mealIsIn', { meal: mealLabel(k, t), stage: t(`stages.${where[k]}.short`) })}
            </button>
          ))}
        </p>
      )}

      <h2 id="stage-title" className="text-xl font-extrabold">
        {t(`stages.${shown}.name`)}
      </h2>
      <p className="mt-2 leading-relaxed">{t(`stages.${shown}.what`)}</p>
      <details className="mt-3 text-sm leading-relaxed">
        <summary className="cursor-pointer font-semibold">{t('sim.more')}</summary>
        <dl className="mt-2 space-y-2">
          <div>
            <dt className="font-semibold">{t('lesson.chemistry')}</dt>
            <dd>{t(`stages.${shown}.chemistry`)}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('charts.absorbed')}</dt>
            <dd>{t(`stages.${shown}.absorbed`)}</dd>
          </div>
        </dl>
        <p className="mt-2 border-l-4 border-tissue pl-3 text-ink-2">{t(`stages.${shown}.fact`)}</p>
      </details>
    </section>
  )
}
