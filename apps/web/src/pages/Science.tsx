import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION } from '@lifepeek/engine'
import { FOODS } from '../data/foods.ts'
import { addEnglish, localized } from '../i18n/index.ts'
import { REFERENCES } from '../lib/references.ts'
import scienceText from 'virtual:lifepeek-en/science'
import lessonText from 'virtual:lifepeek-en/lesson'
import PageShell from '../components/PageShell.tsx'

// This page's English text comes with its code (size budget, scripts/i18n-sections.mjs).
addEnglish(scienceText, lessonText)

export default function Science() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { hash } = useLocation()
  const target = decodeURIComponent(hash.slice(1))

  // The graphs' "How we know" links point at one reference or food (#freckmann2007, #food:cola).
  // The page loads lazily, so scroll once it is here, as About does. The router changes the hash
  // without a real navigation, so CSS :target never matches; the entry is marked from `target`.
  useEffect(() => {
    if (target) document.getElementById(target)?.scrollIntoView({ block: 'center' })
  }, [target])
  const marked = (id: string) => (id === target ? 'bg-surface-sunk' : '')

  return (
    <PageShell width="table">
      <h1 className="text-display font-extrabold tracking-tight">{t('science.title')}</h1>
      <p className="mt-4 text-lg text-ink-muted">{t('science.lead')}</p>
      <p className="tabular mt-2 text-sm text-ink-muted">{t('science.version', { version: MODEL_VERSION })}</p>

      <h2 className="mt-10 mb-2 text-h2 font-extrabold">{t('science.modelTitle')}</h2>
      <p>{t('science.modelBody')}</p>
      <h2 className="mt-8 mb-2 text-h2 font-extrabold">{t('science.fixedTitle')}</h2>
      <p>{t('science.fixedBody')}</p>
      <h2 className="mt-8 mb-2 text-h2 font-extrabold">{t('science.limitsTitle')}</h2>
      <ul className="list-disc space-y-1 pl-6">
        {(t('science.limits', { returnObjects: true }) as string[]).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>

      <h2 className="mt-10 mb-4 text-h2 font-extrabold">{t('science.foodsTitle')}</h2>
      <div className="overflow-x-auto">
        <table className="tabular w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left">
              <th scope="col" className="py-2 pr-3">
                {t('lesson.meal')}
              </th>
              <th scope="col" className="py-2 pr-3">
                {t('science.nutrientsPerServing')}
              </th>
              <th scope="col" className="py-2 pr-3">
                {t('science.gi')}
              </th>
              <th scope="col" className="py-2">
                {t('science.references')}
              </th>
            </tr>
          </thead>
          <tbody>
            {FOODS.map((f) => (
              <tr key={f.id} id={`food:${f.id}`} className={`border-b border-border align-top ${marked(`food:${f.id}`)}`}>
                <th scope="row" className="py-3 pr-3 text-left">
                  <span aria-hidden="true">{f.emoji} </span>
                  {localized(f.name, lang)}
                  <span className="block font-normal text-ink-muted">{localized(f.serving.label, lang)}</span>
                </th>
                <td className="py-3 pr-3">
                  {f.nutrients.energyKcal} kcal · {t('nutrients.carbs')} {f.nutrients.carbsG} g · {t('nutrients.protein')}{' '}
                  {f.nutrients.proteinG} g · {t('nutrients.fat')} {f.nutrients.fatG} g · {t('nutrients.fiber')} {f.nutrients.fiberG} g
                  {f.notes && <span className="mt-1 block text-ink-muted">{localized(f.notes, lang)}</span>}
                </td>
                <td className="py-3 pr-3">{f.glycemicIndex ? f.glycemicIndex.value : t('science.noGi')}</td>
                <td className="py-3">
                  <ul className="space-y-1">
                    {f.sources.map((s) => (
                      <li key={s.citation}>
                        {s.url ? (
                          <a href={s.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                            {s.label}
                          </a>
                        ) : (
                          s.label
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 mb-4 text-h2 font-extrabold">{t('science.references')}</h2>
      <ol className="list-decimal space-y-1 pl-6 text-sm">
        {REFERENCES.map((r) => (
          <li key={r.id} id={r.id} className={`rounded-control px-1 py-0.5 ${marked(r.id)}`}>
            {r.citation}
            {r.url && (
              <>
                {' '}
                <a href={r.url} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                  {new URL(r.url).hostname}
                </a>
              </>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-ink-muted">{t('disclaimer.long')}</p>
    </PageShell>
  )
}
