import { useRef, useState, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import type { CountKind, CountLines, CountYoursProps } from './CountYours.tsx'

/** The timer, once its code has arrived (shared by every button: Breathing's, the heart's). */
let loaded: ComponentType<CountYoursProps> | null = null
const load = () => import('./CountYours.tsx').then((m) => (loaded = m.default))
/** Fetch the timer early (pointing at or focusing the button); offline that may fail, and that is fine. */
const prefetch = () => void load().catch(() => {})

/**
 * The "Count yours" button (X-2; ui-ux §8.2) beside a system's book line: Breathing's breaths a
 * minute, and the heart's pulse (U-3 adds it there: `<CountYoursButton kind="pulse" lines={…} />`).
 * Its 15-second timer (components/CountYours.tsx) is downloaded the first time it is wanted, in the
 * stage's Overlay; if it doesn't arrive, the button's line says so, with "Try again" (R71).
 *
 * It imports no stage module (no LoadBoundary): it rides in a system pack's chunk, and a stage
 * module a pack imports is cut out of /sim with everything the two share (flat/layerKit.ts).
 *
 * `lines` is called when it opens, so the model's line is the run's value at that minute of the
 * meal clock (which then waits while the timer is open).
 */
export default function CountYoursButton({
  kind,
  lines,
  className = '',
}: {
  kind: CountKind
  lines: () => CountLines
  className?: string
}) {
  const { t } = useTranslation()
  const button = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState<CountLines | null>(null)
  const [Panel, setPanel] = useState<ComponentType<CountYoursProps> | null>(() => loaded)
  const [failed, setFailed] = useState(false)

  const fetchPanel = () => {
    setFailed(false)
    load().then(
      (C) => setPanel(() => C),
      () => setFailed(true),
    )
  }
  const press = () => {
    if (open) return setOpen(null)
    setOpen(lines())
    if (!Panel) fetchPanel()
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        data-count-open={kind}
        aria-expanded={open !== null}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onClick={press}
        // 44 px to touch on a phone, a text-sized button from 1024 px up.
        className={`inline-flex min-h-11 items-center rounded-control px-2 font-semibold text-ink underline underline-offset-2 hover:bg-surface-sunk lg:min-h-9 ${className}`}
      >
        {t('count.open')}
      </button>
      {open && failed && (
        <span className="flex basis-full flex-wrap items-center gap-x-2">
          <span role="alert">{t(navigator.onLine ? 'graph.loadFailed' : 'sim.needsInternet')}</span>
          <button
            type="button"
            onClick={fetchPanel}
            className="min-h-11 rounded-control px-2 font-semibold text-ink underline hover:bg-surface-sunk lg:min-h-9"
          >
            {t('graph.retry')}
          </button>
        </span>
      )}
      {open && Panel && <Panel kind={kind} lines={open} anchor={button} onClose={() => setOpen(null)} />}
    </>
  )
}
