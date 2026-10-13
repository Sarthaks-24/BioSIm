import { Suspense, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_ORGANISM, type Simulation } from '@lifepeek/engine'
import BodyView from '../BodyView.tsx'
import { LoadBoundary, LoadFailed, lazyWithRetry } from '../LoadBoundary.tsx'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { BodyClockContext, MEAL_BODY_CLOCK } from '../../hooks/useBodyClock.ts'
import { ORGANISMS } from '../../registry/index.ts'
import { useRunStore } from '../../state/run.ts'
import LayerBar from './LayerBar.tsx'
import { NowLine } from './NowLine.tsx'
import ParticleKey from './ParticleKey.tsx'
import PlayPrompt, { useAtStart } from './PlayPrompt.tsx'
import SummaryLine from './SummaryLine.tsx'
import { mealNames } from './mealText.ts'

/** The full stage text is downloaded when "More" is first opened (size budget). If it doesn't load, its panel says so. */
const stageMore = lazyWithRetry(() => import('./StageMore.tsx'))

/** Where "More" sits: beside the body from 1024 px up, over it on a phone. */
const MORE_BOX = 'absolute inset-0 lg:inset-y-auto lg:top-14 lg:bottom-3 lg:left-4 lg:w-[min(25rem,46%)] lg:rounded-frame'

/** Foods offered when the meal is empty: a drink, an Indian staple, a fruit. */
const EXAMPLES = ['cola', 'roti', 'apple'] as const

/**
 * The body: the one big thing on the stage. The 3D body when the device can draw it (a separate
 * download, fetched only here), the flat diagram while it loads and when it can't (BodyView). It
 * follows the meal clock. With an empty meal it asks for a food instead, with a few to tap.
 *
 * Under the body, the stage's words (WP-14, council verdicts #3 and #4): the Now line (where the
 * food is and what that organ does, with "More") and the summary sentence. They are rows of this
 * pane, so their height comes out of the body's, never the graphs' or the dock's, and nothing
 * scrolls. On a phone the first screen has no height to spare (council 2026-10-13): the Now line
 * is a row above the body, in place of the layer switch while there is only one layer to switch
 * to, and the summary a row under it. It used to lie over the top of the body and hid the stomach
 * there, most of all in Hindi (WP-18); as rows, nothing covers the picture.
 */
export default function BodyPane({ run, kept }: { run: Simulation; kept: Simulation | null }) {
  const { t, i18n } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const hasMeal = meal.length > 0
  const oneLayer = ORGANISMS[DEFAULT_ORGANISM].systems.length === 1
  const [more, setMore] = useState(false)
  // Clearing the meal closes "More": it must not open again (and take the focus) with the next food.
  const [hadMeal, setHadMeal] = useState(hasMeal)
  if (hadMeal !== hasMeal) {
    setHadMeal(hasMeal)
    if (!hasMeal) setMore(false)
  }
  // Bumped by "Try again" when the stage text didn't load: a new boundary asks for it again.
  const [attempt, setAttempt] = useState(0)
  const moreButton = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const closeMore = () => {
    setMore(false)
    moreButton.current?.focus()
  }
  const open = more && hasMeal
  const atStart = useAtStart()
  const StageMore = stageMore.Component

  return (
    <section aria-labelledby="body-pane-title" className="relative flex min-h-0 flex-col">
      <h2 id="body-pane-title" className="sr-only">
        {t('stage.body')}
      </h2>
      {/* The layer switch sits in the body's top corner, over empty paper, so it costs the body no height. */}
      {/* Full width so a long list scrolls instead of being cut; only the control itself takes clicks. */}
      <div
        className={`pointer-events-none absolute inset-x-3 top-2 z-10 lg:inset-x-4 lg:top-3 ${oneLayer && hasMeal ? 'max-lg:hidden' : ''}`}
      >
        <LayerBar className="pointer-events-auto w-fit" />
      </div>
      {/* The body fills whatever height the stage leaves it (absolute, so the canvas can't push the row taller). */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          {hasMeal ? (
            <BodyClockContext value={MEAL_BODY_CLOCK}>
              <BodyView sim={run} label={t('stage.bodyLabel', { meal: mealNames(meal, i18n.language) })} />
            </BodyClockContext>
          ) : (
            <div className="grid h-full place-content-center justify-items-center gap-3 p-6 text-center">
              <p className="max-w-[28ch] text-title font-extrabold text-ink">{t('stage.empty')}</p>
              <ul className="flex flex-wrap justify-center gap-2" aria-label={t('stage.examples')}>
                {EXAMPLES.map((id) => {
                  const food = lookupFood(id)
                  if (!food) return null
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => useRunStore.getState().addFood(id)}
                        className="flex min-h-11 items-center gap-1.5 rounded-control bg-sunk2 px-3 text-control font-semibold hover:bg-sunk2-hover lg:min-h-9"
                      >
                        <span aria-hidden="true">{food.emoji}</span>
                        {localized(food.name, i18n.language)}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
        {/*
         * From 1024 px up, a band over the legs, out of the organs' way: what the food pieces are
         * (council round 2). While the clock stands at the start nothing has moved yet, so what to do
         * first takes its place, as on a phone. Not while "More" covers the body.
         */}
        {hasMeal && (
          <div className="pointer-events-none absolute inset-x-4 bottom-1.5 grid items-end justify-items-start max-lg:hidden [&>*]:col-start-1 [&>*]:row-start-1">
            <ParticleKey run={run} className={`max-w-[70%] flex-wrap ${atStart && !open ? 'invisible' : ''}`} />
            {!open && (
              <PlayPrompt
                meal={meal}
                className="-ml-1.5 max-w-full rounded-[1.125rem] bg-shelf/90 px-3 py-1 text-control leading-6 shadow-[0_1px_3px_rgb(20_33_61/0.18)]"
              />
            )}
          </div>
        )}
        {open && (
          // Beside the body from 1024 px up (the lit organ stays in view); over it on a phone.
          <LoadBoundary
            key={attempt}
            onFail={stageMore.reset}
            fallback={
              <section id={panelId} aria-label={t('now.more')} className={`${MORE_BOX} z-20 border border-rule2 bg-shelf p-4`}>
                <LoadFailed onRetry={() => setAttempt((a) => a + 1)} attempt={attempt} />
              </section>
            }
          >
            <Suspense fallback={null}>
              <StageMore run={run} id={panelId} onClose={closeMore} className={MORE_BOX} />
            </Suspense>
          </LoadBoundary>
        )}
      </div>
      {/*
       * On a phone the picture is short and the large intestine's label sits by the legs, so the
       * key is a line of its own under the picture, never on a label (WP-18). It scrolls if long.
       */}
      {hasMeal && (
        // At the start the prompt takes the key's place (nothing has moved yet): the same row, so the
        // body above keeps its size, and nothing is laid over the picture or its labels.
        <div className="grid px-3 pb-0.5 lg:hidden [&>*]:col-start-1 [&>*]:row-start-1">
          <ParticleKey
            run={run}
            className={`overflow-x-auto overscroll-x-contain whitespace-nowrap [scrollbar-width:none] ${atStart && !open ? 'invisible' : ''}`}
          />
          {!open && <PlayPrompt meal={meal} className="text-caption leading-6" />}
        </div>
      )}
      {hasMeal && (
        // From 1024 px up one band under the body. On a phone the band dissolves (`contents`): the
        // Now line is the pane's first row, above the body, and the summary its last.
        <div className="max-lg:contents lg:flex lg:flex-col lg:gap-1.5 lg:border-t lg:border-rule2 lg:px-4 lg:py-2.5">
          <NowLine
            run={run}
            kept={kept}
            open={open}
            onToggle={() => (open ? closeMore() : setMore(true))}
            moreRef={moreButton}
            panelId={panelId}
            className="max-lg:order-first max-lg:px-3 max-lg:pt-1 max-lg:pb-0.5"
          />
          <SummaryLine run={run} kept={kept} className="max-lg:border-t max-lg:border-rule2 max-lg:px-3 max-lg:py-1" />
        </div>
      )}
    </section>
  )
}
