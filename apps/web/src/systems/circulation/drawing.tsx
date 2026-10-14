import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt } from '@lifepeek/engine'
import {
  ATRIA,
  ATRIA_ORIGIN,
  GUT,
  KIDNEYS,
  LABELS,
  LIVER,
  LUNGS,
  SEPTUM,
  VENTRICLES,
  VENTRICLE_ORIGIN,
  VESSELS,
  type Bed,
  type CirculationLabel,
  type Outline,
  type Vessel,
} from '../../anatomy/human/circulation.ts'
import { CIRCULATION_TONE } from '../../anatomy/tones/circulation.ts'
import { onTick } from '../../lib/ticker.ts'
import { useClock } from '../../state/clock.ts'
import type { View } from '../../anatomy/human/base.ts'
import type { LayerProps } from '../../registry/types.ts'
import {
  GUT_MAX,
  GUT_REST_SHARE,
  LEGS_MAX,
  MUSCLE_REST_SHARE,
  atriaScale,
  beatRate,
  dashDensity,
  dashSpeed,
  restingOutput,
  seriesOf,
  squeezeOf,
  ventricleScale,
} from './beat.ts'

/*
 * The pack shares no code with the stage but the meal clock's (a module shared with /sim would be
 * split out of it into a chunk of its own, on every first download), nor with another pack. So the
 * few lines it needs of the flat body are written out here, and circulation.test.ts checks each
 * against its original: `frameOf` (flat/FlatBody.tsx frame), LOOK (flat/look.ts FLAT_LOOK) and the
 * pixel-ratio cap (three/quality.ts).
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

/** An open path through the points, rounded at its corners: the same curve for the tube (canvas) and its dashes (SVG). */
export function vesselPath(pts: Outline, { X, Y }: Pick<Frame, 'X' | 'Y'>): string {
  const p = pts.map(([x, y]) => [X(x), Y(y)] as const)
  if (p.length < 3) return p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('')
  let d = `M${p[0]![0].toFixed(1)} ${p[0]![1].toFixed(1)}`
  for (let i = 1; i < p.length - 1; i++) {
    const [a, b] = [p[i]!, p[i + 1]!]
    const end = i === p.length - 2 ? b : ([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const)
    d += `Q${a[0].toFixed(1)} ${a[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`
  }
  return d
}

/** A tube of `width` (scene units, at least 2 px) along the vessel: its outline first, then its colour inside. */
function tube(ctx: CanvasRenderingContext2D, v: Vessel, look: Look, m: Frame) {
  const path = new Path2D(vesselPath(v.path, m))
  const tone = CIRCULATION_TONE[v.blood]
  const width = Math.max(2, v.width * m.scale)
  ctx.strokeStyle = ink(tone, look)
  ctx.lineWidth = width + 2 * look.line
  ctx.stroke(path)
  ctx.strokeStyle = tone
  ctx.lineWidth = width
  ctx.stroke(path)
}

/** A filled organ with its outline; `alpha` < 1 for a ghost. */
function solid(ctx: CanvasRenderingContext2D, tone: string, look: Look, alpha = 1) {
  ctx.globalAlpha = alpha
  ctx.fillStyle = tone
  ctx.fill()
  ctx.globalAlpha = Math.min(1, alpha + 0.35)
  ctx.strokeStyle = ink(tone, look)
  ctx.lineWidth = look.line
  ctx.stroke()
  ctx.globalAlpha = 1
}

function ellipse(ctx: CanvasRenderingContext2D, e: { cx: number; cy: number; rx: number; ry: number }, m: Frame) {
  ctx.beginPath()
  ctx.ellipse(m.X(e.cx), m.Y(e.cy), e.rx * m.scale, e.ry * m.scale, 0, 0, 2 * Math.PI)
}

/** What does not move: the ghosts (lungs, liver, gut, kidneys) and every vessel's tube. */
function paintBack(ctx: CanvasRenderingContext2D, look: Look, m: Frame) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  for (const lung of LUNGS) {
    smooth(ctx, lung, m)
    solid(ctx, CIRCULATION_TONE.lungs, look, 0.3)
  }
  for (const k of KIDNEYS) {
    ellipse(ctx, k, m)
    solid(ctx, CIRCULATION_TONE.ghost, look, 0.8)
  }
  for (const organ of [GUT, LIVER]) {
    smooth(ctx, organ, m)
    solid(ctx, CIRCULATION_TONE.ghost, look, 0.6)
  }
  for (const v of VESSELS) tube(ctx, v, look, m)
}

/** The atria (their own rhythm layer: they squeeze first). */
function paintAtria(ctx: CanvasRenderingContext2D, look: Look, m: Frame) {
  for (const a of ATRIA) {
    ellipse(ctx, a, m)
    solid(ctx, CIRCULATION_TONE.heart, look)
  }
}

/** The ventricles and the septum between them (their own rhythm layer). */
function paintVentricles(ctx: CanvasRenderingContext2D, look: Look, m: Frame) {
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  smooth(ctx, VENTRICLES, m)
  solid(ctx, CIRCULATION_TONE.heart, look)
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'
  ctx.lineWidth = Math.max(1, 0.012 * m.scale)
  ctx.stroke(new Path2D(vesselPath(SEPTUM, m)))
}

/**
 * The labels, most needed first: a phone's picture names the heart and three more (anatomy plan
 * §2.0: active + 3), a short one only the heart, the aorta and the vena cava.
 */
const LABEL_KEYS: readonly CirculationLabel[] = ['heart', 'aorta', 'venaCava', 'legs', 'pulmonaryArtery', 'pulmonaryVein']

/** The dashes' pattern at a density: a short dash, a gap that closes as more blood flows (CSS px). */
const DASH = 3
const GAP = 10
const dashArray = (density: number) => `${DASH} ${(GAP / density).toFixed(1)}`
/** The dashes' speed at rest, CSS px a second. */
const DASH_PX_S = 36

/** An arrowhead (a chevron) half-way along a vessel, pointing the way its blood goes. */
function arrowOf(v: Vessel, m: Frame): string {
  const i = Math.floor((v.path.length - 1) / 2)
  const [a, b] = [v.path[i]!, v.path[i + 1]!]
  const [x0, y0, x1, y1] = [m.X(a[0]), m.Y(a[1]), m.X(b[0]), m.Y(b[1])]
  const len = Math.hypot(x1 - x0, y1 - y0) || 1
  const [ux, uy] = [(x1 - x0) / len, (y1 - y0) / len]
  const [cx, cy] = [(x0 + x1) / 2, (y0 + y1) / 2]
  const s = Math.max(5, 0.07 * m.scale)
  const back = (side: 1 | -1) => `${(cx - ux * s - uy * s * 0.7 * side).toFixed(1)} ${(cy - uy * s + ux * s * 0.7 * side).toFixed(1)}`
  return `M${back(1)}L${cx.toFixed(1)} ${cy.toFixed(1)}L${back(-1)}`
}

/**
 * Heart & blood's flat picture (U-3; anatomy plan §2.2), over the base body in the `torso` framing:
 * the heart (atria, ventricles), the body loop (aorta and its branches to the neck, arms, gut,
 * kidneys and, leaving the bottom edge, the legs; the venae cavae back), the lung loop (pulmonary
 * artery to the pale lungs, pulmonary veins back), and the portal vein to the liver, then the hepatic
 * veins into the inferior vena cava. Oxygen-rich blood red, oxygen-poor blue, captioned: blue is a
 * drawing convention.
 *
 * It moves on the real clock (lib/ticker.ts, ≤ 30 fps, only while it is shown and motion is
 * allowed): the beat at the model's rate for the meal-clock minute on screen, at most 2.5 a second;
 * the atria squeeze, then the ventricles (each its own layer, CSS `scale`). Dashes run along the
 * vessels (≤ 20 fps) as fast as the blood pumped a minute against resting (half to twice), denser
 * on the gut's vessels with the blood to the gut and on the legs' with the blood to the muscles.
 * Nothing changes colour. With motion reduced: a still heart, still dashes and arrows on both loops.
 */
function HeartLayer({ sim, view, width: w, height: h, reduced, projector, kit }: LayerProps) {
  const { t } = useTranslation()
  const back = useRef<HTMLCanvasElement>(null)
  const atria = useRef<HTMLCanvasElement>(null)
  const ventricles = useRef<HTMLCanvasElement>(null)
  const dashes = useRef<SVGGElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const m = frameOf(w, h, view)
  const look = projector ? LOOK.projector : LOOK.normal

  // The still parts, painted once per size and look.
  useEffect(() => {
    const ctx = [back, atria, ventricles].map((c) => c.current && sized(c.current, w, h))
    if (ctx.some((c) => !c)) return
    const [b, a, v] = ctx as CanvasRenderingContext2D[]
    paintBack(b!, look, m)
    paintAtria(a!, look, m)
    paintVentricles(v!, look, m)
  }, [w, h, view, look]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view

  // The beat and the dashes: on the ticker while motion is allowed, else one still frame.
  useEffect(() => {
    const rate = seriesOf(sim, 'heart.rate')
    const stroke = seriesOf(sim, 'heart.strokeVolume')
    const output = seriesOf(sim, 'heart.output')
    const gut = seriesOf(sim, 'blood.flow.gut')
    const muscle = seriesOf(sim, 'blood.flow.muscle')
    const [a, v, el] = [atria.current, ventricles.current, root.current]
    if (!rate || !stroke || !output || !gut || !muscle || !a || !v || !el) return
    a.style.transformOrigin = `${m.X(ATRIA_ORIGIN.x)}px ${m.Y(ATRIA_ORIGIN.y)}px`
    v.style.transformOrigin = `${m.X(VENTRICLE_ORIGIN.x)}px ${m.Y(VENTRICLE_ORIGIN.y)}px`
    a.style.willChange = v.style.willChange = 'transform'
    const coRest = restingOutput(output)
    const beds = dashes.current ? [...dashes.current.querySelectorAll<SVGGElement>('g[data-bed]')] : []
    let phase = 0
    let shown = ['', '']
    let shownDensity = ''
    let offset = 0
    let since = 0
    const draw = (dt: number) => {
      const min = useClock.getState().simMin
      const { hz } = beatRate(valueAt(rate, min, sim.stepMin))
      phase = (phase + hz * dt) % 1
      const squeeze = squeezeOf(valueAt(stroke, min, sim.stepMin))
      // A still heart is relaxed: full size.
      const s = [atriaScale(phase, squeeze), ventricleScale(phase, squeeze)].map((x) => x.toFixed(3))
      if (s[0] !== shown[0]) a.style.transform = `scale(${s[0]})`
      if (s[1] !== shown[1]) v.style.transform = `scale(${s[1]})`
      shown = s
      el.dataset.ventricleScale = s[1]
      el.dataset.beatHz = hz.toFixed(2)
      // The dashes, at most 20 times a second: their density by where the blood goes, their speed by how much is pumped.
      since += dt
      if (since < 0.05 && dt > 0) return
      const co = valueAt(output, min, sim.stepMin)
      const density: Record<Bed, number> = {
        body: 1,
        lungs: 1,
        gut: dashDensity(valueAt(gut, min, sim.stepMin), GUT_REST_SHARE * coRest * 1000, GUT_MAX),
        legs: dashDensity(valueAt(muscle, min, sim.stepMin), MUSCLE_REST_SHARE * coRest * 1000, LEGS_MAX),
      }
      const key = `${density.gut}|${density.legs}`
      if (key !== shownDensity) {
        shownDensity = key
        for (const g of beds) g.style.strokeDasharray = dashArray(density[g.dataset.bed as Bed])
        el.dataset.dashGut = String(density.gut)
        el.dataset.dashLegs = String(density.legs)
      }
      const speed = dashSpeed(co, coRest)
      el.dataset.dashSpeed = speed.toFixed(2)
      offset -= DASH_PX_S * speed * since
      since = 0
      for (const g of beds) g.style.strokeDashoffset = offset.toFixed(1)
    }
    draw(0)
    return reduced ? undefined : onTick(draw)
  }, [sim, reduced, w, h, view]) // eslint-disable-line react-hooks/exhaustive-deps -- `m` follows w, h and view

  // The labels, laid out like Digestion's (the stage's label overlay, handed over in `kit`), with
  // the heart's own places (anatomy/human/circulation.ts LABELS); placed when the size or the words change.
  const specs = useMemo(
    () =>
      LABEL_KEYS.map((key, i) => ({
        key,
        text: t(`sys.circulation.label.${key}`),
        tone: i ? ('stage' as const) : ('active' as const),
        hidden: (h < 260 && i > 2) || (w < 640 && i > 3),
      })),
    [t, h, w],
  )
  const placeLabels = () => w > 0 && h > 0 && place((p) => [m.X(p.x), m.Y(p.y)], w, h)
  const { overlay, place } = kit.useCallouts(specs, () => placeLabels(), LABELS)
  useEffect(() => void placeLabels())

  const beds: readonly Bed[] = ['body', 'lungs', 'gut', 'legs']
  return (
    <div
      ref={root}
      data-layer="circulation"
      data-beat={reduced ? 'still' : 'moving'}
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <canvas ref={back} aria-hidden="true" className="absolute top-0 left-0" />
      <svg aria-hidden="true" width={w} height={h} className="absolute top-0 left-0 overflow-visible">
        <g ref={dashes} fill="none" stroke="rgba(255,255,255,0.85)" strokeLinecap="round">
          {beds.map((bed) => (
            <g key={bed} data-bed={bed} style={{ strokeDasharray: dashArray(1) }}>
              {VESSELS.filter((v) => v.bed === bed).map((v) => (
                <path key={v.id} d={vesselPath(v.path, m)} strokeWidth={Math.max(1.25, Math.min(2.5, v.width * m.scale * 0.45))} />
              ))}
            </g>
          ))}
        </g>
        {reduced && (
          // Still: an arrow on each main vessel of both loops, the way its blood goes.
          <g data-arrows="" fill="none" stroke="#14213d" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            {VESSELS.filter((v) => v.arrow).map((v) => (
              <path key={v.id} d={arrowOf(v, m)} />
            ))}
          </g>
        )}
      </svg>
      <canvas ref={atria} aria-hidden="true" className="absolute top-0 left-0" />
      <canvas ref={ventricles} aria-hidden="true" className="absolute top-0 left-0" />
      {/* The colour key: red and blue are a drawing convention, never the blood's real colour. */}
      <div
        data-blood-key=""
        // Beside the hips, never over the body's outline (its widest, ±0.95 units).
        style={{ maxWidth: `${Math.round(Math.min(184, Math.max(112, m.X(-0.95) - 8)))}px`, left: 4, bottom: 4 }}
        className="absolute flex flex-col gap-0.5 rounded-control bg-surface-raised/85 px-1.5 py-0.5 text-caption leading-tight text-ink-muted"
      >
        <span className="flex flex-wrap gap-x-2">
          {(['rich', 'poor'] as const).map((b) => (
            <span key={b} className="inline-flex items-center gap-1 whitespace-nowrap text-ink">
              <span
                aria-hidden="true"
                className="inline-block rounded-full"
                style={{ width: 14, height: 4, background: CIRCULATION_TONE[b] }}
              />
              {t(`sys.circulation.key.${b}`)}
            </span>
          ))}
        </span>
        <span>{t('sys.circulation.key.convention')}</span>
      </div>
      {overlay}
    </div>
  )
}

/** The pack's drawings (systems/load.ts `drawing`): one per system it serves. */
const DRAWINGS = { circulation: HeartLayer }
export default DRAWINGS
