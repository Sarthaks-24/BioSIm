/**
 * Where a graph puts the words it writes on the plot itself (the ring's "Highest: 121", the
 * energy graph's "The same for every meal"): never on a line, never outside the plot. Each label
 * tries a short list of spots beside what it names, nearest first, and takes the first that
 * crosses no line and no label already placed. Pure, so it is tested without a browser.
 */

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

/** A drawn line as CSS-pixel points: x0, y0, x1, y1, … */
export type Polyline = Float32Array

/** Space kept between a label and a line, another label or the plot's edge (px). */
const PAD = 3

/** True when the segment (x1, y1)–(x2, y2) passes through the box (Liang–Barsky clipping). */
function segmentHits(b: Box, x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1
  const dy = y2 - y1
  let t0 = 0
  let t1 = 1
  const edges: [number, number][] = [
    [-dx, x1 - b.x],
    [dx, b.x + b.w - x1],
    [-dy, y1 - b.y],
    [dy, b.y + b.h - y1],
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false
    } else {
      const r = q / p
      if (p < 0) {
        if (r > t1) return false
        if (r > t0) t0 = r
      } else {
        if (r < t0) return false
        if (r < t1) t1 = r
      }
    }
  }
  return true
}

const grow = (b: Box, by: number): Box => ({ x: b.x - by, y: b.y - by, w: b.w + 2 * by, h: b.h + 2 * by })

/** True when any part of the line passes through the box, or within PAD of it. */
export function lineHits(box: Box, line: Polyline, pad = PAD): boolean {
  const b = grow(box, pad)
  for (let i = 2; i < line.length; i += 2) {
    const x1 = line[i - 2]!
    const y1 = line[i - 1]!
    const x2 = line[i]!
    const y2 = line[i + 1]!
    // Most segments are nowhere near: skip them cheaply.
    if (Math.max(x1, x2) < b.x || Math.min(x1, x2) > b.x + b.w || Math.max(y1, y2) < b.y || Math.min(y1, y2) > b.y + b.h) continue
    if (segmentHits(b, x1, y1, x2, y2)) return true
  }
  return false
}

const boxesOverlap = (a: Box, b: Box) => a.x < b.x + b.w + PAD && b.x < a.x + a.w + PAD && a.y < b.y + b.h + PAD && b.y < a.y + a.h + PAD

const inside = (b: Box, width: number, height: number) => b.x >= 0 && b.y >= 0 && b.x + b.w <= width && b.y + b.h <= height

/**
 * The first spot (top-left corners, nearest first) where a label of this size fits inside the
 * plot without touching a line or another label. If none is free, the spot that crosses the
 * fewest lines and labels, so the label still sits next to what it names. A spot that sticks out
 * of the plot (a wide label near the middle of a phone's narrow graph) is tried last, moved just
 * inside: a label is never dropped. Null only when there are no spots.
 */
export function placeLabel(
  size: { w: number; h: number },
  spots: readonly { x: number; y: number }[],
  plot: { width: number; height: number },
  lines: readonly Polyline[],
  taken: readonly Box[] = [],
): Box | null {
  const boxes = spots.map((s) => ({ x: s.x, y: s.y, w: size.w, h: size.h }))
  const clamp = (b: Box): Box => ({
    ...b,
    x: Math.max(0, Math.min(b.x, plot.width - b.w)),
    y: Math.max(0, Math.min(b.y, plot.height - b.h)),
  })
  const tries = [
    ...boxes.filter((b) => inside(b, plot.width, plot.height)),
    ...boxes.filter((b) => !inside(b, plot.width, plot.height)).map(clamp),
  ]
  let best: { box: Box; hits: number } | null = null
  for (const box of tries) {
    const hits = lines.filter((l) => lineHits(box, l)).length + taken.filter((t) => boxesOverlap(t, box)).length
    if (hits === 0) return box
    if (!best || hits < best.hits) best = { box, hits }
  }
  return best?.box ?? null
}

/** Gap between a ring's centre and its label (px): clear of the 5 px ring and its 2 px edge. */
const RING_GAP = 9

/**
 * Spots for a ring's label, nearest first: the four corners beside the ring (above right first,
 * where the eye expects it), then the same corners moved further away, up and down.
 */
export function ringSpots(cx: number, cy: number, w: number, h: number): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = []
  for (const d of [0, 10, 20, 32, 46, 62, 80, 100]) {
    const above = cy - RING_GAP - h - d
    const below = cy + RING_GAP + d
    const right = cx + RING_GAP
    const left = cx - RING_GAP - w
    spots.push({ x: right, y: above }, { x: left, y: above }, { x: right, y: below }, { x: left, y: below })
  }
  return spots
}

/**
 * Spots for a line's own name (energy used at rest, a flat line): just above its right end,
 * then just below it, then the same further left, in tenths of the plot.
 */
export function lineEndSpots(endY: number, width: number, w: number, h: number): { x: number; y: number }[] {
  const spots: { x: number; y: number }[] = []
  for (let k = 0; k <= 6; k++) {
    const x = width - 4 - w - (k * width) / 10
    spots.push({ x, y: endY - 5 - h }, { x, y: endY + 5 })
  }
  return spots
}

/** A line's points in CSS pixels, from its thinned samples. */
export function polyline(t: Float32Array, v: Float32Array, x: (min: number) => number, y: (v: number) => number): Polyline {
  const out = new Float32Array(t.length * 2)
  for (let i = 0; i < t.length; i++) {
    out[i * 2] = x(t[i]!)
    out[i * 2 + 1] = y(v[i]!)
  }
  return out
}
