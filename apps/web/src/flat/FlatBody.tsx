import { useEffect, useRef, useState } from 'react'
import { activeStage, type NutrientKind, type RunResult, type StageId } from '@lifepeek/engine'
import { useBodyClock } from '../hooks/useBodyClock.ts'
import { useMotion } from '../state/motion.ts'
import { ARM, FRAMINGS, HEAD, TORSO_PROFILE, armRadius, type View } from '../anatomy/human/base.ts'
import type { ActivityBand } from '../anatomy/human/bands.ts'
import {
  ESOPHAGUS,
  GALLBLADDER,
  LARGE_INTESTINE,
  LIVER_OUTLINE,
  PANCREAS,
  PHARYNX,
  SMALL_INTESTINE,
  STOMACH,
  particlePosition,
  stomachFillRadius,
  tumble,
} from '../anatomy/human/digestion.ts'
import { Vec3, type Spline3 } from '../anatomy/spline.ts'
import { bodyStateAt, type BodyState } from '../anatomy/bodyState.ts'
import { useCalloutSpecs, useCallouts, type Project } from '../anatomy/CalloutOverlay.tsx'
import { FADE_TONE, PARTICLE_EDGE, SKIN_FILL, SKIN_LINE } from '../anatomy/tones/base.ts'
import { ILEUM_TONE, JEJUNUM_TONE, ORGAN_TONE, PYLORUS_TONE, type LitOrgan } from '../anatomy/tones/digestion.ts'
import { DIGESTION } from '../systems/digestion/def.ts'
import type { LayerComponent } from '../registry/types.ts'
import type { SystemDef } from '../systems/registry.ts'
import { limbsFor, loadLimbs } from './registry.ts'
import { NUTRIENT_COLOR } from '../lib/colors.ts'
import { quality } from '../three/quality.ts'
import { useProjector } from '../hooks/useProjector.ts'
import { FLAT_LOOK, css, mix, outlineOf, rgb, scale, type FlatLook, type Rgb } from './look.ts'

/**
 * Flat diagram for devices without WebGL, and every system's picture in v3.0 (flat first, R43).
 * Uses the same anatomy curves, colours, labels and particle maths as the 3D view, drawn front-on
 * with Canvas 2D, in the lit system's framing (`SystemDef.camera`). Digestion's organs are drawn
 * here (first paint); another system's drawing is its own lazy layer (flat/registry.ts) over the
 * base body. Legs and the activity pose (`band`) come from a lazy chunk too (flat/limbs.ts), so
 * Digestion at rest loads neither.
 *
 * Built for exactly the slow devices that need it: the organs that only change when the meal
 * moves to the next organ are drawn once into a cached layer; each frame copies that layer and
 * draws only what moves (the stomach's fill and the food). The labels are DOM, placed only when
 * the size or the active organ changes.
 */

/** Digestion's `torso` framing (anatomy/human/base.ts FRAMINGS); the resting body on Home is drawn in it. */
export const VIEW = FRAMINGS.torso

/**
 * `final`: this is the body the stage shows (no WebGL, or it failed), not the stand-in while the 3D
 * body loads; once drawn it says so with `data-ready`, which the e2e tests wait for.
 * `band`: the activity band at this minute of the meal clock (anatomy/human/bands.ts `bandAt`): the
 * body takes that band's still pose (R4, R32). Rest by default.
 * `system`: the lit system (the stage's `layer`): its framing and its drawing. Digestion by default.
 * `layer`: another system's flat drawing (its pack's, systems/load.ts `packDrawing`), drawn over the base.
 */
export default function FlatBody({
  sim,
  label,
  final = false,
  band = 'rest',
  system = DIGESTION,
  layer: Layer,
}: {
  sim: RunResult
  label: string
  final?: boolean
  band?: ActivityBand
  system?: SystemDef
  layer?: LayerComponent
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const still = useRef<HTMLCanvasElement>(null)
  const moving = useRef<HTMLCanvasElement>(null)
  const clock = useBodyClock()
  const reduced = useMotion((s) => s.reduced)
  const projector = useProjector()
  // The lit system's framing and drawing (flat registry): Digestion's organs are drawn here, another
  // system's by its own layer, loaded only once it is lit.
  const framing = system.camera.framing
  const view = FRAMINGS[framing]
  const organs = system.draw === 'body'
  const limbs = useLimbs(limbsFor(framing, band))
  const [stage, setStage] = useState<StageId>(() => activeStage(sim, clock.now()))
  const [size, setSize] = useState({ w: 0, h: 0 })
  const { w, h } = size
  const specs = useCalloutSpecs(stage, w)
  // Another system's layer places its own labels.
  const { overlay, place } = useCallouts(organs ? specs : [], () => placeLabels())
  const placeLabels = () => {
    if (w > 0 && h > 0) place(flatProjection(w, h, view), w, h)
  }

  // Labels move only when the picture's size or the active organ changes.
  useEffect(placeLabels)

  useEffect(() => {
    const el = wrapper.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const a = still.current
    const b = moving.current
    if (!a || !b || w === 0 || h === 0) return
    const stillCtx = setup(a, rectOf(view, w, h, view))
    const movingCtx = setup(b, organs ? rectOf(GUT, w, h, view) : { left: 0, top: 0, width: 0, height: 0 })
    if (!stillCtx || !movingCtx) return
    // The pose's skin, once its chunk is here (until then the body stands at rest: never a blank picture).
    const paint: StillPaint = { view, organs, figure: limbs ? (ctx, X, Y, scale) => limbs.paintFigure(ctx, X, Y, scale, band) : undefined }
    // The projector look: switching projector mode sets the picture up again (review 15, LOW 8:
    // not only when the switch happens to resize it).
    flat = projector ? FLAT_LOOK.projector : FLAT_LOOK.normal
    let drawn = ''
    let shownStage = stage
    const draw = () => {
      const t = clock.now()
      const state = bodyStateAt(sim, t)
      // The still organs are redrawn only when an organ's highlight changes.
      const key = `${state.stage}|${state.holds.stomach}|${state.holds.smallIntestine}|${state.holds.largeIntestine}`
      if (key !== drawn) {
        paintStill(stillCtx, w, h, state, paint)
        drawn = key
      }
      if (organs) paintMoving(movingCtx, w, h, sim, t, state, reduced, view)
      // Re-render (labels) only when the meal moves to another organ, not every frame.
      if (state.stage !== shownStage) setStage((shownStage = state.stage))
    }
    draw()
    return clock.subscribe(draw)
  }, [sim, clock, reduced, projector, w, h, view, organs, limbs, band]) // eslint-disable-line react-hooks/exhaustive-deps -- `stage` is only the starting value

  return (
    <div
      ref={wrapper}
      role="img"
      aria-label={label}
      data-body="flat"
      data-ready={final && w > 0 && h > 0 ? '' : undefined}
      data-particles={reduced ? 'still' : 'tumbling'}
      data-framing={framing}
      className="relative h-full w-full"
    >
      <canvas ref={still} aria-hidden="true" className="absolute" />
      <canvas ref={moving} aria-hidden="true" className="absolute" />
      {!organs && Layer && w > 0 && h > 0 && <Layer sim={sim} label={label} view={view} band={band} width={w} height={h} />}
      {overlay}
    </div>
  )
}

/**
 * The legs and poses (a lazy chunk) when the picture needs them, once loaded; until then, or if the
 * load fails, null: the body is still drawn, at rest.
 */
function useLimbs(need: boolean) {
  const [limbs, setLimbs] = useState<Awaited<ReturnType<typeof loadLimbs>> | null>(null)
  useEffect(() => {
    if (need) loadLimbs().then(setLimbs, () => {})
  }, [need])
  return need ? limbs : null
}

/** Scene units → CSS pixels, front-on, fitting `view` into the picture (Digestion's VIEW by default). */
export function frame(w: number, h: number, view: View = VIEW) {
  const scale = Math.min(w / (view.maxX - view.minX), h / (view.maxY - view.minY))
  const ox = w / 2
  const oy = h / 2 + ((view.maxY + view.minY) / 2) * scale
  return { scale, X: (x: number) => ox + x * scale, Y: (y: number) => oy - y * scale }
}

const flatProjection = (w: number, h: number, view: View): Project => {
  const { X, Y } = frame(w, h, view)
  return (p) => [X(p.x), Y(p.y)]
}

/**
 * Where the food can be (mouth to rectum, the stomach at its fullest), in scene units. Only this
 * part of the picture is redrawn every frame; on a phone without a GPU, copying a canvas to the
 * screen costs in proportion to its size.
 */
const GUT = { minX: -0.86, maxX: 0.98, minY: -1.66, maxY: 2.8 }

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/** A scene box as a whole-pixel rectangle of the picture, which shows `view`. */
function rectOf(box: View, w: number, h: number, view: View): Rect {
  const { X, Y } = frame(w, h, view)
  const left = Math.max(0, Math.floor(X(box.minX)))
  const top = Math.max(0, Math.floor(Y(box.maxY)))
  return { left, top, width: Math.min(w, Math.ceil(X(box.maxX))) - left, height: Math.min(h, Math.ceil(Y(box.minY))) - top }
}

/** Sizes and places a canvas over `rect`; its context then draws in the picture's CSS pixels. */
function setup(canvas: HTMLCanvasElement, rect: Rect) {
  // The same pixel-ratio cap as the 3D body: a 3× phone screen would otherwise fill 9 pixels per CSS pixel.
  const dpr = Math.min(window.devicePixelRatio || 1, quality().dpr)
  Object.assign(canvas.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` })
  canvas.width = Math.round(rect.width * dpr)
  canvas.height = Math.round(rect.height * dpr)
  const ctx = canvas.getContext('2d')
  ctx?.setTransform(dpr, 0, 0, dpr, -rect.left * dpr, -rect.top * dpr)
  return ctx
}

let flat: FlatLook = FLAT_LOOK.normal

/** The flat organ colours: the 3D tones, faded when empty, and a deep shade for the outline. */
const tone = (organ: LitOrgan, faded = false): Rgb => {
  const c = rgb(ORGAN_TONE[organ])
  return faded ? mix(c, rgb(FADE_TONE), flat.fade) : c
}
const ink = (c: Rgb, faded = false) => css(faded ? scale(mix(c, rgb(FADE_TONE), 0.2), 0.72) : outlineOf(c, flat))
const WHITE: Rgb = [255, 255, 255]

/** What moves: the stomach's fill and the food. Drawn every frame the clock moves. */
function paintMoving(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sim: RunResult,
  time: number,
  state: BodyState,
  reduced: boolean,
  view: View,
) {
  ctx.clearRect(0, 0, w, h)
  const { scale, X, Y } = frame(w, h, view)
  paintStomach(ctx, X, Y, scale, state)
  const p = new Vec3()
  for (const part of sim.particles) {
    const s = particlePosition(part, time, p)
    if (s <= 0) continue
    drawShape(ctx, part.kind, X(p.x), Y(p.y), Math.max(3.5, 0.055 * scale) * s, tumble(part.seed[1], time, reduced))
  }
}

/** The organ's state, as the 3D shader has it: active, normal or faded. */
const look = (organ: LitOrgan, s: BodyState) => {
  if (organ === 'esophagus') return { active: s.stage === 'mouth' || s.stage === 'esophagus', faded: false }
  if (organ === 'stomach' || organ === 'smallIntestine' || organ === 'largeIntestine')
    return { active: s.stage === organ, faded: s.stage !== organ && !s.holds[organ] }
  return { active: false, faded: false }
}

/** Polyline samples of the static curves, in scene units, computed once. */
const samples = new Map<Spline3, Float32Array>()
function sampled(curve: Spline3, n: number): Float32Array {
  let pts = samples.get(curve)
  if (!pts) {
    pts = new Float32Array((n + 1) * 2)
    const p = new Vec3()
    for (let i = 0; i <= n; i++) {
      curve.getPointAt(i / n, p)
      pts[i * 2] = p.x
      pts[i * 2 + 1] = p.y
    }
    samples.set(curve, pts)
  }
  return pts
}

/** Outline of a tube with a radius function, as one closed polygon (front-on). */
function tubeOutline(curve: Spline3, radius: (u: number) => number, n: number): [number, number][] {
  const left: [number, number][] = []
  const right: [number, number][] = []
  const p = new Vec3()
  const t = new Vec3()
  for (let i = 0; i <= n; i++) {
    const u = i / n
    curve.getPointAt(u, p)
    curve.getTangentAt(u, t)
    const len = Math.hypot(t.x, t.y) || 1
    const r = radius(u)
    left.push([p.x - (t.y / len) * r, p.y + (t.x / len) * r])
    right.push([p.x + (t.y / len) * r, p.y - (t.x / len) * r])
  }
  return [...left, ...right.reverse()]
}
let armShape: [number, number][] | null = null

/**
 * How the still layer is drawn: the framing, the posed skin with legs (flat/limbs.ts) instead of the
 * resting outline, and whether Digestion's organs are lit.
 */
interface StillPaint {
  view?: View
  figure?: (ctx: CanvasRenderingContext2D, X: (x: number) => number, Y: (y: number) => number, scale: number) => void
  organs?: boolean
}

/** Everything that only changes when the meal reaches another organ (or the pose changes). */
export function paintStill(ctx: CanvasRenderingContext2D, w: number, h: number, s: BodyState, paint: StillPaint = {}) {
  const { view = VIEW, figure, organs = true } = paint
  ctx.clearRect(0, 0, w, h)
  const { scale, X, Y } = frame(w, h, view)
  const poly = (pts: readonly (readonly [number, number])[], mirror = false) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(mirror ? -x : x), Y(y)) : ctx.lineTo(X(mirror ? -x : x), Y(y))))
    ctx.closePath()
  }

  // Skin: a faint fill and a crisp, cool outline (the 3D shell's rim).
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.fillStyle = SKIN_FILL
  ctx.strokeStyle = SKIN_LINE
  ctx.lineWidth = 1.5
  if (figure) figure(ctx, X, Y, scale)
  else {
    // At rest, no legs: the arms, then the torso closed under the hips.
    armShape ??= tubeOutline(ARM, armRadius, 48)
    for (const mirror of [false, true]) {
      poly(armShape, mirror)
      ctx.fill()
      ctx.stroke()
    }
    ctx.beginPath()
    TORSO_PROFILE.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))))
    for (let i = TORSO_PROFILE.length - 1; i >= 0; i--) ctx.lineTo(X(-TORSO_PROFILE[i]![0]), Y(TORSO_PROFILE[i]![1]))
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.ellipse(X(HEAD.center.x), Y(HEAD.center.y), HEAD.rx * scale, HEAD.ry * scale, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  if (!organs) return

  /** A filled shape with the organ's outline. */
  const solid = (organ: LitOrgan) => {
    const { active, faded } = look(organ, s)
    const c = tone(organ, faded)
    ctx.fillStyle = css(active ? mix(c, WHITE, 0.08) : c)
    ctx.fill()
    ctx.strokeStyle = ink(c, faded)
    ctx.lineWidth = flat.line + (active ? 0.75 : 0)
    ctx.stroke()
  }
  /** A tube drawn as a wide stroke: the outline colour first, then the organ colour inside it. */
  const tube = (organ: LitOrgan, curve: Spline3, width: number, n: number, colour?: (u: number) => string) => {
    const { active, faded } = look(organ, s)
    const c = tone(organ, faded)
    const pts = sampled(curve, n)
    const path = () => {
      ctx.beginPath()
      for (let i = 0; i < pts.length; i += 2) {
        if (i === 0) ctx.moveTo(X(pts[i]!), Y(pts[i + 1]!))
        else ctx.lineTo(X(pts[i]!), Y(pts[i + 1]!))
      }
    }
    path()
    ctx.strokeStyle = ink(c, faded)
    ctx.lineWidth = width * scale + 2 * (flat.line + (active ? 0.75 : 0))
    ctx.stroke()
    if (colour && !faded) {
      // A gradient along the tube is not possible in Canvas 2D; draw it in a few runs instead.
      const runs = 6
      const per = Math.ceil(pts.length / 2 / runs)
      for (let r = 0; r < runs; r++) {
        ctx.beginPath()
        for (let i = r * per; i <= Math.min(pts.length / 2 - 1, (r + 1) * per); i++) {
          if (i === r * per) ctx.moveTo(X(pts[i * 2]!), Y(pts[i * 2 + 1]!))
          else ctx.lineTo(X(pts[i * 2]!), Y(pts[i * 2 + 1]!))
        }
        ctx.strokeStyle = colour((r + 0.5) / runs)
        ctx.lineWidth = width * scale
        ctx.stroke()
      }
    } else {
      path()
      ctx.strokeStyle = css(c)
      ctx.lineWidth = width * scale
      ctx.stroke()
    }
  }

  poly(LIVER_OUTLINE)
  solid('liver')
  ctx.beginPath()
  ctx.ellipse(X(GALLBLADDER.center.x + 0.02), Y(GALLBLADDER.center.y - 0.02), 0.05 * scale, 0.1 * scale, -0.35, 0, Math.PI * 2)
  solid('gallbladder')
  tube('pancreas', PANCREAS, 0.1, 40)
  tube('esophagus', PHARYNX, 0.09, 12)
  tube('esophagus', ESOPHAGUS, 0.08, 60)
  tube('largeIntestine', LARGE_INTESTINE, 0.16, 220)
  const jejunum = rgb(JEJUNUM_TONE)
  const ileum = rgb(ILEUM_TONE)
  tube('smallIntestine', SMALL_INTESTINE, 0.085, 640, (u) => {
    const c = tone('smallIntestine')
    return css(u < 0.45 ? mix(c, jejunum, 0.4 * (1 - u / 0.45)) : mix(c, ileum, 0.45 * ((u - 0.45) / 0.55)))
  })
}

const PYLORUS = rgb(PYLORUS_TONE)

/** The stomach, stretched by how full it is now (same rule as the 3D shader: ends pinned). */
export function paintStomach(
  ctx: CanvasRenderingContext2D,
  X: (x: number) => number,
  Y: (y: number) => number,
  scale: number,
  s: BodyState,
) {
  const { active, faded } = look('stomach', s)
  ctx.beginPath()
  tubeOutline(STOMACH, (u) => stomachFillRadius(u, s.stomachFill), 40).forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y)),
  )
  ctx.closePath()
  const c = tone('stomach', faded)
  ctx.fillStyle = css(active ? mix(c, WHITE, 0.08) : c)
  ctx.fill()
  ctx.strokeStyle = ink(c, faded)
  ctx.lineWidth = flat.line + (active ? 0.75 : 0)
  ctx.lineJoin = 'round'
  ctx.stroke()
  // Pylorus ring at the exit.
  const end = STOMACH.getPointAt(1)
  ctx.beginPath()
  ctx.arc(X(end.x), Y(end.y), 0.045 * scale, 0, Math.PI * 2)
  ctx.strokeStyle = css(faded ? mix(PYLORUS, rgb(FADE_TONE), 0.6) : PYLORUS)
  ctx.lineWidth = Math.max(2, 0.025 * scale)
  ctx.stroke()
}

/** One food particle: its own shape and colour, a dark edge (like the 3D particles), turned by `angle`. */
function drawShape(ctx: CanvasRenderingContext2D, kind: NutrientKind, x: number, y: number, r: number, angle: number) {
  ctx.fillStyle = NUTRIENT_COLOR[kind]
  ctx.beginPath()
  const turn = (dx: number, dy: number): [number, number] => [
    x + dx * Math.cos(angle) - dy * Math.sin(angle),
    y + dx * Math.sin(angle) + dy * Math.cos(angle),
  ]
  const shape = (pts: [number, number][]) =>
    pts.map(([dx, dy]) => turn(dx, dy)).forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)))
  switch (kind) {
    case 'carbs':
      ctx.arc(x, y, r, 0, Math.PI * 2)
      break
    case 'protein':
      shape([
        [-r, -r],
        [r, -r],
        [r, r],
        [-r, r],
      ])
      break
    case 'fat':
      shape([
        [0, -r * 1.2],
        [r, 0],
        [0, r * 1.2],
        [-r, 0],
      ])
      break
    case 'fiber':
      shape([
        [-r * 0.35, -r * 1.4],
        [r * 0.35, -r * 1.4],
        [r * 0.35, r * 1.4],
        [-r * 0.35, r * 1.4],
      ])
      break
    case 'water':
      ctx.arc(x, y, r * 0.7, 0, Math.PI * 2)
      break
  }
  ctx.closePath()
  ctx.fill()
  // A dark edge keeps pale particles visible on pale tissue and on the paper, like in 3D.
  ctx.lineWidth = 1.25
  ctx.strokeStyle = PARTICLE_EDGE
  ctx.stroke()
}
