import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type ChartableSeries, type Series } from '@lifepeek/engine'
import { useClock } from '../../state/clock.ts'
import { HORIZON_MIN, KNEE_MIN, TIMELINE_TICKS } from '../../lib/time.ts'
import { bandPath, domainFor, linePath, minAt, samplesOf, xAt, yAt, yTicks } from '../../lib/axis.ts'
import { formatNumber, formatSignal } from '../../lib/formatSignal.ts'
import { StatusTag } from '../kit/index.ts'
import { LineSwatch } from '../stage/KeptTag.tsx'
import Playhead from './Playhead.tsx'
import { STRIP_ROWS } from './layout.ts'

interface Props {
  series: ChartableSeries
  /** The kept run's series for the same signal: a dashed grey ghost under the live line (G7). */
  kept: Series | null
  /** The kept meal's name, for the ghost's end label ("Kept: Cola"). */
  keptName: string
  /** One moment ringed on the live line, with a short label ("Highest: 121"). */
  marker: { atMin: number; label: string } | null
  /** The ⓘ "How we know" button (HowWeKnow). */
  info: ReactNode
  /** A line under the graph (the blood-sugar "not medical advice" note). */
  footer?: ReactNode
  className?: string
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

/**
 * One live graph (G1): a catalog signal over the 48 h meal clock, beside the body.
 *
 * - Drawn in real CSS pixels (ResizeObserver), not a stretched viewBox, so lines stay 2 px on a
 *   phone and sharp on a projector. Paths are built once per run and size, from ≤ 400 points.
 * - x is the timeline's squeezed scale, so it lines up with the dock below; y is the signal's
 *   fixed range (`displayRange`), the same for every meal, stretched once only if a value would
 *   not fit. Labels are HTML (they wrap, scale and get Devanagari line height); the SVG holds lines.
 * - The kept run is a dashed grey line with an end label, never told apart by hue alone.
 * - The playhead and the readouts follow the meal clock outside React (Playhead). Dragging on the
 *   graph pauses and moves the clock, like the dock.
 */
export default function SignalStrip({ series, kept, keptName, marker, info, footer, className = '' }: Props) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const meta = series.meta
  const titleId = useId()
  const [plot, { width, height, rem }] = useSize<HTMLDivElement>()

  const { domain, stretched } = useMemo(
    () => domainFor(meta.displayRange ?? [0, 1], [series.values, series.low, series.high, kept?.values]),
    [meta, series, kept],
  )
  const ticks = useMemo(() => yTicks(domain, series.values[0]), [domain, series])

  const paths = useMemo(() => {
    if (!width || !height) return null
    const x = (min: number) => xAt(min, width)
    const y = (v: number) => yAt(v, domain, height)
    const line = (values: Float32Array) => {
      const s = samplesOf(values)
      return linePath(s.t, s.v, x, y)
    }
    const end = (values: Float32Array) => ({ x: width, y: y(values[values.length - 1]!) })
    return {
      run: line(series.values),
      band: series.low && series.high ? bandPath(samplesOf(series.high), samplesOf(series.low), x, y) : null,
      kept: kept ? line(kept.values) : null,
      keptEnd: kept ? end(kept.values) : null,
      marker: marker ? { x: x(marker.atMin), y: y(valueAt(series, marker.atMin)) } : null,
    }
  }, [series, kept, marker, width, height, domain])

  const runText = useRef<HTMLSpanElement>(null)
  const keptText = useRef<HTMLSpanElement>(null)
  const readout = useCallback(
    (_min: number, r: number, k: number | null) => {
      if (runText.current) runText.current.textContent = formatSignal(r, meta, t, lang)
      if (keptText.current && k !== null) keptText.current.textContent = formatSignal(k, meta, t, lang)
    },
    [meta, t, lang],
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

  const name = t(`${meta.i18nKey}.name`)
  return (
    <figure aria-labelledby={titleId} className={`flex min-h-0 flex-col gap-1 ${STRIP_ROWS} ${className}`}>
      {/*
       * Phones: the tab above already names the graph, so the header is one row: values, status, ⓘ.
       * From 1024 px up: name, status and ⓘ, then the values under them.
       */}
      <figcaption className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 [grid-template-areas:'read_status_info'] lg:gap-y-0.5 lg:[grid-template-areas:'title_status_info'_'read_read_read']">
        <span id={titleId} className="text-control font-semibold text-ink [grid-area:title] max-lg:sr-only">
          {name}
        </span>
        <span className="[grid-area:status]">
          <StatusTag status={meta.status} />
        </span>
        <span className="[grid-area:info]">{info}</span>
        <span className="tabular flex flex-wrap items-center gap-x-4 text-caption [grid-area:read]">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <LineSwatch />
            <span className="sr-only">{t('stage.thisMeal')}: </span>
            <span ref={runText} className="font-semibold text-ink" />
          </span>
          {kept && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
              <LineSwatch kept />
              {t('graph.kept')}
              <span ref={keptText} className="font-semibold" />
            </span>
          )}
          {stretched && <span className="text-ink-2">{t('graph.stretched')}</span>}
        </span>
      </figcaption>

      <div className="grid min-h-0 flex-1 grid-cols-[var(--plot-gutter)_minmax(0,1fr)]">
        {/* y labels: top, before eating (or middle), bottom. Text, so it never stretches. */}
        <div aria-hidden="true" data-axis="y" className="tabular relative border-r-2 border-ink-2/70 text-caption text-ink-2">
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
          className="relative min-h-12 cursor-ew-resize lg:min-h-0 touch-pan-y border-b-2 border-ink-2/70 select-none"
        >
          {paths && (
            <svg
              role="img"
              aria-label={t('graph.label', { name })}
              width={width}
              height={height}
              className="absolute inset-0 overflow-visible"
            >
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
                {TIMELINE_TICKS.filter((m) => m > 0 && m < HORIZON_MIN && m !== KNEE_MIN).map((m) => (
                  <line key={m} x1={Math.round(xAt(m, width)) + 0.5} x2={Math.round(xAt(m, width)) + 0.5} y1="0" y2={height} />
                ))}
              </g>
              {/* The 6 h knee, dotted as on the dock: time runs faster to its right. */}
              <line
                x1={xAt(KNEE_MIN, width)}
                x2={xAt(KNEE_MIN, width)}
                y1="0"
                y2={height}
                className="stroke-ink-2/60"
                strokeWidth="2"
                strokeDasharray="0 4"
                strokeLinecap="round"
              />
              {paths.band && <path data-line="band" d={paths.band} className="fill-run [fill-opacity:var(--strip-band-opacity)]" />}
              {paths.kept && (
                <path
                  data-line="kept"
                  d={paths.kept}
                  className="fill-none stroke-kept [stroke-dasharray:var(--strip-kept-dash)] [stroke-width:var(--strip-line)]"
                />
              )}
              <path
                data-line="run"
                d={paths.run}
                className="fill-none stroke-run [stroke-width:var(--strip-line)]"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {paths.marker && <circle cx={paths.marker.x} cy={paths.marker.y} r="5" className="fill-shelf stroke-ink" strokeWidth="2" />}
            </svg>
          )}
          {paths?.marker && marker && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute text-caption leading-none font-semibold whitespace-nowrap text-ink [text-shadow:var(--strip-halo)]"
              style={{ left: paths.marker.x + 9, top: paths.marker.y - 9, transform: 'translateY(-100%)' }}
            >
              {marker.label}
            </span>
          )}
          {paths?.keptEnd && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-1 max-w-[80%] text-right text-caption leading-tight text-ink-2 [text-shadow:var(--strip-halo)]"
              style={{ bottom: height - paths.keptEnd.y + 5 }}
            >
              {t('keep.tag', { meal: keptName })}
            </span>
          )}
          <Playhead width={width} height={height} domain={domain} run={series} kept={kept} readout={readout} />
        </div>
      </div>
      {footer}
    </figure>
  )
}
