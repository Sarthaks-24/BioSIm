import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { valueAt, type RunResult } from '@lifepeek/engine'
import type { LayerProps } from '../../registry/types.ts'
import type { View } from '../../anatomy/human/base.ts'
import type { ActivityBand } from '../../anatomy/human/bands.ts'
import type { CalloutSpec } from '../../anatomy/CalloutOverlay.tsx'
import type { Spline3, XYZ } from '../../anatomy/spline.ts'
import type { LimbKit, PosedLimbs } from '../../anatomy/human/limbs.ts'
import {
  LABELS,
  LYMPH_ROUTE,
  LYMPH_SAC,
  MAIN_DUCT,
  NECK_VEIN,
  NODES,
  RIGHT_DUCT,
  THYMUS,
  TRUNK_VESSELS,
  spleenPoint,
  type LymphLabel,
} from '../../anatomy/human/lymph.ts'
import { LYMPH_TONE } from '../../anatomy/tones/lymph.ts'
import type { LayerKit } from '../../flat/layerKit.ts'
import { useProjector } from '../../hooks/useProjector.ts'
import { onTick } from '../../lib/ticker.ts'
import { useClock } from '../../state/clock.ts'
import { MAX_DOTS, ROAD, ROUTE_SEC, dotShown, fatDots, seriesOf } from './fat.ts'

/**
 * The static lymph map (A-11a; anatomy plan §2.7), drawn over the base body in the `full` framing:
 * lymph vessels from the feet, the hands, the head and the gut; merged node clusters (neck, armpit,
 * gut, groin); the main lymph duct climbing to the left neck vein and the short right duct to the
 * right one; the spleen and the thymus. The map itself never moves or flashes; it is drawn again only
 * when the picture's size, the pose or the projector look changes. The vessels of the arms and legs follow the band's
 * still pose (the limb curves, loaded with the legs), so a walk never leaves a vessel in the air.
 * Until the legs' chunk is here (or if it can't arrive: offline, never saved) the map is drawn on
 * the body the flat body draws then, the resting one with no legs: the trunk's and the resting
 * arms' vessels, never a blank picture (R93 #6). It asks for the legs again when the internet is back.
 *
 *
 * Fat dots (U-5, v3.1; anatomy plan §2.7): while lymph carries the meal's fat to the blood
 * (`lymph.fatFlowRate` at the clock's minute), teal diamonds (digestion's fat shape and colour) run
 * along the web-side lymph route (anatomy/human/lymph.ts LYMPH_ROUTE): from the gut up the main duct
 * into the left neck vein. As many as the fat arriving (fat.ts `fatDots`), none for a meal without
 * fat (cola, water) and none once the fat has all gone by. They move on the real clock (lib/ticker.ts,
 * at most 20 updates a second), at a steady drawn speed; with motion reduced they stand still.
 *
 * It imports nothing from the stage's chunk but the meal clock's: the flat body hands it what it
 * needs (`kit`, flat/layerKit.ts), and the few lines of the flat body's maths it shares are copied
 * here (`frame`, the outline shade, the particles' edge).
 */

export default function LymphLayer({ sim, view, band, width, height, reduced, kit }: LayerProps) {
  const { t } = useTranslation()
  const canvas = useRef<HTMLCanvasElement>(null)
  const projector = useProjector()
  const { posed, failed } = usePosedLimbs(band, kit)
  const [drawn, setDrawn] = useState(false)
  const fat = useRef<HTMLCanvasElement>(null)
  const dots = useFatDots(fat, sim, width, height, view, kit, reduced)

  // The parts' names (anatomy plan §6): the first three on a narrow picture, the rest with room.
  const roomy = width >= 460
  const specs = useMemo<CalloutSpec<LymphLabel>[]>(
    () => LABEL_ORDER.map(([key, tone, top]) => ({ key, text: t(`sys.lymph.map.${key}`), tone, hidden: !roomy && !top })),
    [t, roomy],
  )
  const { overlay, place } = kit.useCallouts(specs, () => placeLabels(), LABELS)
  const placeLabels = () => {
    if (width > 0 && height > 0) {
      const { X, Y } = frame(width, height, view)
      place((p) => [X(p.x), Y(p.y)], width, height)
    }
  }
  useEffect(placeLabels)

  useEffect(() => {
    const el = canvas.current
    if (!el || width === 0 || height === 0) return
    // The flat body's pixel-ratio cap (three/quality.ts: 1.5 device pixels per CSS px at most).
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    el.width = Math.round(width * dpr)
    el.height = Math.round(height * dpr)
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    paintLymph(ctx, width, height, view, kit.base, posed, projector)
    // Drawn: whole, or as whole as it can be (the legs did not arrive).
    setDrawn(!!posed || failed)
  }, [width, height, view, kit, posed, failed, projector])

  return (
    <>
      <canvas
        ref={canvas}
        aria-hidden="true"
        data-layer="lymph"
        data-drawn={drawn ? '' : undefined}
        data-limbs={posed ? '' : undefined}
        className="absolute inset-0"
        style={{ width, height }}
      />
      <canvas
        ref={fat}
        aria-hidden="true"
        data-fat-dots={dots}
        data-fat={reduced ? 'still' : 'moving'}
        className="pointer-events-none absolute inset-0"
        style={{ width, height }}
      />
      {overlay}
    </>
  )
}

/** The particles' dark edge (anatomy/tones/base.ts PARTICLE_EDGE, copied: lymph.test checks it). */
export const DOT_EDGE = '#141a2e'

/**
 * The lymph route in CSS px of a `w` × `h` picture of `view` (anatomy/human/lymph.ts LYMPH_ROUTE): the
 * gut's vessel front-on, then the main duct as the map draws it (a curve through its points, seen
 * with the limbs' weak perspective), to where it joins the left neck vein.
 */
export function fatRoute(base: LimbKit, w: number, h: number, view: View): Pt[] {
  const { X, Y } = frame(w, h, view)
  const p = new base.Vec3()
  const duct = new base.Spline3(LYMPH_ROUTE.duct, 0.5)
  const pts: Pt[] = [
    ...LYMPH_ROUTE.flat.map(([x, y]) => [x, y] as Pt),
    ...Array.from({ length: 41 }, (_, i) => seen(duct.getPointAt(i / 40, p))),
    seen(LYMPH_ROUTE.into),
  ]
  return pts.map(([x, y]) => [X(x), Y(y)])
}

/** A point `u` (0–1) of the way along a polyline, by length. */
export function pointAlong(pts: readonly Pt[], cum: readonly number[], u: number): Pt {
  const d = u * cum[cum.length - 1]!
  let i = 1
  while (i < cum.length - 1 && cum[i]! < d) i++
  const seg = cum[i]! - cum[i - 1]! || 1
  const k = (d - cum[i - 1]!) / seg
  const [a, b] = [pts[i - 1]!, pts[i]!]
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]
}

/**
 * The fat dots on their own canvas: how many follow the fat lymph carries at the clock's minute
 * (re-rendering only when that number changes), moved along the route on the real clock while there
 * are any and motion is allowed. Returns how many are drawn (the canvas's `data-fat-dots`).
 */
function useFatDots(
  canvas: RefObject<HTMLCanvasElement | null>,
  sim: RunResult,
  w: number,
  h: number,
  view: View,
  kit: LayerKit,
  reduced: boolean,
): number {
  const n = useClock(
    useCallback(
      (s: { simMin: number }) => {
        const road = seriesOf(sim, ROAD)
        return road ? fatDots(valueAt(road, s.simMin, sim.stepMin)) : 0
      },
      [sim],
    ),
  )
  const route = useMemo(() => {
    if (w === 0 || h === 0) return null
    const pts = fatRoute(kit.base, w, h, view)
    const cum = [0]
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]))
    return { pts, cum, r: Math.max(3.5, 0.05 * frame(w, h, view).scale) }
  }, [w, h, view, kit])
  const phase = useRef(0)

  useEffect(() => {
    const el = canvas.current
    if (!el || !route) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    el.width = Math.round(w * dpr)
    el.height = Math.round(h * dpr)
    const ctx = el.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      const { r } = route
      ctx.fillStyle = LYMPH_TONE.fat
      ctx.strokeStyle = DOT_EDGE
      ctx.lineWidth = 1.25
      ctx.lineJoin = 'round'
      for (let i = 0; i < MAX_DOTS; i++) {
        if (!dotShown(i, n)) continue
        const [x, y] = pointAlong(route.pts, route.cum, (phase.current + i / MAX_DOTS) % 1)
        // Digestion's fat particle: a diamond, a little taller than wide (flat/FlatBody.tsx).
        ctx.beginPath()
        ctx.moveTo(x, y - r * 1.2)
        ctx.lineTo(x + r, y)
        ctx.lineTo(x, y + r * 1.2)
        ctx.lineTo(x - r, y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
      }
    }
    draw()
    if (reduced || n === 0) return
    let since = 0
    return onTick((dt) => {
      phase.current = (phase.current + dt / ROUTE_SEC) % 1
      since += dt
      if (since < 0.05) return
      since = 0
      draw()
    })
  }, [canvas, route, n, reduced, w, h])
  return n
}

/** Each label, its weight, and whether it stays on a narrow picture (the plan's first three). */
const LABEL_ORDER: readonly (readonly [LymphLabel, CalloutSpec['tone'], boolean])[] = [
  ['nodes', 'stage', true],
  ['mainDuct', 'stage', true],
  ['spleen', 'stage', true],
  ['vessels', 'stage', false],
  ['rightDuct', 'context', false],
  ['thymus', 'context', false],
  ['neckVein', 'context', false],
]

/**
 * The band's posed limbs, once the legs' chunk is here (the flat body loads it for the `full`
 * framing too, so this waits on the same promise); null until then. `failed`: the chunk did not
 * arrive; it is asked for again when the internet comes back.
 */
function usePosedLimbs(band: ActivityBand, kit: LayerKit): { posed: Posed | null; failed: boolean } {
  const [posed, setPosed] = useState<Posed | null>(null)
  const [failed, setFailed] = useState(false)
  const [tries, setTries] = useState(0)
  useEffect(() => {
    let live = true
    const again = () => setTries((n) => n + 1)
    kit.loadLimbs().then(
      (m) => {
        if (!live) return
        setFailed(false)
        setPosed({ limbs: m.posedLimbs(band), legRadius: m.legRadius })
      },
      () => {
        if (!live) return
        setFailed(true)
        window.addEventListener('online', again, { once: true })
      },
    )
    return () => {
      live = false
      window.removeEventListener('online', again)
    }
  }, [band, kit, tries])
  return { posed: posed?.limbs.band === band ? posed : null, failed }
}

/** A pose's limbs and the legs' radius (both from the legs' chunk). */
interface Posed {
  limbs: PosedLimbs
  legRadius: (u: number) => number
}

type Pt = [number, number]

/** Scene units → CSS px, front-on, fitting `view` (flat/FlatBody.tsx `frame`, copied: see above). */
function frame(w: number, h: number, view: View) {
  const scale = Math.min(w / (view.maxX - view.minX), h / (view.maxY - view.minY))
  const oy = h / 2 + ((view.maxY + view.minY) / 2) * scale
  return { scale, X: (x: number) => w / 2 + x * scale, Y: (y: number) => oy - y * scale }
}

/**
 * The limbs' weak perspective (flat/limbs.ts `project`: a camera 30 units in front, level with the
 * chest), so a vessel lies on the limb the base body draws.
 */
const seen = (p: XYZ, dx = 0): Pt => {
  const s = 30 / (30 - p.z)
  return [(p.x + dx) * s, 1 + (p.y - 1) * s]
}

/** The flat look (flat/look.ts FLAT_LOOK): the outline's shade of a tone and its width, normal and projector. */
const LOOK = { normal: { ink: 0.42, line: 1.25 }, projector: { ink: 0.2, line: 2 } }
const hex = (c: string, k = 1) => `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(c.slice(i, i + 2), 16) * k)).join(',')})`
/** The neck veins: the blood's, drawn faint in the skin's line colour (anatomy/tones/base.ts SKIN_LINE). */
const VEIN = 'rgba(61,76,107,0.45)'

/** A node cluster's main node on a side (NODES: armpit 3rd, groin 8th). */
const node = (i: number, side: number): Pt => [NODES[i]!.x * side, NODES[i]!.y]

/**
 * Paints the map in CSS pixels of a `w` × `h` picture of `view`, the limbs' vessels in their pose;
 * with no `posed` limbs (not loaded), on the resting body without legs: the trunk and resting arms.
 */
export function paintLymph(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  view: View,
  base: LimbKit,
  posed: Posed | null,
  projector: boolean,
) {
  const { scale, X, Y } = frame(w, h, view)
  const look = projector ? LOOK.projector : LOOK.normal
  const p = new base.Vec3()
  /** Samples of a curve from `u0` to `u1` (either way), shifted sideways by `dx(u)`, as the picture draws it. */
  const along = (c: Spline3, u0: number, u1: number, n: number, dx: (u: number) => number = () => 0): Pt[] =>
    Array.from({ length: n + 1 }, (_, i) => {
      const u = u0 + ((u1 - u0) * i) / n
      return seen(c.getPointAt(u, p), dx(u))
    })
  const through = (pts: readonly XYZ[]) => new base.Spline3(pts, 0.5)

  // Vessels: the trunk's and the head's (mirrored where on both sides), then the limbs' in this pose:
  // up the inside of each leg to the groin nodes (with a branch from the outer calf), up each arm
  // from the hand to the armpit nodes.
  const vessels: Pt[][] = TRUNK_VESSELS.flatMap(({ pts, mirror }) => {
    const right = pts.map(([x, y]) => [x, y] as Pt)
    return mirror ? [right, right.map(([x, y]) => [-x, y] as Pt)] : [right]
  })
  const resting = (side: number) => along(base.ARM, 0.9, 0.16, 30).map(([x, y]) => [x * side, y] as Pt)
  if (posed) {
    const { limbs, legRadius } = posed
    for (const { side, curve } of limbs.legs) {
      // The inside of the leg is towards the midline: −x on the viewer's right leg.
      const inner = (u: number) => -side * 0.3 * legRadius(u)
      vessels.push([...along(curve, 0.93, 0.06, 40, inner), node(7, side)])
      vessels.push(along(curve, 0.78, 0.5, 12, (u) => legRadius(u) * side * (0.45 - 0.75 * ((0.78 - u) / 0.28))))
    }
    for (const { side, curve } of limbs.arms) {
      // A posed arm is one curve, shoulder (0) to fingertips (1) (U-1a): its vessel runs from the
      // hand up to the armpit, as the resting arm's does along ARM.
      const pts = limbs.band === 'rest' ? resting(side) : along(curve, 0.9, 0.07, 30)
      vessels.push([...pts, node(2, side)])
    }
  } else for (const side of [1, -1]) vessels.push([...resting(side), node(2, side)])

  ctx.clearRect(0, 0, w, h)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Readable on a 160 px picture and on a projector: never thinner than these, in CSS px.
  const vesselW = Math.max(1.5, 0.026 * scale)
  const ductW = Math.max(2.5, 0.055 * scale)
  const path = (pts: readonly Pt[]) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))))
  }
  /** Tubes as wide strokes: every outline first, then every fill, so tubes that meet look joined. */
  const tubes = (lines: readonly (readonly Pt[])[], c: string, width: number) => {
    ctx.strokeStyle = hex(c, look.ink)
    ctx.lineWidth = width + 2 * look.line
    for (const l of lines) (path(l), ctx.stroke())
    ctx.strokeStyle = c
    ctx.lineWidth = width
    for (const l of lines) (path(l), ctx.stroke())
  }
  /** Filled shapes, outlines first (so overlapping nodes merge into one cluster). */
  const blobs = (shapes: readonly (() => void)[], c: string) => {
    ctx.strokeStyle = hex(c, look.ink)
    ctx.lineWidth = 2 * look.line
    for (const s of shapes) (s(), ctx.stroke())
    ctx.fillStyle = c
    for (const s of shapes) (s(), ctx.fill())
  }
  const ellipse = (x: number, y: number, rx: number, ry: number, tilt: number, min: number) => () => {
    ctx.beginPath()
    ctx.ellipse(X(x), Y(y), Math.max(min, rx * scale), Math.max(min, ry * scale), tilt, 0, Math.PI * 2)
  }

  // The neck veins the ducts empty into: faint, they are the blood's.
  ctx.strokeStyle = VEIN
  ctx.lineWidth = ductW * 1.3
  for (const side of [1, -1]) {
    path(along(through(NECK_VEIN), 0, 1, 24).map(([x, y]) => [x * side, y]))
    ctx.stroke()
  }

  const { vessel, node: nodeTone, spleen, thymus } = LYMPH_TONE
  tubes(vessels, vessel, vesselW)
  tubes([along(through(MAIN_DUCT), 0, 1, 60), along(through(RIGHT_DUCT), 0, 1, 12)], vessel, ductW)
  const sac = LYMPH_SAC
  blobs([ellipse(sac.center.x, sac.center.y, sac.rx, sac.ry, 0, ductW / 2 + 1)], vessel)

  blobs(
    NODES.flatMap(({ x, y, r, mirror }) =>
      (mirror ? [1, -1] : [1]).map((side) => ellipse(x * side, y, r * 1.15, r, 0, Math.max(2.5, vesselW * 1.4))),
    ),
    nodeTone,
  )
  blobs(
    [
      () => {
        ctx.beginPath()
        for (let i = 0; i <= 32; i++) {
          const a = (i / 32) * Math.PI * 2
          spleenPoint({ x: Math.cos(a), y: Math.sin(a), z: 0 }, p)
          if (i === 0) ctx.moveTo(X(p.x), Y(p.y))
          else ctx.lineTo(X(p.x), Y(p.y))
        }
        ctx.closePath()
      },
    ],
    spleen,
  )
  blobs(
    THYMUS.map(({ x, y, rx, ry, tilt }) => ellipse(x, y, rx, ry, tilt, 2)),
    thymus,
  )
}
