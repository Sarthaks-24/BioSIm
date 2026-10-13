import { useEffect, useRef } from 'react'
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
 */
export function watchForUpdates() {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => show(() => void updateSW(true)),
    onRegisteredSW: (_url, registration) => {
      if (!registration) return
      setInterval(() => {
        // Offline, or the server is busy: the next check will do.
        if (navigator.onLine && document.visibilityState === 'visible') registration.update().catch(() => undefined)
      }, CHECK_EVERY_MS)
    },
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
 * than a phone's screen), above everything else. Its place and shadow are inline styles and its
 * classes are ones the first paint already has, so it adds nothing to the page's CSS (size budget).
 */
const BOX: React.CSSProperties = {
  position: 'fixed',
  right: '1rem',
  bottom: '1rem',
  zIndex: 60,
  maxWidth: 'min(28rem, calc(100vw - 2rem))',
  boxShadow: '0 4px 16px rgb(20 33 61 / 0.25)',
}

function UpdateToast({ onReload, onLater }: { onReload: () => void; onLater: () => void }) {
  const { t } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
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
      style={BOX}
      className="flex flex-col gap-3 rounded-xl border border-rule bg-panel px-4 py-3 text-ink sm:flex-row sm:items-start"
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
