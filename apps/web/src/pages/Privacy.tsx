import { useTranslation } from 'react-i18next'
import RichText from '../components/RichText.tsx'
import { MAKER } from '../lib/credits.ts'

/** One heading of the privacy text, as paragraphs before a list, the list, and paragraphs after it. */
interface Section {
  title: string
  intro?: string[]
  items?: string[]
  outro?: string[]
}

/**
 * The privacy page. Its text (EN + HI) is copied word for word from the project's privacy notice into
 * the translation files, so this page only lays it out.
 */
export default function Privacy() {
  const { t } = useTranslation()
  const sections = t('privacy.sections', { returnObjects: true, name: MAKER.name }) as Section[]
  const paras = (list: string[] | undefined) =>
    list?.map((p) => (
      <p key={p}>
        <RichText text={p} />
      </p>
    ))
  return (
    <article className="mx-auto max-w-3xl px-4 py-10 leading-relaxed">
      <h1 className="text-4xl font-extrabold tracking-tight">{t('privacy.title')}</h1>
      <p className="mt-2 text-sm text-ink-2">{t('privacy.updated')}</p>
      <p className="mt-6 max-w-[68ch] rounded-xl border border-rule bg-panel px-4 py-3 text-lg">
        <RichText text={t('privacy.summary')} />
      </p>

      {sections.map((s) => (
        <section key={s.title} className="max-w-[68ch]">
          <h2 className="mt-10 mb-3 text-2xl font-extrabold">{s.title}</h2>
          <div className="space-y-3">
            {paras(s.intro)}
            {s.items && (
              <ul className="list-disc space-y-2 pl-6">
                {s.items.map((item) => (
                  <li key={item}>
                    <RichText text={item} />
                  </li>
                ))}
              </ul>
            )}
            {paras(s.outro)}
          </div>
        </section>
      ))}
    </article>
  )
}
