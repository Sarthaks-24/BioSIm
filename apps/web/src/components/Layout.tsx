import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { NavLink, Outlet, ScrollRestoration, Link, useLocation, useMatches } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION } from '@lifepeek/engine'
import { INK, ORGAN_COLOR } from '../lib/colors.ts'
import { MAKER } from '../lib/credits.ts'
import { useCanonical } from '../hooks/useCanonical.ts'
import { setProjector, useProjector } from '../hooks/useProjector.ts'
import LanguageButton from './LanguageButton.tsx'
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

/** Three lines, or a cross while the menu is open; drawn like the kit's icons (components/kit/icons.tsx). */
function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={open ? 'm5.5 5.5 9 9m0-9-9 9' : 'M3.5 5.5h13M3.5 10h13M3.5 14.5h13'} />
    </svg>
  )
}

/**
 * The phone menu's state. It closes when a link is followed (the page changes), on Escape (focus
 * goes back to its button) and on a tap anywhere else.
 */
function useMenu() {
  const [open, setOpen] = useState(false)
  const id = useId()
  const button = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const [page, setPage] = useState(pathname)
  if (page !== pathname) {
    setPage(pathname)
    setOpen(false)
  }
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      button.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (!button.current?.contains(target) && !document.getElementById(id)?.contains(target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open, id])
  return { open, setOpen, id, button }
}

/** Route `handle` flags the Layout reads. */
export interface RouteHandle {
  /**
   * The page is one screen (the stage at /sim): from 1024 px up, on a tablet (640 px wide and
   * 700 px tall) and in a short, wide window (500 px tall or less: FP-2; the `fit` variant,
   * styles.css), the header, page and footer share the window exactly, so nothing scrolls. On
   * phones the page fills at least the first screen and the footer sits just below it; a phone
   * under 700 px tall may scroll, so the body keeps its size (FP-1).
   */
  fit?: boolean
}

export default function Layout() {
  const { t } = useTranslation()
  const fit = useMatches().some((m) => (m.handle as RouteHandle | undefined)?.fit)
  // The saved choice is applied before the first draw (hooks/useProjector.ts); the Teach page's
  // lessons can switch it on too, so the button reads it from the page, not from its own state.
  const projector = useProjector()
  const menu = useMenu()
  // The site menu: on phones and in a short, wide window (FP-2) a drop-down under the header while
  // it is open (the links, then on a phone the projector switch); elsewhere from 640 px up
  // (`unfold`) the links are a row (the box is `contents`, so its drop-down look does not apply)
  // and the switch sits on the right. On the projector stage the links are hidden from 1024 px up
  // (UI-5), where the stage has its projector size; below that they stay, so a phone or tablet left
  // in projector mode can always leave it.
  const menuBox = `${menu.open ? 'absolute inset-x-0 top-full flex flex-col gap-1 border-b border-border bg-surface-page px-3 py-2 shadow-[0_6px_12px_-6px_rgb(20_33_61/0.25)]' : 'hidden'} unfold:contents ${fit && projector ? 'lg:hidden!' : ''}`
  // The projector switch in the header: from 640 px up; on the stage only from 1024 px up while it is
  // off (it has no projector size below that), but always while it is on, so it can be turned off.
  // In the phone menu it is drawn like the link rows above it (FP-10): no outline, filled while on.
  const projectorButton = (inMenu: boolean) => (
    <button
      type="button"
      aria-pressed={projector}
      onClick={() => setProjector(!projector)}
      className={`${target} rounded-full px-3 text-sm font-semibold whitespace-nowrap ${projector ? 'bg-ink text-white' : 'hover:bg-surface-sunk'} ${inMenu ? 'sm:hidden' : `w-fit border ${projector ? 'border-ink' : 'border-border'} ${fit && !projector ? 'max-lg:hidden' : 'max-sm:hidden'}`}`}
    >
      {t('nav.projector')}
    </button>
  )

  // A one-screen page has its own projector size (styles.css). Set before the paint of the first
  // render that matches it, while its code may still be loading, so the size never jumps.
  useLayoutEffect(() => {
    document.documentElement.toggleAttribute('data-fit', fit)
  }, [fit])

  useCanonical()

  const footerLink = 'inline-block py-1 underline-offset-2 hover:text-ink hover:underline'
  // Header controls are 44 px tall on phones and tablets, 36 px from 1024 px up (kit sizes, A11).
  const target = 'inline-flex min-h-11 items-center lg:min-h-9'
  const nav = ({ isActive }: { isActive: boolean }) =>
    `${target} rounded-full px-3 text-sm font-semibold whitespace-nowrap ${isActive ? 'bg-ink text-white' : 'hover:bg-surface-sunk'}`
  // On the projector the stage keeps the footer to one line (council 2026-10-13 #7): the medical
  // note, who made it, About, Privacy and the model version. The rest is one click away on About.
  const extra = fit ? 'in-data-[contrast=high]:hidden' : ''

  const footer = (
    <footer className={`no-print border-t border-border ${fit ? 'lg:border-border lg:bg-surface-page' : ''}`}>
      <div
        className={
          fit
            ? 'flex flex-col gap-1 px-4 py-2 text-caption text-ink-muted lg:flex-row lg:flex-wrap lg:items-baseline lg:gap-x-6 lg:py-1.5 in-data-[contrast=high]:text-micro'
            : 'space-y-3 px-4 py-5 text-sm text-ink-muted'
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
          <li className={extra}>
            <Link to="/stats" className={footerLink}>
              {t('stats.footer')}
            </Link>
          </li>
          <li className={extra}>
            <Link to="/about#licences" className={footerLink}>
              {t('footer.licences')}
            </Link>
          </li>
          <li className={extra}>
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
    // One-screen pages: the outer box is exactly the window where it fits (`fit`). Elsewhere the
    // inner box is (header + page = at least the first screen) and the footer follows; where it fits
    // it is `contents`, so header, page and footer are all rows of the outer box.
    <div className={fit ? 'flex flex-col fit:h-dvh' : 'flex min-h-dvh flex-col'}>
      <div className={fit ? 'flex min-h-dvh shrink-0 flex-col fit:contents' : 'contents'}>
        <a href="#main" className="sr-only z-50 rounded bg-ink px-3 py-2 text-white focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
          {t('nav.skip')}
        </a>
        <header className="no-print relative z-30 border-b border-border bg-surface-page/90 backdrop-blur">
          {/* Full width on every page, as on the stage (edges line up with its meal bar), so the logo
              never moves between pages (FP-10); content pages centre their own column (PageShell).
              On a phone the stage's two rows of 44 px controls get almost no padding: the body needs the room. */}
          <div className={`flex flex-wrap items-center gap-x-4 px-4 ${fit ? 'py-0.5 lg:py-1.5' : 'gap-y-1 py-2 lg:py-3'}`}>
            <Link to="/" className="flex items-center gap-2 text-xl font-extrabold tracking-tight">
              <Logo />
              LifePeek
            </Link>
            {/*
             * The projector shows one page, the stage, to a room: its site nav is hidden there (UI-5).
             * On a phone the links fold into a menu (council round 2): a row of its own cost the
             * stage's body about 50 px of the first screen. Opened, they drop down under the header.
             */}
            <div id={menu.id} className={menuBox}>
              <nav aria-label={t('nav.main')} className="flex flex-col gap-1 unfold:flex-row">
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
              {projectorButton(true)}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                ref={menu.button}
                type="button"
                aria-expanded={menu.open}
                aria-controls={menu.id}
                onClick={() => menu.setOpen(!menu.open)}
                className={`${target} order-last w-11 justify-center rounded-full border border-border hover:bg-surface-sunk unfold:hidden`}
              >
                <MenuIcon open={menu.open} />
                <span className="sr-only">{t('nav.menu')}</span>
              </button>
              {/* On phones the switch is in the menu (plan-ui-ux §3.5: here it would cost the header a row). */}
              {projectorButton(false)}
              {/* Only in a Hindi build (R47: Hindi is paused). The flag written out, so a build
                  without it leaves the button's code out (i18n/index.ts says why). */}
              {import.meta.env.VITE_HINDI === '1' && (
                <LanguageButton
                  className={`${target} rounded-full border border-border px-3 text-sm font-semibold whitespace-nowrap hover:bg-surface-sunk`}
                />
              )}
            </div>
          </div>
        </header>

        <main id="main" className={fit ? 'flex min-h-0 flex-1 flex-col' : 'flex-1'}>
          <Outlet />
        </main>
      </div>

      {footer}
      <ScrollRestoration />
    </div>
  )
}
