import { Component, lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { InfoIcon } from '../kit/index.ts'
import Popover from '../stage/Popover.tsx'
import type { PanelProps } from './HowWeKnowPanel.tsx'

const loadPanel = () => import('./HowWeKnowPanel.tsx')
/** Fetch the panel early (pointing at or focusing a button); offline that may fail, and that is fine. */
const prefetch = () => void loadPanel().catch(() => {})
let HowWeKnowPanel = lazy(loadPanel)

/**
 * If the panel's code doesn't load (offline before it was saved, or a tab left open over a new
 * release), say so in the panel's place instead of the error taking the whole screen. React.lazy
 * keeps a failure for good, so a fresh one is made: the next try loads the file again.
 */
class PanelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch() {
    HowWeKnowPanel = lazy(loadPanel)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/**
 * The ⓘ "How we know" button of one graph (G3). Its panel (HowWeKnowPanel) and the source list
 * load the first time one is wanted: on pointing at or focusing a button, so it is there by the
 * time it is pressed (and offline, the service worker has it).
 */
export default function HowWeKnow({ title, ...panel }: PanelProps & { title?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  // Bumped by "Try again": a new boundary, so the panel is asked for again.
  const [attempt, setAttempt] = useState(0)
  const button = useRef<HTMLButtonElement>(null)
  const name = title ?? t(`${panel.meta.i18nKey}.name`)
  const label = t('graph.howFor', { name })
  const close = () => setOpen(false)

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={label}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onClick={() => setOpen((o) => !o)}
        // 44 px to touch on a phone; 28 px from 1024 px up, pulled into the header line so it adds no height.
        className="-my-2 grid size-11 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-sunk2 hover:text-ink aria-expanded:bg-sunk2 aria-expanded:text-ink lg:-my-1 lg:size-7"
      >
        <InfoIcon />
      </button>
      {open && (
        <PanelBoundary
          key={attempt}
          fallback={
            <Popover anchor={button} onClose={close} label={label} className="w-[20rem]">
              <p className="text-caption text-ink-2" role="alert">
                {t('graph.loadFailed')}
              </p>
              <button
                type="button"
                onClick={() => setAttempt((a) => a + 1)}
                className="mt-2 min-h-11 rounded-control bg-sunk2 px-3 text-control font-semibold text-ink hover:bg-sunk2-hover lg:min-h-9"
              >
                {t('graph.retry')}
              </button>
            </Popover>
          }
        >
          <Suspense fallback={null}>
            <HowWeKnowPanel {...panel} anchor={button} label={label} onClose={close} />
          </Suspense>
        </PanelBoundary>
      )}
    </>
  )
}

/** One labelled part of the panel. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="font-semibold text-ink">{title}</h4>
      <div>{children}</div>
    </section>
  )
}
