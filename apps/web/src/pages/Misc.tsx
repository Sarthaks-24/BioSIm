import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { resolveShortLink } from '../lib/api.ts'

/** /s/:code — expands a short link, or falls back to the simulator if it can't. */
export function ShortLink() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  useEffect(() => {
    let alive = true
    void resolveShortLink(code).then((query) => {
      if (alive) navigate(query ? `/sim?${query}` : '/sim', { replace: true })
    })
    return () => {
      alive = false
    }
  }, [code, navigate])
  return <p className="p-10 text-center text-ink-2">…</p>
}

export function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold">{t('notFound.title')}</h1>
      <p className="mt-3 text-ink-2">{t('notFound.body')}</p>
      <Link to="/sim" className="mt-6 inline-block rounded-full bg-ink px-5 py-2.5 font-semibold text-white">
        {t('notFound.cta')}
      </Link>
    </div>
  )
}
