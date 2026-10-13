import { lazy, Suspense, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MAX_ITEMS } from '@lifepeek/engine'
import { useRunStore } from '../../state/run.ts'
import { IconButton, PlusIcon } from '../kit/index.ts'

/** The food search is downloaded the first time it is opened, with the stage's other sheets (Sheets.tsx, size budget). */
const FoodSearch = lazy(() => import('./Sheets.tsx').then((m) => ({ default: m.FoodSearch })))

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
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)

  const show = () => {
    const r = opener.current?.getBoundingClientRect()
    setAnchor(r ? { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - 24 * 16)) } : null)
    useRunStore.setState({ capBlocked: false })
    setOpen(true)
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
        className={`bg-sunk2/60 ${compact ? 'w-11 justify-center px-0 lg:w-9 [&>span]:sr-only' : ''}`}
      />
      {open && (
        <Suspense fallback={null}>
          <FoodSearch
            anchor={anchor}
            onClose={() => {
              setOpen(false)
              opener.current?.focus()
            }}
          />
        </Suspense>
      )}
    </>
  )
}
