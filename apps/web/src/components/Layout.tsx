import { useEffect, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, Link, useMatches } from 'react-router'
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

/** Route `handle` flags the Layout reads. */
export interface RouteHandle {
  /**
   * The page is one screen (the v2 stage at /next): from 1024 px up the header, page and footer
   * share the window exactly, so nothing scrolls on a laptop or a projector. On phones the page
   * fills the first screen and the footer sits just below it.
   */
  fit?: boolean
}

export default function Layout() {
  const { t, i18n } = useTranslation()
  const fit = useMatches().some((m) => (m.handle as RouteHandle | undefined)?.fit)
  const [projector, setProjector] = useState(() => readPref('projector') === '1')

  useEffect(() => {
    document.documentElement.dataset.contrast = projector ? 'high' : 'normal'
    writePref('projector', projector ? '1' : '0')
  }, [projector])

  useCanonical()

  const footerLink = 'inline-block py-1 underline-offset-2 hover:text-ink hover:underline'
  const nav = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-3 py-1.5 text-sm font-semibold ${isActive ? 'bg-ink text-white' : 'hover:bg-sunk'}`

  const footer = (
    <footer className={`no-print border-t border-rule ${fit ? 'lg:border-rule2 lg:bg-paper2' : ''}`}>
      <div
        className={
          fit
            ? 'flex flex-col gap-1 px-4 py-2 text-caption text-ink-2 lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-6 lg:py-1.5'
            : 'mx-auto max-w-7xl space-y-3 px-4 py-5 text-sm text-ink-2'
        }
      >
        <MedicalNote text="short" />
        <ul className={`flex flex-wrap items-center ${fit ? 'gap-x-4' : 'gap-x-5'} gap-y-1`}>
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
            <Link to="/stats" className={footerLink}>
              {t('stats.footer')}
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
  )

  return (
    // One-screen pages: the outer box is exactly the window from 1024 px up. Below that, the inner
    // box is (header + page = the first screen) and the footer follows; at lg it is `contents`, so
    // header, page and footer are all rows of the outer box.
    <div className={fit ? 'flex flex-col lg:h-dvh' : 'flex min-h-dvh flex-col'}>
      <div className={fit ? 'flex h-dvh shrink-0 flex-col lg:contents' : 'contents'}>
        <a href="#main" className="sr-only z-50 rounded bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          {t('nav.skip')}
        </a>
        <header className="no-print border-b border-rule bg-paper/90 backdrop-blur">
          {/* The stage uses the full width, so its header does too (edges line up with the meal bar). */}
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-4 ${fit ? 'py-2' : 'mx-auto max-w-7xl py-3'}`}>
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
              {/* The stage has no projector button on phones (plan-ui-ux §3.5): it would cost a row. */}
              <button
                type="button"
                aria-pressed={projector}
                onClick={() => setProjector((p) => !p)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${projector ? 'border-ink bg-ink text-white' : 'border-rule hover:bg-sunk'} ${fit ? 'max-lg:hidden' : ''}`}
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

        <main id="main" className={fit ? 'min-h-0 flex-1' : 'flex-1'}>
          <Outlet />
        </main>
      </div>

      {footer}
      <ScrollRestoration />
    </div>
  )
}
