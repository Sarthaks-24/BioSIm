import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import linkText from 'virtual:lifepeek-en/link'
import { addEnglish } from '../../i18n/index.ts'
import { isNewer, linkNotes } from '../../lib/linkNotes.ts'
import type { useRunStore } from '../../state/run.ts'
import { InfoIcon } from '../kit/index.ts'

// Its English comes with it (size budget, scripts/i18n-sections.mjs).
addEnglish(linkText)

/**
 * The notes about the opened link, under the meal bar (Notes.tsx), as items of its list: Hindi
 * later, an older or newer version, foods that no longer exist, what changed on load (B21,
 * lib/linkNotes.ts), and a meal over the size the model is good for. Downloaded only when an opened link has one (size budget). The run store
 * and the foods' names come from Notes: a module of the stage imported here too would be split
 * out of the stage's file into one of its own, which every visit downloads.
 */
export default function LinkNotes({
  store,
  food,
  over,
}: {
  store: typeof useRunStore
  food: (id: string) => string
  over: readonly boolean[]
}) {
  const { t } = useTranslation()
  const linkModelVersion = store((s) => s.linkModelVersion)
  const unknownOrganism = store((s) => s.unknownOrganism)
  const droppedFoods = store((s) => s.droppedFoods)
  const hindiLater = store((s) => s.hindiLater)
  const changes = store((s) => s.changes)
  const link = { linkModelVersion, unknownOrganism, droppedFoods, hindiLater, changes }
  return (
    <>
      {isNewer(link) && (
        <Note>
          <Newer />
        </Note>
      )}
      {linkNotes(link, t, food, over).map((n) => (
        <Note key={n}>{n}</Note>
      ))}
    </>
  )
}

const Note = ({ children }: { children: ReactNode }) => (
  <li role="note" className="flex items-start gap-2 text-control">
    <span className="mt-px text-ink-muted">
      <InfoIcon />
    </span>
    <span>{children}</span>
  </li>
)

/**
 * A link made by a newer LifePeek (architecture §2; it must be in production before any v=3
 * link exists, since an old app cannot learn this later). Offline: it says so, and that the walk
 * or run is not shown until the app is updated. Online: it asks the server for the new version
 * (`registration.update()`), and once its service worker is waiting, "Update now" lets it take
 * over and reloads the link. The link sync left the address as the link came
 * (hooks/useLinkSync.ts), so the reload opens it whole. Without a new version (or with service
 * workers blocked) the note just says the link may show differently.
 */
function Newer() {
  const { t } = useTranslation()
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null)
  const online = navigator.onLine
  useEffect(() => {
    if (!online) return
    let live = true
    let sw: ServiceWorkerContainer | undefined
    try {
      sw = navigator.serviceWorker
    } catch {
      return // site data blocked: the getter throws (Firefox)
    }
    sw?.getRegistration()
      .then((r) => {
        if (!r) return
        const check = () => live && r.waiting && setWaiting(r.waiting)
        r.addEventListener('updatefound', () => r.installing?.addEventListener('statechange', check))
        check()
        return r.update().then(check)
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [online])
  if (!online) return t('link.newerOffline')
  const update = () => {
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
    waiting!.postMessage({ type: 'SKIP_WAITING' })
  }
  return (
    <>
      {t('link.newer')}{' '}
      {waiting && (
        <button type="button" onClick={update} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white">
          {t('link.update')}
        </button>
      )}
    </>
  )
}
