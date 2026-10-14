import fs from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { simulate } from '@lifepeek/engine/run'
import { ACTIVITY_BANDS } from '../anatomy/human/bands.ts'
import { FILL_SIGNAL, gramsIn } from '../anatomy/bodyState.ts'
import { HUMAN_ORGANS } from '../registry/human/organs.ts'
import { drivenAt, levelGate } from './drives.ts'
import { LIMB_KIT } from '../anatomy/human/kit.ts'
import { figure, takeKit } from './limbs.ts'
import { limbsFor, loadLimbs } from './registry.ts'
import { LAZY_PACKS, loadPack, packDrawing, type PackDef } from '../systems/load.ts'
import { poseSvg } from './restingBody.ts'
import { MAX_DRAWN_HZ, STILL_PHASE, drawnRate, rhythmLayer, rhythmScale } from './rhythm.ts'

takeKit(LIMB_KIT)

const src = (file: string) => fs.readFileSync(new URL(file, import.meta.url), 'utf8')

describe('the flat registry loads on demand (R71, R74)', () => {
  it("a system's drawing loads with its pack, the first time the system is lit, once; a failed load is tried again", async () => {
    const layer = () => null
    const drawing = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ default: { breathing: layer } })
    const packs = LAZY_PACKS as Record<string, PackDef>
    packs.breathing = { rows: async () => ({ default: [] }), drawing }
    try {
      expect(drawing).not.toHaveBeenCalled()
      expect(packDrawing('breathing')).toBeUndefined()
      await expect(loadPack('breathing')).rejects.toThrow('offline')
      await loadPack('breathing')
      expect(packDrawing('breathing')).toBe(layer)
      expect(loadPack('breathing')).toBeNull()
      expect(drawing).toHaveBeenCalledTimes(2)
    } finally {
      delete packs.breathing
    }
  })

  it('the legs and poses load only when a picture shows them; Digestion at rest never does', async () => {
    expect(limbsFor('torso', 'rest')).toBe(false)
    expect(limbsFor('chest', 'rest')).toBe(false)
    expect(limbsFor('full', 'rest')).toBe(true)
    expect(limbsFor('torso', 'run')).toBe(true)
    expect((await loadLimbs()).paintFigure).toBeTypeOf('function')
    // No static import of the legs or of any system's drawing from the stage's flat body.
    const body = src('./FlatBody.tsx')
    expect(body).not.toMatch(/from '\.\/limbs\.ts'/)
    expect(body).not.toMatch(/from '\.\.\/systems\/\w+\/(?!def)/)
    expect(src('./registry.ts')).toMatch(/import\('\.\/limbs\.ts'\)/)
  })
})

describe('the four still poses, drawn (R4, R16, R32)', () => {
  it('each band draws a whole body, and no two bands draw the same one', () => {
    const svgs = ACTIVITY_BANDS.map((b) => poseSvg(b))
    for (const svg of svgs) {
      expect(svg).toMatch(/^<svg /)
      expect(svg).not.toMatch(/NaN|Infinity/)
    }
    expect(new Set(svgs).size).toBe(4)
  })

  it('at rest the arms hang beside the body; a brisk walk and a run bend one over the belly', () => {
    expect(figure('rest').over).toHaveLength(0)
    expect(figure('rest').under).toHaveLength(2)
    for (const band of ['walkBrisk', 'run'] as const) expect(figure(band).over.length, band).toBeGreaterThan(0)
  })
})

describe('data → picture only through drives (anatomy plan D4)', () => {
  const sim = simulate({ items: [] }, { lookup: () => undefined, particles: 0 })

  it("reads an organ's driven signals at the minute on screen", () => {
    const stomach = HUMAN_ORGANS.find((o) => o.id === 'stomach')!
    expect(Object.keys(drivenAt(sim, stomach, 30))).toEqual(['fill'])
    expect(drivenAt(sim, stomach, 30).fill).toBe(gramsIn(sim, 'stomach', 30))
    expect(FILL_SIGNAL.stomach).toBe(stomach.drives!.fill)
    expect(
      drivenAt(
        sim,
        HUMAN_ORGANS.find((o) => o.id === 'liver')!,
        30,
      ),
    ).toEqual({})
  })

  it('a level step changes only half a step past its boundary, and at most once a real second', () => {
    const gate = levelGate([10, 20, 30])
    expect(gate(15, 0)).toBe(1)
    // Hovering just over the boundary (20) does not flip it; half a step past (25) does.
    expect(gate(21, 2000)).toBe(1)
    expect(gate(24.9, 4000)).toBe(1)
    expect(gate(25, 6000)).toBe(2)
    // Back under 20 is not enough: half a step (15) below is.
    expect(gate(19, 8000)).toBe(2)
    expect(gate(14, 10_000)).toBe(1)
    // A scrub across every step inside one real second changes the picture once.
    const shown = [0, 100, 200, 300, 400].map((ms, i) => gate([40, 0, 40, 0, 40][i]!, 11_000 + ms))
    expect(new Set(shown).size).toBeLessThanOrEqual(2)
  })
})

describe('the rhythm layer (flash safety, WCAG 2.3.1)', () => {
  it('draws at most 2.5 Hz and says when it slowed', () => {
    expect(drawnRate(15)).toEqual({ hz: 0.25, slowed: false })
    expect(drawnRate(150)).toEqual({ hz: MAX_DRAWN_HZ, slowed: false })
    expect(drawnRate(162)).toEqual({ hz: MAX_DRAWN_HZ, slowed: true })
  })

  it('changes size only, through one CSS transform, written only when it changes; reduced motion is the mid-phase still', () => {
    expect(rhythmScale(0, 0.1)).toBe(1)
    expect(rhythmScale(0.5, 0.1)).toBeCloseTo(1.1, 10)
    const style = { transform: '', transformOrigin: '', willChange: '' }
    const writes: string[] = []
    const el = {
      style: new Proxy(style, {
        set(t, k, v) {
          if (k === 'transform') writes.push(v)
          return Reflect.set(t, k, v)
        },
      }),
    }
    const layer = rhythmLayer(el, [10, 20], 0.1)
    expect(style.willChange).toBe('transform')
    expect(style.transformOrigin).toBe('10px 20px')
    layer.set(0.25)
    layer.set(0.25)
    layer.set(0.2501)
    expect(writes).toEqual(['scale(1.050)'])
    layer.still()
    expect(writes.at(-1)).toBe(`scale(${rhythmScale(STILL_PHASE, 0.1).toFixed(3)})`)
    expect(Object.keys(style).sort()).toEqual(['transform', 'transformOrigin', 'willChange'])
  })
})
