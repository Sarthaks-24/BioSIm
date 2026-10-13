import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import PageShell from '../components/PageShell.tsx'

export function NotFound() {
  const { t } = useTranslation()
  return (
    <PageShell width="note" as="div">
      <h1 className="text-3xl font-extrabold">{t('notFound.title')}</h1>
      <p className="mt-3 text-ink-muted">{t('notFound.body')}</p>
      <Link to="/sim" className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 font-semibold text-white">
        {t('notFound.cta')}
      </Link>
    </PageShell>
  )
}

/** Shown instead of a blank page if something fails to load (often an old cached version after an update). */
export function ErrorPage() {
  const { t } = useTranslation()
  return (
    <PageShell width="note" as="div">
      <h1 className="text-3xl font-extrabold">{t('error.title')}</h1>
      <p className="mt-3 text-ink-muted">{t('error.body')}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 rounded-full bg-ink px-5 py-2.5 font-semibold text-white"
      >
        {t('error.reload')}
      </button>
    </PageShell>
  )
}
