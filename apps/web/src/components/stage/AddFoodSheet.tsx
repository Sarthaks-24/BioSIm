import { Suspense, useLayoutEffect, useRef, useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { create } from 'zustand'
import { MAX_ITEMS } from '@lifepeek/engine'
import { useRunStore } from '../../state/run.ts'
import { IconButton, PlusIcon } from '../kit/index.ts'
import { LoadBoundary, LoadFailedBox, lazyWithRetry } from '../LoadBoundary.tsx'
import type ActivitySheet from '../ActivitySheet.tsx'
import type FoodSearch from './FoodSearch.tsx'
import { BOUT_EMOJI, boutLabel, clockText } from './boutText.ts'

/** The most bouts the sheet adds (ui-ux §5; a link may hold more, up to the codec's 8). */
export const MAX_SHEET_BOUTS = 3

/**
 * The meal sheet's state: closed, or open on its Food or Activity tab, maybe changing one bout
 * (`edit`: its place in the plan). A store, so a bout chip can open it on that bout (E-3b-ui).
 * `switched`: the reader moved between Food and Activity, so the focus stays on that switch.
 * `returnTo`: the chip that opened it, which gets the focus back when it closes (else the chip now
 * in its place, else "+ Add"; R93 #10).
 */
export type MealSheet = { tab: 'food' | 'activity'; edit?: number; switched?: boolean } | null
export const useMealSheet = create<{ open: MealSheet; returnTo: HTMLElement | null }>(() => ({ open: null, returnTo: null }))

/** Opens the meal sheet from a chip's button (`from`), which gets the focus back when it closes. */
export const openMealSheet = (open: NonNullable<MealSheet>, from: HTMLElement) => useMealSheet.setState({ open, returnTo: from })

/**
 * The food search is downloaded the first time it is opened, with the stage's other sheets
 * (Sheets.tsx, size budget). If it doesn't arrive, a small box under the button says so.
 */
// `m?.`: when the file did not arrive and the page is reloading, the import resolves to nothing (LoadBoundary.tsx, `lazyWithRetry`).
const foodSearch = lazyWithRetry<ComponentProps<typeof FoodSearch>>(() => import('./Sheets.tsx').then((m) => ({ default: m?.FoodSearch })))

/**
 * The Activity half's code and words load the first time it is shown (R71/R74: load on demand; the
 * pack-manifest puts them in the lazy tier, never the precache). It gets the stage's parts it uses
 * as props, so it shares no code with the stage that the stage would have to split off.
 */
const activitySheet = lazyWithRetry<ComponentProps<typeof ActivitySheet>>(() => import('../ActivitySheet.tsx'))

/**
 * "+ Add food" (UI-13) and its sheet: a sheet on a phone, a panel under the button from 1024 px
 * up, with a "Food | Activity" switch (E-3b-ui; the activity half loads when first shown).
 * Closing it puts focus back on this button. With the meal full it opens on Activity.
 */
export default function AddFoodSheet({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const activity = useRunStore((s) => s.activity)
  const bouts = activity.length
  const full = meal.length >= MAX_ITEMS
  const opener = useRef<HTMLButtonElement>(null)
  const open = useMealSheet((s) => s.open)
  const returnTo = useMealSheet((s) => s.returnTo)
  const [attempt, setAttempt] = useState(0)
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null)

  // Placed under this button whoever opened it (the button, or a bout chip).
  useLayoutEffect(() => {
    if (!open) return
    const r = opener.current?.getBoundingClientRect()
    setAnchor(r ? { top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - 24 * 16)) } : null)
  }, [open])

  const show = () => {
    useRunStore.setState({ capBlocked: false })
    useMealSheet.setState({ open: { tab: full ? 'activity' : 'food' }, returnTo: null })
  }

  // The focus goes back (FoodSearch.tsx `focusBack`, with the sheet's code: not first paint) to the
  // chip that opened it, else the chip now in its place, else this button (R93 #10).
  const close = () => {
    const add = opener.current
    useMealSheet.setState({ open: null, returnTo: null })
    import('./Sheets.tsx').then(
      (m) => m.focusBack(add),
      () => add?.focus(),
    )
  }

  return (
    <>
      <IconButton
        ref={opener}
        icon={<PlusIcon />}
        label={t('sim.addFood')}
        onClick={show}
        disabled={full && bouts >= MAX_SHEET_BOUTS}
        aria-haspopup="dialog"
        data-add-food=""
        title={full ? t('stage.mealFull', { n: MAX_ITEMS }) : undefined}
        // Next to food chips "+" alone is clear (the words stay its name); with no food yet the
        // words show, as the first thing to do.
        className={`bg-surface-sunk/60 ${compact ? 'w-11 justify-center px-0 lg:w-9 [&>span]:sr-only' : ''}`}
      />
      {open && (
        <LoadBoundary
          key={attempt}
          onFail={() => {
            foodSearch.reset()
            activitySheet.reset()
          }}
          fallback={
            <LoadFailedBox attempt={attempt} style={anchor ?? undefined} onRetry={() => setAttempt((a) => a + 1)} onClose={close} />
          }
        >
          <Suspense fallback={null}>
            <foodSearch.Component
              anchor={anchor}
              tab={open.tab}
              // Switching Food | Activity keeps the focus on the switch; opening places it (R93 #11).
              place={!open.switched}
              from={returnTo}
              // If it does not arrive, this boundary's box says so, as for the food search.
              activity={
                <activitySheet.Component
                  edit={open.edit}
                  max={MAX_SHEET_BOUTS}
                  bouts={activity}
                  setBouts={useRunStore.getState().setActivity}
                  label={(b) => boutLabel(b, t)}
                  clock={clockText}
                  emoji={BOUT_EMOJI}
                  onDone={close}
                  place={!open.switched}
                />
              }
              onTab={(tab) => useMealSheet.setState({ open: { tab, switched: true } })}
              onClose={close}
            />
          </Suspense>
        </LoadBoundary>
      )}
    </>
  )
}
