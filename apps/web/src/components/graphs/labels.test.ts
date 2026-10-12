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
    const plot = { width: 100, height: 40 }
    const size = { w: 30, h: 10 }
    const lines = [line(0, 5, 100, 5), line(0, 20, 100, 20), line(0, 35, 100, 35)]
    expect(placeLabel(size, ringSpots(50, 20, size.w, size.h), plot, lines)).not.toBeNull()
  })
})
