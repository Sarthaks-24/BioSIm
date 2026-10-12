import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useClock } from '../../state/clock.ts'
import { HORIZON_MIN, KNEE_FRACTION, KNEE_MIN, TIMELINE_TICKS, formatDuration, posToTime, timeToPos } from '../../lib/time.ts'
import { posAt } from '../../lib/axis.ts'

/**
 * The dock's plain time slider (WP-11; WP-14 adds the key-moment markers). It uses the same
 * squeezed scale as v1: the first 6 hours get 60 % of the bar, the part after the dotted line runs
 * faster and says so.
 *
 * The thumb, the filled part and the slider's value are moved straight from the meal clock
 * (`useClock.subscribe`), never through React state, so playing re-renders nothing here.
 * Keys: ← → 10 min (Shift: 1 h), Home / End, PageDown / PageUp next / previous key moment.
 */
/**
 * Hour labels that need a wide enough track (the rest always show: 0, 2, 4, 6 and 48 h). The
 * vertical lines on the graphs stay at every hour either way.
 */
const TICK_FITS: Record<number, string> = {
  60: '@max-[24rem]:hidden',
  180: '@max-[24rem]:hidden',
  720: '@max-[40rem]:hidden',
  1440: '@max-[22rem]:hidden',
  2160: '@max-[40rem]:hidden',
}

export default function Scrubber() {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = track.current
    if (!el) return
    const show = (min: number) => {
      // The same scale as the graphs' playheads (lib/axis.ts), so the thumb is right under them.
      el.style.setProperty('--pos', String(posAt(min)))
      el.setAttribute('aria-valuenow', String(Math.round(min)))
      el.setAttribute('aria-valuetext', `${formatDuration(min, t)} ${t('sim.afterEating')}`)
    }
    show(useClock.getState().simMin)
    return useClock.subscribe((s) => s.simMin, show)
  }, [t])

  const timeAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect()
    return posToTime((clientX - r.left) / r.width)
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const clock = useClock.getState()
    clock.pause()
    e.currentTarget.setPointerCapture(e.pointerId)
    clock.setSimMin(timeAt(e.clientX))
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) useClock.getState().setSimMin(timeAt(e.clientX))
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    const clock = useClock.getState()
    const step = e.shiftKey ? 60 : 10
    const moves: Record<string, () => void> = {
      ArrowRight: () => clock.step(step),
      ArrowUp: () => clock.step(step),
      ArrowLeft: () => clock.step(-step),
      ArrowDown: () => clock.step(-step),
      PageDown: () => clock.stepToMoment(1),
      PageUp: () => clock.stepToMoment(-1),
      Home: () => clock.step(-HORIZON_MIN),
      End: () => clock.step(HORIZON_MIN),
    }
    const move = moves[e.key]
    if (!move) return
    e.preventDefault()
    move()
  }

  const knee = `${KNEE_FRACTION * 100}%`
  return (
    // The top padding holds "after 6 h: faster" (from 640 px up); the bottom one the hour ticks.
    // A size container: which hour labels fit depends on the track's own width (it sits under the
    // graph column from 1024 px up) in rem, so projector mode and Hindi drop labels sooner.
    <div className="@container relative pt-2 pb-5 select-none sm:pt-5">
      {/* "after 6 h: faster", over the squeezed part of the bar. */}
      <span
        aria-hidden="true"
        className="absolute top-0 text-caption whitespace-nowrap text-ink-2 max-sm:hidden"
        style={{ left: `calc(${knee} + 0.5rem)` }}
      >
        {t('sim.scaleBreak', { after: formatDuration(KNEE_MIN, t) })}
      </span>
      <span aria-hidden="true" className="absolute top-1 bottom-4 border-l-2 border-dotted border-ink-2/60" style={{ left: knee }} />
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label={t('sim.timeline')}
        aria-valuemin={0}
        aria-valuemax={HORIZON_MIN}
        aria-describedby="scrubber-keys"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onKeyDown={onKeyDown}
        // A tall invisible hit area around a thin track; --pos (0…1) is set from the clock.
        // The focus ring goes on the thumb, not round the whole bar and its labels. Size and layout
        // containment: moving the thumb every frame re-lays out this box only, not the stage.
        className="group relative -my-3 h-8 cursor-pointer touch-none rounded-control [contain:size_layout] [--pos:0] focus-visible:outline-none!"
      >
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-control bg-ink/20" />
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-0 h-1.5 w-[calc(var(--pos)*100%)] -translate-y-1/2 rounded-control bg-ink"
        />
        <span
          aria-hidden="true"
          data-thumb=""
          className="absolute top-1/2 left-[calc(var(--pos)*100%)] size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-shelf bg-ink shadow-[0_1px_3px_rgb(20_33_61/0.4)] group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink group-active:scale-110"
        />
      </div>
      {TIMELINE_TICKS.map((m) => (
        <span
          key={m}
          aria-hidden="true"
          className={`tabular absolute bottom-0 text-caption whitespace-nowrap text-ink-2 ${
            m === 0 ? '' : m === HORIZON_MIN ? '-translate-x-full' : '-translate-x-1/2'
          } ${TICK_FITS[m] ?? ''}`}
          style={{ left: `${timeToPos(m) * 100}%` }}
        >
          {t('units.hShort', { n: m / 60 })}
        </span>
      ))}
      <p id="scrubber-keys" className="sr-only">
        {t('stage.keysHint')}
      </p>
    </div>
  )
}
