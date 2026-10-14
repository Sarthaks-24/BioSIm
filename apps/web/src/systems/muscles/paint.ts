import { useEffect, useState } from 'react'
import type { View } from '../../anatomy/human/base.ts'
import type { ActivityBand } from '../../anatomy/human/bands.ts'
import type { LimbKit, PosedLimbs } from '../../anatomy/human/limbs.ts'
import type { Callout } from '../../anatomy/callouts.ts'
import type { Spline3, XYZ } from '../../anatomy/spline.ts'
import type { LayerKit } from '../../flat/layerKit.ts'

/*
 * What the effort pack's three flat layers share (muscles, skin, bones; anatomy plan §2.4–2.6): the
 * picture's frame, the flat look, the limbs' weak perspective, stretches of a posed limb, and the
 * band's posed limbs from the legs' chunk. The pack shares no code with the stage (a module shared
 * with /sim would be split out of it into a chunk of its own), so the few lines it needs of the flat
 * body are written out here, and effort.test.ts checks each against its original: `frameOf`
 * (flat/FlatBody.tsx frame), LOOK (flat/look.ts FLAT_LOOK), `seen` (flat/limbs.ts project) and the
 * pixel-ratio cap (three/quality.ts).
 */

export type Pt = readonly [number, number]

/** Scene units → CSS px, front-on, fitting `view` into the picture (flat/FlatBody.tsx `frame`). */
export function frameOf(w: number, h: number, view: View) {
  const scale = Math.min(w / (view.maxX - view.minX), h / (view.maxY - view.minY))
  const oy = h / 2 + ((view.maxY + view.minY) / 2) * scale
  return { scale, X: (x: number) => w / 2 + x * scale, Y: (y: number) => oy - y * scale }
}
export type Frame = ReturnType<typeof frameOf>

/**
 * The outline's shade of a tone and its width (flat/look.ts FLAT_LOOK), and a pale fill's outline on
 * the projector: 3 px of ink (anatomy plan §5: bone, the skin's rim).
 */
export const LOOK = { normal: { ink: 0.42, line: 1.25, pale: 1.25 }, projector: { ink: 0.2, line: 2, pale: 3 } } as const
export type Look = (typeof LOOK)[keyof typeof LOOK]

/** A tone's outline: the tone, shaded (flat/look.ts outlineOf). */
export const inkOf = (hex: string, look: Look) =>
  `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * look.ink)).join(',')})`

/** A tone moved `k` of the way to white: the working muscles' one lightness step. */
export const lighter = (hex: string, k: number) =>
  `rgb(${[1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + 255 * k)).join(',')})`

/** Sizes a canvas to the picture (CSS px), at the flat body's pixel-ratio cap (1.5; 1.25 on a 2 GB phone). */
export function sized(canvas: HTMLCanvasElement, w: number, h: number) {
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

/** A limb point as the picture draws it (flat/limbs.ts `project`: a camera 30 units in front, level with the chest), and how much nearer parts grow. */
export function seen(p: XYZ): { x: number; y: number; s: number } {
  const s = 30 / (30 - p.z)
  return { x: p.x * s, y: 1 + (p.y - 1) * s, s }
}

/** A smooth closed path through the points (quadratic curves through their midpoints), in scene units. */
export function smoothPath(ctx: CanvasRenderingContext2D, pts: readonly Pt[], { X, Y }: Frame) {
  const mid = (a: Pt, b: Pt) => [X((a[0] + b[0]) / 2), Y((a[1] + b[1]) / 2)] as const
  ctx.beginPath()
  const start = mid(pts[pts.length - 1]!, pts[0]!)
  ctx.moveTo(start[0], start[1])
  pts.forEach((p, i) => {
    const m = mid(p, pts[(i + 1) % pts.length]!)
    ctx.quadraticCurveTo(X(p[0]), Y(p[1]), m[0], m[1])
  })
  ctx.closePath()
}

/** A straight-edged closed path through the points, in scene units. */
export function polyPath(ctx: CanvasRenderingContext2D, pts: readonly Pt[], { X, Y }: Frame) {
  ctx.beginPath()
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))))
  ctx.closePath()
}

/** An outline mirrored to the other side (x → −x). */
export const mirrored = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [-x, y] as const)

/** A stretch of a limb (anatomy/human/muscles.ts LimbStretch). */
export interface Stretch {
  u0: number
  u1: number
  off: number
  w: number
}

/**
 * Points along a posed limb as the picture draws it, from `u0` to `u1`: each with the left of the
 * limb's direction in the picture (for a limb running down, +x) and the limb's radius there.
 */
function along(curve: Spline3, radius: (u: number) => number, u0: number, u1: number, n: number) {
  const out: { x: number; y: number; nx: number; ny: number; r: number }[] = []
  const du = 0.004
  for (let i = 0; i <= n; i++) {
    const u = n ? u0 + ((u1 - u0) * i) / n : u0
    const p = seen(curve.getPointAt(Math.min(1, Math.max(0, u))))
    const a = seen(curve.getPointAt(Math.max(0, u - du)))
    const b = seen(curve.getPointAt(Math.min(1, u + du)))
    const tx = b.x - a.x
    const ty = b.y - a.y
    const len = Math.hypot(tx, ty) || 1
    out.push({ x: p.x, y: p.y, nx: -ty / len, ny: tx / len, r: radius(u) * p.s })
  }
  return out
}

/**
 * A stretch of a posed limb as one closed outline, in scene units: its middle `off` × the radius to
 * the limb's outer side (`side` +1 for the viewer's right limb, −1 for the left), `w` × the radius
 * wide each side. A muscle (`taper`) narrows to its ends, where its tendons are; a bone or a tendon
 * keeps its width.
 */
export function stretchOutline(curve: Spline3, radius: (u: number) => number, s: Stretch, side: 1 | -1, taper: boolean, n = 18): Pt[] {
  const pts = along(curve, radius, s.u0, s.u1, n)
  const left: Pt[] = []
  const right: Pt[] = []
  pts.forEach((p, i) => {
    const k = taper ? Math.max(0.16, Math.sin((Math.PI * i) / n) ** 0.6) : 1
    const cx = p.x + p.nx * side * s.off * p.r
    const cy = p.y + p.ny * side * s.off * p.r
    const half = s.w * p.r * k
    left.push([cx + p.nx * half, cy + p.ny * half])
    right.push([cx - p.nx * half, cy - p.ny * half])
  })
  return [...left, ...right.reverse()]
}

/** A point on a posed limb, `off` × its radius to the outer side, in scene units. */
export function limbPoint(curve: Spline3, radius: (u: number) => number, u: number, off: number, side: 1 | -1): Pt {
  const [p] = along(curve, radius, u, u, 0)
  return [p!.x + p!.nx * side * off * p!.r, p!.y + p!.ny * side * off * p!.r]
}

/** A pose's limbs, the body base and the figure's outlines the legs' chunk was handed (flat/limbs.ts). */
export interface Posed {
  limbs: PosedLimbs
  base: LimbKit
  legRadius: (u: number) => number
  /** The posed skin: arms under the torso, the torso with both legs, arms over it (scene units). */
  figure: { under: Pt[][]; body: Pt[]; over: Pt[][] }
}

/**
 * The band's posed limbs, once the legs' chunk is here (the flat body loads it for the `full`
 * framing too, so this waits on the same promise); null until then, and the layer waits with the legs.
 */
export function usePosed(band: ActivityBand, kit: LayerKit): Posed | null {
  const [posed, setPosed] = useState<Posed | null>(null)
  // The legs' chunk is saved with the pack (cache-tiers.mjs DRAWING_DEPS); if it still can't arrive, it is asked for again when the internet is back.
  const [tries, setTries] = useState(0)
  useEffect(() => {
    let live = true
    const again = () => setTries((n) => n + 1)
    kit.loadLimbs().then(
      (m) =>
        live &&
        setPosed({
          limbs: m.posedLimbs(band),
          base: m.limbKit(),
          legRadius: m.legRadius,
          figure: m.figure(band),
        }),
      () => live && window.addEventListener('online', again, { once: true }),
    )
    return () => {
      live = false
      window.removeEventListener('online', again)
    }
  }, [band, kit, tries])
  // The last pose stays until the next one is here, so a band's edge never shows a frame without one.
  return posed
}

/** A limb of the pose by kind and side, with its radius along it. */
export function limbOf(posed: Posed, limb: 'leg' | 'arm', side: 1 | -1): { curve: Spline3; radius: (u: number) => number } {
  if (limb === 'leg') return posed.limbs.legs.find((l) => l.side === side)!
  return { curve: posed.limbs.arms.find((a) => a.side === side)!.curve, radius: posed.base.armRadius }
}

/**
 * A label table with some labels moved onto the pose's limbs (anatomy plan §6): each named label's
 * anchor goes to its place on its limb, and its label keeps its offset from the anchor at rest.
 */
export function posedLabels<K extends string>(
  table: Readonly<Record<K, Callout>>,
  posed: Posed,
  places: Partial<Record<K, { limb: 'leg' | 'arm'; side: 1 | -1; u: number; off?: number }>>,
): Record<K, Callout> {
  const out = { ...table } as Record<K, Callout>
  for (const [key, place] of Object.entries(places) as [K, { limb: 'leg' | 'arm'; side: 1 | -1; u: number; off?: number }][]) {
    const { curve, radius } = limbOf(posed, place.limb, place.side)
    const [x, y] = limbPoint(curve, radius, place.u, place.off ?? 0, place.side)
    const rest = table[key]
    out[key] = { ...rest, anchor: { x, y, z: 0 }, at: { x: rest.at.x, y: rest.at.y + (y - rest.anchor.y), z: 0 } }
  }
  return out
}

/**
 * Cross-fades a layer at a band's edge (anatomy plan §2.4: the pose changes only there, over 300 ms;
 * a cut under reduced motion): the old picture (its canvases, `layers`) is copied to `ghost`, which
 * then fades out over the new one. Call before painting the new pose.
 */
export function crossFade(layers: readonly (HTMLCanvasElement | null)[], ghost: HTMLCanvasElement, reduced: boolean) {
  const ctx = ghost.getContext('2d')
  const from = layers[0]
  if (!ctx || !from?.width) return
  ghost.width = from.width
  ghost.height = from.height
  ghost.style.width = from.style.width
  ghost.style.height = from.style.height
  ghost.style.transition = 'none'
  ghost.style.opacity = reduced ? '0' : '1'
  if (reduced) return
  // Every canvas of the layer as it shows now (a hatch step or the vessels' at its opacity).
  for (const c of layers)
    if (c?.width) {
      ctx.globalAlpha = Number(c.style.opacity || 1)
      ctx.drawImage(c, 0, 0)
    }
  ctx.globalAlpha = 1
  // The next frame starts the fade (the copy is shown first, at full strength).
  requestAnimationFrame(() => {
    ghost.style.transition = 'opacity 300ms linear'
    ghost.style.opacity = '0'
  })
}
