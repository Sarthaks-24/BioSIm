import { useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION, PARAMS, type Simulation } from '@lifepeek/engine'
import { readPref, writePref } from '../../lib/prefs.ts'
import { useRunStore } from '../../state/run.ts'
import { MEDICAL_HREF } from '../MedicalNote.tsx'
import { InfoIcon } from '../kit/index.ts'

/**
 * Short notes under the meal bar, only when they apply: the first-visit medical note (until
 * "Got it"), a link from an older or newer version, foods a link named that no longer exist, and
 * a meal over the size the model is good for. The texts are v1's; the newer-version one is new.
 * The "too big" alert for a food being added sits where it is added (food sheet, servings).
 */
export default function Notes({ run, kept }: { run: Simulation; kept: Simulation | null }) {
  const { t } = useTranslation()
  const linkVersion = useRunStore((s) => s.linkModelVersion)
  const unknownOrganism = useRunStore((s) => s.unknownOrganism)
  const dropped = useRunStore((s) => s.droppedFoods)
  const [firstRun, setFirstRun] = useState(() => readPref('medicalNoteSeen') !== '1')

  const newer = unknownOrganism !== null || (linkVersion !== null && linkVersion > MODEL_VERSION)
  const notes = [
    newer && t('sim.newerLink'),
    // A link can't be from both a newer and an older version: the newer note wins.
    !newer && linkVersion !== null && linkVersion < MODEL_VERSION && t('sim.oldLink'),
    dropped > 0 && t('sim.unknownFoods', { count: dropped }),
    run.meal.overCap && t('sim.overCap', { meal: t('stage.thisMeal'), kcal: PARAMS.maxMealKcal }),
    kept?.meal.overCap && t('sim.overCap', { meal: t('stage.keptMeal'), kcal: PARAMS.maxMealKcal }),
  ].filter((n): n is string => typeof n === 'string')

  if (!firstRun && notes.length === 0) return null
  return (
    <div className="border-b border-rule2 bg-shelf px-3 py-1.5 lg:px-4">
      <ul className="flex flex-col gap-1">
        {firstRun && (
          <li data-first-run="" className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="flex min-w-0 flex-1 basis-80 items-start gap-2 text-control">
              <span className="mt-px text-ink-2">
                <InfoIcon />
              </span>
              <span>
                <strong className="font-semibold">{t('disclaimer.firstRun.title')}</strong>{' '}
                <span className="text-ink-2">{t('disclaimer.firstRun.body')}</span>{' '}
                <Link to={MEDICAL_HREF} className="font-semibold whitespace-nowrap underline underline-offset-2">
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
              className="ml-auto min-h-11 shrink-0 rounded-control bg-ink px-4 text-control font-semibold text-white lg:min-h-9"
            >
              {t('disclaimer.firstRun.ok')}
            </button>
          </li>
        )}
        {notes.map((n) => (
          <li key={n} role="note" className="flex items-start gap-2 text-control">
            <span className="mt-px text-ink-2">
              <InfoIcon />
            </span>
            {n}
          </li>
        ))}
      </ul>
    </div>
  )
}
