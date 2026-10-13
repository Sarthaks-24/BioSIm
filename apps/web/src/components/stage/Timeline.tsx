import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { RunResult } from '@lifepeek/engine'
import { useClock } from '../../state/clock.ts'
import { useSheet } from '../../state/sheet.ts'
import { HORIZON_MIN, KNEE_FRACTION, KNEE_MIN, TIMELINE_TICKS, formatDuration, posToTime, timeToPos } from '../../lib/time.ts'
import { posAt } from '../../lib/axis.ts'
import { groupClose, hitAreas, momentNameKey, type Moment } from '../../lib/moments.ts'
import { useSystemUi } from '../../systems/ui.ts'

/**
 * The dock's timeline (WP-11 slider, WP-14 key moments, FP-3). It uses the same squeezed scale as
 * v1: the first 6 hours get 60 % of the bar, and the part after the dotted line says "6 h → 48 h
 * squeezed" (council verdict #6).
 *
 * Two rows (FP-3, B4, U7). The slider is a 44 px band of its own: a tap anywhere in it moves the
 * clock, and no other control lies on it (the clock's words and "squeezed" sit in its top, and let
 * taps through). Under it, the key moments' lane: each moment is a tick hanging under the track,
 * this meal's filled blue; the kept meal's in a row of their own below the hours, labelled "Kept:".
 * Shape and place tell them apart, never the grey alone. Moments of either meal closer than a
 * finger (44 px) share one target, as tall as the lane, so no two targets overlap (council round
 * 2); a target with several moments draws a double tick, not a count (U7: the "2", "4" badges were
 * cryptic). Pressing a target pauses and moves the clock to its first moment; a target with
 * several opens their list (a sheet that loads on first use) to pick one. A target's names show
 * above the bar while the pointer or the keyboard focus is on it, and after it is pressed, until
 * the clock moves on. Never when a link, a lesson or Page Down moves the clock to a moment: the
 * names would sit over the graph's last line on the projector (council round 3, FIX-G).
 *
 * The thumb, the filled part and the slider's value are moved straight from the meal clock
 * (`useClock.subscribe`), never through React state, so playing re-renders nothing here.
 * Keys on the slider: ← → 10 min (Shift: 1 h), Home / End, PageDown / PageUp next / previous key
 * moment. The moments are one Tab stop; ← → move between them.
 */

/** A target's width (px): a finger's. Moments closer than this share one (WCAG 2.5.5). */
const GAP = 44
/** Hour labels never come closer than this (px) to the one beside them (B13). */
const TICK_GAP = 8
/**
 * Which hour labels stay when they don't all fit, first to last: 0 h, 48 h, 6 h (the knee), 2 h,
 * 4 h, 24 h, then 1 h, 3 h, 12 h, 36 h. Indexes into TIMELINE_TICKS; measured, so projector mode,
 * Hindi and the pseudo-locale drop labels as soon as they would crowd. The graphs' vertical hour
 * lines stay either way.
 */
const TICK_ORDER = [0, 9, 5, 2, 4, 7, 1, 3, 6, 8]
/** A paused clock this close (minutes) to where a marker press moved it is still "at" it: the names stay shown. */
const AT_MOMENT_MIN = 0.5

/** One key moment of one meal ('run' = this meal, 'kept'), with its words: "name, time". */
type Mark = Moment & { lane: 'run' | 'kept'; line: string }

/** One target on the lane: one moment, or a few of either meal that nearly coincide. */
interface Marker {
  key: string
  /** Its moments in time order; the target sits at the first, and a press jumps there. */
  moments: Mark[]
  atMin: number
  /** Its hit area, px left and right of the first moment. */
  before: number
  after: number
  /** One line per moment: the button's name and the label above the bar. */
  lines: string[]
}

export default function Timeline({ run, kept }: { run: RunResult; kept: RunResult | null }) {
  const { t } = useTranslation()
  // The lit system's key moments (SystemUi.moments, W-1).
  const { moments: momentsOf } = useSystemUi()
  const track = useRef<HTMLDivElement>(null)
  const lane = useRef<HTMLDivElement>(null)
  const kneeLabel = useRef<HTMLSpanElement>(null)
  const width = useTrackWidth(track)

  const fill = useRef<HTMLSpanElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = track.current
    if (!el) return
    let shownMin = -1
    const show = (min: number) => {
      // The same scale as the graphs' playheads (lib/axis.ts), so the thumb is right under them.
      // Moved with transforms on their own layers (a percentage of the track's width), so a
      // playing frame neither lays out nor repaints the page: the compositor just slides them.
      const pos = posAt(min)
      fill.current!.style.transform = `translateX(${((pos - 1) * 100).toFixed(3)}%)`
      thumb.current!.style.transform = `translateX(${(pos * 100).toFixed(3)}%)`
      // The slider's value changes once per minute, not every frame.
      const rounded = Math.round(min)
      if (rounded === shownMin) return
      shownMin = rounded
      el.setAttribute('aria-valuenow', String(rounded))
      el.setAttribute('aria-valuetext', `${formatDuration(min, t)} ${t('sim.afterEating')}`)
    }
    show(useClock.getState().simMin)
    return useClock.subscribe((s) => s.simMin, show)
  }, [t])

  // The hour labels that fit (B13): each label in TICK_ORDER shows unless it would come within
  // TICK_GAP px of one already shown. Measured again when the track, the language or the fonts change.
  useLayoutEffect(() => {
    const labels = lane.current!.querySelectorAll<HTMLElement>('[data-tick]')
    const fit = () => {
      const shown: number[][] = []
      for (const i of TICK_ORDER) {
        const el = labels[i]!
        const min = TIMELINE_TICKS[i]!
        const w = el.offsetWidth
        const x = timeToPos(min) * width
        const left = min ? (min === HORIZON_MIN ? x - w : x - w / 2) : 0
        const free = shown.every(([l, r]) => left >= r! + TICK_GAP || left + w <= l! - TICK_GAP)
        el.style.visibility = free ? '' : 'hidden'
        if (free) shown.push([left, left + w])
      }
    }
    fit()
    document.fonts.ready.then(fit)
  }, [width, t])

  const markers = useMemo(() => {
    const marks: Mark[] = []
    for (const [sim, lane] of [
      [run, 'run'],
      [kept, 'kept'],
    ] as const) {
      if (!sim || sim.meal.items.length === 0) continue
      for (const m of momentsOf(sim)) {
        const name = t(momentNameKey(m.id, sim))
        const time =
          m.low != null && m.high != null
            ? t('dock.usually', { time: formatDuration(m.atMin, t), low: formatDuration(m.low, t), high: formatDuration(m.high, t) })
            : formatDuration(m.atMin, t)
        marks.push({ ...m, lane, line: t(lane === 'run' ? 'dock.marker' : 'dock.keptMarker', { name, time }) })
      }
    }
    // In time order; at the same minute this meal's come first (the sort is stable).
    marks.sort((p, q) => p.atMin - q.atMin)
    const groups: Mark[][] = []
    groupClose(
      marks.map((m) => posAt(m.atMin) * width),
      GAP,
    ).forEach((g, i) => (groups[g] ??= []).push(marks[i]!))
    const hits = hitAreas(
      groups.map((g) => posAt(g[0]!.atMin) * width),
      GAP,
    )
    return groups.map((moments, i): Marker => ({
      key: `${moments[0]!.lane}:${moments[0]!.id}`,
      moments,
      atMin: moments[0]!.atMin,
      lines: moments.map((m) => m.line),
      ...hits[i]!,
    }))
  }, [momentsOf, run, kept, t, width])

  // Which names show: the marker under the pointer or the keyboard focus; else, after a marker was
  // pressed (a tap on a phone has no hover), every moment the paused clock is at, of both meals
  // (cola's "half has left" and "highest" can share a minute, and so can the kept meal's), so
  // none hides behind another. `pressed` is the minute the press moved the clock to: once the
  // clock is anywhere else (playing, a drag, Page Down, a link) nothing shows by itself.
  const [hot, setHot] = useState<string | null>(null)
  const [pressed, setPressed] = useState<number | null>(null)
  const atMoment = useCallback(
    (s: { simMin: number; playing: boolean }) =>
      s.playing || pressed === null || Math.abs(s.simMin - pressed) >= AT_MOMENT_MIN
        ? ''
        : markers
            .flatMap((m) => m.moments)
            .filter((x) => Math.abs(x.atMin - s.simMin) < AT_MOMENT_MIN)
            .map((x) => x.line)
            .join('\n'),
    [markers, pressed],
  )
  const here = useClock(atMoment)
  const hotMarker = markers.find((m) => m.key === hot)
  const tip = hotMarker ?? (here ? { key: here, atMin: pressed!, lines: here.split('\n') } : null)

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
  const kneeLeft = useKneeSide(kneeLabel, width)
  return (
    <div className="relative select-none">
      {/*
       * "6 h → 48 h squeezed", in the band's top over the squeezed part of the bar, starting just
       * right of the dotted line. When it is longer than that part (Hindi, the projector) it ends
       * just left of the line instead, so it never runs across the line or off the bar (WP-18).
       */}
      <span
        ref={kneeLabel}
        aria-hidden="true"
        data-knee=""
        className="pointer-events-none absolute top-0.5 text-caption leading-none whitespace-nowrap text-ink-muted max-sm:hidden"
        style={kneeLeft ? { right: `calc(${(1 - KNEE_FRACTION) * 100}% + 0.375rem)` } : { left: `calc(${knee} + 0.375rem)` }}
      >
        {t('dock.squeezed', { from: formatDuration(KNEE_MIN, t), to: formatDuration(HORIZON_MIN, t) })}
      </span>
      {/* The dotted line, through the track only: the clock's words above it (phones) stay clear. */}
      <span
        aria-hidden="true"
        data-knee-line=""
        className="pointer-events-none absolute top-[24px] h-[20px] border-l-2 border-dotted border-ink-muted/60"
        style={{ left: knee }}
      />
      {/* The band: the slider, 44 px tall, its track in the lower part. */}
      <div className="relative h-[44px]">
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
          // The whole band is the hit area. The focus ring goes on the thumb, not round the band.
          // Size and layout containment keeps the track's inside to itself.
          className="group absolute inset-0 cursor-pointer touch-none rounded-control [contain:size_layout] focus-visible:outline-none!"
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-[34px] h-1.5 -translate-y-1/2 overflow-hidden rounded-control bg-ink/20"
          >
            {/* The filled part: a full-width bar slid in from the left, clipped by the track. */}
            <span
              ref={fill}
              className="block size-full rounded-control bg-ink will-change-transform"
              style={{ transform: 'translateX(-100%)' }}
            />
          </span>
          {/* A track-wide box slid right by the clock's share of the track; the thumb sits at its left edge. */}
          <span aria-hidden="true" ref={thumb} className="pointer-events-none absolute inset-0 will-change-transform">
            <span
              data-thumb=""
              className="absolute top-[34px] left-0 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-raised bg-ink shadow-[0_1px_3px_rgb(20_33_61/0.4)] group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-ink group-active:scale-110"
            />
          </span>
        </div>
        {tip && <MarkerTip key={tip.key} atMin={tip.atMin} lines={tip.lines} width={width} />}
      </div>
      {/* The lane: hour labels, then the moments' targets over them (siblings of the slider: a slider's children are not read out). */}
      <div ref={lane} className={`relative ${kept ? 'h-[calc(var(--lane)+var(--text-caption))]' : 'h-(--lane)'}`}>
        {TIMELINE_TICKS.map((m) => (
          <span
            key={m}
            aria-hidden="true"
            data-tick=""
            className={`tabular absolute top-[calc(var(--lane)-2px)] -translate-y-full text-caption leading-none whitespace-nowrap text-ink-muted ${
              m === 0 ? '' : m === HORIZON_MIN ? '-translate-x-full' : '-translate-x-1/2'
            }`}
            style={{ left: `${timeToPos(m) * 100}%` }}
          >
            {t('units.hShort', { n: m / 60 })}
          </span>
        ))}
        {kept && (
          <span
            aria-hidden="true"
            data-kept-lane=""
            className="absolute top-(--lane) right-full mr-1.5 text-caption leading-none text-ink-muted"
          >
            {t('now.keptShort')}
          </span>
        )}
        <MarkerLane markers={markers} width={width} label={t('dock.moments')} onHot={setHot} onPress={setPressed} />
      </div>
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

/**
 * The key moments' targets along the lane, as a toolbar: one Tab stop; ← → (and Home / End) move
 * between them, Enter or Space presses one. The stage's key map leaves those keys to it (lib/keys.ts).
 */
function MarkerLane({
  markers,
  width,
  label,
  onHot,
  onPress,
}: {
  markers: Marker[]
  width: number
  label: string
  onHot: (key: string | null) => void
  /** A marker was pressed and moved the clock to `atMin`. */
  onPress: (atMin: number) => void
}) {
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
    <div ref={box} role="toolbar" aria-label={label} onKeyDown={onKeyDown} className="absolute inset-0">
      {markers.map((m, i) => (
        <button
          key={m.key}
          type="button"
          tabIndex={i === at ? 0 : -1}
          aria-label={m.lines.join('; ')}
          aria-haspopup={m.moments.length > 1 ? 'dialog' : undefined}
          data-marker={[...new Set(m.moments.map((x) => x.lane))].join(' ')}
          data-moment={m.moments.map((x) => x.id).join(' ')}
          onClick={() => {
            const clock = useClock.getState()
            clock.pause()
            clock.setSimMin(m.atMin)
            onPress(m.atMin)
            // Several moments: their list, to pick one (U7).
            if (m.moments.length > 1) useSheet.getState().open({ kind: 'moments', moments: m.moments.map((x) => [x.line, x.atMin]) })
          }}
          onPointerEnter={() => onHot(m.key)}
          onPointerLeave={() => onHot(null)}
          onFocus={(e) => {
            setFocus(i)
            // Keyboard focus only: a click focuses the button too, and the press shows the names anyway.
            if (e.currentTarget.matches(':focus-visible')) onHot(m.key)
          }}
          onBlur={() => onHot(null)}
          className="absolute inset-y-0 cursor-pointer rounded-control focus-visible:outline-offset-0"
          style={{ left: posAt(m.atMin) * width - m.before, width: m.before + m.after }}
        >
          {/*
           * Each meal's ticks: this meal's hang under the track, the kept meal's sit in its row.
           * One tick per meal, at its first moment; a double tick where it has several here.
           */}
          {(['run', 'kept'] as const).map((lane) => {
            const own = m.moments.filter((x) => x.lane === lane)
            return own.length ? (
              <span
                key={lane}
                aria-hidden="true"
                data-dot={lane}
                data-count={own.length > 1 ? own.length : undefined}
                className={`pointer-events-none absolute -translate-x-1/2 ${lane === 'run' ? '-top-[7px] h-3' : 'top-[calc(var(--lane)+2px)] h-2.5'} ${
                  own.length > 1
                    ? `w-[9px] border-x-[3px] ${lane === 'run' ? 'border-run' : 'border-kept'}`
                    : `w-[3px] ${lane === 'run' ? 'bg-run' : 'bg-kept'}`
                }`}
                style={{ left: m.before + (posAt(own[0]!.atMin) - posAt(m.atMin)) * width }}
              />
            ) : null
          })}
        </button>
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
      className="pointer-events-none absolute bottom-[24px] z-10 flex w-max max-w-full flex-col rounded-control bg-ink px-2 py-0.5 text-caption font-semibold text-white shadow-[0_1px_3px_rgb(20_33_61/0.35)]"
      style={left === null ? { left: 0, visibility: 'hidden' } : { left }}
    >
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </span>
  )
}
