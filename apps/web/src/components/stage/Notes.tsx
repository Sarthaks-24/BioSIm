import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION, PARAMS, type RunResult } from '@lifepeek/engine'
import { readPref, writePref } from '../../lib/prefs.ts'
import { useRunStore } from '../../state/run.ts'
import { MEDICAL_HREF } from '../MedicalNote.tsx'
import { InfoIcon } from '../kit/index.ts'

/**
 * Short notes under the meal bar, only when they apply: the first-visit medical note (until
 * "Got it"), a Hindi link while Hindi is paused (R47), a link from an older or newer version, foods
 * a link named that no longer exist, and a meal over the size the model is good for. The texts are v1's; the newer-version one is new.
 * The "too big" alert for a food being added sits where it is added (food sheet, servings).
 */
export default function Notes({ run, kept }: { run: RunResult; kept: RunResult | null }) {
  const { t } = useTranslation()
  const linkVersion = useRunStore((s) => s.linkModelVersion)
  const unknownOrganism = useRunStore((s) => s.unknownOrganism)
  const dropped = useRunStore((s) => s.droppedFoods)
  const hindiLater = useRunStore((s) => s.hindiLater)
  const [firstRun, setFirstRun] = useState(() => readPref('medicalNoteSeen') !== '1')

  const newer = unknownOrganism !== null || (linkVersion !== null && linkVersion > MODEL_VERSION)
  const notes = [
    hindiLater && t('sim.hindiLater'),
    newer && t('sim.newerLink'),
    // A link can't be from both a newer and an older version: the newer note wins.
    !newer && linkVersion !== null && linkVersion < MODEL_VERSION && t('sim.oldLink'),
    dropped > 0 && t('sim.unknownFoods', { count: dropped }),
    run.meal.overCap && t('sim.overCap', { meal: t('stage.thisMeal'), kcal: PARAMS.maxMealKcal }),
    kept?.meal.overCap && t('sim.overCap', { meal: t('stage.keptMeal'), kcal: PARAMS.maxMealKcal }),
  ].filter((n): n is string => typeof n === 'string')

  if (!firstRun && notes.length === 0) return null
  return (
    <div className="border-b border-border bg-surface-raised px-3 py-1.5 lg:px-4">
      <ul className="flex flex-col gap-1">
        {firstRun && (
          // On a phone the card is small (legal/medical-note.md: "a small dismissible card"): its
          // title and "More about this" beside "Got it", caption-sized. The full text stays for
          // screen readers and is one tap away; the graph's note and the footer say "not medical
          // advice" too. In Hindi the whole card took 200 px and left the body almost no room (WP-18).
          <li data-first-run="" className="flex items-start gap-x-3 gap-y-1 lg:flex-wrap lg:items-center">
            <p className="flex min-w-0 flex-1 items-start gap-2 text-caption lg:basis-80 lg:text-control">
              <span className="mt-px text-ink-muted">
                <InfoIcon />
              </span>
              <span>
                <strong className="font-semibold">{t('disclaimer.firstRun.title')}</strong>{' '}
                <span className="text-ink-muted max-lg:sr-only">{t('disclaimer.firstRun.body')}</span>{' '}
                {/* A phone keeps the card to one line (FP-1): the footer links the full note too. */}
                <Link to={MEDICAL_HREF} className="font-semibold whitespace-nowrap underline underline-offset-2 max-sm:hidden">
                  {t('disclaimer.more')}
                </Link>
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                writePref('medicalNoteSeen', '1')
                setFirstRun(false)
              }}
              // Quiet (FP-1): Play stays the strongest thing on the first screen.
              className="ml-auto min-h-11 shrink-0 rounded-control bg-surface-sunk px-4 text-control font-semibold text-ink hover:bg-surface-sunk-hover lg:min-h-9"
            >
              {t('disclaimer.firstRun.ok')}
            </button>
          </li>
        )}
        {notes.map((n) => (
          <li key={n} role="note" className="flex items-start gap-2 text-control">
            <span className="mt-px text-ink-muted">
              <InfoIcon />
            </span>
            {n}
          </li>
        ))}
      </ul>
    </div>
  )
}
