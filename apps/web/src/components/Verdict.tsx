import { useTranslation } from 'react-i18next'
import { PARAMS } from '@biosim/engine'
import { mealLabel, presentMeals, type Sims } from '../state/sim.ts'
import { formatDuration } from '../lib/time.ts'

/**
 * The answer in one sentence, so nobody has to read a chart to get the point:
 * "Meal A leaves the stomach about 6× faster than Meal B." plus the reason (calories).
 */
export default function Verdict({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const keys = presentMeals(sims)
  if (keys.length === 0) return null

  const half = (k: 'a' | 'b') => sims[k].events.stomachHalfEmptyMin
  const kcal = (k: 'a' | 'b') => Math.round(sims[k].meal.total.energyKcal)
  const rate = PARAMS.stomach.energyKcalPerMin.toFixed(0)

  let headline: string
  let detail: string
  if (keys.length === 1) {
    const k = keys[0]!
    headline = t('verdict.single', { meal: mealLabel(k, t), time: formatDuration(half(k) ?? 0, t) })
    detail = t('verdict.kcalOne', { meal: mealLabel(k, t), kcal: kcal(k) })
  } else {
    const [fast, slow] = (half('a') ?? 0) <= (half('b') ?? 0) ? (['a', 'b'] as const) : (['b', 'a'] as const)
    const ratio = (half(slow) ?? 0) / Math.max(1, half(fast) ?? 1)
    headline =
      ratio < 1.15
        ? t('verdict.similar')
        : t('verdict.faster', { fast: mealLabel(fast, t), slow: mealLabel(slow, t), x: ratio < 3 ? ratio.toFixed(1) : Math.round(ratio) })
    detail = t('verdict.detail', {
      a: formatDuration(half('a') ?? 0, t),
      b: formatDuration(half('b') ?? 0, t),
      kcalA: kcal('a'),
      kcalB: kcal('b'),
      rate,
    })
  }

  return (
    <section aria-live="polite" className="mb-4 rounded-xl border-l-4 border-ink bg-panel px-4 py-3">
      <p className="text-lg leading-snug font-extrabold sm:text-xl">{headline}</p>
      <p className="mt-1 text-sm text-ink-2">{detail}</p>
    </section>
  )
}
