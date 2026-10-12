import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { Simulation } from '@lifepeek/engine'
import { useClock } from '../../state/clock.ts'
import { HORIZON_MIN, KNEE_FRACTION, KNEE_MIN, TIMELINE_TICKS, formatDuration, posToTime, timeToPos } from '../../lib/time.ts'
import { posAt } from '../../lib/axis.ts'
import { momentNameKey, runMoments, stackRows, type Moment } from '../../lib/moments.ts'

/**
 * The dock's timeline (WP-11 slider, WP-14 key moments). It uses the same squeezed scale as v1:
 * the first 6 hours get 60 % of the bar, and the part after the dotted line says "6 h → 48 h
 * squeezed" (council verdict #6).
 *
 * "When things happen" is shown once, here (03 WP-14): this meal's key moments are filled blue
 * dots ON the bar, the kept meal's are hollow grey rings just BELOW it, like the two runs' dots on
 * the graphs' playheads. Shape and place tell them apart, never the grey alone. Each is a button
 * that pauses and moves the clock there; "leftovers start leaving" also shows its low–high range.
 * A dot's name shows above it on hover and focus, and stays while the clock is paused on it
 * (after a click, or PageDown).
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

/** Half a marker's hit area at most (px): 24 px targets (WCAG 2.5.8), split where dots are closer. */
const HALF_HIT = 12
/** Markers closer than this (px) go in a row of their own: away from the bar for this meal, further down for the kept one. */
const MIN_GAP = 12
/** Distance between two rows of markers (px). */
const ROW_PX = 14
/** A paused clock this close (minutes) to a moment is "at" it: its name stays shown. */
const AT_MOMENT_MIN = 0.5

interface Marker extends Moment {
  /** 0 = on its lane's line; 1, 2 … = stacked away from the bar, where moments nearly coincide. */
  row: number
  /** How far (px) the dot is drawn right of its time, on a phone, to clear a moment just before it. */
  shift: number
  /** Half its hit area's width, left and right of the dot (px). */
  before: number
  after: number
  /** 'run' = this meal (filled, on the bar), 'kept' = the kept meal (hollow, below). */
  lane: 'run' | 'kept'
  key: string
  /** Name + time, for the button and the label above it. */
  label: string
}

export default function Timeline2({ run, kept }: { run: Simulation; kept: Simulation | null }) {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const width = useTrackWidth(track)
  // From 640 px up there is room above the bar for a second row of dots; a phone has none (the
  // clock is right above the track), so there close dots are nudged sideways instead.
  const roomAbove = useMinWidth('40rem')

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

  const markers = useMemo(() => {
    const of = (sim: Simulation | null, lane: Marker['lane']): Marker[] =>
      sim && sim.meal.items.length > 0
        ? runMoments(sim).map((m) => {
            const name = t(momentNameKey(m.id, sim))
            const time =
              m.low != null && m.high != null
                ? t('dock.usually', {
                    time: formatDuration(m.atMin, t),
                    low: formatDuration(m.low, t),
                    high: formatDuration(m.high, t),
                  })
                : formatDuration(m.atMin, t)
            return {
              ...m,
              lane,
              key: `${lane}:${m.id}`,
              label: t(lane === 'run' ? 'dock.marker' : 'dock.keptMarker', { name, time }),
              row: 0,
              shift: 0,
              before: HALF_HIT,
              after: HALF_HIT,
            }
          })
        : []
    return [...layout(of(run, 'run'), width, roomAbove), ...layout(of(kept, 'kept'), width, roomAbove)]
  }, [run, kept, t, width, roomAbove])
  // Rows stacked above the bar (this meal) and below it (the kept meal) need room of their own.
  const rows = (lane: Marker['lane']) => Math.max(0, ...markers.filter((m) => m.lane === lane).map((m) => m.row))
  const lift = rows('run')

  // Which name shows: the dot under the pointer or focus, else the one the paused clock is at.
  const [hot, setHot] = useState<string | null>(null)
  const atMoment = useCallback(
    (s: { simMin: number; playing: boolean }) =>
      s.playing ? null : (markers.find((m) => Math.abs(m.atMin - s.simMin) < AT_MOMENT_MIN)?.key ?? null),
    [markers],
  )
  const here = useClock(atMoment)
  const shown = markers.find((m) => m.key === (hot ?? here))

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
  const lane = (which: Marker['lane']) => markers.filter((m) => m.lane === which)
  return (
    // The top padding holds "6 h → 48 h squeezed" (from 640 px up); the bottom one the hour ticks,
    // and with a kept meal its hollow dots first. A size container: which hour labels fit depends
    // on the track's own width in rem, so projector mode and Hindi drop labels sooner.
    <div
      className={`@container relative select-none sm:pt-5 ${lift ? 'pt-5' : 'pt-2'} ${!kept ? 'pb-5' : rows('kept') ? 'pb-12' : 'pb-9'}`}
    >
      {/*
       * "6 h → 48 h squeezed", over the squeezed part of the bar: it starts just right of the dotted
       * line and, when it is longer than that part (Hindi, projector), grows to the left from the
       * bar's end instead of running off it.
       */}
      <span
        aria-hidden="true"
        data-knee=""
        className="absolute top-0 right-0 bg-shelf text-caption whitespace-nowrap text-ink-2 max-sm:hidden"
        style={{ minWidth: `calc(${(1 - KNEE_FRACTION) * 100}% - 0.5rem)` }}
      >
        {t('dock.squeezed', { from: formatDuration(KNEE_MIN, t), to: formatDuration(HORIZON_MIN, t) })}
      </span>
      <span aria-hidden="true" className="absolute top-1 bottom-4 border-l-2 border-dotted border-ink-2/60" style={{ left: knee }} />
      {/* The bar's row: the slider, with the moments laid over it (they are its siblings: a slider's children are not read out). */}
      <div className="relative" style={{ '--track-w': `${width}px` } as CSSProperties}>
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
        <MarkerLane markers={lane('run')} lane="run" label={t('dock.moments')} onHot={setHot} />
        {kept && <MarkerLane markers={lane('kept')} lane="kept" label={t('dock.keptMoments')} onHot={setHot} />}
        {shown && <MarkerTip key={shown.key} marker={shown} width={width} lift={lift} />}
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

/** The track's width in CSS px (for splitting close markers' hit areas); re-renders only on resize. */
function useTrackWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [ref])
  return width
}

/**
 * One run's moments placed along the bar, in time order: rows where they nearly coincide
 * (stackRows), and hit areas 24 px wide, or split halfway to a closer neighbour in the same row,
 * so every moment can be clicked.
 */
function layout(markers: Marker[], width: number, stack: boolean): Marker[] {
  const sorted = [...markers].sort((p, q) => p.atMin - q.atMin)
  const xs = sorted.map((m) => posAt(m.atMin) * width)
  // Stacked: rows where dots nearly coincide. Nudged: one row, each dot at least MIN_GAP right of
  // the one before (the label and the clock still give its exact time).
  const rows = stack ? stackRows(xs, MIN_GAP) : xs.map(() => 0)
  const drawn = [...xs]
  if (!stack) for (let i = 1; i < drawn.length; i++) drawn[i] = Math.max(drawn[i]!, drawn[i - 1]! + MIN_GAP)
  const half = (i: number, j: number) => Math.min(HALF_HIT, Math.abs(drawn[j]! - drawn[i]!) / 2)
  return sorted.map((m, i) => {
    const prev = rows.lastIndexOf(rows[i]!, i - 1)
    const next = rows.indexOf(rows[i]!, i + 1)
    return {
      ...m,
      row: rows[i]!,
      shift: drawn[i]! - xs[i]!,
      before: prev >= 0 ? half(prev, i) : HALF_HIT,
      after: next >= 0 ? half(i, next) : HALF_HIT,
    }
  })
}

/** True while the window is at least `min` wide (a CSS length); re-renders only when that changes. */
function useMinWidth(min: string) {
  const query = `(min-width: ${min})`
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatch(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [query])
  return match
}

/** One run's moments as buttons along the bar (laid out by `layout`). */
function MarkerLane({
  markers,
  lane,
  label,
  onHot,
}: {
  markers: Marker[]
  lane: Marker['lane']
  label: string
  onHot: (key: string | null) => void
}) {
  const kept = lane === 'kept'
  // With stacked rows each row's hit areas are as tall as the row, so they never overlap.
  const stacked = markers.some((m) => m.row > 0)
  return (
    <ul
      aria-label={label}
      // This meal on the bar's centre line; the kept meal 0.6875 rem (11 px) below it, clear of the bar.
      className={`pointer-events-none absolute inset-x-0 h-0 ${kept ? 'top-[calc(50%+0.6875rem)]' : 'top-1/2'}`}
    >
      {markers.map((m) => {
        const range = m.low != null && m.high != null
        return (
          <li
            key={m.key}
            className="absolute top-0"
            style={{ left: `calc(${posAt(m.atMin) * 100}% + ${m.shift}px)`, top: (kept ? 1 : -1) * m.row * ROW_PX }}
          >
            {m.row > 0 && (
              // A raised dot hangs from a thin stem to its time on the line below.
              <span
                aria-hidden="true"
                className={`absolute left-0 w-px -translate-x-1/2 ${kept ? 'bg-kept/60' : 'bg-run/60'}`}
                style={kept ? { bottom: 0, height: m.row * ROW_PX } : { top: 0, height: m.row * ROW_PX }}
              />
            )}
            {range && (
              // The between-person range: a light bar from low to high, centred on the dot's line.
              <span
                aria-hidden="true"
                data-range=""
                className={`absolute top-0 h-2 -translate-y-1/2 rounded-full ${kept ? 'border border-kept/70 bg-shelf' : 'bg-run/30'}`}
                style={{
                  left: `calc(${posAt(m.low!) - posAt(m.atMin)} * var(--track-w) - ${m.shift}px)`,
                  width: `calc(${posAt(m.high!) - posAt(m.low!)} * var(--track-w))`,
                }}
              />
            )}
            <button
              type="button"
              aria-label={m.label}
              data-marker={lane}
              data-moment={m.id}
              onClick={() => {
                const clock = useClock.getState()
                clock.pause()
                clock.setSimMin(m.atMin)
              }}
              onPointerEnter={() => onHot(m.key)}
              onPointerLeave={() => onHot(null)}
              onFocus={() => onHot(m.key)}
              onBlur={() => onHot(null)}
              className={`pointer-events-auto absolute top-0 grid -translate-y-1/2 cursor-pointer place-items-center rounded-full focus-visible:outline-offset-0 ${stacked ? 'h-3.5' : 'h-6'}`}
              style={{ left: -m.before, width: m.before + m.after } as CSSProperties}
            >
              <span
                aria-hidden="true"
                data-dot=""
                className={`pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${
                  kept ? 'size-2.5 border-kept bg-shelf' : 'size-3.5 border-shelf bg-run'
                }`}
                style={{ left: m.before }}
              />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The name of one moment, above the bar, in the dark pill the body uses for the organ the food is
 * in. Centred over its dot, but always kept inside the track (measured before paint).
 */
function MarkerTip({ marker, width, lift }: { marker: Marker; width: number; lift: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [left, setLeft] = useState<number | null>(null)
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0
    const x = posAt(marker.atMin) * width + marker.shift - w / 2
    setLeft(Math.max(0, Math.min(x, width - w)))
  }, [marker, width])
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-marker-tip=""
      className="pointer-events-none absolute z-10 w-max max-w-full rounded-control bg-ink px-2 py-0.5 text-caption font-semibold text-white shadow-[0_1px_3px_rgb(20_33_61/0.35)]"
      // Above the bar and above any raised row of dots.
      style={{ bottom: `calc(50% + 0.875rem + ${lift * ROW_PX}px)`, ...(left === null ? { left: 0, visibility: 'hidden' } : { left }) }}
    >
      {marker.label}
    </span>
  )
}
