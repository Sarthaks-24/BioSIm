import type { StageId } from '@lifepeek/engine'
import { MOUTH } from './human/digestion.ts'
import type { XYZ } from './spline.ts'

/**
 * Organ labels as small callouts: a dot on the organ, a short leader line, and the name beside
 * the organ instead of on top of it. The 3D body and the flat diagram share the anchors and the
 * layout, so a label sits in the same place in both.
 */

/** Organs that can carry a label: the food's path, plus liver and pancreas for context. */
export type CalloutId = StageId | 'liver' | 'pancreas'

export interface Callout {
  /** The point on the organ the leader starts from (scene units, see human.ts). */
  anchor: XYZ
  /** Where the label's inner edge sits, beside the organ. */
  at: XYZ
  /** Which way the label extends from `at`: away from the body's midline. */
  side: 'left' | 'right'
}

const v = (x: number, y: number, z: number): XYZ => ({ x, y, z })

/**
 * Anchors are on the front of each organ; label points are in empty space next to it (the chest,
 * beside the hips) or outside the stomach's greatest stretch, so a label never covers its organ.
 */
export const CALLOUTS: Record<CalloutId, Callout> = {
  mouth: { anchor: MOUTH, at: v(0.3, 2.64, 0.2), side: 'right' },
  esophagus: { anchor: v(0.01, 1.62, -0.07), at: v(0.2, 1.62, -0.07), side: 'right' },
  stomach: { anchor: v(0.6, 0.86, 0.16), at: v(0.9, 0.92, 0.12), side: 'right' },
  smallIntestine: { anchor: v(0.24, -0.46, 0.22), at: v(0.93, -0.5, 0.1), side: 'right' },
  largeIntestine: { anchor: v(-0.68, -0.32, 0.08), at: v(-0.93, -0.32, 0.06), side: 'left' },
  liver: { anchor: v(-0.5, 1.12, 0.26), at: v(-0.86, 1.36, 0.1), side: 'left' },
  pancreas: { anchor: v(0.06, 0.26, 0.0), at: v(-0.93, 0.36, 0.0), side: 'left' },
}

/** One label to place, in CSS pixels of the picture. */
export interface CalloutInput {
  key: string
  /** Anchor on screen. */
  ax: number
  ay: number
  /** Label point on screen. */
  lx: number
  ly: number
  side: 'left' | 'right'
  /** Measured label size. */
  w: number
  h: number
  /** Higher goes first and never moves for a lower one (the active stage is highest). */
  priority: number
}

export interface CalloutBox {
  key: string
  x: number
  y: number
  w: number
  h: number
  /** Leader from the anchor to the label's inner edge; null when the label already touches the anchor. */
  leader: { x1: number; y1: number; x2: number; y2: number } | null
}

export interface CalloutLayout {
  shown: CalloutBox[]
  /** Labels that found no free place inside the picture; they are hidden rather than overlapping. */
  hidden: string[]
}

/** Space kept between two labels, and between a label and the picture's edge (px). */
const GAP = 4
const STEP = 3

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) =>
  a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP

/** A shape labels must not cover (a posed arm in front of the body, R89), as a polygon in CSS px. */
export type Obstacle = readonly (readonly [number, number])[]

/** The point is inside the polygon (even-odd). */
function within(px: number, py: number, poly: Obstacle): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!
    const [xj, yj] = poly[j]!
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * The box covers part of the shape: one of the shape's points is in the box (with the gap round it),
 * or one of the box's corners or its middle is in the shape. A limb's outline is sampled densely, so
 * this is enough for a label against an arm.
 */
const covers = (b: { x: number; y: number; w: number; h: number }, poly: Obstacle) =>
  poly.some(([x, y]) => x > b.x - GAP && x < b.x + b.w + GAP && y > b.y - GAP && y < b.y + b.h + GAP) ||
  [
    [b.x, b.y],
    [b.x + b.w, b.y],
    [b.x, b.y + b.h],
    [b.x + b.w, b.y + b.h],
    [b.x + b.w / 2, b.y + b.h / 2],
  ].some(([x, y]) => within(x!, y!, poly))

/**
 * Places labels so that no two overlap and all stay inside the picture. Each label starts beside
 * its organ, pushed inside the edges; then, in priority order, it slides up or down (nearest free
 * place first, at most about three label heights) past the labels already placed. A label with no
 * free place is hidden: overlapping text is never shown. Pure, so it is tested without a browser.
 *
 * `avoid`: shapes no label may cover (U-1, R89: a posed arm in front of the torso, which would
 * otherwise sit under "Liver" or "Stomach"); a label then slides further, up to about six label
 * heights, to clear it.
 */
export function layoutCallouts(items: readonly CalloutInput[], width: number, height: number, avoid: readonly Obstacle[] = []): CalloutLayout {
  const shown: CalloutBox[] = []
  const hidden: string[] = []
  const order = [...items].sort((a, b) => b.priority - a.priority)
  for (const it of order) {
    const w = Math.min(it.w, width - 2 * GAP)
    const x = clamp(it.side === 'right' ? it.lx : it.lx - w, GAP, width - GAP - w)
    const y0 = clamp(it.ly - it.h / 2, GAP, height - GAP - it.h)
    const reach = it.h * (avoid.length ? 6 : 3) + 24
    let placed: CalloutBox | null = null
    for (let d = 0; d <= reach && !placed; d += STEP) {
      for (const y of d === 0 ? [y0] : [y0 + d, y0 - d]) {
        if (y < GAP || y > height - GAP - it.h) continue
        const box = { key: it.key, x, y, w, h: it.h, leader: null }
        if (!shown.some((s) => overlaps(s, box)) && !avoid.some((a) => covers(box, a))) {
          placed = box
          break
        }
      }
    }
    if (!placed) {
      hidden.push(it.key)
      continue
    }
    // The leader ends at the middle of the label's inner edge (the edge facing the organ).
    const x2 = it.side === 'right' ? placed.x : placed.x + placed.w
    const y2 = placed.y + placed.h / 2
    const inside = it.ax >= placed.x && it.ax <= placed.x + placed.w && it.ay >= placed.y && it.ay <= placed.y + placed.h
    placed.leader = inside || Math.hypot(x2 - it.ax, y2 - it.ay) < 6 ? null : { x1: it.ax, y1: it.ay, x2, y2 }
    shown.push(placed)
  }
  return { shown, hidden }
}

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), Math.max(lo, hi))
