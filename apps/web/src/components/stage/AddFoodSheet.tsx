import { Suspense, useRef, useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_ITEMS } from '@lifepeek/engine'
import { useRunStore } from '../../state/run.ts'
import { IconButton, PlusIcon } from '../kit/index.ts'
import { LoadBoundary, LoadFailedBox, lazyWithRetry } from '../LoadBoundary.tsx'
import type FoodSearch from './FoodSearch.tsx'

/**
 * The food search is downloaded the first time it is opened, with the stage's other sheets
 * (Sheets.tsx, size budget). If it doesn't arrive, a small box under the button says so.
 */
// `m?.`: when the file did not arrive and the page is reloading, the import resolves to nothing (LoadBoundary.tsx, `lazyWithRetry`).
const foodSearch = lazyWithRetry<ComponentProps<typeof FoodSearch>>(() => import('./Sheets.tsx').then((m) => ({ default: m?.FoodSearch })))

/**
 * "+ Add food" (UI-13) and its food search (FoodSearch): a sheet on a phone, a panel under the
 * button from 1024 px up. Closing it puts focus back on this button.
 */
export default function AddFoodSheet({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const full = meal.length >= MAX_ITEMS
  const opener = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)

  const show = () => {
    const r = opener.current?.getBoundingClientRect()
    setAnchor(r ? { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - 24 * 16)) } : null)
    useRunStore.setState({ capBlocked: false })
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    opener.current?.focus()
  }

  return (
    <>
      <IconButton
        ref={opener}
        icon={<PlusIcon />}
        label={t('sim.addFood')}
        onClick={show}
        disabled={full}
        aria-haspopup="dialog"
        title={full ? t('stage.mealFull', { n: MAX_ITEMS }) : undefined}
        // Next to food chips "+" alone is clear (the words stay its name); with no food yet the
        // words show, as the first thing to do.
        className={`bg-surface-sunk/60 ${compact ? 'w-11 justify-center px-0 lg:w-9 [&>span]:sr-only' : ''}`}
      />
      {open && (
        <LoadBoundary
          key={attempt}
          onFail={foodSearch.reset}
          fallback={
            <LoadFailedBox attempt={attempt} style={anchor ?? undefined} onRetry={() => setAttempt((a) => a + 1)} onClose={close} />
          }
        >
          <Suspense fallback={null}>
            <foodSearch.Component anchor={anchor} onClose={close} />
          </Suspense>
        </LoadBoundary>
      )}
    </>
  )
}
