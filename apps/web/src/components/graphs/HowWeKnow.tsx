import { Suspense, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { InfoIcon } from '../kit/index.ts'
import { LoadBoundary, LoadFailed, lazyWithRetry } from '../LoadBoundary.tsx'
import Popover from '../stage/Popover.tsx'
import type { PanelProps } from './HowWeKnowPanel.tsx'

const loadPanel = () => import('./HowWeKnowPanel.tsx')
/** Fetch the panel early (pointing at or focusing a button); offline that may fail, and that is fine. */
const prefetch = () => void loadPanel().catch(() => {})
/** If it doesn't load, the panel's place says so, with "Try again" (LoadBoundary). */
const panelCode = lazyWithRetry(loadPanel)

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
  const Panel = panelCode.Component

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
        className="-my-2 grid size-11 shrink-0 place-items-center rounded-control text-ink-muted hover:bg-surface-sunk hover:text-ink aria-expanded:bg-surface-sunk aria-expanded:text-ink lg:-my-1 lg:size-7"
      >
        <InfoIcon />
      </button>
      {open && (
        <LoadBoundary
          key={attempt}
          onFail={panelCode.reset}
          fallback={
            <Popover anchor={button} onClose={close} label={label} className="w-[20rem]">
              <LoadFailed onRetry={() => setAttempt((a) => a + 1)} attempt={attempt} />
            </Popover>
          }
        >
          <Suspense fallback={null}>
            <Panel {...panel} anchor={button} label={label} onClose={close} />
          </Suspense>
        </LoadBoundary>
      )}
    </>
  )
}

/**
 * A text read when it is drawn, not when its element is made: for notes passed to the panel whose
 * English (`limits.*`, the rings' `graph.*Note`) loads with the panel itself.
 */
export function Say({ k }: { k: string }) {
  const { t } = useTranslation()
  return t(k)
}

/** One labelled part of the panel. */
export function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h4 className="font-semibold text-ink">{title}</h4>
      <div>{children}</div>
    </section>
  )
}
