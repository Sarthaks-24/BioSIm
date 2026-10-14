import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt } from '@lifepeek/engine'
import {
  BRONCHI,
  DIAPHRAGM,
  DIAPHRAGM_THICK,
  FOOD_PIPE,
  LABELS,
  LEFT_LUNG,
  LUNG_BASE,
  LUNG_TOP,
  NASAL,
  RIBS,
  RIGHT_LUNG,
  WINDPIPE,
  type BreathingLabel,
  type Outline,
} from '../../anatomy/human/breathing.ts'
import { BREATHING_TONE } from '../../anatomy/tones/breathing.ts'
import { onTick } from '../../lib/ticker.ts'
import { useClock } from '../../state/clock.ts'
import type { View } from '../../anatomy/human/base.ts'
import type { LayerProps } from '../../registry/types.ts'
import { STILL_BREATH, breathRate, breathingIn, fillAt, lungScale, seriesOf } from './breath.ts'

/*
 * The pack shares no code with the stage but the meal clock's (a module shared with /sim would be
 * split out of it into a chunk of its own, on every first download). So the few lines it needs of
 * the flat body are written out here, and breathing.test.ts checks each against its original:
 * `frameOf` (flat/FlatBody.tsx frame), LOOK (flat/look.ts FLAT_LOOK), the pixel-ratio cap
 * (three/quality.ts) and the skin's line colour (anatomy/tones/base.ts SKIN_LINE).
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

/** What does not move: the food-pipe ghost, the nasal passage and the windpipe with its rings. */
function paintAirway(ctx: CanvasRenderingContext2D, look: Look, m: Frame) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  tube(ctx, FOOD_PIPE, 0.07, BREATHING_TONE.ghost, look, m)
  tube(ctx, NASAL, 0.075, BREATHING_TONE.airway, look, m)
  const pipe: Outline = [
    [0, WINDPIPE.top],
    [0, WINDPIPE.split],
  ]
  tube(ctx, pipe, WINDPIPE.width, BREATHING_TONE.airway, look, m)
  // The windpipe's rings of cartilage: short pale bars across it.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = Math.max(1, 0.012 * m.scale)
  const half = (WINDPIPE.width / 2) * m.scale * 0.8
  for (let y = WINDPIPE.top - 0.06; y > WINDPIPE.split + 0.04; y -= 0.09) {
    ctx.beginPath()
    ctx.moveTo(m.X(0) - half, m.Y(y))
    ctx.lineTo(m.X(0) + half, m.Y(y))
    ctx.stroke()
  }
}

/** The lungs and their bronchi (one rhythm layer: they swell together). */
function paintLungs(ctx: CanvasRenderingContext2D, look: Look, m: Frame) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const lung of [RIGHT_LUNG, LEFT_LUNG]) {
    smooth(ctx, lung, m)
    solid(ctx, BREATHING_TONE.lungs, look)
  }
  for (const b of BRONCHI) tube(ctx, b.path, b.width, BREATHING_TONE.airway, look, m)
}

/** The diaphragm: a band of muscle under the lungs, domed under each. */
function paintDiaphragm(ctx: CanvasRenderingContext2D, look: Look, m: Frame) {
  ctx.lineJoin = 'round'
  const under = [...DIAPHRAGM].reverse().map(([x, y]) => [x, y - DIAPHRAGM_THICK] as const)
  line(ctx, [...DIAPHRAGM, ...under], m)
  ctx.closePath()
  solid(ctx, BREATHING_TONE.diaphragm, look)
}

/** Faint ribs over the lungs, for a bearing (anatomy plan §2.1). */
function paintRibs(ctx: CanvasRenderingContext2D, m: Frame) {
  ctx.strokeStyle = RIB_LINE
  ctx.globalAlpha = 0.45
  ctx.lineWidth = Math.max(1, 0.018 * m.scale)
  for (const rib of RIBS)
    for (const side of [1, -1]) {
      const [a, b, c] = rib.map(([x, y]) => [m.X(side * x), m.Y(y)] as const)
      ctx.beginPath()
      ctx.moveTo(a![0], a![1])
      ctx.quadraticCurveTo(b![0], b![1], c![0], c![1])
      ctx.stroke()
    }
  ctx.globalAlpha = 1
}

/** The labels, most needed first: a short picture (a phone's) names only the lungs and the diaphragm. */
const LABEL_KEYS: readonly BreathingLabel[] = ['lungs', 'diaphragm', 'trachea', 'nasal']

/**
 * Breathing's flat picture (U-2; anatomy plan §2.1), over the base body in the `chest` framing:
 * nasal passage, windpipe, two levels of bronchi, the lungs (the heart's notch on the left), the
 * diaphragm's dome, a pale food pipe beside the windpipe and faint ribs.
 *
 * It moves on the real clock (lib/ticker.ts, ≤ 30 fps, only while it is shown and motion is
 * allowed): the breath's rate is the model's at the meal-clock minute on screen, drawn at most 0.8
 * times a second. The lungs swell (their own layer, CSS `scale`) and the diaphragm, the main cue,
 * moves down with their base (`translate`); the air runs in and out of the windpipe as dashes (≤ 20
 * fps). Nothing changes colour. With motion reduced: one still frame, half breathed in, with arrows
 * for air in and out. A short picture (a phone's) names only the lungs and the diaphragm.
 */
function LungsLayer({ sim, view, width: w, height: h, reduced, projector, kit }: LayerProps) {
  const { t } = useTranslation()
  const back = useRef<HTMLCanvasElement>(null)
  const muscle = useRef<HTMLCanvasElement>(null)
  const lungs = useRef<HTMLCanvasElement>(null)
  const front = useRef<HTMLCanvasElement>(null)
  const air = useRef<SVGGElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const m = frameOf(w, h, view)
  const look = projector ? LOOK.projector : LOOK.normal

  // The still parts, painted once per size and look.
  useEffect(() => {
    const ctx = [back, muscle, lungs, front].map((c) => c.current && sized(c.current, w, h))
    if (ctx.some((c) => !c)) return
    const [b, d, l, f] = ctx as CanvasRenderingContext2D[]
    paintAirway(b!, look, m)
    paintDiaphragm(d!, look, m)
    paintLungs(l!, look, m)
    paintRibs(f!, m)
  }, [w, h, view, look]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view

  // The breath: on the ticker while motion is allowed, else one still frame.
  useEffect(() => {
    const rate = seriesOf(sim, 'lungs.breathRate')
    const tidal = seriesOf(sim, 'lungs.tidalVolume')
    const l = lungs.current
    const d = muscle.current
    const el = root.current
    if (!rate || !tidal || !l || !d || !el) return
    // The lungs grow from their top on the midline; the diaphragm follows their base down.
    l.style.transformOrigin = `${m.X(LUNG_TOP.x)}px ${m.Y(LUNG_TOP.y)}px`
    l.style.willChange = d.style.willChange = 'transform'
    const height = m.Y(LUNG_BASE) - m.Y(LUNG_TOP.y)
    let phase = STILL_BREATH
    let shown = ''
    let dash = 0
    let since = 0
    const draw = (dt: number) => {
      const min = useClock.getState().simMin
      const { hz } = breathRate(valueAt(rate, min, sim.stepMin))
      phase = (phase + hz * dt) % 1
      const s = lungScale(valueAt(tidal, min, sim.stepMin), fillAt(phase)).toFixed(3)
      if (s !== shown) {
        shown = s
        l.style.transform = `scale(${s})`
        d.style.transform = `translateY(${((Number(s) - 1) * height).toFixed(2)}px)`
        el.dataset.lungScale = s
      }
      el.dataset.breathHz = hz.toFixed(2)
      // The air dashes, at most 20 times a second: down the windpipe while the lungs fill, up while
      // they empty, faster when the breaths are.
      since += dt
      if (air.current && since >= 0.05) {
        dash += (breathingIn(phase) ? -1 : 1) * 120 * hz * since
        since = 0
        air.current.style.strokeDashoffset = dash.toFixed(1)
      }
    }
    draw(0)
    return reduced ? undefined : onTick(draw)
  }, [sim, reduced, w, h, view]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view

  // The labels, laid out like Digestion's (the stage's label overlay, handed over in `kit`), with
  // breathing's own places (anatomy/human/breathing.ts LABELS); placed when the size or the words change.
  const specs = useMemo(
    () =>
      LABEL_KEYS.map((key, i) => ({
        key,
        text: t(`sys.breathing.label.${key}`),
        tone: i ? ('stage' as const) : ('active' as const),
        hidden: h < 260 && i > 1,
      })),
    [t, h],
  )
  const placeLabels = () => w > 0 && h > 0 && place((p) => [m.X(p.x), m.Y(p.y)], w, h)
  const { overlay, place } = kit.useCallouts(specs, () => placeLabels(), LABELS)
  useEffect(() => void placeLabels())

  const path = (pts: Outline) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${m.X(x)} ${m.Y(y)}`).join('')
  const arrow = (x: number, down: boolean) => {
    const [cx, cy, s] = [m.X(x), m.Y(2.05), Math.max(6, 0.06 * m.scale)]
    const tip = down ? cy + s : cy - s
    const wing = down ? cy + s * 0.3 : cy - s * 0.3
    return `M${cx} ${cy - s}V${cy + s}M${cx - s * 0.6} ${wing}L${cx} ${tip}L${cx + s * 0.6} ${wing}`
  }
  return (
    <div
      ref={root}
      data-layer="breathing"
      data-breath={reduced ? 'still' : 'moving'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={back} aria-hidden="true" className="absolute top-0 left-0" />
      <canvas ref={muscle} aria-hidden="true" className="absolute top-0 left-0" />
      <canvas ref={lungs} aria-hidden="true" className="absolute top-0 left-0" />
      <canvas ref={front} aria-hidden="true" className="absolute top-0 left-0" />
      <svg aria-hidden="true" width={w} height={h} className="absolute top-0 left-0 overflow-visible">
        {reduced ? (
          // Still: air in beside the windpipe on one side, out on the other.
          <g data-arrows="" fill="none" stroke={BREATHING_TONE.air} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={arrow(-0.16, true)} />
            <path d={arrow(0.16, false)} />
          </g>
        ) : (
          <g ref={air} fill="none" stroke={BREATHING_TONE.air} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 7">
            <path d={path([NASAL[0]!, [0, WINDPIPE.split]])} />
            <path d={path(BRONCHI[0]!.path)} />
            <path d={path(BRONCHI[1]!.path)} />
          </g>
        )}
      </svg>
      {overlay}
    </div>
  )
}

/** The pack's drawings (systems/load.ts `drawing`): one per system it serves. */
const DRAWINGS = { breathing: LungsLayer }
export default DRAWINGS
