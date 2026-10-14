import { describe, expect, it, vi } from 'vitest'
import { decodeShareState, encodeShareState } from '@lifepeek/engine'
import { CONTROL_SIGNALS, simulate } from '@lifepeek/engine/run'
import { NERVE_SOURCES, brainRoute, reflexTime } from '@lifepeek/engine/demo'
import en from '../../i18n/en.json'
import { lookupFood } from '../../data/foods.ts'
import { FRAMINGS } from '../../anatomy/human/base.ts'
import { LABELS } from '../../anatomy/human/nerves.ts'
import { FLAT_LOOK } from '../../flat/look.ts'
import { SYSTEM_SOURCES } from '../../lib/systemSources.ts'
import { REFERENCES } from '../../lib/references.ts'
import { PACKS } from '../packs.ts'
import { PACK_OF, systemOf } from '../registry.ts'
import { AT, PLAY_MS, along, counterMs, race, signalAt, steps } from './demo.ts'
import { NERVES_LESSON } from './lesson.ts'
import { NERVES } from './row.ts'

// The flat body's frame, without its drawing code's page APIs (FlatBody imports the stage).
vi.mock('../../i18n/index.ts', () => ({ localized: () => '' }))
const { frame } = await import('../../flat/FlatBody.tsx')
const { LOOK, cordLine, frameOf } = await import('./drawing.tsx')
const { DEMO_SOURCES } = await import('./NerveDemo.tsx')
const { brainSugar } = await import('./ui.tsx')

/** English text at a dotted key. */
const text = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)

describe('the nerve demo’s numbers are the engine’s (U-7; model §2.6, R92)', () => {
  const usual = race(false)
  const slow = race(true)

  it('each counter ends on reflexTime, to the whole ms (± 1 ms), and never runs past it', () => {
    for (const r of [usual, slow]) {
      const myelin = r === slow ? 0 : 1
      expect(r.reflex).toEqual(reflexTime('hotPan', { myelin }))
      expect(r.brain).toEqual(brainRoute('hotPan', { myelin }))
      for (const timing of [r.reflex, r.brain]) {
        expect(Math.abs(counterMs(timing, timing.totalMs) - timing.totalMs)).toBeLessThanOrEqual(1)
        expect(counterMs(timing, timing.totalMs + 500)).toBe(counterMs(timing, timing.totalMs))
        expect(counterMs(timing, -5)).toBe(0)
      }
    }
    // V-7's worked values: 64.31 ms and 214.31 ms with myelin; 882.63 ms without.
    expect(counterMs(usual.reflex, Infinity)).toBe(64)
    expect(counterMs(usual.brain, Infinity)).toBe(214)
    expect(counterMs(slow.reflex, Infinity)).toBe(883)
  })

  it('the brain route takes at least three times as long (R92: sourced 3.3×), so the words say "about three times"', () => {
    const k = usual.brain.totalMs / usual.reflex.totalMs
    expect(k).toBeGreaterThanOrEqual(3)
    expect(Math.round(k)).toBe(3)
    expect(text('sys.control.nerves.demo.result')).toContain('about three times as long')
  })

  it('with myelin off (thin fibres) the reflex is far slower, more than ten times', () => {
    expect(slow.reflex.totalMs / usual.reflex.totalMs).toBeGreaterThan(10)
    expect(slow.brain.totalMs).toBeGreaterThan(usual.brain.totalMs * 4)
  })

  it('the longer route plays over 5–10 s on screen (model §2.6), the same slow-down for both routes', () => {
    expect(PLAY_MS).toBeGreaterThanOrEqual(5000)
    expect(PLAY_MS).toBeLessThanOrEqual(10000)
    for (const r of [usual, slow]) expect(Math.max(r.reflex.totalMs, r.brain.totalMs) * r.slow).toBeCloseTo(PLAY_MS, 6)
  })

  it('with motion reduced: four still frames in time order, ending on each route at the muscle (anatomy plan §4)', () => {
    for (const r of [usual, slow]) {
      const s = steps(r)
      expect(s.map((f) => f.key)).toEqual(['start', 'cord', 'reflex', 'brain'])
      expect(s.map((f) => f.t)).toEqual([...s.map((f) => f.t)].sort((a, b) => a - b))
      expect(s[2]!.t).toBe(r.reflex.totalMs)
      expect(s[3]!.t).toBe(r.brain.totalMs)
      expect(s[1]!.t).toBeCloseTo(r.reflex.inMs, 9)
    }
  })

  it('the signals start at the fingertip, take their own paths, and end at the arm muscle', () => {
    for (const timing of [usual.reflex, usual.brain]) {
      expect(signalAt(timing, 0)).toEqual(AT.receptor)
      expect(signalAt(timing, timing.totalMs)).toEqual(AT.muscle)
      expect(signalAt(timing, timing.inMs)).toEqual(AT.cordIn)
    }
    // Half-way through its thinking, the brain route's signal is in the brain; the reflex is already at the muscle.
    const thinking = usual.reflex.inMs + usual.reflex.synapseMs + usual.brain.thinkingMs / 2
    expect(signalAt(usual.brain, thinking)).toEqual(AT.brain)
    expect(signalAt(usual.reflex, thinking)).toEqual(AT.muscle)
    expect(
      along(
        {
          pts: [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
        },
        0.75,
      ),
    ).toEqual([10, 5])
    expect(
      along(
        {
          pts: [
            [0, 0],
            [10, 0],
            [10, 10],
          ],
          weights: [0.5, 0.5],
        },
        0.25,
      ),
    ).toEqual([5, 0])
  })
})

describe('Brain & nerves’ row, pack and lesson (U-7)', () => {
  it('a demo row in the control pack: no graphs, a Model estimate tag, the upper framing, public (acceptance passed)', () => {
    expect(systemOf('nerves')).toBe(NERVES)
    expect(NERVES).toMatchObject({
      pack: 'control',
      slots: [],
      tag: 'assumption',
      draw: 'layer',
      camera: { framing: 'upper' },
      public: true,
    })
    expect(PACK_OF.nerves).toBe('control')
  })

  it('its pack brings the control rows, its UI with the demo card, its drawing and its English', async () => {
    const pack = PACKS.control!
    const rows = (await pack.rows()).default.map((r) => r.id)
    expect(rows).toContain('brain.glucoseUse')
    const ui = (await pack.ui!()).default.nerves!
    expect(ui.card).toBeTypeOf('function')
    expect(ui.moments(null as never)).toEqual([])
    expect((await pack.drawing!()).default.nerves).toBeTypeOf('function')
    const section = (await pack.text!()).default as { sys?: { control?: { nerves?: Record<string, unknown> } } }
    expect(section.sys?.control?.nerves?.demo).toBeTruthy()
  })

  it('the Now line’s brain sugar is the run’s brain.glucoseUse: about 4.4 g an hour for any meal', () => {
    for (const items of [[], [{ foodId: 'roti', servings: 1 }], [{ foodId: 'cola', servings: 4 }]]) {
      const run = simulate({ items, activity: [] }, { lookup: lookupFood, particles: 0 })
      expect(brainSugar(run)).toBe('4.4')
    }
  })

  it('the frame and the outline look are the flat body’s; the pale cord gets a 3 px outline on the projector', () => {
    for (const [w, h] of <[number, number][]>[
      [360, 170],
      [800, 600],
    ]) {
      const a = frameOf(w, h, FRAMINGS.upper)
      const b = frame(w, h, FRAMINGS.upper)
      for (const p of [-0.8, 0, 2.9]) {
        expect(a.X(p)).toBeCloseTo(b.X(p), 6)
        expect(a.Y(p)).toBeCloseTo(b.Y(p), 6)
      }
    }
    expect(LOOK.normal).toEqual({ ink: FLAT_LOOK.normal.ink, line: FLAT_LOOK.normal.line })
    expect(LOOK.projector).toEqual({ ink: FLAT_LOOK.projector.ink, line: FLAT_LOOK.projector.line })
    expect(cordLine(LOOK.projector)).toBe(3)
    expect(Object.keys(LABELS).slice(0, 3)).toEqual(['brain', 'cord', 'nerves'])
  })

  it('its sources: the brain sugar row’s, then the demo’s read pages (V-7), each in the Science reference list', () => {
    expect(SYSTEM_SOURCES.nerves).toEqual([...CONTROL_SIGNALS['brain.glucoseUse'].sourceIds, ...DEMO_SOURCES])
    const ids = new Set(REFERENCES.map((r) => r.id))
    for (const id of DEMO_SOURCES) {
      expect(ids.has(id), id).toBe(true)
      expect(NERVE_SOURCES[id].url).toMatch(/^https:\/\//)
    }
    // The knee tap is out (R92): its source is not shown.
    expect(DEMO_SOURCES).not.toContain('khatun2024')
  })

  it('its words: "Beyond class 10" on the what-if, the book line as read, no unread number', () => {
    const demo = en.sys.control.nerves.demo
    expect(demo.beyond).toBe('Beyond class 10')
    expect(demo.myelin).toBe('Myelin off (thin fibres)')
    expect(demo.book).toContain('NCERT Class 10, Ch 6, p. 102')
    expect(demo.book).toContain('the thinking process of the brain is not fast enough')
    expect(JSON.stringify(en.sys.control)).not.toMatch(/TO VERIFY|knee/i)
    // The plan's unread 250 ms thinking time never shows (V-7 decide 2).
    expect(JSON.stringify(en.sys.control)).not.toContain('250')
  })

  it('the lesson stub: v3.1, opens Brain & nerves on the demo with a roti; its title and question are in the English', () => {
    expect(NERVES_LESSON).toMatchObject({ key: 'reflexHotPan', release: 'v3.1', layer: 'nerves', slot: 'demo' })
    expect(text(NERVES_LESSON.title)).toBe('Why do you pull your hand back before you feel the pain?')
    expect(text(NERVES_LESSON.question)).toBeTruthy()
    const l = NERVES_LESSON
    const s = decodeShareState(
      new URLSearchParams(encodeShareState({ a: l.meal, b: l.kept, t: l.t, layer: l.layer, act: l.activity, bact: l.keptActivity })),
    )
    expect(s.layer).toBe('nerves')
    expect(s.a).toEqual(NERVES_LESSON.meal)
  })
})
