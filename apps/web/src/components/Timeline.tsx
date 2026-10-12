import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useSim, mealLabel, presentMeals, type MealKey, type Sims } from '../state/sim.ts'
import {
  HORIZON_MIN,
  KNEE_FRACTION,
  KNEE_MIN,
  PACES,
  TIMELINE_TICKS,
  TIMELINE_TICKS_NARROW,
  formatDuration,
  posToTime,
  timeToPos,
  type Pace,
} from '../lib/time.ts'
import { MEAL_COLOR } from '../lib/colors.ts'

/** Key moments shown on the bar. Meal A uses diamonds above the bar, meal B circles below — shape and position, not just colour. */
function useMarkers(sims: Sims) {
  const { t } = useTranslation()
  return presentMeals(sims).flatMap((k) => {
    const e = sims[k].events
    const raw: [string, number | null | undefined][] = [
      [t('events.half'), e.stomachHalfEmptyMin],
      [t('events.peak'), e.glucosePeak?.timeMin],
      [t('events.colon'), e.halfLeftoversInColon?.typical],
    ]
    return raw
      .filter((m): m is [string, number] => typeof m[1] === 'number' && m[1] <= HORIZON_MIN)
      .map(([label, time]) => ({ k, time, label: `${mealLabel(k, t)}: ${label} — ${formatDuration(time, t)}` }))
  })
}

export default function Timeline({ sims }: { sims: Sims }) {
  const { t } = useTranslation()
  const time = useSim((s) => s.time)
  const playing = useSim((s) => s.playing)
  const pace = useSim((s) => s.pace)
  const { setTime, togglePlay, restart, setPace, pause } = useSim.getState()
  const track = useRef<HTMLDivElement>(null)
  const markers = useMarkers(sims)

  const timeFromPointer = (clientX: number) => {
    const rect = track.current!.getBoundingClientRect()
    return posToTime((clientX - rect.left) / rect.width)
  }
  const onPointerDown = (e: React.PointerEvent) => {
    pause()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    setTime(timeFromPointer(e.clientX))
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 1) setTime(timeFromPointer(e.clientX))
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 60 : 10
    const keys: Record<string, number> = {
      ArrowRight: step,
      ArrowUp: step,
      ArrowLeft: -step,
      ArrowDown: -step,
      PageUp: 120,
      PageDown: -120,
    }
    if (e.key in keys) {
      e.preventDefault()
      pause()
      setTime(time + keys[e.key]!)
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      pause()
      setTime(e.key === 'Home' ? 0 : HORIZON_MIN)
    }
  }

  const marker = (m: { k: MealKey; time: number; label: string }, i: number) => (
    <button
      key={`${m.k}-${i}`}
      type="button"
      title={m.label}
      aria-label={m.label}
      onClick={() => {
        pause()
        setTime(m.time)
      }}
      className={`group absolute z-10 grid size-7 -translate-x-1/2 place-items-center rounded-full hover:bg-sunk ${m.k === 'a' ? '-top-1' : 'bottom-4'}`}
      style={{ left: `${timeToPos(m.time) * 100}%` }}
    >
      <span
        aria-hidden="true"
        className={m.k === 'a' ? 'size-3 rotate-45' : 'size-3 rounded-full'}
        style={{ background: MEAL_COLOR[m.k] }}
      />
      {/* Visible label on hover and keyboard focus, not just a browser tooltip. */}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 hidden -translate-x-1/2 rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-hover:block group-focus-visible:block ${
          m.k === 'a' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}
      >
        {m.label}
      </span>
    </button>
  )

  return (
    <div className="rounded-xl border border-rule bg-panel px-4 pt-3 pb-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-11 min-w-28 items-center justify-center gap-2 rounded-full bg-ink px-5 font-semibold text-white"
        >
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
          {playing ? t('sim.pause') : t('sim.play')}
        </button>
        <button
          type="button"
          onClick={restart}
          className="grid size-11 place-items-center rounded-full border border-rule text-lg hover:bg-sunk"
          aria-label={t('sim.restart')}
          title={t('sim.restart')}
        >
          <span aria-hidden="true">⟲</span>
        </button>
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <span className="sr-only sm:not-sr-only">{t('sim.speed')}</span>
          <select
            value={pace}
            onChange={(e) => setPace(Number(e.target.value) as Pace)}
            className="rounded-lg border border-rule bg-panel px-2 py-2 text-sm text-ink"
          >
            {PACES.map((p) => (
              <option key={p} value={p}>
                {t('sim.paceValue', { duration: p >= 60 ? t('units.minutes', { n: p / 60 }) : t('units.seconds', { n: p }) })}
              </option>
            ))}
          </select>
        </label>
        <p className="ml-auto text-right leading-tight">
          <span className="tabular block text-xl font-extrabold sm:text-2xl">{formatDuration(time, t)}</span>
          <span className="text-xs text-ink-2">{t('sim.afterEating')}</span>
        </p>
      </div>

      <div className="relative select-none pt-6 pb-10">
        {markers.map(marker)}

        {/* The bar is zoomed into the first 6 hours; the shaded part runs faster. */}
        <div
          aria-hidden="true"
          className="absolute top-4 bottom-8 rounded-r-md bg-sunk/70"
          style={{ left: `${KNEE_FRACTION * 100}%`, right: 0 }}
        />
        <span aria-hidden="true" className="absolute top-0 text-xs text-ink-2" style={{ left: `calc(${KNEE_FRACTION * 100}% + 0.5rem)` }}>
          {t('sim.scaleBreak', { after: formatDuration(KNEE_MIN, t) })}
        </span>

        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label={t('sim.timeline')}
          aria-valuemin={0}
          aria-valuemax={HORIZON_MIN}
          aria-valuenow={Math.round(time)}
          aria-valuetext={`${formatDuration(time, t)} ${t('sim.afterEating')}`}
          aria-describedby="timeline-hint"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onKeyDown={onKeyDown}
          className="relative h-3 cursor-pointer touch-none rounded-full bg-sunk"
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-ink/80" style={{ width: `${timeToPos(time) * 100}%` }} />
          <div
            className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow"
            style={{ left: `${timeToPos(time) * 100}%` }}
          />
        </div>

        {TIMELINE_TICKS.map((m) => (
          <span
            key={m}
            className={`tabular absolute bottom-3 -translate-x-1/2 text-xs font-semibold whitespace-nowrap text-ink-2 first:translate-x-0 last:-translate-x-full ${
              TIMELINE_TICKS_NARROW.includes(m) ? '' : 'max-sm:hidden'
            }`}
            style={{ left: `${timeToPos(m) * 100}%` }}
          >
            {t('units.hShort', { n: m / 60 })}
          </span>
        ))}
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        {presentMeals(sims).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={k === 'a' ? 'size-2.5 rotate-45' : 'size-2.5 rounded-full'}
              style={{ background: MEAL_COLOR[k] }}
            />
            {t('sim.markerKey', { meal: mealLabel(k, t) })}
          </span>
        ))}
      </p>
      <p id="timeline-hint" className="sr-only">
        {t('sim.keyboardHint')}
      </p>
    </div>
  )
}
