import { describe, expect, it } from 'vitest'
import { lineEndSpots, lineHits, placeLabel, ringSpots } from './labels.ts'

const line = (...pts: number[]) => Float32Array.from(pts)

describe('plot labels', () => {
  it('a line through a box hits it; one beside it does not; a steep drop between two far points still hits', () => {
    const box = { x: 10, y: 10, w: 20, h: 10 }
    expect(lineHits(box, line(0, 15, 40, 15))).toBe(true)
    expect(lineHits(box, line(0, 40, 40, 40))).toBe(false)
    // Two points well outside the box, one segment crossing it.
    expect(lineHits(box, line(20, 0, 20, 100))).toBe(true)
    // Within the 3 px padding counts as touching.
    expect(lineHits(box, line(0, 22, 40, 22))).toBe(true)
  })

  it('takes the first free spot beside the ring, above right first', () => {
    const plot = { width: 300, height: 150 }
    const size = { w: 60, h: 14 }
    expect(placeLabel(size, ringSpots(100, 80, size.w, size.h), plot, [])).toEqual({ x: 109, y: 57, w: 60, h: 14 })
    // A line running up to the right blocks above right: the label goes above left.
    const up = line(100, 80, 200, 20)
    const box = placeLabel(size, ringSpots(100, 80, size.w, size.h), plot, [up])!
    expect(box.x + box.w).toBeLessThan(100)
    expect(lineHits(box, up)).toBe(false)
  })

  it('stays inside the plot and off labels already placed', () => {
    const plot = { width: 200, height: 100 }
    const size = { w: 80, h: 14 }
    const taken = [{ x: 0, y: 0, w: 200, h: 40 }]
    const box = placeLabel(size, ringSpots(190, 50, size.w, size.h), plot, [], taken)!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.w).toBeLessThanOrEqual(200)
    expect(box.y).toBeGreaterThanOrEqual(43)
  })

  it('a flat line’s name sits above its right end, else below it', () => {
    const plot = { width: 300, height: 100 }
    const size = { w: 90, h: 30 }
    expect(placeLabel(size, lineEndSpots(60, 300, size.w, size.h), plot, [])).toEqual({ x: 206, y: 25, w: 90, h: 30 })
    const blocking = line(0, 40, 300, 40)
    expect(placeLabel(size, lineEndSpots(60, 300, size.w, size.h), plot, [blocking])).toEqual({ x: 206, y: 65, w: 90, h: 30 })
  })

  it('with no free spot, the one crossing the fewest lines', () => {
    const plot = { width: 200, height: 100 }
    const size = { w: 40, h: 10 }
    const spots = ringSpots(100, 50, size.w, size.h)
    // Lines every 12 px cross every spot; a steep line through the right-hand spots crosses them twice.
    const lines = [...Array.from({ length: 9 }, (_, i) => line(0, 4 + i * 12, 200, 4 + i * 12)), line(130, 0, 131, 100)]
    const hits = (b: { x: number; y: number; w: number; h: number }) => lines.filter((l) => lineHits(b, l)).length
    const box = placeLabel(size, spots, plot, lines)!
    const fewest = Math.min(
      ...spots
        .map((s) => ({ ...s, ...size }))
        .filter((b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= 200 && b.y + b.h <= 100)
        .map(hits),
    )
    expect(fewest).toBeGreaterThan(0)
    expect(hits(box)).toBe(fewest)
    // Not simply the first spot (above right), which the steep line also crosses.
    expect(box.x + box.w).toBeLessThan(100)
  })

  it('a label wider than either side of the ring is moved just inside the plot, never dropped (300 px phone graph)', () => {
    const plot = { width: 300, height: 120 }
    const size = { w: 144, h: 14 }
    const box = placeLabel(size, ringSpots(150, 70, size.w, size.h), plot, [])
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.w).toBeLessThanOrEqual(300)
    // Still above the ring, as near as it fits.
    expect(box!.y + box!.h).toBeLessThanOrEqual(70 - 9)
  })
})
