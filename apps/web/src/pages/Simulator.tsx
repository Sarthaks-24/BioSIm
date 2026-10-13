import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MODEL_VERSION, PARAMS } from '@lifepeek/engine'
import { useSim, mealLabel, shareQuery, MEAL_KEYS, type MealKey, type Sims } from '../state/sim.ts'
import { useClock } from '../hooks/useClock.ts'
import { useUrlSync } from '../hooks/useUrlSync.ts'
import { useSimulation } from '../hooks/useSimulation.ts'
import { addEnglish, localized } from '../i18n/index.ts'
import MealPicker from '../components/MealPicker.tsx'
import BodyView from '../components/BodyView.tsx'
import Timeline from '../components/Timeline.tsx'
import StagePanel from '../components/StagePanel.tsx'
import KeyMoments from '../components/KeyMoments.tsx'
import LessonView from '../components/LessonView.tsx'
import Legend from '../components/Legend.tsx'
import ShareButton from '../components/ShareButton.tsx'
import FeedbackDialog from '../components/FeedbackDialog.tsx'
import { FirstRunNote } from '../components/MedicalNote.tsx'
import Verdict from '../components/Verdict.tsx'
import { GlucoseChart, StomachChart, WhereChart } from '../components/charts/SimCharts.tsx'
import { MEAL_COLOR } from '../lib/colors.ts'
import verdictText from 'virtual:lifepeek-en/verdict'
import chartsText from 'virtual:lifepeek-en/charts'
import eventsText from 'virtual:lifepeek-en/events'
import lessonText from 'virtual:lifepeek-en/lesson'

// This page's English text comes with its code (size budget, scripts/i18n-sections.mjs).
addEnglish(verdictText, chartsText, eventsText, lessonText)

type View = 'body' | 'lesson'

export default function Simulator() {
  const { t, i18n } = useTranslation()
  const [view, setView] = useState<View>('body')
  const a = useSim((s) => s.a)
  const b = useSim((s) => s.b)
  const linkVersion = useSim((s) => s.linkModelVersion)
  const sims: Sims = { a: useSimulation(a), b: useSimulation(b) }
  useClock()
  useUrlSync()

  // Space toggles play when focus isn't in a form control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.code !== 'Space' || el.closest('input, select, textarea, button, [role="slider"], dialog, summary')) return
      e.preventDefault()
      useSim.getState().togglePlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const describe = (k: MealKey) => `${mealLabel(k, t)}: ${sims[k].meal.items.map((i) => localized(i.food.name, i18n.language)).join(', ')}`

  const unknown = useSim((s) => s.droppedFoods)
  const overCap = MEAL_KEYS.filter((k) => sims[k].meal.overCap)
  const notes = [
    linkVersion !== null && linkVersion !== MODEL_VERSION && t('sim.oldLink'),
    unknown > 0 && t('sim.unknownFoods', { count: unknown }),
    ...overCap.map((k) => t('sim.overCap', { meal: mealLabel(k, t), kcal: PARAMS.maxMealKcal })),
  ].filter(Boolean) as string[]

  const tab = (v: View) => `rounded-full px-4 py-1.5 text-sm font-semibold ${view === v ? 'bg-ink text-white' : 'hover:bg-sunk'}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="sr-only">{t('sim.title')}</h1>

      {notes.map((n) => (
        <p key={n} role="note" className="mb-3 rounded-lg border border-rule bg-panel px-3 py-2 text-sm">
          {n}
        </p>
      ))}

      <FirstRunNote />

      <div className="no-print mb-4 grid gap-4 md:grid-cols-2">
        {MEAL_KEYS.map((k) => (
          <div key={k} className="rounded-xl border border-rule bg-panel p-4" style={{ borderTop: `4px solid ${MEAL_COLOR[k]}` }}>
            <MealPicker meal={k} />
          </div>
        ))}
      </div>

      <Verdict sims={sims} />

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('sim.views')} className="flex gap-1 rounded-full border border-rule p-1">
          <button type="button" aria-pressed={view === 'body'} onClick={() => setView('body')} className={tab('body')}>
            {t('sim.view3d')}
          </button>
          <button type="button" aria-pressed={view === 'lesson'} onClick={() => setView('lesson')} className={tab('lesson')}>
            {t('sim.viewLesson')}
          </button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <FeedbackDialog context={() => shareQuery(useSim.getState())} />
          <ShareButton />
        </div>
      </div>

      {view === 'lesson' ? (
        <LessonView sims={sims} />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div>
              {/* A and B always side by side — the comparison is the point, even on a phone. */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4">
                {MEAL_KEYS.map((k) => (
                  <div
                    key={k}
                    className="relative h-[44vh] min-h-64 overflow-hidden rounded-xl border border-rule bg-[radial-gradient(ellipse_at_50%_40%,#fbfdfc,#e4ece9)] lg:h-[60vh]"
                  >
                    <span
                      className="absolute top-3 left-3 z-10 rounded-full px-2.5 py-0.5 text-sm font-extrabold text-white"
                      style={{ background: MEAL_COLOR[k] }}
                    >
                      {k.toUpperCase()}
                    </span>
                    {sims[k].meal.items.length > 0 ? (
                      <BodyView sim={sims[k]} label={describe(k)} />
                    ) : (
                      <p className="grid h-full place-items-center p-6 text-center text-ink-2">
                        {t(k === 'b' ? 'sim.pickBoth' : 'sim.emptyMeal')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 px-1">
                <Legend />
              </div>
            </div>
            {/* On small screens the reading panel comes after the controls. */}
            <div className="order-last lg:order-none lg:row-span-2">
              <StagePanel sims={sims} />
            </div>
            {/* On phones the controls stick to the bottom so Play stays in reach while watching. */}
            <div className="z-20 max-lg:sticky max-lg:bottom-0 max-lg:-mx-4 max-lg:bg-paper/95 max-lg:px-4 max-lg:pt-2 max-lg:pb-2 max-lg:backdrop-blur">
              <Timeline sims={sims} />
            </div>
          </div>

          <div className="mt-6 grid gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-2 xl:grid-cols-3">
            <StomachChart sims={sims} />
            <GlucoseChart sims={sims} />
            <div className="md:col-span-2 xl:col-span-1">
              <WhereChart sims={sims} />
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <KeyMoments sims={sims} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
