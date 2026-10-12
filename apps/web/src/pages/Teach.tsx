import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { PRESETS, presetHref } from '../lib/presets.ts'

export default function Teach() {
  const { t } = useTranslation()
  const list = (key: string) => t(key, { returnObjects: true }) as string[]
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed">
      <h1 className="text-4xl font-extrabold tracking-tight">{t('teach.title')}</h1>
      <p className="mt-4 text-lg text-ink-2">{t('teach.lead')}</p>

      <h2 className="mt-10 mb-3 text-2xl font-extrabold">{t('teach.plan')}</h2>
      <ol className="list-decimal space-y-3 pl-6">
        {list('teach.steps').map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <h2 className="mt-10 mb-3 text-2xl font-extrabold">{t('teach.presetsTitle')}</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {PRESETS.map((p) => (
          <li key={p.key}>
            <Link to={presetHref(p)} className="block rounded-lg border border-rule bg-panel px-4 py-3 font-semibold hover:border-ink">
              {t(`home.example.${p.key}`)}
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-10 mb-3 text-2xl font-extrabold">{t('teach.questionsTitle')}</h2>
      <ul className="list-disc space-y-2 pl-6">
        {list('teach.questions').map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>

      <h2 className="mt-10 mb-3 text-2xl font-extrabold">{t('teach.tipsTitle')}</h2>
      <ul className="list-disc space-y-2 pl-6">
        {list('teach.tips').map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </article>
  )
}
