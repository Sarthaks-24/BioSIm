import { useTranslation } from 'react-i18next'
import type { MealItem } from '@lifepeek/engine'
import { PlayIcon } from '../kit/index.ts'
import { useClock } from '../../state/clock.ts'
import { shortMealNames } from './mealText.ts'

/** True while the meal clock stands at the start, paused: nothing has moved yet. */
export const useAtStart = () => useClock((s) => s.simMin === 0 && !s.playing)

/**
 * The first-screen prompt (council round 2, outsider): "Press ▶ to watch Cola go through the
 * body", while the clock stands at 0 min. It goes as soon as the meal moves, and comes back if the
 * clock is wound back to the start. Where it sits is the body pane's choice (BodyPane). The ▶ is
 * drawn as the Play button itself (a small ink disc), so it points at the real control; a screen
 * reader hears the button's name there.
 */
export default function PlayPrompt({ meal, className = '' }: { meal: readonly MealItem[]; className?: string }) {
  const { t, i18n } = useTranslation()
  const atStart = useAtStart()
  if (!atStart) return null
  const [before, after = ''] = t('stage.pressPlay', { meal: shortMealNames(meal, i18n.language) }).split('▶')
  return (
    <p data-play-prompt="" className={`pointer-events-none font-semibold text-pretty text-ink ${className}`}>
      {before}
      <span className="mx-0.5 inline-grid size-6 place-items-center rounded-full bg-ink align-[-0.4em] text-white [&>svg]:size-3.5">
        <PlayIcon />
        <span className="sr-only">{t('sim.play')}</span>
      </span>
      {after}
    </p>
  )
}
