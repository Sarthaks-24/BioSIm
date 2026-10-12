import { describe, expect, it } from 'vitest'
import type { XYZ } from './spline.ts'
import { CALLOUTS, layoutCallouts, type CalloutId, type CalloutInput } from './callouts.ts'

type Box = { x: number; y: number; w: number; h: number }
const overlap = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** Deterministic pseudo-random numbers, so a failure can be replayed. */
function rng(seed: number) {
  let s = seed
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32
}

function expectClean(items: CalloutInput[], width: number, height: number) {
  const { shown, hidden } = layoutCallouts(items, width, height)
  expect(shown.length + hidden.length).toBe(items.length)
  for (const b of shown) {
    expect(b.x).toBeGreaterThanOrEqual(0)
    expect(b.y).toBeGreaterThanOrEqual(0)
    expect(b.x + b.w).toBeLessThanOrEqual(width)
    expect(b.y + b.h).toBeLessThanOrEqual(height)
  }
  for (let i = 0; i < shown.length; i++)
    for (let j = i + 1; j < shown.length; j++) expect(overlap(shown[i]!, shown[j]!), `${shown[i]!.key} × ${shown[j]!.key}`).toBe(false)
  return { shown, hidden }
}

describe('layoutCallouts', () => {
  it('never overlaps two labels and keeps them inside the picture', () => {
    const r = rng(7)
    for (let round = 0; round < 300; round++) {
      const width = 200 + r() * 1200
      const height = 200 + r() * 700
      const items: CalloutInput[] = Array.from({ length: 2 + Math.floor(r() * 6) }, (_, i) => {
        const lx = r() * width
        const ly = r() * height
        return {
          key: `l${i}`,
          ax: lx + (r() - 0.5) * 80,
          ay: ly + (r() - 0.5) * 80,
          lx,
          ly,
          side: r() < 0.5 ? 'left' : 'right',
          w: 40 + r() * 120,
          h: 18 + r() * 8,
          priority: Math.floor(r() * 3),
        }
      })
      expectClean(items, width, height)
    }
  })

  it('places the highest priority label first, where it asked to be', () => {
    const same = { ax: 100, ay: 100, lx: 120, ly: 100, side: 'right' as const, w: 80, h: 20 }
    const { shown } = layoutCallouts(
      [
        { key: 'other', ...same, priority: 1 },
        { key: 'active', ...same, priority: 3 },
      ],
      400,
      400,
    )
    const active = shown.find((b) => b.key === 'active')!
    expect(active).toMatchObject({ x: 120, y: 90 })
    expect(active.leader).toEqual({ x1: 100, y1: 100, x2: 120, y2: 100 })
    expect(shown.find((b) => b.key === 'other')!.y).not.toBe(90)
  })

  it('hides a label rather than overlap it when there is no room', () => {
    const tight = (key: string, priority: number): CalloutInput => ({
      key,
      ax: 10,
      ay: 10,
      lx: 0,
      ly: 10,
      side: 'right',
      w: 90,
      h: 18,
      priority,
    })
    const { shown, hidden } = layoutCallouts([tight('a', 2), tight('b', 1)], 100, 26)
    expect(shown.map((b) => b.key)).toEqual(['a'])
    expect(hidden).toEqual(['b'])
  })

  // The real labels, front-on as the flat diagram (and the 3D camera at rest) shows them, at the
  // widths of a phone, a laptop and a projector, with English and (wider) Hindi text.
  it.each([
    [390, 360],
    [760, 640],
    [830, 680],
  ])('lays out the body labels without overlaps in a %i×%i picture', (width, height) => {
    const scale = Math.min(width / 2.9, height / 5.15)
    const project = (p: XYZ) => [width / 2 + p.x * scale, height / 2 + 0.675 * scale - p.y * scale] as const
    const charPx = { en: 7, hi: 8.5 }
    const names: Record<CalloutId, { en: string; hi: string }> = {
      mouth: { en: 'Mouth', hi: 'मुँह' },
      esophagus: { en: 'Food pipe', hi: 'भोजन नली' },
      stomach: { en: 'Stomach', hi: 'आमाशय' },
      smallIntestine: { en: 'Small intestine', hi: 'छोटी आँत' },
      largeIntestine: { en: 'Large intestine', hi: 'बड़ी आँत' },
      liver: { en: 'Liver', hi: 'यकृत' },
      pancreas: { en: 'Pancreas', hi: 'अग्न्याशय' },
    }
    for (const lang of ['en', 'hi'] as const) {
      const items = (Object.keys(CALLOUTS) as CalloutId[])
        .filter((k) => k !== 'mouth')
        .map((key, i): CalloutInput => {
          const c = CALLOUTS[key]
          const [ax, ay] = project(c.anchor)
          const [lx, ly] = project(c.at)
          return { key, ax, ay, lx, ly, side: c.side, w: 16 + names[key][lang].length * charPx[lang], h: 20, priority: i === 1 ? 3 : 2 }
        })
      const { hidden } = expectClean(items, width, height)
      // Every food-path label fits; only context labels may give way.
      expect(
        hidden.filter((k) => k !== 'liver' && k !== 'pancreas'),
        lang,
      ).toEqual([])
    }
  })
})
