import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt } from '@lifepeek/engine'
import {
  AORTA,
  BLADDER_BASE,
  BLADDER_MAX_ML,
  LABELS,
  RIBS,
  URETHRA,
  VENA_CAVA,
  bladderRadius,
  kidneyOutline,
  renalArtery,
  renalVein,
  ureter,
  type KidneyLabel,
  type Outline,
} from '../../anatomy/human/kidneys.ts'
import { KIDNEY_TONE } from '../../anatomy/tones/kidneys.ts'
import { levelGate } from '../../flat/drives.ts'
import { onTick } from '../../lib/ticker.ts'
import { useClock } from '../../state/clock.ts'
import type { View } from '../../anatomy/human/base.ts'
import type { LayerProps } from '../../registry/types.ts'
import { BLADDER_BOUNDS, EASE_MS, EMPTIES_ML, URGE_ML, seriesOf, stepMl, ureterSpeed } from './water.ts'

/*
 * The pack shares no code with the stage but the meal clock's (a module shared with /sim would be
 * split out of it into a chunk of its own, on every first download), nor with another pack. So the
 * few lines it needs of the flat body are written out here, and kidneys.test.ts checks each against
 * its original: `frameOf` (flat/FlatBody.tsx frame), LOOK (flat/look.ts FLAT_LOOK), the pixel-ratio
 * cap (three/quality.ts) and the skin's line colour (anatomy/tones/base.ts SKIN_LINE).
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

/** The skin's outline colour (anatomy/tones/base.ts SKIN_LINE): the ribs are drawn in it, faint. */
export const RIB_LINE = 'rgba(61,76,107,0.55)'

/** An organ colour's outline: the colour, shaded (flat/look.ts outlineOf). */
const ink = (hex: string, look: Look) => `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * look.ink)).join(',')})`

/** The bladder's outline: a pale fill (L* > 85) gets a 3 px ink outline on the projector (anatomy plan §5). */
export const bladderLine = (look: Look) => (look === LOOK.projector ? 3 : look.line)

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

/** A tube of `width` (scene units) along the points: its outline first, then its colour inside. */
function tube(ctx: CanvasRenderingContext2D, pts: Outline, width: number, tone: string, look: Look, m: Frame) {
  line(ctx, pts, m)
  ctx.strokeStyle = ink(tone, look)
  ctx.lineWidth = width * m.scale + 2 * look.line
  ctx.stroke()
  ctx.strokeStyle = tone
  ctx.lineWidth = width * m.scale
  ctx.stroke()
}

/** A filled organ with its outline. */
function solid(ctx: CanvasRenderingContext2D, tone: string, look: Look) {
  ctx.fillStyle = tone
  ctx.fill()
  ctx.strokeStyle = ink(tone, look)
  ctx.lineWidth = look.line
  ctx.stroke()
}

const SIDES = [1, -1] as const

/** What does not move: faint low ribs, the big vessels and the kidneys' own, the kidneys, the ureters and the urethra. */
function paintStill(ctx: CanvasRenderingContext2D, look: Look, m: Frame) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Faint lowest ribs, for a bearing: the kidneys' upper parts are behind them.
  ctx.strokeStyle = RIB_LINE
  ctx.globalAlpha = 0.45
  ctx.lineWidth = Math.max(1, 0.018 * m.scale)
  for (const rib of RIBS)
    for (const side of SIDES) {
      const [a, b, c] = rib.map(([x, y]) => [m.X(side * x), m.Y(y)] as const)
      ctx.beginPath()
      ctx.moveTo(a![0], a![1])
      ctx.quadraticCurveTo(b![0], b![1], c![0], c![1])
      ctx.stroke()
    }
  ctx.globalAlpha = 1
  // The vena cava and the aorta down the middle; the renal veins pass in front of the aorta.
  const trunk = (v: typeof AORTA): Outline => [
    [v.x, v.top],
    [v.x, v.bottom],
  ]
  for (const side of SIDES) tube(ctx, renalArtery(side), 0.035, KIDNEY_TONE.artery, look, m)
  tube(ctx, trunk(AORTA), AORTA.width, KIDNEY_TONE.artery, look, m)
  tube(ctx, trunk(VENA_CAVA), VENA_CAVA.width, KIDNEY_TONE.vein, look, m)
  for (const side of SIDES) tube(ctx, renalVein(side), 0.04, KIDNEY_TONE.vein, look, m)
  for (const side of SIDES) {
    smooth(ctx, kidneyOutline(side), m)
    solid(ctx, KIDNEY_TONE.kidney, look)
  }
  for (const side of SIDES) tube(ctx, ureter(side), 0.03, KIDNEY_TONE.ureter, look, m)
  tube(ctx, URETHRA, 0.035, KIDNEY_TONE.ureter, look, m)
}

/** The labels, most needed first: a short picture (a phone's) names the kidneys and the bladder; a tall one adds the vein and urethra (tap-only on a phone). */
const LABEL_KEYS: readonly KidneyLabel[] = ['kidney', 'bladder', 'ureter', 'artery', 'vein', 'urethra']

/** The gauge's marks: where the bladder starts to feel full, and where it empties (anatomy plan §2.3). */
const MARKS = [
  { ml: URGE_ML, key: 'urge' },
  { ml: EMPTIES_ML, key: 'empties' },
] as const

/**
 * Kidneys & water's flat picture (U-4; anatomy plan §2.3), over the base body in the `torso`
 * framing: the kidneys (the right one lower), their arteries and veins off the aorta and vena cava,
 * the ureters, the urinary bladder and a short urethra; faint lowest ribs for a bearing.
 *
 * - The bladder grows with the cube root of the urine in it (`bladderRadius`) and a gauge beside it
 *   fills with marks at 150 mL (starts to feel full) and 300 mL (empties); never drawn above 600 mL.
 * - Scrub-safe (anatomy plan §2.0, §4): the volume drawn moves in 25 mL steps through
 *   flat/drives.ts `levelGate`, half a step past a boundary and at most once a real second, however
 *   fast the clock is played or dragged, so an emptying shows at most once a second; each change
 *   eases over 200 ms (a cut with motion reduced). The model's number is in the Now line.
 * - Drops of urine run down the ureters in pulses (Drawing only), faster when more urine is made,
 *   at most 20 updates a second on the real clock (lib/ticker.ts). Nothing changes colour.
 * - With motion reduced: the still bladder and gauge, and arrows down the ureters.
 */
function KidneysLayer({ sim, view, width: w, height: h, reduced, projector, kit }: LayerProps) {
  const { t } = useTranslation()
  const back = useRef<HTMLCanvasElement>(null)
  const bag = useRef<SVGGElement>(null)
  const fill = useRef<SVGRectElement>(null)
  const drops = useRef<SVGGElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const m = frameOf(w, h, view)
  const look = projector ? LOOK.projector : LOOK.normal

  // The still parts, painted once per size and look.
  useEffect(() => {
    const ctx = back.current && sized(back.current, w, h)
    if (ctx) paintStill(ctx, look, m)
  }, [w, h, view, look]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view

  // The bladder and its gauge: the gated volume at the clock's minute, re-checked a second after a
  // change the gate held back, so a fast drag that stops still lands on the right size.
  useEffect(() => {
    const bladder = seriesOf(sim, 'kidney.bladderMl')
    const el = root.current
    if (!bladder || !el) return
    const gate = levelGate(BLADDER_BOUNDS)
    let shown = -1
    let later = 0
    const show = () => {
      const ml = valueAt(bladder, useClock.getState().simMin, sim.stepMin)
      const step = gate(ml, performance.now())
      if (step !== shown) {
        shown = step
        const drawn = stepMl(step)
        bag.current?.style.setProperty('transform', `scale(${(bladderRadius(drawn) / bladderRadius(EMPTIES_ML)).toFixed(3)})`)
        fill.current?.style.setProperty('transform', `scaleY(${(drawn / BLADDER_MAX_ML).toFixed(3)})`)
        el.dataset.bladderDrawn = String(drawn)
      }
      window.clearTimeout(later)
      if (step !== BLADDER_BOUNDS.filter((b) => ml >= b).length) later = window.setTimeout(show, 1050)
    }
    show()
    const off = useClock.subscribe((s) => s.simMin, show)
    return () => {
      off()
      window.clearTimeout(later)
    }
  }, [sim])

  // The drops down the ureters, in pulses, on the real clock while motion is allowed.
  useEffect(() => {
    const urine = seriesOf(sim, 'kidney.urineRate')
    if (reduced || !urine) return
    let offset = 0
    let since = 0
    let clock = 0
    return onTick((dt) => {
      clock += dt
      since += dt
      if (since < 0.05) return
      offset -= ureterSpeed(valueAt(urine, useClock.getState().simMin, sim.stepMin), clock) * since
      since = 0
      drops.current?.style.setProperty('stroke-dashoffset', offset.toFixed(1))
    })
  }, [sim, reduced])

  // The labels, laid out like Digestion's (the stage's label overlay, handed over in `kit`), with
  // the kidneys' own places (anatomy/human/kidneys.ts LABELS); placed when the size or the words change.
  const specs = useMemo(
    () =>
      LABEL_KEYS.map((key, i) => ({
        key,
        text: t(`sys.kidneys.label.${key}`),
        tone: i ? ('stage' as const) : ('active' as const),
        hidden: (h < 260 && i > 1) || (h < 420 && i > 3),
      })),
    [t, h],
  )
  const placeLabels = () => w > 0 && h > 0 && place((p) => [m.X(p.x), m.Y(p.y)], w, h)
  const { overlay, place } = kit.useCallouts(specs, () => placeLabels(), LABELS)
  useEffect(() => void placeLabels())

  const path = (pts: Outline) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${m.X(x).toFixed(1)} ${m.Y(y).toFixed(1)}`).join('')
  // The bladder at 300 mL, scaled from its base (its outline keeps its width while it scales).
  const base = { x: m.X(BLADDER_BASE.x), y: m.Y(BLADDER_BASE.y) }
  const r = bladderRadius(EMPTIES_ML) * m.scale
  // The gauge: beside the bladder, from its base up; 0–600 mL, at least 56 px tall.
  const gauge = { x: m.X(0.4), bottom: base.y, height: Math.max(56, m.scale), width: Math.max(6, 0.06 * m.scale) }
  const markY = (ml: number) => gauge.bottom - (ml / BLADDER_MAX_ML) * gauge.height
  const words = m.scale >= 90
  const easing = reduced ? undefined : `transform ${EASE_MS}ms ease-out`
  const arrow = (side: 1 | -1) => {
    const [x, y, s] = [m.X(side * 0.235), m.Y(-0.7), Math.max(5, 0.05 * m.scale)]
    return `M${x - s * 0.6} ${y - s * 0.4}L${x} ${y + s * 0.5}L${x + s * 0.6} ${y - s * 0.4}`
  }
  const urineInk = ink(KIDNEY_TONE.ureter, LOOK.projector)
  return (
    <div
      ref={root}
      data-layer="kidneys"
      data-drops={reduced ? 'still' : 'moving'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={back} aria-hidden="true" className="absolute top-0 left-0" />
      <svg aria-hidden="true" width={w} height={h} className="absolute top-0 left-0 overflow-visible">
        {reduced ? (
          // Still: arrows down each ureter, towards the bladder.
          <g data-arrows="" fill="none" stroke={urineInk} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={arrow(1)} />
            <path d={arrow(-1)} />
          </g>
        ) : (
          <g ref={drops} data-ureter-drops="" fill="none" stroke={urineInk} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 9">
            <path d={path(ureter(1))} />
            <path d={path(ureter(-1))} />
          </g>
        )}
        <g ref={bag} data-bladder="" style={{ transformOrigin: `${base.x}px ${base.y}px`, transition: easing, willChange: 'transform' }}>
          <ellipse
            cx={base.x}
            cy={base.y - r}
            rx={r * 1.1}
            ry={r}
            fill={KIDNEY_TONE.bladder}
            stroke={ink(KIDNEY_TONE.bladder, look)}
            strokeWidth={bladderLine(look)}
            vectorEffect="non-scaling-stroke"
          />
        </g>
        <g data-gauge="" className="text-ink-muted">
          <rect
            x={gauge.x}
            y={gauge.bottom - gauge.height}
            width={gauge.width}
            height={gauge.height}
            rx={gauge.width / 2}
            fill="var(--color-surface-raised, #fff)"
            stroke={ink(KIDNEY_TONE.ureter, look)}
            strokeWidth={look.line}
          />
          <rect
            ref={fill}
            x={gauge.x}
            y={gauge.bottom - gauge.height}
            width={gauge.width}
            height={gauge.height}
            rx={gauge.width / 2}
            fill={KIDNEY_TONE.ureter}
            style={{ transformOrigin: `${gauge.x}px ${gauge.bottom}px`, transform: 'scaleY(0)', transition: easing }}
          />
          {MARKS.map((mark) => (
            <g key={mark.key} data-mark={mark.ml}>
              <line
                x1={gauge.x - 3}
                x2={gauge.x + gauge.width + 3}
                y1={markY(mark.ml)}
                y2={markY(mark.ml)}
                stroke="currentColor"
                strokeWidth={projector ? 2 : 1.5}
              />
              <text x={gauge.x + gauge.width + 5} y={markY(mark.ml)} dy="0.35em" fill="currentColor" fontSize={projector ? 14 : 11}>
                {mark.ml} {t('sys.kidneys.gauge.unit')}
                {words && ` · ${t(`sys.kidneys.gauge.${mark.key}`)}`}
              </text>
            </g>
          ))}
        </g>
      </svg>
      {overlay}
    </div>
  )
}

/** The pack's drawings (systems/load.ts `drawing`): one per system it serves. */
const DRAWINGS = { kidneys: KidneysLayer }
export default DRAWINGS
