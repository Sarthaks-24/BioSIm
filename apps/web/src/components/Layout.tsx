import { useEffect, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION } from '@lifepeek/engine'
import { readPref, writePref } from '../lib/prefs.ts'
import { INK, ORGAN_COLOR } from '../lib/colors.ts'
import { MAKER } from '../lib/credits.ts'
import { useCanonical } from '../hooks/useCanonical.ts'
import MedicalNote from './MedicalNote.tsx'

function Logo() {
  // A stylized stomach-and-gut mark: the loop the app is about.
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M11 3v6c0 3 2 4 5 4h3c4 0 7 3 7 7s-3 8-9 8c-5 0-9-3-9-7 0-3 2-5 5-5"
        fill="none"
        stroke={ORGAN_COLOR.mouth}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="13" cy="20" r="2.2" fill={INK} />
    </svg>
  )
}

export default function Layout() {
  const { t, i18n } = useTranslation()
  const [projector, setProjector] = useState(() => readPref('projector') === '1')

  useEffect(() => {
    document.documentElement.dataset.contrast = projector ? 'high' : 'normal'
    writePref('projector', projector ? '1' : '0')
  }, [projector])

  useCanonical()

  const footerLink = 'inline-block py-1 underline-offset-2 hover:text-ink hover:underline'
  const nav = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'hover:bg-sunk'}`

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only z-50 rounded bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        {t('nav.skip')}
      </a>
      <header className="no-print border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
            <Logo />
            LifePeek
          </Link>
          <nav aria-label="Main" className="order-3 flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
            <NavLink to="/sim" className={nav}>
              {t('nav.simulator')}
            </NavLink>
            <NavLink to="/teach" className={nav}>
              {t('nav.teach')}
            </NavLink>
            <NavLink to="/science" className={nav}>
              {t('nav.science')}
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-pressed={projector}
              onClick={() => setProjector((p) => !p)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${projector ? 'border-ink bg-ink text-white' : 'border-rule hover:bg-sunk'}`}
            >
              {t('nav.projector')}
            </button>
            <button
              type="button"
              onClick={() => void i18n.changeLanguage(i18n.language === 'hi' ? 'en' : 'hi')}
              aria-label={t('nav.languageLabel')}
              lang={i18n.language === 'hi' ? 'en' : 'hi'}
              className="rounded-full border border-rule px-3 py-1.5 text-sm font-semibold hover:bg-sunk"
            >
              {t('nav.language')}
            </button>
          </div>
        </div>
      </header>

      <main id="main" className="flex-1">
        <Outlet />
      </main>

      <footer className="no-print border-t border-rule">
        <div className="mx-auto max-w-7xl space-y-3 px-4 py-5 text-sm text-ink-2">
          <MedicalNote text="short" />
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <li>
              <a href={MAKER.github} target="_blank" rel="noreferrer" className={footerLink}>
                {t('footer.madeBy', { name: MAKER.name })}
              </a>
            </li>
            <li>
              <Link to="/about" className={footerLink}>
                {t('footer.about')}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className={footerLink}>
                {t('footer.privacy')}
              </Link>
            </li>
            <li>
              <Link to="/about#licences" className={footerLink}>
                {t('footer.licences')}
              </Link>
            </li>
            <li>
              {/* A plain file on the server, not an app page: a normal link, not a router link. */}
              <a href="/THIRD_PARTY_NOTICES.txt" className={footerLink}>
                {t('footer.notices')}
              </a>
            </li>
            <li className="tabular">{t('footer.model', { version: MODEL_VERSION })}</li>
          </ul>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  )
}
