import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Simulation } from '@biosim/engine'
import { useSim, type MealKey } from '../state/sim.ts'
import { HORIZON_MIN, SPEEDS, TIMELINE_TICKS, formatClock, formatDuration, posToTime, timeToPos, type Speed } from '../lib/time.ts'
import { MEAL_COLOR } from '../lib/colors.ts'

interface Props {
  sims: Partial<Record<MealKey, Simulation>>
}

/**
 * Scrubbable, non-linear timeline. The first 6 hours get most of the width because that is
 * where stomach emptying and blood sugar happen. Markers show each meal's key moments.
 */
export default function Timeline({ sims }: Props) {
  const { t } = useTranslation()
  const time = useSim((s) => s.time)
  const playing = useSim((s) => s.playing)
  const speed = useSim((s) => s.speed)
  const { setTime, togglePlay, restart, setSpeed, pause } = useSim.getState()
  const track = useRef<HTMLDivElement>(null)

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
    } else if (e.key === 'Home') {
      e.preventDefault()
      setTime(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setTime(HORIZON_MIN)
    }
  }

  const speedLabel = (s: Speed) => formatDuration(s, t)

  return (
    <div className="rounded-xl border border-rule bg-panel px-4 pt-3 pb-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-10 min-w-24 items-center justify-center gap-2 rounded-full bg-ink px-4 font-semibold text-white"
        >
          <span aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
          {playing ? t('sim.pause') : t('sim.play')}
        </button>
        <button
          type="button"
          onClick={restart}
          className="grid size-10 place-items-center rounded-full border border-rule text-lg hover:bg-sunk"
          aria-label={t('sim.restart')}
          title={t('sim.restart')}
        >
          <span aria-hidden="true">⟲</span>
        </button>

        <label className="ml-1 flex items-center gap-2 text-sm text-ink-2">
          {t('sim.speed')}
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value) as Speed)}
            className="rounded-lg border border-rule bg-panel px-2 py-1.5 text-ink"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {t('sim.speedValue', { label: speedLabel(s) })}
              </option>
            ))}
          </select>
        </label>

        <p className="ml-auto text-right" aria-live="off">
          <span className="block text-xs text-ink-2">{t('sim.time')}</span>
          <span className="tabular text-2xl font-extrabold leading-none">{formatClock(time)}</span>
          <span className="text-sm text-ink-2"> h</span>
        </p>
      </div>

      <div className="relative select-none pt-5 pb-6">
        {/* Event markers: A above the track, B below. */}
        {(['a', 'b'] as const).map((k) => {
          const sim = sims[k]
          if (!sim || sim.meal.items.length === 0) return null
          const marks = [sim.events.stomachHalfEmptyMin, sim.events.glucosePeak?.timeMin ?? null, sim.events.firstReachesColon.typical]
          return marks.map((m, i) =>
            m === null || m > HORIZON_MIN ? null : (
              <span
                key={`${k}-${i}`}
                aria-hidden="true"
                className="absolute size-2 -translate-x-1/2 rotate-45"
                style={{
                  left: `${timeToPos(m) * 100}%`,
                  background: MEAL_COLOR[k],
                  top: k === 'a' ? 6 : 'auto',
                  bottom: k === 'b' ? 14 : 'auto',
                }}
              />
            ),
          )
        })}

        <div
          ref={track}
          role="slider"
          tabIndex={0}
          aria-label={t('sim.timeline')}
          aria-valuemin={0}
          aria-valuemax={HORIZON_MIN}
          aria-valuenow={Math.round(time)}
          aria-valuetext={formatDuration(time, t)}
          aria-describedby="timeline-hint"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onKeyDown={onKeyDown}
          className="relative h-3 cursor-pointer touch-none rounded-full bg-sunk"
        >
          <div className="absolute inset-y-0 left-0 rounded-full bg-ink/80" style={{ width: `${timeToPos(time) * 100}%` }} />
          <div
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow"
            style={{ left: `${timeToPos(time) * 100}%` }}
          />
        </div>

        {TIMELINE_TICKS.map((m) => (
          <span
            key={m}
            className="tabular absolute bottom-0 -translate-x-1/2 text-[11px] text-ink-2 first:translate-x-0 last:-translate-x-full"
            style={{ left: `${timeToPos(m) * 100}%` }}
          >
            {m / 60}h
          </span>
        ))}
      </div>
      <p id="timeline-hint" className="sr-only">
        {t('sim.keyboardHint')}
      </p>
    </div>
  )
}
