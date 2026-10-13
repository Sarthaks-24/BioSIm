import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import { registerSW } from 'virtual:pwa-register'
import updateText from 'virtual:lifepeek-en/update'
import { addEnglish } from '../i18n/index.ts'

// Its English text comes with it (size budget, scripts/i18n-sections.mjs).
addEnglish(updateText)

/** How often an open tab asks the server for a newer version (a classroom laptop stays open for days). */
const CHECK_EVERY_MS = 60 * 60 * 1000

/**
 * A new version is ready (council round 3). The service worker waits ("prompt", vite.config.ts):
 * it never reloads a page by itself, in the middle of a lesson. Without a word, though, an open
 * tab or the installed app kept the old version until every LifePeek tab was closed. So this
 * small note offers the reload: "Reload" lets the new worker take over and reloads; "Later" closes
 * the note, and the new version starts the next time the app is opened.
 *
 * Loaded after the page has loaded (main.tsx), never part of a page's first download. It
 * registers the service worker itself (vite.config.ts `injectRegister: false`).
 *
 * Only a real update shows the note (B16): this page was opened by an older worker (a controller
 * at load) **and** a new one is waiting. vite-plugin-pwa also calls `onNeedRefresh` when a first
 * install finishes while another LifePeek tab is open (`installed` with `isExternal`): nothing is
 * new then, and the note was false. A blocked service worker (a school browser) is no error.
 */
export function watchForUpdates() {
  let sw: ServiceWorkerContainer
  try {
    sw = navigator.serviceWorker
  } catch {
    return // site data blocked: the getter throws (Firefox)
  }
  if (!sw) return
  const hadController = !!sw.controller
  let registration: ServiceWorkerRegistration | undefined
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => {
      if (!hadController) return
      const found = registration ? Promise.resolve(registration) : sw.getRegistration()
      found.then((r) => r?.waiting && show(() => void updateSW(true))).catch(() => undefined)
    },
    onRegisteredSW: (_url, r) => {
      if (!r) return
      registration = r
      setInterval(() => {
        // Offline, or the server is busy: the next check will do.
        if (navigator.onLine && document.visibilityState === 'visible') r.update().catch(() => undefined)
      }, CHECK_EVERY_MS)
    },
    onRegisterError: () => undefined,
  })
}

function show(reload: () => void) {
  if (document.querySelector('[data-update-toast]')) return
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const close = () => {
    root.unmount()
    host.remove()
  }
  root.render(<UpdateToast onReload={reload} onLater={close} />)
}

/**
 * The note: a status message (read out once, it takes no focus away from the lesson), with its two
 * buttons in the Tab order at the end of the page. A light card in the bottom right corner (no wider
 * than a phone's screen), above everything else, but never over the stage's clock dock (FP-5, B16):
 * where the dock is in the window, the note sits under it if it fits there, else just above it.
 * Its place and shadow are inline styles and its classes are ones the first paint already has, so
 * it adds nothing to the page's CSS (size budget).
 */
const BOX: React.CSSProperties = {
  position: 'fixed',
  right: '1rem',
  zIndex: 60,
  maxWidth: 'min(28rem, calc(100vw - 2rem))',
  boxShadow: '0 4px 16px rgb(20 33 61 / 0.25)',
}
/** Room between the note and the window's bottom edge, or the dock (px). */
const EDGE = 16

/** How far up from the window's bottom the note sits: clear of the dock (components/kit/Dock.tsx). */
function lift(note: HTMLElement | null): number {
  const dock = document.querySelector('[data-dock]')?.getBoundingClientRect()
  const vh = window.innerHeight
  if (!dock || !note || dock.bottom <= 0 || dock.top >= vh) return EDGE
  // Under the dock if it fits there (the dock scrolled up a phone's page), else above it.
  return vh - dock.bottom >= note.offsetHeight + 2 * EDGE ? EDGE : vh - dock.top + EDGE / 2
}

function UpdateToast({ onReload, onLater }: { onReload: () => void; onLater: () => void }) {
  const { t } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const [bottom, setBottom] = useState(EDGE)
  // Kept clear of the dock as the page scrolls, the window changes size, or the stage opens.
  useEffect(() => {
    const place = () => setBottom(lift(box.current))
    place()
    const every = setInterval(place, 500)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      clearInterval(every)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [])
  // Escape is "Later" while one of its buttons has the focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && box.current?.contains(document.activeElement)) onLater()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onLater])
  return (
    <div
      ref={box}
      role="status"
      data-update-toast=""
      style={{ ...BOX, bottom }}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3 text-ink sm:flex-row sm:items-start"
    >
      <p className="min-w-0 flex-1 font-semibold">{t('update.ready')}</p>
      <div className="flex shrink-0 items-center gap-3 self-end sm:self-center">
        <button type="button" onClick={onLater} className="whitespace-nowrap underline underline-offset-2 hover:text-ink">
          {t('update.later')}
        </button>
        <button type="button" onClick={onReload} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white">
          {t('update.reload')}
        </button>
      </div>
    </div>
  )
}
