import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION } from '@lifepeek/engine'
import { FOODS } from '../data/foods.ts'
import { addEnglish, localized } from '../i18n/index.ts'
import { REFERENCES } from '../lib/references.ts'
import { SYSTEM_SOURCES } from '../lib/systemSources.ts'
import { pickerSystems } from '../systems/registry.ts'
import scienceText from 'virtual:lifepeek-en/science'
import lessonText from 'virtual:lifepeek-en/lesson'
import disclaimerText from 'virtual:lifepeek-en/disclaimer'
import PageShell from '../components/PageShell.tsx'

// This page's English text comes with its code (size budget, scripts/i18n-sections.mjs).
addEnglish(scienceText, lessonText, disclaimerText)

export default function Science() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { hash, search } = useLocation()
  // One section per body system there is (public, or every built one in a `?preview=1` session; X-1).
  const systems = pickerSystems(new URLSearchParams(search).get('preview') === '1').map((s) => s.id)
  // Reproduction's sources (R-1) come with its data, only while its teacher switch shows the row:
  // the page names none of them otherwise (and its first download carries none).
  const repro = systems.includes('reproduction')
  const [extra, setExtra] = useState<typeof REFERENCES>([])
  useEffect(() => {
    if (repro)
      // Its pack, not its data module alone: a module of its own would be one more file name in /sim.
      void import('../systems/reproduction/pack.ts')
        .then((m) => setExtra(Object.entries(m.REPRO_SOURCES).map(([id, s]) => ({ id, ...s }))))
        .catch(() => {})
  }, [repro])
  const references =
    repro && extra.length ? [...REFERENCES, ...extra].sort((a, b) => a.citation.localeCompare(b.citation, 'en')) : REFERENCES
  const citation = (id: string) => references.find((r) => r.id === id)?.citation ?? id
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
      {/* Science → the simulator and Teach (T12a, internal links). */}
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-semibold">
        <Link to="/sim" className="underline underline-offset-2">
          {t('science.trySim')}
        </Link>
        <Link to="/teach" className="underline underline-offset-2">
          {t('science.teachLink')}
        </Link>
      </p>

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

      {/* Per body system, the references its graphs rest on (from the catalog: lib/systemSources.ts). */}
      <h2 className="mt-10 mb-2 text-h2 font-extrabold">{t('science.systems.title')}</h2>
      <p className="mb-2 text-ink-muted">{t('science.systems.lead')}</p>
      {systems.map((id) => (
        <section key={id} aria-labelledby={`system-${id}`} data-system={id} className="border-t border-border py-3">
          <h3 id={`system-${id}`} className="text-lg font-extrabold">
            {t(`systems.${id}.name`)}
          </h3>
          {SYSTEM_SOURCES[id]?.length ? (
            <ul className="mt-1 list-disc space-y-1 pl-6 text-sm">
              {SYSTEM_SOURCES[id]!.map((ref) => (
                <li key={ref}>
                  <a href={`#${ref}`} className="underline underline-offset-2">
                    {citation(ref)}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">{t('science.systems.none')}</p>
          )}
        </section>
      ))}

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
        {references.map((r) => (
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
