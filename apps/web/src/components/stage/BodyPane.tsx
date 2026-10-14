import { Suspense, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { RunResult } from '@lifepeek/engine'
import BodyView from '../BodyView.tsx'
import { LoadBoundary, LoadFailed, lazyWithRetry } from '../LoadBoundary.tsx'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { BodyClockContext, MEAL_BODY_CLOCK } from '../../hooks/useBodyClock.ts'
import { useRunStore } from '../../state/run.ts'
import { systemOf } from '../../systems/registry.ts'
import { useSystemUi } from '../../systems/ui.ts'
import SystemTitle from '../SystemTitle.tsx'
import ParticleKey from './ParticleKey.tsx'
import PlayPrompt, { useAtStart } from './PlayPrompt.tsx'
import SummaryLine from './SummaryLine.tsx'
import { useActivityBand } from '../../lib/bouts.ts'
import { BOUT_EMOJI, boutLabel, inSentence } from './boutText.ts'
import { mealNames, shortFoodName } from './mealText.ts'

/** The full stage text is downloaded when "More" is first opened (size budget). If it doesn't load, its panel says so. */
const stageMore = lazyWithRetry(() => import('./StageMore.tsx'))

/**
 * "More" (StageMore): from 1024 px up a column at the pane's right, and the body moves left to make
 * room for it (FP-5, U4: it covered the body, its labels and the food pieces' key). If its text
 * doesn't load, the box that says so takes the same place (on a phone, the body's lower edge).
 */
const MORE_ROOM = 'lg:right-[min(25rem,46%)]'
const MORE_FAILED =
  'absolute inset-x-0 bottom-0 z-20 border-t border-border bg-surface-raised p-4 lg:inset-y-0 lg:left-auto lg:w-[min(25rem,46%)] lg:border-t-0 lg:border-l'

/** Foods offered when the meal is empty: a drink, an Indian staple, a fruit. */
const EXAMPLES = ['cola', 'roti', 'apple'] as const
/** The activity offered beside them (E-3b-ui, ui-ux §6): "Try: walk 20 min, from 0:30". One tap; its chip's ✕ undoes it. */
const TRY_BOUT = { kind: 'walk', startMin: 30, durMin: 20 } as const

/**
 * The body: the one big thing on the stage. The 3D body when the device can draw it (a separate
 * download, fetched only here), the flat diagram while it loads and when it can't (BodyView). It
 * follows the meal clock. With an empty meal the body rests, and a card under it offers a few foods.
 *
 * Under the body, the stage's words (WP-14, council verdicts #3 and #4): the Now line (where the
 * food is and what that organ does, with "More") and the summary sentence. They are rows of this
 * pane, so their height comes out of the body's, never the graphs' or the dock's, and nothing
 * scrolls. On a phone the first screen has no height to spare (council 2026-10-13): the Now line
 * is a row above the body, in place of the layer switch while there is only one layer to switch
 * to, and the summary a row under it. It used to lie over the top of the body and hid the stomach
 * there, most of all in Hindi (WP-18); as rows, nothing covers the picture.
 */
export default function BodyPane({
  run,
  kept,
  summary,
  summaryTo,
}: {
  run: RunResult
  kept: RunResult | null
  summary: boolean
  /** Where the summary goes instead of under the body: a small projector window's box under the graph (FP-2). */
  summaryTo?: HTMLElement | null
}) {
  const { t, i18n } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  const resting = useRunStore((s) => s.activity.length === 0)
  const hasMeal = meal.length > 0
  // The body's stance at the clock time (R4, R16, R32: rest, or one still pose per kind).
  // The body's still pose for the band (A-0 flat, flat/limbs.ts); also on the box for the tests.
  const band = useActivityBand()
  // The food pieces are Digestion's picture's; another system's has none, so no key to them.
  const pieces = useRunStore((s) => systemOf(s.layer)?.draw === 'body')
  // The lit system's Now line (W-1): digestion's says where the meal is; a rhythm system's chip (U-2).
  const { now: NowLine, chip: Chip } = useSystemUi()
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
  const bodyBox = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const closeMore = () => {
    setMore(false)
    moreButton.current?.focus()
  }
  const open = more && hasMeal
  const atStart = useAtStart()
  const StageMore = stageMore.Component

  return (
    <section aria-labelledby="body-pane-title" className="relative flex flex-col lg:min-h-0">
      <h2 id="body-pane-title" className="sr-only">
        {t('stage.body')}
      </h2>
      {/* The body fills whatever height the stage leaves it (absolute, so the canvas can't push the row taller). */}
      <div ref={bodyBox} data-activity-band={band} className="relative min-h-40 flex-1 lg:min-h-0">
        {/*
         * The system's title (and a rhythm system's chip) in the body's top corner, over the empty
         * paper beside the head, so they cost the body no height (U-2; ui-ux §3.2, §9). Only the
         * controls themselves take clicks.
         */}
        <div className="pointer-events-none absolute inset-x-3 top-2 z-10 flex flex-col items-start gap-1 lg:inset-x-4 lg:top-3">
          <SystemTitle run={run} />
          {Chip && <Chip run={run} />}
        </div>
        {/* With "More" open from 1024 px up, the body and its key move left of it (MORE_ROOM). */}
        <div className={`absolute inset-0 ${open ? MORE_ROOM : ''}`}>
          {/* With no food yet the body still shows, resting (R23): the picks are a card under it. */}
          <BodyClockContext value={MEAL_BODY_CLOCK}>
            <BodyView
              band={band}
              sim={run}
              label={hasMeal ? t('stage.bodyLabel', { meal: mealNames(meal, i18n.language) }) : t('stage.bodyResting')}
            />
          </BodyClockContext>
          {/*
           * From 1024 px up, a band over the legs, out of the organs' way: what the food pieces are
           * (council round 2). While the clock stands at the start nothing has moved yet, so what to do
           * first takes its place, as on a phone. Not while "More" is open.
           */}
          {hasMeal && (
            <div className="pointer-events-none absolute inset-x-4 bottom-1.5 grid items-end justify-items-start max-lg:hidden [&>*]:col-start-1 [&>*]:row-start-1">
              {pieces && !summaryTo && <ParticleKey run={run} className={`max-w-[70%] flex-wrap ${atStart && !open ? 'invisible' : ''}`} />}
              {!open && (
                <PlayPrompt
                  meal={meal}
                  className="-ml-1.5 max-w-full rounded-[1.125rem] bg-surface-raised/90 px-3 py-1 text-control leading-6 shadow-[0_1px_3px_rgb(20_33_61/0.18)]"
                />
              )}
            </div>
          )}
        </div>
        {open && (
          <LoadBoundary
            key={attempt}
            onFail={stageMore.reset}
            fallback={
              <section id={panelId} aria-label={t('now.more')} className={MORE_FAILED}>
                <LoadFailed onRetry={() => setAttempt((a) => a + 1)} attempt={attempt} />
              </section>
            }
          >
            <Suspense fallback={null}>
              <StageMore run={run} id={panelId} anchor={moreButton} body={bodyBox} onClose={closeMore} />
            </Suspense>
          </LoadBoundary>
        )}
      </div>
      {/*
       * On a phone the picture is short and the large intestine's label sits by the legs, so the
       * key is a line of its own under the picture, never on a label (WP-18). It scrolls if long.
       */}
      {!hasMeal && (
        // The food picks (R23, FP-1 owns the empty state; E-3b-ui adds the activity ones): a card
        // under the body's feet, over none of it, so the resting body is whole.
        <div className="grid place-items-center px-3 pb-2 lg:pb-4">
          <div className="grid max-w-full justify-items-center gap-2 rounded-frame border border-border bg-surface-raised px-3 py-2 text-center lg:gap-3 lg:px-6 lg:py-4">
            <p className="text-control font-extrabold text-ink lg:text-title">{t('stage.empty')}</p>
            {/* One row: it scrolls sideways rather than wrap (a long translation). */}
            <ul className="flex max-w-full gap-2 overflow-x-auto [scrollbar-width:none]" aria-label={t('stage.examples')}>
              {EXAMPLES.map((id) => {
                const food = lookupFood(id)
                if (!food) return null
                return (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => useRunStore.getState().addFood(id)}
                      className="flex min-h-11 items-center gap-1.5 rounded-control bg-surface-sunk px-2.5 text-control font-semibold whitespace-nowrap hover:bg-surface-sunk-hover lg:min-h-9"
                    >
                      <span aria-hidden="true">{food.emoji}</span>
                      {shortFoodName(localized(food.name, i18n.language))}
                    </button>
                  </li>
                )
              })}
              {resting && (
                // The one activity pick (R23: E-3b-ui adds only the stance and the activity chips here).
                <li>
                  <button
                    type="button"
                    data-try-bout=""
                    onClick={() => useRunStore.getState().setActivity([TRY_BOUT])}
                    className="flex min-h-11 items-center gap-1.5 rounded-control bg-surface-sunk px-2.5 text-control font-semibold whitespace-nowrap hover:bg-surface-sunk-hover lg:min-h-9"
                  >
                    <span aria-hidden="true">{BOUT_EMOJI.walk}</span>
                    {t('activity.try', { bout: inSentence(boutLabel(TRY_BOUT, t)) })}
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
      {hasMeal && (
        // At the start the prompt takes the key's place (nothing has moved yet): the same row, so the
        // body above keeps its size, and nothing is laid over the picture or its labels.
        // Under 680 px tall the key gives way to the body; the prompt stays (FP-1).
        <div
          className={`grid px-3 pb-0.5 lg:hidden [&>*]:col-start-1 [&>*]:row-start-1 ${atStart && !open ? '' : '[@media(height<42.5rem)]:hidden'}`}
        >
          {pieces && (
            <ParticleKey
              run={run}
              className={`overflow-x-auto overscroll-x-contain whitespace-nowrap [scrollbar-width:none] ${atStart && !open ? 'invisible' : ''}`}
            />
          )}
          {!open && <PlayPrompt meal={meal} className="text-caption leading-6" />}
        </div>
      )}
      {hasMeal && (
        // From 1024 px up one band under the body. On a phone the band dissolves (`contents`): the
        // Now line is the pane's first row, above the body, and the summary its last.
        <div className="max-lg:contents lg:flex lg:flex-col lg:gap-1.5 lg:border-t lg:border-border lg:px-4 lg:py-2.5">
          <NowLine
            run={run}
            kept={kept}
            open={open}
            onToggle={() => (open ? closeMore() : setMore(true))}
            moreRef={moreButton}
            panelId={panelId}
            className="max-lg:order-first max-lg:px-3 max-lg:pt-1 max-lg:pb-0.5"
          />
          {/* Not on a phone under 680 px tall: the stage shows it past the first screen (Simulator, FP-1).
              On a small projector window it goes under the graph (FP-2), so the body keeps its column's height. */}
          {summary &&
            summaryTo &&
            createPortal(<SummaryLine run={run} kept={kept} className="border-t border-border px-4 py-2" />, summaryTo)}
          {/* There too the food pieces' key, off the small projector's body (R85: it covered 12 % of it). */}
          {pieces && summaryTo && createPortal(<ParticleKey run={run} className="flex-wrap px-4 pb-2" />, summaryTo)}
          {summary && !summaryTo && (
            <SummaryLine run={run} kept={kept} className="max-lg:border-t max-lg:border-border max-lg:px-3 max-lg:py-1" />
          )}
        </div>
      )}
    </section>
  )
}
