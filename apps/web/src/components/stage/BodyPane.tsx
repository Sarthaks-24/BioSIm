import { useTranslation } from 'react-i18next'
import type { Simulation } from '@lifepeek/engine'
import BodyView from '../BodyView.tsx'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'
import { BodyClockContext, MEAL_BODY_CLOCK } from '../../hooks/useBodyClock.ts'
import { useRunStore } from '../../state/run.ts'
import LayerBar from './LayerBar.tsx'
import { mealNames } from './mealText.ts'

/** Foods offered when the meal is empty: a drink, an Indian staple, a fruit. */
const EXAMPLES = ['cola', 'roti', 'apple'] as const

/**
 * The body: the one big thing on the stage. The 3D body when the device can draw it (a separate
 * download, fetched only here), the flat diagram while it loads and when it can't (BodyView). It
 * follows the meal clock. With an empty meal it asks for a food instead, with a few to tap.
 */
export default function BodyPane({ run }: { run: Simulation }) {
  const { t, i18n } = useTranslation()
  const meal = useRunStore((s) => s.meal)
  return (
    <section aria-labelledby="body-pane-title" className="relative flex min-h-0 flex-col">
      <h2 id="body-pane-title" className="sr-only">
        {t('stage.body')}
      </h2>
      {/* The layer switch sits in the body's top corner, over empty paper, so it costs the body no height. */}
      {/* Full width so a long list scrolls instead of being cut; only the control itself takes clicks. */}
      <div className="pointer-events-none absolute inset-x-3 top-2 z-10 lg:inset-x-4 lg:top-3">
        <LayerBar className="pointer-events-auto w-fit" />
      </div>
      {/* The body fills whatever height the stage leaves it (absolute, so the canvas can't push the row taller). */}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          {meal.length > 0 ? (
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
      </div>
    </section>
  )
}
