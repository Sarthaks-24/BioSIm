import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { buildMeal, simulate, stomachFraction } from '@biosim/engine'
import { lookupFood } from '../data/foods.ts'
import { DEFAULT_PRESET, PRESETS, presetHref } from '../lib/presets.ts'
import { MEAL_COLOR } from '../lib/colors.ts'
import { localized } from '../i18n/index.ts'

/** The hero is the real model output for cola vs burger and fries, drawn once on load. */
function EmptyingRace() {
  const { t, i18n } = useTranslation()
  const lines = useMemo(
    () =>
      (['a', 'b'] as const).map((k) => {
        const meal = buildMeal(DEFAULT_PRESET[k], lookupFood)
        const sim = simulate(meal, { particles: 0 })
        const pts: string[] = []
        for (let m = 0; m <= 360; m += 3) {
          const pct = stomachFraction(sim, m)
          pts.push(`${(m / 360) * 600},${20 + (1 - pct) * 240}`)
        }
        return { k, d: `M${pts.join('L')}`, name: meal.items.map((i) => localized(i.food.name, i18n.language)).join(' + ') }
      }),
    [i18n.language],
  )

  return (
    <figure className="w-full">
      <svg viewBox="-40 0 660 300" className="h-auto w-full" role="img" aria-label={t('home.previewCaption')}>
        {[0, 50, 100].map((p) => (
          <g key={p}>
            <line x1={0} x2={600} y1={20 + (1 - p / 100) * 240} y2={20 + (1 - p / 100) * 240} stroke="var(--color-rule)" />
            <text x={-8} y={20 + (1 - p / 100) * 240} textAnchor="end" dominantBaseline="middle" className="fill-ink-2 text-[13px]">
              {p}%
            </text>
          </g>
        ))}
        {[0, 1, 2, 3, 4, 5, 6].map((h) => (
          <text key={h} x={(h / 6) * 600} y={286} textAnchor="middle" className="tabular fill-ink-2 text-[13px]">
            {h}
          </text>
        ))}
        <clipPath id="race-reveal">
          <rect x={-10} y={0} width={620} height={300} className="race-reveal" />
        </clipPath>
        <g clipPath="url(#race-reveal)">
          {lines.map((l) => (
            <path
              key={l.k}
              d={l.d}
              fill="none"
              stroke={MEAL_COLOR[l.k]}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={l.k === 'b' ? '14 9' : undefined}
            />
          ))}
        </g>
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {lines.map((l) => (
          <span key={l.k} className="flex items-center gap-2 font-semibold" style={{ color: MEAL_COLOR[l.k] }}>
            <svg width="26" height="8" aria-hidden="true">
              <line x1="0" x2="26" y1="4" y2="4" stroke="currentColor" strokeWidth="4" strokeDasharray={l.k === 'b' ? '7 4' : undefined} />
            </svg>
            {l.name}
          </span>
        ))}
        <span className="w-full text-ink-2">
          {t('home.previewCaption')} · {t('home.hours')}
        </span>
      </figcaption>
    </figure>
  )
}

export default function Home() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-7xl px-4">
      <section className="grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-20">
        <div>
          <h1 className="max-w-[18ch] text-4xl leading-[1.05] font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {t('home.headline')}
          </h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-2">{t('home.lead')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/sim" className="rounded-full bg-ink px-6 py-3 text-lg font-semibold text-white">
              {t('home.cta')}
            </Link>
          </div>
        </div>
        <EmptyingRace />
      </section>

      <section aria-labelledby="how" className="border-t border-rule py-12">
        <h2 id="how" className="mb-8 text-2xl font-extrabold">
          {t('home.how.title')}
        </h2>
        <dl className="grid gap-8 md:grid-cols-3">
          {(['computed', 'honest', 'class'] as const).map((k) => (
            <div key={k}>
              <dt className="mb-2 text-lg font-semibold">{t(`home.how.${k}`)}</dt>
              <dd className="leading-relaxed text-ink-2">{t(`home.how.${k}Body`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="examples" className="border-t border-rule py-12">
        <h2 id="examples" className="mb-6 text-2xl font-extrabold">
          {t('home.examples')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => (
            <li key={p.key}>
              <Link to={presetHref(p)} className="flex h-full flex-col gap-2 rounded-xl border border-rule bg-panel p-4 hover:border-ink">
                <span className="text-3xl" aria-hidden="true">
                  {[...p.a, ...p.b].map((i) => lookupFood(i.foodId)?.emoji).join('')}
                </span>
                <span className="font-semibold">{t(`home.example.${p.key}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
