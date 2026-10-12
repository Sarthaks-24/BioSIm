import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { MODEL_VERSION, encodeShareState } from '@biosim/engine'
import { useSim } from '../state/sim.ts'
import { useClock } from '../hooks/useClock.ts'
import { useSimulation } from '../hooks/useSimulation.ts'
import { DEFAULT_PRESET } from '../lib/presets.ts'
import { hasWebGL } from '../lib/webgl.ts'
import { localized } from '../i18n/index.ts'
import MealPicker from '../components/MealPicker.tsx'
import BodyView from '../components/BodyView.tsx'
import Timeline from '../components/Timeline.tsx'
import StagePanel from '../components/StagePanel.tsx'
import KeyMoments from '../components/KeyMoments.tsx'
import LessonView from '../components/LessonView.tsx'
import Legend from '../components/Legend.tsx'
import ShareButton from '../components/ShareButton.tsx'
import FeedbackDialog from '../components/FeedbackDialog.tsx'
import { GlucoseChart, StomachChart, WhereChart } from '../components/charts/SimCharts.tsx'
import { MEAL_COLOR } from '../lib/colors.ts'

type View = 'body' | 'lesson'

export default function Simulator() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [view, setView] = useState<View>('body')
  const a = useSim((s) => s.a)
  const b = useSim((s) => s.b)
  const linkVersion = useSim((s) => s.linkModelVersion)
  const simA = useSimulation(a)
  const simB = useSimulation(b)
  const sims = { a: simA, b: simB }
  useClock()

  // Load the comparison from the URL; an empty URL opens the classic cola-vs-burger lesson.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.has('a') || params.has('b')) useSim.getState().loadFromUrl(location.search)
    else useSim.setState({ a: DEFAULT_PRESET.a, b: DEFAULT_PRESET.b, time: 0, playing: false, linkModelVersion: null })
  }, [location.search])

  // Keep the address bar shareable as meals change (without adding history entries).
  useEffect(() => {
    const query = encodeShareState({ a, b, t: 0 }).toString()
    window.history.replaceState(window.history.state, '', `/sim?${query}`)
  }, [a, b])

  // Space toggles play when focus isn't in a form control.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.code !== 'Space' || el.closest('input, select, textarea, button, [role="slider"], dialog')) return
      e.preventDefault()
      useSim.getState().togglePlay()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const describe = (key: 'a' | 'b') => {
    const sim = sims[key]
    const names = sim.meal.items.map((i) => localized(i.food.name, i18n.language)).join(', ')
    return `${key === 'a' ? t('sim.mealA') : t('sim.mealB')}: ${names}`
  }

  const tab = (v: View) => `rounded-full px-4 py-1.5 text-sm font-semibold ${view === v ? 'bg-ink text-white' : 'hover:bg-sunk'}`

  return (
    <div className="mx-auto max-w-7xl px-4 py-5">
      <h1 className="sr-only">{t('sim.title')}</h1>

      {linkVersion !== null && linkVersion !== MODEL_VERSION && (
        <p role="note" className="mb-3 rounded-lg border border-rule bg-panel px-3 py-2 text-sm">
          {t('sim.oldLink')}
        </p>
      )}

      <div className="no-print mb-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-rule bg-panel p-4" style={{ borderTop: `4px solid ${MEAL_COLOR.a}` }}>
          <MealPicker meal="a" />
        </div>
        <div className="rounded-xl border border-rule bg-panel p-4" style={{ borderTop: `4px solid ${MEAL_COLOR.b}` }}>
          <MealPicker meal="b" />
        </div>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label={t('sim.views')} className="flex gap-1 rounded-full border border-rule p-1">
          <button type="button" aria-pressed={view === 'body'} onClick={() => setView('body')} className={tab('body')}>
            {t('sim.view3d')}
          </button>
          <button type="button" aria-pressed={view === 'lesson'} onClick={() => setView('lesson')} className={tab('lesson')}>
            {t('sim.viewLesson')}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <FeedbackDialog />
          <ShareButton />
        </div>
      </div>

      {view === 'lesson' ? (
        <LessonView sims={sims} />
      ) : (
        <>
          {!hasWebGL() && <p className="mb-3 rounded-lg border border-rule bg-panel px-3 py-2 text-sm">{t('sim.noWebgl')}</p>}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
            {/* A and B always side by side — the comparison is the point, even on a phone. */}
            <div className="grid grid-cols-2 gap-2 sm:gap-4">
              {(['a', 'b'] as const).map((k) => (
                <div
                  key={k}
                  className="relative h-[52vh] min-h-72 overflow-hidden rounded-xl border border-rule bg-[radial-gradient(ellipse_at_50%_40%,#fbfdfc,#e4ece9)] lg:h-[60vh]"
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
            {/* On small screens the controls come right under the bodies; the reading panel after. */}
            <div className="order-last lg:order-none lg:row-span-2">
              <StagePanel sims={sims} />
            </div>
            <div>
              <Timeline sims={sims} />
              <div className="mt-2 px-1">
                <Legend />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-6 rounded-xl border border-rule bg-panel p-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.9fr]">
            <StomachChart sims={sims} />
            <GlucoseChart sims={sims} />
            <div className="space-y-6 md:col-span-2 xl:col-span-1">
              <WhereChart sims={sims} />
              <KeyMoments sims={sims} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
