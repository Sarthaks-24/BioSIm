import { lazy, Suspense, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { InfoIcon } from '../kit/index.ts'
import type { PanelProps } from './HowWeKnowPanel.tsx'

const loadPanel = () => import('./HowWeKnowPanel.tsx')
const HowWeKnowPanel = lazy(loadPanel)

/**
 * The ⓘ "How we know" button of one graph (G3). Its panel (HowWeKnowPanel) and the source list
 * load the first time one is wanted: on pointing at or focusing a button, so it is there by the
 * time it is pressed (and offline, the service worker has it).
 */
export default function HowWeKnow({ title, ...panel }: PanelProps & { title?: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const name = title ?? t(`${panel.meta.i18nKey}.name`)
  const label = t('graph.howFor', { name })

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={label}
        onPointerEnter={loadPanel}
        onFocus={loadPanel}
        onClick={() => setOpen((o) => !o)}
        // 44 px to touch on a phone; 28 px from 1024 px up, pulled into the header line so it adds no height.
        className="-my-2 grid size-11 shrink-0 place-items-center rounded-control text-ink-2 hover:bg-sunk2 hover:text-ink aria-expanded:bg-sunk2 aria-expanded:text-ink lg:-my-1 lg:size-7"
      >
        <InfoIcon />
      </button>
      {open && (
        <Suspense fallback={null}>
          <HowWeKnowPanel {...panel} anchor={button} label={label} onClose={() => setOpen(false)} />
        </Suspense>
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
