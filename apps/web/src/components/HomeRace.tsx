import { useTranslation } from 'react-i18next'
import { DEFAULT_PRESET } from '../lib/presets.ts'
import { KEPT, RUN } from '../lib/colors.ts'
import { HERO_END_MIN, HERO_STEP_MIN } from '../data/heroShape.ts'
import hero from '../data/hero.json'
import { mealNames } from './stage/mealText.ts'

const x = (min: number) => (min / HERO_END_MIN) * 600
const y = (share: number) => (1 - share) * 240
const path = (stomach: number[]) => `M${stomach.map((s, i) => `${x(i * HERO_STEP_MIN)},${y(s)}`).join('L')}`

/**
 * The race: the real model output for cola, with burger + fries kept (the stage's first lesson),
 * drawn the way the stage draws them: this meal solid blue, the kept meal dashed grey. The numbers
 * come precomputed (data/hero.json, checked by hero.test.ts), so Home never runs the model. Home
 * loads this file, numbers included, after its first paint (pages/Home.tsx), and the lines draw in
 * the reveal. The axis labels are HTML at the caption size, so they never shrink with the plot on a
 * phone (B8); the lines keep their width at any size too.
 */
export default function HomeRace() {
  const { t, i18n } = useTranslation()
  const lines = [
    { k: 'meal', d: path(hero.meal.stomach), color: RUN, dash: undefined, name: mealNames(DEFAULT_PRESET.meal, i18n.language) },
    {
      k: 'kept',
      d: path(hero.kept.stomach),
      color: KEPT,
      dash: '10 6',
      name: t('keep.tag', { meal: mealNames(DEFAULT_PRESET.kept ?? [], i18n.language) }),
    },
  ]

  return (
    <figure data-home-chart className="w-full text-caption">
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        <div className="relative w-9 tabular text-ink-muted" aria-hidden="true">
          {[0, 50, 100].map((p) => (
            <span key={p} className="absolute right-0 -translate-y-1/2" style={{ top: `${100 - p}%` }}>
              {p}%
            </span>
          ))}
        </div>
        <svg viewBox="0 0 600 240" overflow="visible" className="h-auto w-full" role="img" aria-label={t('home.previewCaption')}>
          {[0, 0.5, 1].map((s) => (
            <line key={s} x1={0} x2={600} y1={y(s)} y2={y(s)} stroke="var(--color-border)" vectorEffect="non-scaling-stroke" />
          ))}
          <clipPath id="race-reveal">
            <rect x={-10} y={-10} width={620} height={260} className="race-reveal" />
          </clipPath>
          <g clipPath="url(#race-reveal)">
            {lines.map(
              (l) =>
                l.d && (
                  <path
                    key={l.k}
                    d={l.d}
                    fill="none"
                    stroke={l.color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeDasharray={l.dash}
                    vectorEffect="non-scaling-stroke"
                  />
                ),
            )}
          </g>
        </svg>
        <div className="relative col-start-2 h-6 tabular text-ink-muted" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6].map((h) => (
            <span key={h} className="absolute bottom-0 -translate-x-1/2" style={{ left: `${(h / 6) * 100}%` }}>
              {h}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-control">
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
