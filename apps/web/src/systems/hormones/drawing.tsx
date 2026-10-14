import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt } from '@lifepeek/engine'
import {
  ADRENALS,
  ADRENAL_CAP,
  INSULIN_PATH,
  INTO_LIVER_U,
  LABELS,
  LIVER_OUTLINE,
  PITUITARY,
  STOMACH_OUTLINE,
  THYROID,
  along,
  pancreasOutline,
  type HormoneLabel,
  type Outline,
} from '../../anatomy/human/hormones.ts'
import { HORMONE_TONE } from '../../anatomy/tones/hormones.ts'
import { levelGate } from '../../flat/drives.ts'
import { onTick } from '../../lib/ticker.ts'
import { useClock } from '../../state/clock.ts'
import type { View } from '../../anatomy/human/base.ts'
import type { LayerProps } from '../../registry/types.ts'
import { DOT_BOUNDS, DOT_STEP, TRIP_SEC, dotsOf } from './insulin.ts'
import { INSULIN, seriesOf } from './summary.ts'

/*
 * The pack shares no code with the stage but the meal clock's (a module shared with /sim would be
 * split out of it into a chunk of its own, on every first download), nor with another pack. So the
 * few lines it needs of the flat body are written out here, as the kidneys' are, and hormones.test.ts
 * checks each against its original: `frameOf` (flat/FlatBody.tsx frame), LOOK (flat/look.ts
 * FLAT_LOOK), the pixel-ratio cap (three/quality.ts), the skin's line colour and the particles' edge
 * (anatomy/tones/base.ts SKIN_LINE, PARTICLE_EDGE).
 */

/** Scene units → CSS px, front-on, fitting `view` into the picture (flat/FlatBody.tsx `frame`). */
export function frameOf(w: number, h: number, view: View) {
  const scale = Math.min(w / (view.maxX - view.minX), h / (view.maxY - view.minY))
  const oy = h / 2 + ((view.maxY + view.minY) / 2) * scale
  return { scale, X: (x: number) => w / 2 + x * scale, Y: (y: number) => oy - y * scale }
}
type Frame = ReturnType<typeof frameOf>

/** The outline's shade of an organ's colour and its width (flat/look.ts FLAT_LOOK). */
export const LOOK = { normal: { ink: 0.42, line: 1.25 }, projector: { ink: 0.2, line: 2 } } as const
type Look = (typeof LOOK)[keyof typeof LOOK]

/** The skin's outline colour (anatomy/tones/base.ts SKIN_LINE): the see-through stomach is drawn in it. */
export const GHOST_LINE = 'rgba(61,76,107,0.55)'
/** The food particles' edge (anatomy/tones/base.ts PARTICLE_EDGE): the insulin dots have it too. */
export const DOT_EDGE = '#141a2e'

/** An organ colour's outline: the colour, shaded (flat/look.ts outlineOf). */
const ink = (hex: string, look: Look) => `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * look.ink)).join(',')})`

/** The pancreas's outline: a pale fill (L* > 85) gets a 3 px ink outline on the projector (anatomy plan §5). */
export const pancreasLine = (look: Look) => (look === LOOK.projector ? 3 : look.line)

/** Sizes a canvas to the picture (CSS px), at the flat body's pixel-ratio cap (1.5; 1.25 on a 2 GB phone). */
function sized(canvas: HTMLCanvasElement, w: number, h: number) {
  const memory = (navigator as { deviceMemory?: number }).deviceMemory
  const dpr = Math.min(window.devicePixelRatio || 1, memory !== undefined && memory <= 2 ? 1.25 : 1.5)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx?.clearRect(0, 0, w, h)
  return ctx
}

/** A smooth closed outline through the points (quadratic curves through their midpoints). */
function smooth(ctx: CanvasRenderingContext2D, pts: Outline, { X, Y }: Frame) {
  const mid = (a: readonly [number, number], b: readonly [number, number]) => [X((a[0] + b[0]) / 2), Y((a[1] + b[1]) / 2)] as const
  ctx.beginPath()
  const start = mid(pts[pts.length - 1]!, pts[0]!)
  ctx.moveTo(start[0], start[1])
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % pts.length]!)
    ctx.quadraticCurveTo(X(p[0]), Y(p[1]), m[0], m[1])
  })
  ctx.closePath()
}

/** An open line through the points. */
function line(ctx: CanvasRenderingContext2D, pts: Outline, { X, Y }: Frame) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))))
}

/** A filled organ with its outline. */
function solid(ctx: CanvasRenderingContext2D, tone: string, look: Look, width: number = look.line) {
  ctx.fillStyle = tone
  ctx.fill()
  ctx.strokeStyle = ink(tone, look)
  ctx.lineWidth = width
  ctx.stroke()
}

/** An ellipse path, scene units. */
function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, m: Frame) {
  ctx.beginPath()
  ctx.ellipse(m.X(x), m.Y(y), rx * m.scale, ry * m.scale, 0, 0, Math.PI * 2)
}

/**
 * What does not move: the liver, the vein from the pancreas to it, the pancreas, the stomach drawn
 * see-through in front of it, and the glands that are drawn only (pituitary, thyroid, adrenals).
 */
function paintStill(ctx: CanvasRenderingContext2D, look: Look, m: Frame) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // The drawing-only glands, faint: a bearing, never moved by the model.
  ctx.globalAlpha = 0.75
  ellipse(ctx, PITUITARY.x, PITUITARY.y, PITUITARY.rx, PITUITARY.ry, m)
  solid(ctx, HORMONE_TONE.gland, look)
  for (const side of [1, -1]) {
    ellipse(ctx, THYROID.x + side * THYROID.lobe, THYROID.y, THYROID.rx, THYROID.ry, m)
    solid(ctx, HORMONE_TONE.gland, look)
  }
  ctx.globalAlpha = 1
  // The liver, then the adrenals peeking over the kidneys' tops (behind it in the body: drawn faint).
  smooth(ctx, LIVER_OUTLINE, m)
  solid(ctx, HORMONE_TONE.liver, look)
  ctx.globalAlpha = 0.75
  for (const a of ADRENALS) {
    smooth(
      ctx,
      ADRENAL_CAP.map(([x, y]) => [a.x + x, a.y + y]),
      m,
    )
    solid(ctx, HORMONE_TONE.gland, look)
  }
  ctx.globalAlpha = 1
  // The vein: the pancreas's blood (and its insulin) runs along it to the liver.
  line(ctx, INSULIN_PATH, m)
  ctx.strokeStyle = ink(HORMONE_TONE.vein, look)
  ctx.lineWidth = 0.05 * m.scale + 2 * look.line
  ctx.stroke()
  ctx.strokeStyle = HORMONE_TONE.vein
  ctx.lineWidth = 0.05 * m.scale
  ctx.stroke()
  // The pancreas over its vein.
  smooth(ctx, pancreasOutline(), m)
  solid(ctx, HORMONE_TONE.pancreas, look, pancreasLine(look))
  // The stomach in front, see-through: a pale wash and a dashed outline.
  smooth(ctx, STOMACH_OUTLINE, m)
  ctx.fillStyle = 'rgba(61,76,107,0.06)'
  ctx.fill()
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = GHOST_LINE
  ctx.lineWidth = look.line
  ctx.stroke()
  ctx.setLineDash([])
}

/** The labels, most needed first: a short picture (a phone's) names the pancreas and the liver; a tall one adds the rest. */
const LABEL_KEYS: readonly HormoneLabel[] = ['pancreas', 'liver', 'vein', 'stomach', 'thyroid', 'pituitary', 'adrenal']

/** The dots' pool: the most a step draws (insulin.ts dotsOf). */
const POOL = Array.from({ length: dotsOf(DOT_BOUNDS.length) }, (_, i) => i)

/** A dot's place and opacity at `u` along the vein: it fades as it goes into the liver. */
function dotAt(u: number, m: Frame) {
  const [x, y] = along(INSULIN_PATH, u)
  const fade = u > INTO_LIVER_U ? Math.max(0, 1 - (u - INTO_LIVER_U) / (1 - INTO_LIVER_U)) : 1
  return { x: m.X(x), y: m.Y(y), opacity: fade }
}

/**
 * Hormones' flat picture (U-6; anatomy plan §2.8), over the base body in the `upper` framing: the
 * pancreas behind a see-through stomach, the liver, and the vein from the pancreas to the liver;
 * the pituitary, thyroid and adrenals drawn only (their cards say so).
 *
 * - Insulin dots leave the pancreas along the vein to the liver: none while insulin is at its
 *   before-eating level (water alone: exactly 1×), more as it rises. The count moves in steps through
 *   flat/drives.ts `levelGate` (half a step past a boundary, at most once a real second), so scrubbing
 *   never flickers it. The model's number is in the Now line and the graph.
 * - The dots move on the real clock (lib/ticker.ts, at most 20 updates a second); nothing changes colour.
 * - With motion reduced: the same number of dots, still, spread along the vein, and an arrow at its end.
 */
function HormonesLayer({ sim, view, width: w, height: h, reduced, projector, kit }: LayerProps) {
  const { t } = useTranslation()
  const back = useRef<HTMLCanvasElement>(null)
  const dots = useRef<SVGGElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const m = frameOf(w, h, view)
  const look = projector ? LOOK.projector : LOOK.normal

  // The still parts, painted once per size and look.
  useEffect(() => {
    const ctx = back.current && sized(back.current, w, h)
    if (ctx) paintStill(ctx, look, m)
  }, [w, h, view, look]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view

  // How many dots: the gated step at the clock's minute, re-checked a second after a change the gate
  // held back (so a fast drag that stops still lands on the right count). Then, unless motion is
  // reduced, the dots run along the vein on the real clock.
  useEffect(() => {
    const insulin = seriesOf(sim, INSULIN)
    const el = root.current
    const g = dots.current
    if (!insulin || !el || !g) return
    const gate = levelGate(DOT_BOUNDS, 1000, DOT_STEP)
    const circles = [...g.querySelectorAll('circle')]
    let count = -1
    let later = 0
    let clock = 0
    const place = () => {
      circles.forEach((c, i) => {
        if (i >= count) return void c.setAttribute('opacity', '0')
        // Still: spread along the vein, short of the liver. Moving: evenly spaced, running.
        const u = reduced ? ((i + 0.5) / count) * INTO_LIVER_U : (clock / TRIP_SEC + i / count) % 1
        const p = dotAt(u, m)
        c.setAttribute('cx', p.x.toFixed(1))
        c.setAttribute('cy', p.y.toFixed(1))
        c.setAttribute('opacity', p.opacity.toFixed(2))
      })
    }
    const show = () => {
      const x = valueAt(insulin, useClock.getState().simMin, sim.stepMin)
      const step = gate(x, performance.now())
      const n = dotsOf(step)
      if (n !== count) {
        count = n
        el.dataset.dots = String(n)
        place()
      }
      window.clearTimeout(later)
      if (step !== DOT_BOUNDS.filter((b) => x >= b).length) later = window.setTimeout(show, 1050)
    }
    show()
    const off = useClock.subscribe((s) => s.simMin, show)
    let since = 0
    const stop = reduced
      ? () => {}
      : onTick((dt) => {
          clock += dt
          since += dt
          if (since < 0.05 || count <= 0) return
          since = 0
          place()
        })
    return () => {
      off()
      stop()
      window.clearTimeout(later)
    }
  }, [sim, reduced, w, h, view]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view

  // The labels, laid out like Digestion's (the stage's label overlay, handed over in `kit`), with
  // hormones' own places (anatomy/human/hormones.ts LABELS); placed when the size or the words change.
  const specs = useMemo(
    () =>
      LABEL_KEYS.map((key, i) => ({
        key,
        text: t(`sys.control.label.${key}`),
        tone: i ? ('stage' as const) : ('active' as const),
        hidden: (h < 260 && i > 1) || (h < 420 && i > 3),
      })),
    [t, h],
  )
  const placeLabels = () => w > 0 && h > 0 && place((p) => [m.X(p.x), m.Y(p.y)], w, h)
  const { overlay, place } = kit.useCallouts(specs, () => placeLabels(), LABELS)
  useEffect(() => void placeLabels())

  const r = Math.max(2.5, 0.032 * m.scale)
  // The arrow at the vein's end, into the liver (motion reduced).
  const arrow = (() => {
    const [x0, y0] = along(INSULIN_PATH, INTO_LIVER_U - 0.06)
    const [x1, y1] = along(INSULIN_PATH, INTO_LIVER_U)
    const [ax, ay, bx, by] = [m.X(x0), m.Y(y0), m.X(x1), m.Y(y1)]
    const len = Math.hypot(bx - ax, by - ay) || 1
    const [ux, uy] = [(bx - ax) / len, (by - ay) / len]
    const s = Math.max(5, 0.05 * m.scale)
    return `M${bx - ux * s - uy * s * 0.6} ${by - uy * s + ux * s * 0.6}L${bx} ${by}L${bx - ux * s + uy * s * 0.6} ${by - uy * s - ux * s * 0.6}`
  })()
  return (
    <div
      ref={root}
      data-layer="hormones"
      data-dots="0"
      data-motion={reduced ? 'still' : 'moving'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={back} aria-hidden="true" className="absolute top-0 left-0" />
      <svg aria-hidden="true" width={w} height={h} className="absolute top-0 left-0 overflow-visible">
        <g ref={dots} data-insulin-dots="" fill={HORMONE_TONE.insulin} stroke={DOT_EDGE} strokeWidth={projector ? 1.5 : 1}>
          {POOL.map((i) => (
            <circle key={i} r={r} opacity="0" />
          ))}
        </g>
        {reduced && (
          <path
            data-arrow=""
            d={arrow}
            className="in-data-[dots=0]:hidden"
            fill="none"
            stroke={HORMONE_TONE.insulin}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      {overlay}
    </div>
  )
}

/** The pack's drawings (systems/load.ts `drawing`): one per system it serves. */
const DRAWINGS = { hormones: HormonesLayer }
export default DRAWINGS
