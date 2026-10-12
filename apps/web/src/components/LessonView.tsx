import { useTranslation } from 'react-i18next'
import { STAGES, stageWindow, type Simulation, type StageId } from '@biosim/engine'
import { mealLabel, presentMeals, type Sims } from '../state/sim.ts'
import { localized } from '../i18n/index.ts'
import { formatDuration } from '../lib/time.ts'
import { MEAL_COLOR } from '../lib/colors.ts'
import KeyMoments from './KeyMoments.tsx'

/**
 * The whole simulation as text: for screen readers, printing and devices that struggle with 3D.
 * Same numbers as the visual view — stage times come from the engine.
 */
export default function LessonView({ sims }: { sims: Sims }) {
  const { t, i18n } = useTranslation()

  const when = (sim: Simulation, stage: StageId): string => {
    const w = stageWindow(sim, stage)
    if (!w) return t('events.noLeftovers')
    return `${formatDuration(w.start, t)} – ${formatDuration(w.end, t)}`
  }

  return (
    <article className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold">{t('lesson.title')}</h2>
          <p className="text-ink-2">{t('lesson.intro')}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print rounded-full border border-rule px-4 py-2 font-semibold hover:bg-sunk"
        >
          {t('lesson.print')}
        </button>
      </header>

      <KeyMoments sims={sims} />

      {presentMeals(sims).map((k) => {
        const sim = sims[k]
        const n = sim.meal.total
        return (
          <section key={k} aria-labelledby={`lesson-${k}`} className="break-inside-avoid">
            <h3 id={`lesson-${k}`} className="mb-1 text-xl font-extrabold" style={{ color: MEAL_COLOR[k] }}>
              {mealLabel(k, t)}: {sim.meal.items.map((i) => `${localized(i.food.name, i18n.language)} ×${i.servings}`).join(', ')}
            </h3>
            <p className="tabular mb-3 text-sm text-ink-2">
              {t('lesson.per')}: {t('units.kcal', { n: Math.round(n.energyKcal) })} · {t('nutrients.carbs')} {Math.round(n.carbsG)} g ·{' '}
              {t('nutrients.protein')} {Math.round(n.proteinG)} g · {t('nutrients.fat')} {Math.round(n.fatG)} g · {t('nutrients.fiber')}{' '}
              {Math.round(n.fiberG)} g · {t('nutrients.water')} {Math.round(n.waterG)} g
            </p>
            <table className="w-full text-[0.9375rem]">
              <thead>
                <tr className="border-b-2 border-ink text-left">
                  <th scope="col" className="py-2 pr-3">
                    {t('lesson.stage')}
                  </th>
                  <th scope="col" className="py-2 pr-3">
                    {t('lesson.when')}
                  </th>
                  <th scope="col" className="py-2">
                    {t('lesson.happens')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {STAGES.map((s, i) => (
                  <tr key={s} className="border-b border-rule align-top">
                    <th scope="row" className="py-3 pr-3 text-left">
                      {i + 1}. {t(`stages.${s}.name`)}
                    </th>
                    <td className="tabular py-3 pr-3 whitespace-nowrap">{when(sim, s)}</td>
                    <td className="py-3">
                      <p>{t(`stages.${s}.what`)}</p>
                      <p className="mt-1 text-ink-2">{t(`stages.${s}.chemistry`)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )
      })}
      <p className="text-sm text-ink-2">{t('disclaimer.long')}</p>
    </article>
  )
}
