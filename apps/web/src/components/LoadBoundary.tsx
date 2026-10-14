import { Component, lazy, type ComponentType, type CSSProperties, type LazyExoticComponent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CloseIcon } from './kit/index.ts'

/**
 * Code that loads on first use ("How we know", "More", the report form, the stage's panels) can fail to arrive:
 * offline before it was saved, or a tab left open over a new release (main.tsx reloads once for
 * that; a second failure lands here). A failed part must say so in its own place, never take the
 * whole stage down to the error page (review 14-17, HIGH 2).
 *
 * React.lazy keeps a failure for good, so each lazy part is made with `lazyWithRetry`: the
 * boundary calls `reset` when it catches, and the next try (a new boundary, `key={attempt}`)
 * loads the file again.
 *
 * Nothing arrived is a load failure too ("Loading chunk failed"). main.tsx cancels Vite's
 * `vite:preloadError` to reload the page, and the import then resolves to nothing: React.lazy
 * would throw "must resolve to a class or function", which is not a load error, and the route's
 * error page would show until the reload (review FIX-D + WP-18, MED 2). A part picked out of a
 * module (`m?.FoodSearch`) that is missing for the same reason fails the same way.
 */
export interface RetryableLazy<P> {
  /** The current lazy component (read it at render time: `reset` replaces it). */
  readonly Component: LazyExoticComponent<ComponentType<P>>
  reset: () => void
}

export function lazyWithRetry<P>(load: () => Promise<{ default?: ComponentType<P> } | undefined>): RetryableLazy<P> {
  const make = () =>
    lazy(() =>
      load().then((m) => {
        if (!m?.default) throw new Error('Loading chunk failed')
        return m as { default: ComponentType<P> }
      }),
    )
  let current = make()
  return {
    get Component() {
      return current
    },
    reset: () => void (current = make()),
  }
}

/**
 * True for an error that means "the file did not arrive" (FIX-C review, item 5). Each browser
 * words it its own way: Chromium "Failed to fetch dynamically imported module", Firefox "error
 * loading dynamically imported module", Safari "Importing a module script failed"; Vite's own
 * "Unable to preload CSS"; a bundler's ChunkLoadError.
 */
export function isLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.name === 'ChunkLoadError' ||
    /dynamically imported module|Importing a module script failed|Unable to preload|Loading (CSS )?chunk/i.test(error.message)
  )
}

/**
 * Shows `fallback` in place of its children if their file did not load, and calls `onFail`. Any
 * other error is a bug in the part itself: "check the connection" would be wrong and "Try again"
 * could never work, so it goes on to the route's error page (FIX-C review, item 5).
 */
export class LoadBoundary extends Component<
  { fallback: ReactNode; onFail: () => void; children: ReactNode },
  { error: { thrown: unknown } | null }
> {
  state = { error: null as { thrown: unknown } | null }
  static getDerivedStateFromError(thrown: unknown) {
    return { error: { thrown } }
  }
  componentDidCatch(thrown: unknown) {
    if (isLoadError(thrown)) this.props.onFail()
  }
  render() {
    const { error } = this.state
    if (!error) return this.props.children
    if (!isLoadError(error.thrown)) throw error.thrown
    return this.props.fallback
  }
}

/**
 * "This didn't load. Check the internet connection and try again." and "Try again". Once a try
 * again has failed too (`attempt` ≥ 1), also "Reload": some browsers remember a failed file for
 * the rest of the page's life, and only a reload asks for it again. `focus`: "Try again" takes the
 * focus when it appears (the box stands in for a sheet the person just opened).
 */
export function LoadFailed({ onRetry, attempt = 0, focus = false }: { onRetry: () => void; attempt?: number; focus?: boolean }) {
  const { t } = useTranslation()
  const button =
    'mt-2 min-h-11 rounded-control bg-surface-sunk px-3 text-control font-semibold text-ink hover:bg-surface-sunk-hover lg:min-h-9'
  return (
    <>
      <p className="text-caption text-ink-muted" role="alert">
        {/* Offline, the part was never saved: it needs the internet once (R71). */}
        {t(navigator.onLine ? 'graph.loadFailed' : 'sim.needsInternet')}
      </p>
      <span className="flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} autoFocus={focus} className={button}>
          {t('graph.retry')}
        </button>
        {attempt > 0 && (
          <button type="button" onClick={() => window.location.reload()} className={button}>
            {t('error.reload')}
          </button>
        )}
      </span>
    </>
  )
}

/**
 * For a sheet or a search that did not load (the table, keys and settings, the food search): a
 * small box where it would have opened, with "Try again" and ✕. Not a dialog: the stage behind
 * still works. `style` places it (under its button); without it, low in the middle of the window.
 * "Try again" has the focus, as the sheet would have, so Escape closes the box and a failed try
 * again does not drop the focus to the page (review FIX-D + WP-18, LOW 3).
 */
export function LoadFailedBox({
  onRetry,
  onClose,
  attempt,
  style,
}: {
  onRetry: () => void
  onClose: () => void
  attempt: number
  style?: CSSProperties
}) {
  const { t } = useTranslation()
  return (
    <div
      data-load-failed=""
      style={style}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      className={`fixed z-40 flex w-[20rem] max-w-[calc(100vw-1rem)] items-start gap-2 rounded-control border border-border bg-surface-raised p-3 text-ink shadow-[0_6px_24px_-8px_rgb(20_33_61/0.35)] ${
        style ? '' : 'bottom-24 left-1/2 -translate-x-1/2'
      }`}
    >
      <div className="min-w-0 flex-1">
        <LoadFailed onRetry={onRetry} attempt={attempt} focus />
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label={t('stage.close')}
        title={t('stage.close')}
        className="-mt-1.5 -mr-1.5 grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-sunk hover:text-ink lg:size-9"
      >
        <CloseIcon />
      </button>
    </div>
  )
}
