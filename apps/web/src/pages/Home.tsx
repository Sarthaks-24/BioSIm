import { useEffect, useState, type ComponentType } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PRESETS, presetHref } from '../lib/presets.ts'
import { lookupFood } from '../data/foods.ts'
import { shortMealNames } from '../components/stage/mealText.ts'
import PageShell from '../components/PageShell.tsx'
// The stage's flat body at rest, drawn by FlatBody itself into an SVG file (flat/restingBody.ts):
// Home links the picture and never runs the drawing code.
import restingBody from '../assets/resting-body.svg'

const MORE = 'rounded-full border border-border px-5 py-3 text-lg font-semibold hover:bg-surface-sunk'

/**
 * Home (FP-8, R15): what LifePeek shows, in one line, beside the body it shows it in (the stage's
 * flat body, resting); then the race that proves it; then how it is built and examples to open.
 * Sections are divided by rules, not boxed in cards, like the stage.
 */
export default function Home() {
  const { t, i18n } = useTranslation()
  // The race and its numbers load after the first paint (every page's first download is shared with
  // the stage, whose budget is tight); its box keeps the room meanwhile, and a failed load leaves it empty.
  const [Race, setRace] = useState<ComponentType | null>(null)
  useEffect(() => {
    import('../components/HomeRace.tsx').then(
      (m) => setRace(() => m.default),
      () => {},
    )
  }, [])
  return (
    <PageShell width="wide" as="div">
      <section className="home-split py-10 lg:py-20">
        <div>
          <h1 className="home-title">{t('home.promise')}</h1>
          <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-ink-muted">{t('home.intro')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/sim" className="rounded-full bg-ink px-6 py-3 text-lg font-semibold text-white">
              {t('home.cta')}
            </Link>
            {/* Home ↔ Teach ↔ Science (T12a): the nav's names, no new text. */}
            <Link to="/teach" className={MORE}>
              {t('nav.teach')}
            </Link>
            <Link to="/science" className={MORE}>
              {t('nav.science')}
            </Link>
          </div>
        </div>
        <img src={restingBody} alt={t('stage.bodyResting')} width={290} height={535} className="home-body" />
      </section>

      <section aria-labelledby="race" className="home-split border-t border-border py-12">
        <h2 id="race" className="home-fact">
          {t('home.headline')}
        </h2>
        {Race ? <Race /> : <div className="aspect-[2/1]" />}
      </section>

      <section aria-labelledby="how" className="border-t border-border py-12">
        <h2 id="how" className="mb-6 text-h2 font-extrabold">
          {t('home.how.title')}
        </h2>
        <dl>
          {(['computed', 'honest', 'class'] as const).map((k) => (
            <div key={k} className="home-split border-t border-border py-5">
              <dt className="text-lg font-semibold">{t(`home.how.${k}`)}</dt>
              <dd className="leading-relaxed text-ink-muted">{t(`home.how.${k}Body`)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="examples" className="border-t border-border py-12">
        <h2 id="examples" className="mb-6 text-h2 font-extrabold">
          {t('home.examples')}
        </h2>
        <ul className="home-split">
          {PRESETS.map((p) => (
            <li key={p.key} className="border-t border-border">
              <Link to={presetHref(p)} className="flex items-center gap-4 py-3 font-semibold hover:underline">
                <span className="w-[4.5em] shrink-0 text-2xl" aria-hidden="true">
                  {[...p.meal, ...p.kept].map((i) => lookupFood(i.foodId)?.emoji).join('')}
                </span>
                {t('home.example', { meal: shortMealNames(p.meal, i18n.language), kept: shortMealNames(p.kept, i18n.language) })}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  )
}
