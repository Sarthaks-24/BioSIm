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

/** Shows `fallback` in place of its children if they throw (a file that did not load), and calls `onFail`. */
export class LoadBoundary extends Component<{ fallback: ReactNode; onFail: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    this.props.onFail()
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** "This didn't load. Check the internet connection and try again." and "Try again". */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <p className="text-caption text-ink-2" role="alert">
        {t('graph.loadFailed')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 min-h-11 rounded-control bg-sunk2 px-3 text-control font-semibold text-ink hover:bg-sunk2-hover lg:min-h-9"
      >
        {t('graph.retry')}
      </button>
    </>
  )
}

/**
 * For a part opened by a button (the report form): the button stays, with the failure in a small
 * panel under it until "Try again" (or the button, which hides it). Not a popover: nothing else on
 * the page (a scroll, the 3D body arriving) may close it before it is read.
 */
export function LoadFailedPanel({ trigger, onRetry }: { trigger: (toggle: () => void) => ReactNode; onRetry: () => void }) {
  const [open, setOpen] = useState(true)
  return (
    <span className="relative inline-flex">
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <span className="absolute top-full right-0 z-40 mt-1.5 block w-[20rem] max-w-[calc(100vw-1rem)] rounded-control border border-rule2 bg-shelf p-3 text-ink shadow-[0_6px_24px_-8px_rgb(20_33_61/0.35)]">
          <LoadFailed onRetry={onRetry} />
        </span>
      )}
    </span>
  )
}
