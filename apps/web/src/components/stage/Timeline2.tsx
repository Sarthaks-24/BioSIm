import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { Simulation } from '@lifepeek/engine'
import { useClock } from '../../state/clock.ts'
import { HORIZON_MIN, KNEE_FRACTION, KNEE_MIN, TIMELINE_TICKS, formatDuration, posToTime, timeToPos } from '../../lib/time.ts'
import { posAt } from '../../lib/axis.ts'
import { groupClose, hitAreas, momentNameKey, runMoments, type Moment } from '../../lib/moments.ts'

/**
 * The dock's timeline (WP-11 slider, WP-14 key moments). It uses the same squeezed scale as v1:
 * the first 6 hours get 60 % of the bar, and the part after the dotted line says "6 h → 48 h
 * squeezed" (council verdict #6).
 *
 * "When things happen" is shown once, here (03 WP-14): this meal's key moments are filled blue
 * dots ON the bar, the kept meal's are hollow grey rings just BELOW it, like the two runs' dots on
 * the graphs' playheads. Shape and place tell them apart, never the grey alone. Each marker is a
 * button that pauses and moves the clock there; "leftovers start leaving" also shows its low–high
 * range. Moments that nearly coincide (cola's first hour) are one marker that names them all
 * (council round 2, WP-15), with one dot per moment. A marker's names show above the bar on hover
 * and focus, and stay while the clock is paused on one of its moments (after a click, or PageDown).
 *
 * The thumb, the filled part and the slider's value are moved straight from the meal clock
 * (`useClock.subscribe`), never through React state, so playing re-renders nothing here.
 * Keys on the slider: ← → 10 min (Shift: 1 h), Home / End, PageDown / PageUp next / previous key
 * moment. Each meal's markers are one Tab stop; ← → move between them.
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

/**
 * Moments closer than this (px) along the bar are one marker (council round 2): 24 px from
 * 1024 px up, 44 px on a phone, a finger's width. Each marker is a target that wide (WCAG 2.5.8).
 */
const GAP_WIDE = 24
const GAP_PHONE = 44
/** A paused clock this close (minutes) to a moment is "at" it: its name stays shown. */
const AT_MOMENT_MIN = 0.5

/** One marker on the bar: one moment, or a few that nearly coincide, of one meal. */
interface Marker {
  /** 'run' = this meal (filled dots, on the bar), 'kept' = the kept meal (hollow rings, below it). */
  lane: 'run' | 'kept'
  key: string
  /** Its moments in time order; the marker sits at the first, and a press jumps there. */
  moments: Moment[]
  atMin: number
  /** Its hit area, px left and right of the first dot. */
  before: number
  after: number
  /** One line per moment, "name, time": the button's name and the label above the bar. */
  lines: string[]
}

export default function Timeline2({ run, kept }: { run: Simulation; kept: Simulation | null }) {
  const { t } = useTranslation()
  const track = useRef<HTMLDivElement>(null)
  const kneeLabel = useRef<HTMLSpanElement>(null)
  const width = useTrackWidth(track)
  // Phones get finger-sized targets, so moments merge sooner there.
  const gap = useMinWidth('64rem') ? GAP_WIDE : GAP_PHONE

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
    const of = (sim: Simulation | null, lane: Marker['lane']): Marker[] => {
      if (!sim || sim.meal.items.length === 0) return []
      const line = (m: Moment) => {
        const name = t(momentNameKey(m.id, sim))
        const time =
          m.low != null && m.high != null
            ? t('dock.usually', { time: formatDuration(m.atMin, t), low: formatDuration(m.low, t), high: formatDuration(m.high, t) })
            : formatDuration(m.atMin, t)
        return t(lane === 'run' ? 'dock.marker' : 'dock.keptMarker', { name, time })
      }
      const groups = group(
        runMoments(sim).sort((p, q) => p.atMin - q.atMin),
        width,
        gap,
      )
      const hits = hitAreas(
        groups.map((g) => posAt(g[0]!.atMin) * width),
        gap,
      )
      return groups.map((moments, i) => ({
        lane,
        key: `${lane}:${moments[0]!.id}`,
        moments,
        atMin: moments[0]!.atMin,
        lines: moments.map(line),
        ...hits[i]!,
      }))
    }
    return [...of(run, 'run'), ...of(kept, 'kept')]
  }, [run, kept, t, width, gap])

  // Which names show: the marker under the pointer or focus; else every moment the paused clock
  // is at, of both meals (cola's "half has left" and "highest" can share a minute, and so can the
  // kept meal's), so none hides behind another.
  const [hot, setHot] = useState<string | null>(null)
  const atMoment = useCallback(
    (s: { simMin: number; playing: boolean }) =>
      s.playing
        ? ''
        : markers
            .flatMap((m) => m.moments.filter((x) => Math.abs(x.atMin - s.simMin) < AT_MOMENT_MIN).map((x) => `${m.key}|${x.id}`))
            .join(' '),
    [markers],
  )
  const here = useClock(atMoment)
  const tip = useMemo(() => {
    const hotMarker = markers.find((m) => m.key === hot)
    if (hotMarker) return { key: hotMarker.key, atMin: hotMarker.atMin, lines: hotMarker.lines }
    if (!here) return null
    const at = new Set(here.split(' '))
    const lines = markers.flatMap((m) => m.lines.filter((_, i) => at.has(`${m.key}|${m.moments[i]!.id}`)))
    const first = markers.find((m) => m.moments.some((x) => at.has(`${m.key}|${x.id}`)))!
    return { key: here, atMin: first.atMin, lines }
  }, [markers, hot, here])

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
  const kneeLeft = useKneeSide(kneeLabel, width)
  return (
    // The top padding holds "6 h → 48 h squeezed" (from 640 px up); the bottom one the hour ticks,
    // and with a kept meal its hollow markers first. The ticks' room is their own text size plus
    // the thumb's overhang, so no tick ("0 h", "0 घं") ever sits under the thumb, in any language
    // or on the projector (WP-18). A size container: which hour labels fit depends on the track's
    // own width in rem, so projector mode and Hindi drop labels sooner.
    <div
      className={`@container relative pt-2 select-none sm:pt-5 ${kept ? 'pb-[calc(1.375rem_+_var(--text-caption))]' : 'pb-[calc(0.75rem_+_var(--text-caption))]'}`}
    >
      {/*
       * "6 h → 48 h squeezed", over the squeezed part of the bar, starting just right of the dotted
       * line. When it is longer than that part (Hindi, the projector) it ends just left of the line
       * instead, so it never runs across the line or off the bar (WP-18).
       */}
      <span
        ref={kneeLabel}
        aria-hidden="true"
        data-knee=""
        className="absolute top-0 text-caption whitespace-nowrap text-ink-2 max-sm:hidden"
        style={kneeLeft ? { right: `calc(${(1 - KNEE_FRACTION) * 100}% + 0.375rem)` } : { left: `calc(${knee} + 0.375rem)` }}
      >
        {t('dock.squeezed', { from: formatDuration(KNEE_MIN, t), to: formatDuration(HORIZON_MIN, t) })}
      </span>
      <span
        aria-hidden="true"
        data-knee-line=""
        className="absolute top-1 bottom-4 border-l-2 border-dotted border-ink-2/60"
        style={{ left: knee }}
      />
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
        {tip && <MarkerTip key={tip.key} atMin={tip.atMin} lines={tip.lines} width={width} />}
      </div>
      {TIMELINE_TICKS.map((m) => (
        <span
          key={m}
          aria-hidden="true"
          data-tick=""
          className={`tabular absolute bottom-0 text-caption leading-none whitespace-nowrap text-ink-2 ${
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

/** The track's width in CSS px (for merging close markers and sizing their targets); re-renders only on resize. */
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
 * True when the knee's label is too long for the squeezed part of the bar, so it goes left of the
 * dotted line. Measured again when the bar or the label changes size (language, projector, fonts).
 */
function useKneeSide(ref: React.RefObject<HTMLSpanElement | null>, width: number) {
  const [left, setLeft] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      const gap = 0.75 * parseFloat(getComputedStyle(el).fontSize)
      setLeft(el.offsetWidth + gap > (1 - KNEE_FRACTION) * width)
    }
    const ro = new ResizeObserver(check)
    ro.observe(el)
    check()
    return () => ro.disconnect()
  }, [ref, width])
  return left
}

/** One meal's moments (sorted by time) as markers: moments closer than `gap` px along the bar share one. */
function group(moments: Moment[], width: number, gap: number): Moment[][] {
  const groups: Moment[][] = []
  groupClose(
    moments.map((m) => posAt(m.atMin) * width),
    gap,
  ).forEach((g, i) => (groups[g] ??= []).push(moments[i]!))
  return groups
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

/**
 * One meal's markers along the bar, as a toolbar: one Tab stop; ← → (and Home / End) move
 * between its markers, Enter or Space jumps the clock to one. The stage's key map leaves those
 * keys to it (lib/keys.ts).
 */
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
  const box = useRef<HTMLDivElement>(null)
  const [focus, setFocus] = useState(0)
  const at = Math.max(0, Math.min(focus, markers.length - 1))
  if (markers.length === 0) return null
  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = markers.length - 1
    const to = (
      { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: last } as Record<string, number>
    )[e.key]
    if (to === undefined) return
    e.preventDefault()
    const i = Math.max(0, Math.min(last, to))
    setFocus(i)
    box.current?.querySelectorAll<HTMLButtonElement>('button')[i]?.focus()
  }
  return (
    <div
      ref={box}
      role="toolbar"
      aria-label={label}
      onKeyDown={onKeyDown}
      // This meal's dots on the bar's centre line, the kept meal's 1 rem (16 px) below it. Their
      // 24 px tall targets reach 16 px above and 8 px below this meal's line, and 8 px above and 16
      // px below the kept one's, so the two rows meet but never overlap, and the dock stays as
      // short as before (a phone's first screen has no height to spare).
      className={`pointer-events-none absolute inset-x-0 h-0 ${kept ? 'top-[calc(50%+1rem)]' : 'top-1/2'}`}
    >
      {markers.map((m, i) => (
        <div key={m.key} className="absolute top-0" style={{ left: `${posAt(m.atMin) * 100}%` }}>
          {m.moments.map((x) =>
            x.low != null && x.high != null ? (
              // The between-person range: a light bar from low to high, centred on the dot's line.
              <span
                key={x.id}
                aria-hidden="true"
                data-range=""
                className={`absolute top-0 h-2 -translate-y-1/2 rounded-full ${kept ? 'border border-kept/70 bg-shelf' : 'bg-run/30'}`}
                style={{
                  left: `calc(${posAt(x.low) - posAt(m.atMin)} * var(--track-w))`,
                  width: `calc(${posAt(x.high) - posAt(x.low)} * var(--track-w))`,
                }}
              />
            ) : null,
          )}
          <button
            type="button"
            tabIndex={i === at ? 0 : -1}
            aria-label={m.lines.join('; ')}
            data-marker={lane}
            data-moment={m.moments.map((x) => x.id).join(' ')}
            onClick={() => {
              const clock = useClock.getState()
              clock.pause()
              clock.setSimMin(m.atMin)
            }}
            onPointerEnter={() => onHot(m.key)}
            onPointerLeave={() => onHot(null)}
            onFocus={() => {
              setFocus(i)
              onHot(m.key)
            }}
            onBlur={() => onHot(null)}
            className={`pointer-events-auto absolute top-0 h-6 cursor-pointer rounded-full focus-visible:outline-offset-0 ${kept ? '-translate-y-1/3' : '-translate-y-2/3'}`}
            style={{ left: -m.before, width: m.before + m.after }}
          >
            {/* One dot per moment, overlapping a little: a marker of three moments shows three. The first dot's centre is its time. */}
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute flex -translate-y-1/2 ${kept ? 'top-1/3' : 'top-2/3'}`}
              style={{ left: `calc(${m.before}px - ${kept ? 0.3125 : 0.4375}rem)` }}
            >
              {m.moments.map((x, j) => (
                <span
                  key={x.id}
                  data-dot=""
                  className={`shrink-0 rounded-full border-2 ${j > 0 ? '-ml-1' : ''} ${kept ? 'size-2.5 border-kept bg-shelf' : 'size-3.5 border-shelf bg-run'}`}
                />
              ))}
            </span>
          </button>
        </div>
      ))}
    </div>
  )
}

/**
 * The names of the moments shown, one per line, above the bar, in the dark pill the body uses for
 * the organ the food is in. Centred over its marker, but always kept inside the track (measured
 * before paint).
 */
function MarkerTip({ atMin, lines, width }: { atMin: number; lines: string[]; width: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [left, setLeft] = useState<number | null>(null)
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth ?? 0
    const x = posAt(atMin) * width - w / 2
    setLeft(Math.max(0, Math.min(x, width - w)))
  }, [atMin, lines, width])
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-marker-tip=""
      className="pointer-events-none absolute bottom-[calc(50%+0.875rem)] z-10 flex w-max max-w-full flex-col rounded-control bg-ink px-2 py-0.5 text-caption font-semibold text-white shadow-[0_1px_3px_rgb(20_33_61/0.35)]"
      style={left === null ? { left: 0, visibility: 'hidden' } : { left }}
    >
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </span>
  )
}
