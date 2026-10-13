import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { DEFAULT_PRESET, PRESETS, presetHref } from '../lib/presets.ts'
import { KEPT, RUN } from '../lib/colors.ts'
import { lookupFood } from '../data/foods.ts'
import { HERO_END_MIN, HERO_STEP_MIN, type Hero } from '../data/heroShape.ts'
import { mealNames, shortMealNames } from '../components/stage/mealText.ts'
import PageShell from '../components/PageShell.tsx'

const x = (min: number) => (min / HERO_END_MIN) * 600
const y = (share: number) => 20 + (1 - share) * 240
const path = (stomach: number[]) => `M${stomach.map((s, i) => `${x(i * HERO_STEP_MIN)},${y(s)}`).join('L')}`

/**
 * The hero: the real model output for cola, with burger + fries kept (the stage's first lesson),
 * drawn the way the stage draws them: this meal solid blue, the kept meal dashed grey. The numbers
 * come precomputed (data/hero.json, checked by hero.test.ts), so Home never runs the model. They
 * are fetched after the first paint (a few hundred bytes every page's first download needn't carry;
 * the stage's budget is tight): the axes and the legend draw at once, the lines as they arrive,
 * inside the reveal.
 */
function EmptyingRace() {
  const { t, i18n } = useTranslation()
  const [hero, setHero] = useState<Hero | null>(null)
  useEffect(() => {
    void import('../data/hero.json').then((m) => setHero(m.default))
  }, [])
  const lines = [
    { k: 'meal', d: hero && path(hero.meal.stomach), color: RUN, dash: undefined, name: mealNames(DEFAULT_PRESET.meal, i18n.language) },
    {
      k: 'kept',
      d: hero && path(hero.kept.stomach),
      color: KEPT,
      dash: '14 9',
      name: t('keep.tag', { meal: mealNames(DEFAULT_PRESET.kept ?? [], i18n.language) }),
    },
  ]

  return (
    <figure className="w-full">
      <svg viewBox="-40 0 660 300" className="h-auto w-full" role="img" aria-label={t('home.previewCaption')}>
        {[0, 50, 100].map((p) => (
          <g key={p}>
            <line x1={0} x2={600} y1={y(p / 100)} y2={y(p / 100)} stroke="var(--color-rule)" />
            <text x={-8} y={y(p / 100)} textAnchor="end" dominantBaseline="middle" className="fill-ink-muted text-[13px]">
              {p}%
            </text>
          </g>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((h) => (
          <text key={h} x={x(h * 60)} y={286} textAnchor="middle" className="tabular fill-ink-muted text-[13px]">
            {h}
          </text>
        ))}
        <clipPath id="race-reveal">
          <rect x={-10} y={0} width={620} height={300} className="race-reveal" />
        </clipPath>
        <g clipPath="url(#race-reveal)">
          {lines.map(
            (l) =>
              l.d && <path key={l.k} d={l.d} fill="none" stroke={l.color} strokeWidth={5} strokeLinecap="round" strokeDasharray={l.dash} />,
          )}
        </g>
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {lines.map((l) => (
          <span key={l.k} className="flex items-center gap-2 font-semibold" style={{ color: l.color }}>
            <svg width="26" height="8" aria-hidden="true">
              <line x1="0" x2="26" y1="4" y2="4" stroke="currentColor" strokeWidth="4" strokeDasharray={l.dash ? '7 4' : undefined} />
            </svg>
            {l.name}
          </span>
        ))}
        <span className="w-full text-ink-muted">
          {t('home.previewCaption')} · {t('home.hours')}
        </span>
      </figcaption>
    </figure>
  )
}

export default function Home() {
  const { t, i18n } = useTranslation()
  return (
    <PageShell width="wide" as="div">
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div>
          <h1 className="max-w-[18ch] text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t('home.headline')}
          </h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-muted">{t('home.lead')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/sim" className="rounded-full bg-ink px-6 py-3 text-lg font-semibold text-white">
              {t('home.cta')}
            </Link>
          </div>
        </div>
        <EmptyingRace />
      </section>

      <section aria-labelledby="how" className="border-t border-rule py-12">
        <h2 id="how" className="mb-8 text-h2 font-extrabold">
          {t('home.how.title')}
        </h2>
        <dl className="grid gap-8 md:grid-cols-3">
          {(['computed', 'honest', 'class'] as const).map((k) => (
            <div key={k}>
              <dt className="mb-2 text-lg font-semibold">{t(`home.how.${k}`)}</dt>
              <dd className="leading-relaxed text-ink-muted">{t(`home.how.${k}Body`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="examples" className="border-t border-rule py-12">
        <h2 id="examples" className="mb-6 text-h2 font-extrabold">
          {t('home.examples')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => (
            <li key={p.key}>
              <Link to={presetHref(p)} className="flex h-full flex-col gap-2 rounded-xl border border-rule bg-surface-raised p-4 hover:border-ink">
                <span className="text-3xl" aria-hidden="true">
                  {[...p.meal, ...p.kept].map((i) => lookupFood(i.foodId)?.emoji).join('')}
                </span>
                <span className="font-semibold">
                  {t('home.example', { meal: shortMealNames(p.meal, i18n.language), kept: shortMealNames(p.kept, i18n.language) })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  )
}
