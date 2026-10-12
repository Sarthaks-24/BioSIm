import { lazy, Suspense, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_ORGANISM, type Simulation } from '@lifepeek/engine'
import BodyView from '../BodyView.tsx'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { BodyClockContext, MEAL_BODY_CLOCK } from '../../hooks/useBodyClock.ts'
import { ORGANISMS } from '../../registry/index.ts'
import { useRunStore } from '../../state/run.ts'
import LayerBar from './LayerBar.tsx'
import { NowLine } from './NowLine.tsx'
import SummaryLine from './SummaryLine.tsx'
import { mealNames } from './mealText.ts'

/** The full stage text is downloaded when "More" is first opened (size budget). */
const StageMore = lazy(() => import('./StageMore.tsx'))

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
 * lies over the top of the body in place of the layer switch, while there is only one layer to
 * switch to, and only the summary is a row, under the body.
 */
export default function BodyPane({ run, kept }: { run: Simulation; kept: Simulation | null }) {
  const { t, i18n } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const hasMeal = meal.length > 0
  const oneLayer = ORGANISMS[DEFAULT_ORGANISM].systems.length === 1
  const [more, setMore] = useState(false)
  const moreButton = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const closeMore = () => {
    setMore(false)
    moreButton.current?.focus()
  }
  const open = more && hasMeal

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
        {open && (
          // Beside the body from 1024 px up (the lit organ stays in view); over it on a phone.
          <Suspense fallback={null}>
            <StageMore
              run={run}
              id={panelId}
              onClose={closeMore}
              className="absolute inset-0 lg:inset-y-auto lg:top-14 lg:bottom-3 lg:left-4 lg:w-[min(25rem,46%)] lg:rounded-frame"
            />
          </Suspense>
        )}
      </div>
      {hasMeal && (
        // From 1024 px up one band under the body. On a phone the band dissolves (`contents`): the
        // Now line lies over the top of the body, where the layer switch was (it costs the body no
        // height; a fade of paper keeps it readable over the head), and the summary is a row under it.
        <div className="max-lg:contents lg:flex lg:flex-col lg:gap-1.5 lg:border-t lg:border-rule2 lg:px-4 lg:py-2.5">
          <NowLine
            run={run}
            open={open}
            onToggle={() => (open ? closeMore() : setMore(true))}
            moreRef={moreButton}
            panelId={panelId}
            className="max-lg:absolute max-lg:inset-x-0 max-lg:top-0 max-lg:z-10 max-lg:bg-linear-to-b max-lg:from-paper2 max-lg:from-70% max-lg:to-transparent max-lg:px-3 max-lg:pt-2 max-lg:pb-4"
          />
          <SummaryLine run={run} kept={kept} className="max-lg:border-t max-lg:border-rule2 max-lg:px-3 max-lg:py-1.5" />
        </div>
      )}
    </section>
  )
}
