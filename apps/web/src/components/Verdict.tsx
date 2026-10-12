import { useTranslation } from 'react-i18next'
import { mealLabel, type Sims } from '../state/sim.ts'
import { formatDuration } from '../lib/time.ts'
import { verdictData } from '../lib/verdict.ts'

/**
 * The answer in one sentence, so nobody has to read a chart to get the point — plus the reason,
 * but only when that reason really explains the result (see lib/verdict.ts and its tests).
 */
export default function Verdict({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const v = verdictData(sims)
  if (v.kind === 'empty') return null

  let headline: string
  let detail: string[]
  if (v.kind === 'single') {
    headline = t('verdict.single', { meal: mealLabel(v.meal, t), time: formatDuration(v.halfMin, t) })
    detail = [t('verdict.rates')]
  } else {
    const name = { fast: mealLabel(v.fast, t), slow: mealLabel(v.slow, t) }
    headline = v.similar
      ? t('verdict.similar')
      : t('verdict.faster', { ...name, x: v.ratio < 3 ? v.ratio.toFixed(1) : Math.round(v.ratio) })
    detail = [t('verdict.times', { a: formatDuration(v.half.a, t), b: formatDuration(v.half.b, t) })]
    if (v.reason === 'drink') detail.push(t('verdict.reasonDrink', { fast: name.fast }))
    if (v.reason === 'calories')
      detail.push(t('verdict.reasonCalories', { slow: name.slow, kcalSlow: v.kcal[v.slow], kcalFast: v.kcal[v.fast] }))
  }

  return (
    <section aria-live="polite" className="mb-4 rounded-xl border-l-4 border-ink bg-panel px-4 py-3">
      <p className="text-lg leading-snug font-extrabold sm:text-xl">{headline}</p>
      <p className="mt-1 text-sm text-ink-2">{detail.join(' ')}</p>
    </section>
  )
}
