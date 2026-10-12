import { useEffect, useId, useRef, useState } from 'react'

export interface Series {
  key: string
  label: string
  color: string
  /** Value per minute. */
  values: ArrayLike<number>
  /** Optional band edges per minute. */
  low?: ArrayLike<number>
  high?: ArrayLike<number>
  dashed?: boolean
}

interface Props {
  title: string
  description: string
  series: Series[]
  xMaxMin: number
  yMax: number
  yTicks: number[]
  yUnit: string
  cursorMin: number
  xLabel: string
}

const W = 520
const H = 240

/**
 * SVG text scales with the chart, so a fixed size would end up ~7 px on a phone. Instead we
 * size labels so they render at 0.8125 rem — which follows projector mode and Hindi sizing.
 */
function useTextSize(svg: React.RefObject<SVGSVGElement | null>) {
  const [units, setUnits] = useState(13)
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const update = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      const width = el.clientWidth || W
      setUnits(Math.min(30, (rem * 0.8125 * W) / width))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    const mo = new MutationObserver(update)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-contrast', 'lang'] })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [svg])
  return units
}

/** Small dependency-free SVG chart; one chart style everywhere. */
export default function LineChart({ title, description, series, xMaxMin, yMax, yTicks, yUnit, cursorMin, xLabel }: Props) {
  const id = useId()
  const ref = useRef<SVGSVGElement>(null)
  const fs = useTextSize(ref)
  const M = { top: 12, right: 12, bottom: fs * 2.6, left: fs * 2.8 }
  const iw = W - M.left - M.right
  const ih = H - M.top - M.bottom
  const x = (min: number) => M.left + (Math.min(min, xMaxMin) / xMaxMin) * iw
  const y = (v: number) => M.top + ih - (Math.max(0, Math.min(v, yMax)) / yMax) * ih
  const step = Math.max(1, Math.round(xMaxMin / 240))

  const path = (vals: ArrayLike<number>) => {
    let d = ''
    for (let i = 0; i <= xMaxMin && i < vals.length; i += step) d += `${d ? 'L' : 'M'}${x(i).toFixed(1)},${y(vals[i]!).toFixed(1)}`
    return d
  }
  const band = (low: ArrayLike<number>, high: ArrayLike<number>) => {
    let top = ''
    let bottom = ''
    for (let i = 0; i <= xMaxMin && i < high.length; i += step) top += `${top ? 'L' : 'M'}${x(i).toFixed(1)},${y(high[i]!).toFixed(1)}`
    for (let i = Math.min(xMaxMin, low.length - 1); i >= 0; i -= step) bottom += `L${x(i).toFixed(1)},${y(low[i]!).toFixed(1)}`
    return `${top}${bottom}Z`
  }
  // Label every hour, or every other hour on long charts so the numbers don't collide.
  const everyH = xMaxMin > 8 * 60 ? 2 : 1
  const hours = Array.from({ length: Math.floor(xMaxMin / 60 / everyH) + 1 }, (_, i) => i * everyH)

  return (
    <figure className="min-w-0">
      <figcaption className="mb-1">
        <span className="block font-semibold">{title}</span>
        <span id={`${id}-desc`} className="block text-sm text-ink-2">
          {description}
        </span>
        <span className="mt-1 block text-xs font-semibold text-ink-2">{yUnit}</span>
      </figcaption>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby={`${id}-desc`} style={{ fontSize: fs }}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="var(--color-rule)" strokeWidth={v === 0 ? 1.5 : 1} />
            <text x={M.left - fs * 0.4} y={y(v)} textAnchor="end" dominantBaseline="middle" className="tabular fill-ink">
              {v}
            </text>
          </g>
        ))}
        {hours.map((h) => (
          <text key={h} x={x(h * 60)} y={H - M.bottom + fs * 1.2} textAnchor="middle" className="tabular fill-ink">
            {h}
          </text>
        ))}
        <text x={W - M.right} y={H - fs * 0.3} textAnchor="end" className="fill-ink-2">
          {xLabel}
        </text>

        {series.map((s) => s.low && s.high && <path key={`${s.key}-band`} d={band(s.low, s.high)} fill={s.color} opacity={0.14} />)}
        {series.map((s) => (
          <path
            key={s.key}
            d={path(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={3}
            strokeDasharray={s.dashed ? '8 5' : undefined}
            strokeLinejoin="round"
          />
        ))}

        {cursorMin <= xMaxMin && (
          <line
            x1={x(cursorMin)}
            x2={x(cursorMin)}
            y1={M.top}
            y2={M.top + ih}
            stroke="var(--color-ink)"
            strokeWidth={1.5}
            strokeDasharray="3 3"
          />
        )}
      </svg>
      <ul className="mt-1 flex flex-wrap gap-x-4 text-sm">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="0" x2="22" y1="4" y2="4" stroke={s.color} strokeWidth="3" strokeDasharray={s.dashed ? '6 4' : undefined} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
    </figure>
  )
}
