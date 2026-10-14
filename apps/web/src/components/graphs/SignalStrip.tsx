import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ActivityBout, type ChartableSeries, type Series } from '@lifepeek/engine'
import { useClock } from '../../state/clock.ts'
import { HORIZON_MIN, KNEE_MIN, TIMELINE_TICKS, formatDuration, windowEnd } from '../../lib/time.ts'
import { bandPath, domainFor, linePath, minAt, samplesOf, xAt, yAt, yTicks, type Domain } from '../../lib/axis.ts'
import { formatNumber, formatSignal, unitLabel } from '../../lib/formatSignal.ts'
import { StatusTag } from '../kit/index.ts'
import { LineSwatch } from '../stage/KeptTag.tsx'
import { useBoutMarks } from '../stage/boutMarks.ts'
import Playhead from './Playhead.tsx'
import { freeSpot, lineEndSpots, placeLabel, polyline, ringSpots, type Box } from './labels.ts'
import { STRIP_ROWS } from './layout.ts'

interface Props {
  series: ChartableSeries
  /** The kept run's series for the same signal: a dashed grey ghost under the live line (G7). */
  kept: Series | null
  /** The meals' short names: the legend says which line is which ("Cola", "Kept: Cheeseburger + French fries"). */
  runName: string
  keptName: string
  /** One moment ringed on the live line at `value`, with a short label ("Highest: 121"). */
  marker: { atMin: number; value: number; label: string } | null
  /** The ⓘ "How we know" button (HowWeKnow). */
  info: ReactNode
  /** A line under the graph (the blood-sugar "not medical advice" note). */
  footer?: ReactNode
  className?: string
  /** The y range, when the organism's registry overrides the catalog's (`signalOverrides`). */
  range?: Domain
  /**
   * A second line on the same axis with its own name, status and label on the line (energy used at
   * rest). It gets no kept ghost: it is the same for every meal.
   */
  second?: { series: Series; label: string } | null
  /**
   * Running totals written after this run's readouts ("340 kcal so far"), for graphs of a rate
   * (energy). The kept run shows its rate only, so the header stays short.
   */
  totals?: { run: Series; second: Series | null } | null
  /** The graph's name, when it is not the first line's (a two-line graph is named for both). */
  title?: string
  /** Read by screen readers after the name: what the graph shows, in one or two sentences. */
  summary?: string
  /** The graphs show one at a time under tabs (phone, projector, short screen): the tab names it. */
  tabbed?: boolean
  /** The run's clock (`run.stepMin`, `run.horizonMin`): index i of every series is minute i·stepMin. */
  clock?: { stepMin: number; horizonMin: number }
  /** The activity bouts of this run and of the kept one: a hatched column each, the kept ones dashed (ui-ux §5). */
  bouts?: readonly ActivityBout[]
  keptBouts?: readonly ActivityBout[]
  /** A range drawn as a pale band across the plot (most children's breaths, R57); its key is in the footer. */
  reference?: { low: number; high: number }
}

/**
 * Watches an element's size in CSS pixels, and the root font size (`rem`, which projector mode and
 * Hindi raise), re-rendering only when one changes.
 */
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0, rem: 16 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth
      const height = el.clientHeight
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      setSize((s) => (s.width === width && s.height === height && s.rem === rem ? s : { width, height, rem }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

const NO_BOUTS: readonly ActivityBout[] = []

/** The human run's clock (PARAMS: 1-minute steps for 48 h), for callers that pass none. */
const RUN_CLOCK = { stepMin: 1, horizonMin: HORIZON_MIN }

const sameBox = (a: Box | null, b: Box | null) => a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h)

/** Where a measured plot label goes; until it is placed (or if no spot was found) it is not seen. */
const labelStyle = (b: Box | null): React.CSSProperties => (b ? { left: b.x, top: b.y } : { left: 0, top: 0, visibility: 'hidden' })

/**
 * One live graph (G1): a catalog signal over the 48 h meal clock, beside the body.
 *
 * - Drawn in real CSS pixels (ResizeObserver), not a stretched viewBox, so lines stay 2 px on a
 *   phone and sharp on a projector. Paths are built once per run and size, from ≤ 400 points.
 * - x is the timeline's squeezed scale, so it lines up with the dock below; y is the signal's
 *   fixed range (`displayRange`), the same for every meal, stretched once only if a value would
 *   not fit. Labels are HTML (they wrap, scale and get Devanagari line height); the SVG holds lines.
 * - The kept run is a dashed grey line, never told apart by hue alone: the legend above the plot
 *   names both meals ("— Cola 145 g   - - Kept: Cheeseburger + French fries 230 g"). No words sit at
 *   the lines' ends (they landed on the lines, council 2026-10-13).
 * - A second line (energy used at rest, WP-13) shares the axis: orange, named and rated in the
 *   readouts with its own status, labelled on the line itself, never given a kept ghost.
 * - The playhead and the readouts follow the meal clock outside React (Playhead). Dragging on the
 *   graph pauses and moves the clock, like the dock.
 */
export default function SignalStrip({
  series,
  kept,
  runName,
  keptName,
  marker,
  info,
  footer,
  className = '',
  range,
  second,
  totals,
  title,
  summary,
  tabbed = false,
  clock = RUN_CLOCK,
  bouts = NO_BOUTS,
  keptBouts = NO_BOUTS,
  reference,
}: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const meta = series.meta
  const titleId = useId()
  const summaryId = useId()
  const hatch = useId()
  const [plot, { width, height, rem }] = useSize<HTMLDivElement>()
  const marks = useBoutMarks(bouts.length + keptBouts.length > 0, series)

  const { domain, stretched } = useMemo(
    () => domainFor(range ?? meta.displayRange ?? [0, 1], [series.values, series.low, series.high, kept?.values, second?.series.values]),
    [range, meta, series, kept, second],
  )
  const ticks = useMemo(() => yTicks(domain, series.values[0]), [domain, series])

  const paths = useMemo(() => {
    if (!width || !height) return null
    const x = (min: number) => xAt(min, width)
    const y = (v: number) => yAt(v, domain, height)
    const line = (values: Float32Array) => {
      const s = samplesOf(values, clock.horizonMin, clock.stepMin)
      return { d: linePath(s.t, s.v, x, y), points: polyline(s.t, s.v, x, y) }
    }
    const run = line(series.values)
    const keptLine = kept ? line(kept.values) : null
    const secondLine = second ? line(second.series.values) : null
    return {
      run: run.d,
      band:
        series.low && series.high
          ? bandPath(samplesOf(series.high, clock.horizonMin, clock.stepMin), samplesOf(series.low, clock.horizonMin, clock.stepMin), x, y)
          : null,
      kept: keptLine?.d ?? null,
      second: secondLine?.d ?? null,
      secondEndY: second ? y(second.series.values[second.series.values.length - 1]!) : null,
      marker: marker ? { x: x(marker.atMin), y: y(marker.value) } : null,
      // Every drawn line, for keeping the labels off them.
      points: [run.points, keptLine?.points, secondLine?.points].filter((p) => !!p),
    }
  }, [series, kept, second, marker, width, height, domain, clock])

  // The words on the plot (the ring's label, the second line's name) go where they cross no line.
  // Measured after layout and placed before paint; hidden until placed, and when nothing fits.
  const markerLabel = useRef<HTMLSpanElement>(null)
  const secondLabel = useRef<HTMLSpanElement>(null)
  // The unit by the y axis, under tabs: placed after the labels above, along the top from the
  // corner, only where it touches nothing. "Time squeezed" is written once, on the dock (FP-4).
  const unitText = useRef<HTMLSpanElement>(null)
  const [placed, setPlaced] = useState<Record<'marker' | 'second' | 'unit', Box | null>>({
    marker: null,
    second: null,
    unit: null,
  })
  const markerWords = marker?.label
  const secondWords = second?.label
  // A web font arriving late (Devanagari) changes the labels' size: place them again.
  const [fonts, setFonts] = useState(0)
  useLayoutEffect(() => {
    const done = () => setFonts((n) => n + 1)
    document.fonts?.addEventListener('loadingdone', done)
    return () => document.fonts?.removeEventListener('loadingdone', done)
  }, [])
  useLayoutEffect(() => {
    const plotSize = { width, height }
    const sizeOf = (el: HTMLElement | null) => (el && el.offsetWidth > 0 ? { w: el.offsetWidth, h: el.offsetHeight } : null)
    // The ring's label and the second line's name first (they say what a line is); then the unit
    // goes along the top edge where it touches nothing, or is left out.
    let secondBox: Box | null = null
    const s = sizeOf(secondLabel.current)
    if (paths && s && paths.secondEndY != null) {
      secondBox = placeLabel(s, lineEndSpots(paths.secondEndY, width, s.w, s.h, height), plotSize, paths.points)
    }
    let markerBox: Box | null = null
    const m = sizeOf(markerLabel.current)
    if (paths?.marker && m) {
      markerBox = placeLabel(m, ringSpots(paths.marker.x, paths.marker.y, m.w, m.h), plotSize, paths.points, secondBox ? [secondBox] : [])
    }
    const u = sizeOf(unitText.current)
    const unitBox =
      paths && u
        ? freeSpot(
            u,
            [0, 1, 2, 3, 4, 6, 8].flatMap((k) => [2, 4 + u.h].map((y) => ({ x: 4 + k * 12, y }))),
            plotSize,
            paths.points,
            [markerBox, secondBox].filter((b) => !!b),
          )
        : null
    const next = { marker: markerBox, second: secondBox, unit: unitBox }
    setPlaced((p) => ((Object.keys(next) as (keyof typeof next)[]).every((k) => sameBox(p[k], next[k])) ? p : next))
  }, [paths, width, height, rem, markerWords, secondWords, fonts, tabbed, lang])

  // Readout text: the value of this run, the kept run and the second line, and running totals if any.
  const runText = useRef<HTMLSpanElement>(null)
  const keptText = useRef<HTMLSpanElement>(null)
  const secondText = useRef<HTMLSpanElement>(null)
  const runTotal = useRef<HTMLSpanElement>(null)
  const secondTotal = useRef<HTMLSpanElement>(null)
  const readout = useCallback(
    (min: number, r: number, k: number | null) => {
      const write = (el: HTMLSpanElement | null, v: number, s: Series = series) => {
        if (el) setText(el, formatSignal(v, s.meta, t, lang))
      }
      const total = (el: HTMLSpanElement | null, s: Series | null | undefined) => {
        if (el && s) setText(el, t('graph.soFar', { value: formatSignal(valueAt(s, min, clock.stepMin), s.meta, t, lang) }))
      }
      write(runText.current, r)
      if (k !== null) write(keptText.current, k)
      if (second) write(secondText.current, valueAt(second.series, min, clock.stepMin), second.series)
      total(runTotal.current, totals?.run)
      total(secondTotal.current, totals?.second)
    },
    [series, second, totals, clock, t, lang],
  )

  // Dragging on the graph scrubs the shared clock (G2). pan-y keeps the page scrollable on a phone.
  const timeAt = (clientX: number) => {
    const r = plot.current!.getBoundingClientRect()
    return minAt(clientX - r.left, r.width)
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    const clock = useClock.getState()
    clock.pause()
    e.currentTarget.setPointerCapture(e.pointerId)
    clock.setSimMin(timeAt(e.clientX))
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) useClock.getState().setSimMin(timeAt(e.clientX))
  }

  const name = title ?? t(`${meta.i18nKey}.name`)
  // With two lines each readout says which line it is; with one, the graph's name does.
  const named = !!second
  // Phones show name and value only (plan-graphs §3.5): the totals, like the second line's label,
  // need the room of a desktop column; on a phone "How we know" gives them in its summary.
  const totalSpan = (ref: RefObject<HTMLSpanElement | null>) =>
    totals && <span ref={ref} data-total="" className="whitespace-nowrap text-ink-muted max-lg:hidden" />
  // Readouts may wrap (Hindi, a phone) between their parts, never inside a number.
  const group = 'inline-flex flex-wrap items-center gap-x-1.5'
  return (
    <figure
      aria-labelledby={titleId}
      aria-describedby={summary ? summaryId : undefined}
      className={`flex min-h-0 flex-col gap-1 ${STRIP_ROWS} ${className}`}
    >
      {/*
       * Stacked graphs (from 1024 px up): name, then how sure we are, small and quiet beside it
       * (it is not a line of the legend), ⓘ at the end; the legend under them, naming both meals.
       * One graph at a time (tabs): the tab names it, so no title here (it would say "Energy"
       * twice). Value, status and ⓘ; a two-line graph, or a kept meal on the projector: status and
       * ⓘ, then the legend; with a kept meal on a phone, its legend entry gets the next row to
       * itself (the meal bar right above names this meal, with the same line sample). On a phone
       * "Scale stretched to fit this plan" gets a row of its own too: squeezed beside the status it
       * took three lines, and pushed the plot under the dock (R60).
       */}
      <figcaption
        className={`grid items-center gap-x-3 ${
          !tabbed
            ? "grid-cols-[auto_minmax(0,1fr)_auto] gap-y-0.5 [grid-template-areas:'title_status_info'_'read_read_read']"
            : named
              ? "grid-cols-[minmax(0,1fr)_auto_auto] gap-y-0.5 [grid-template-areas:'status_status_info'_'read_read_read']"
              : kept
                ? "grid-cols-[minmax(0,1fr)_auto_auto] gap-y-0.5 [grid-template-areas:'read_status_info'_'kept_kept_kept'_'note_note_note'] lg:[grid-template-areas:'status_status_info'_'read_read_read']"
                : "grid-cols-[minmax(0,1fr)_auto_auto] [grid-template-areas:'read_status_info'_'note_note_note']"
        }`}
      >
        <span id={titleId} className={tabbed ? 'sr-only' : 'text-control font-semibold text-ink [grid-area:title]'}>
          {name}
        </span>
        <span className="[grid-area:status]">
          <StatusTag status={meta.status} quiet />
        </span>
        <span className="[grid-area:info]">{info}</span>
        {/* On a phone with a kept meal, the legend's entries are rows of the header grid (`contents`). */}
        <span className={`tabular flex flex-wrap items-center gap-x-4 text-caption [grid-area:read] ${named ? '' : 'max-lg:contents'}`}>
          <span className={`${group} max-lg:[grid-area:read]`}>
            <LineSwatch />
            {/*
             * A two-line graph names the line ("Coming in"); beside a kept meal, the meal names it
             * (on a phone the meal bar above does). Alone, the graph's name says what the line is.
             */}
            <span className={named ? 'text-ink-muted' : kept ? 'text-ink-muted max-lg:sr-only' : 'sr-only'}>
              {named ? t(`${meta.i18nKey}.short`) : kept ? runName : `${t('stage.thisMeal')}: `}
            </span>
            <span ref={runText} data-readout="" className="font-semibold whitespace-nowrap text-ink" />
            {totalSpan(runTotal)}
          </span>
          {second && (
            <span className={`${group} text-ink-muted`}>
              <LineSwatch color="var(--color-energy-used)" />
              {t(`${second.series.meta.i18nKey}.short`)}
              <span ref={secondText} data-readout="" className="font-semibold whitespace-nowrap text-ink" />
              {totalSpan(secondTotal)}
              <StatusTag status={second.series.meta.status} quiet />
            </span>
          )}
          {kept && (
            <span className={`${group} text-ink-muted max-lg:[grid-area:kept]`}>
              <LineSwatch kept />
              <span>{t('keep.tag', { meal: keptName })}</span>
              <span ref={keptText} data-readout="" className="font-semibold whitespace-nowrap" />
            </span>
          )}
          {stretched && <span className="text-ink-muted max-lg:[grid-area:note]">{t('graph.stretched')}</span>}
        </span>
      </figcaption>

      <div className="grid min-h-0 flex-1 grid-cols-[var(--plot-gutter)_minmax(0,1fr)]">
        {/* y labels: top, before eating (or middle), bottom. Text, so it never stretches. */}
        <div
          aria-hidden="true"
          data-axis="y"
          className="tabular relative border-r-2 border-ink-muted/70 text-caption whitespace-nowrap text-ink-muted"
        >
          {ticks.map((v, i) => {
            const fromTop = (domain[1] - v) / (domain[1] - domain[0])
            // The middle label only when a short graph (projector, phone) leaves room between the others.
            if (i === 1 && Math.min(fromTop, 1 - fromTop) * height < 1.6 * rem) return null
            return (
              <span
                key={i}
                className={`absolute right-2 leading-none ${i === 0 ? 'top-0' : i === ticks.length - 1 ? 'bottom-0' : '-translate-y-1/2'}`}
                style={i === 1 ? { top: `${fromTop * 100}%` } : undefined}
              >
                {formatNumber(v, meta, lang)}
              </span>
            )
          })}
        </div>
        <div
          ref={plot}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          // The y axis line is the label column's right border, so x = 0 is exactly the plot's left
          // edge, where the dock's track starts too.
          className="relative min-h-12 cursor-ew-resize lg:min-h-0 touch-pan-y border-b-2 border-ink-muted/70 select-none"
        >
          {paths && (
            // Sized by the plot's box, its drawing by the last measured size: the same, except for
            // the frame or two before a new size is measured (a busy WebKit, B17), when the lines
            // stretch to the box instead of being drawn past it, over the next graph.
            <svg
              role="img"
              // A system's shorter window (Kidneys & water: 12 h) is named; else the 48 h bar.
              aria-label={
                windowEnd() < HORIZON_MIN ? t('graph.labelTo', { name, to: formatDuration(windowEnd(), t) }) : t('graph.label', { name })
              }
              viewBox={`0 0 ${width} ${height}`}
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full overflow-visible"
            >
              {/*
               * After 6 h the time axis is squeezed (42 h in the last 40 % of the width), so a fall
               * that takes hours there looks like a cliff (council round 2, C2): the squeezed part is
               * faintly hatched in the graph paper's colour (a solid tint was the heaviest fill on
               * screen, ui-audit #3), the knee is one dotted rule, and the x axis is broken there.
               */}
              <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <path d="M3 0v6" className="stroke-grid" />
              </pattern>
              <rect
                data-squeezed=""
                x={xAt(KNEE_MIN, width)}
                y="0"
                width={width - xAt(KNEE_MIN, width)}
                height={height}
                fill={`url(#${hatch})`}
              />
              {/* Activity bouts (E-3b-ui): their columns, from the lazy BoutMarks once there are any. */}
              {marks && <marks.BoutBands bouts={bouts} kept={keptBouts} x={(m) => xAt(m, width)} height={height} id={`${hatch}b`} />}
              <g className="stroke-grid" strokeWidth="1" shapeRendering="crispEdges">
                {ticks.slice(0, -1).map((v, i) => (
                  <line
                    key={i}
                    x1="0"
                    x2={width}
                    y1={Math.round(yAt(v, domain, height)) + 0.5}
                    y2={Math.round(yAt(v, domain, height)) + 0.5}
                  />
                ))}
                {TIMELINE_TICKS.filter((m) => m > 0 && m < windowEnd() && m !== KNEE_MIN).map((m) => (
                  <line key={m} x1={Math.round(xAt(m, width)) + 0.5} x2={Math.round(xAt(m, width)) + 0.5} y1="0" y2={height} />
                ))}
              </g>
              {/* The 6 h knee: one thin rule, the hatch's edge. Time runs faster to its right. */}
              <line x1={xAt(KNEE_MIN, width)} x2={xAt(KNEE_MIN, width)} y1="0" y2={height} className="stroke-border" />
              {/* The break in the x axis: two short slashes across it, with a gap of paper between. */}
              <g data-axis-break="" transform={`translate(${xAt(KNEE_MIN, width)} ${height + 1})`}>
                <rect x="-3.5" y="-3" width="7" height="6" className="fill-surface-raised" />
                <path d="M-6.5 4 L-1.5 -4 M1.5 4 L6.5 -4" className="fill-none stroke-ink-muted" strokeWidth="1.5" strokeLinecap="round" />
              </g>
              {reference && (
                <rect
                  data-reference=""
                  x="0"
                  width={width}
                  y={yAt(reference.high, domain, height)}
                  height={yAt(reference.low, domain, height) - yAt(reference.high, domain, height)}
                  style={{ fill: 'var(--color-ink)', fillOpacity: 0.1 }}
                />
              )}
              {paths.band && <path data-line="band" d={paths.band} className="fill-run [fill-opacity:var(--strip-band-opacity)]" />}
              {paths.kept && (
                <path
                  data-line="kept"
                  d={paths.kept}
                  className="fill-none stroke-kept [stroke-dasharray:var(--strip-kept-dash)] [stroke-width:var(--strip-line)]"
                />
              )}
              {paths.second && (
                <path
                  data-line="second"
                  d={paths.second}
                  className="fill-none stroke-energy-used [stroke-width:var(--strip-line)]"
                  strokeLinecap="round"
                />
              )}
              <path
                data-line="run"
                d={paths.run}
                className="fill-none stroke-run [stroke-width:var(--strip-line)]"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {paths.marker && (
                <circle cx={paths.marker.x} cy={paths.marker.y} r="5" className="fill-surface-raised stroke-ink" strokeWidth="2" />
              )}
            </svg>
          )}
          {paths?.marker && marker && (
            <span
              ref={markerLabel}
              aria-hidden="true"
              data-plot-label="marker"
              // Above the playhead (z-10), on a backing of graph paper: the moving line passes behind
              // the words, never through them (council round 2, C5).
              className="pointer-events-none absolute z-10 w-max max-w-[max(9rem,45%)] rounded-[3px] bg-surface-raised/85 px-0.5 text-caption leading-tight font-semibold text-balance text-ink [text-shadow:var(--strip-halo)]"
              style={labelStyle(placed.marker)}
            >
              {marker.label}
            </span>
          )}
          {paths?.secondEndY != null && second && (
            // Near the right end of its line, right of the 6 h knee, where the food energy has
            // mostly come in already, so the label usually sits on empty graph paper.
            <span
              ref={secondLabel}
              aria-hidden="true"
              data-plot-label="second"
              className="pointer-events-none absolute z-10 w-max max-w-[38%] rounded-[3px] bg-surface-raised/85 px-0.5 text-right text-caption leading-tight text-balance text-ink [text-shadow:var(--strip-halo)] max-lg:hidden"
              style={labelStyle(placed.second)}
            >
              {second.label}
            </span>
          )}
          {paths && tabbed && (
            // Under tabs the graph has no title, so its unit is written at the top of the y axis
            // ("600 what?", council round 2, C6). Stacked graphs name it in the title and readouts.
            <span
              ref={unitText}
              aria-hidden="true"
              data-plot-label="unit"
              className="pointer-events-none absolute z-10 rounded-[3px] bg-surface-raised/85 px-0.5 text-caption leading-tight text-ink-muted"
              style={labelStyle(placed.unit)}
            >
              {unitLabel(meta, t)}
            </span>
          )}
          <Playhead
            width={width}
            height={height}
            domain={domain}
            run={series}
            kept={kept}
            second={second?.series ?? null}
            stepMin={clock.stepMin}
            readout={readout}
          />
        </div>
      </div>
      {summary && (
        <span id={summaryId} hidden>
          {summary}
        </span>
      )}
      {footer}
    </figure>
  )
}

/**
 * Writes a readout's text only when it changed, into the text node already there: the same text
 * costs nothing, and a new one changes one node instead of replacing it (less layout per write).
 */
function setText(el: HTMLElement, text: string) {
  const node = el.firstChild
  if (node instanceof Text && !node.nextSibling) {
    if (node.data !== text) node.data = text
  } else el.textContent = text
}
