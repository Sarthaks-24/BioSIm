import { Component, lazy, useState, type ComponentType, type LazyExoticComponent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Code that loads on first use ("How we know", "More", the report form) can fail to arrive:
 * offline before it was saved, or a tab left open over a new release (main.tsx reloads once for
 * that; a second failure lands here). A failed part must say so in its own place, never take the
 * whole stage down to the error page (review 14-17, HIGH 2).
 *
 * React.lazy keeps a failure for good, so each lazy part is made with `lazyWithRetry`: the
 * boundary calls `reset` when it catches, and the next try (a new boundary, `key={attempt}`)
 * loads the file again.
 */
export interface RetryableLazy<P> {
  /** The current lazy component (read it at render time: `reset` replaces it). */
  readonly Component: LazyExoticComponent<ComponentType<P>>
  reset: () => void
}

export function lazyWithRetry<P>(load: () => Promise<{ default: ComponentType<P> }>): RetryableLazy<P> {
  let current = lazy(load)
  return {
    get Component() {
      return current
    },
    reset: () => void (current = lazy(load)),
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
 * the rest of the page's life, and only a reload asks for it again.
 */
export function LoadFailed({ onRetry, attempt = 0 }: { onRetry: () => void; attempt?: number }) {
  const { t } = useTranslation()
  const button = 'mt-2 min-h-11 rounded-control bg-sunk2 px-3 text-control font-semibold text-ink hover:bg-sunk2-hover lg:min-h-9'
  return (
    <>
      <p className="text-caption text-ink-2" role="alert">
        {t('graph.loadFailed')}
      </p>
      <span className="flex flex-wrap gap-2">
        <button type="button" onClick={onRetry} className={button}>
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
 * For a part opened by a button (the report form): the button stays, with the failure in a small
 * panel under it until "Try again" (or the button, which hides it). Not a popover: nothing else on
 * the page (a scroll, the 3D body arriving) may close it before it is read.
 */
export function LoadFailedPanel({
  trigger,
  onRetry,
  attempt,
}: {
  trigger: (toggle: () => void) => ReactNode
  onRetry: () => void
  attempt: number
}) {
  const [open, setOpen] = useState(true)
  return (
    <span className="relative inline-flex">
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <span className="absolute top-full right-0 z-40 mt-1.5 block w-[20rem] max-w-[calc(100vw-1rem)] rounded-control border border-rule2 bg-shelf p-3 text-ink shadow-[0_6px_24px_-8px_rgb(20_33_61/0.35)]">
          <LoadFailed onRetry={onRetry} attempt={attempt} />
        </span>
      )}
    </span>
  )
}
