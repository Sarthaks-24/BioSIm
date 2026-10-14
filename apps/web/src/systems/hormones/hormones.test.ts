import { describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { valueAt, type MealItem, type RunResult } from '@lifepeek/engine'
import { CONTROL_SIGNALS, PACK_PARAMS, simulate } from '@lifepeek/engine/run'
import en from '../../i18n/en.json'
import { lookupFood } from '../../data/foods.ts'
import { FRAMINGS } from '../../anatomy/human/base.ts'
import { LIVER_OUTLINE as GUT_LIVER, PANCREAS, STOMACH, stomachFillRadius } from '../../anatomy/human/digestion.ts'
import { Vec3 } from '../../anatomy/spline.ts'
import { PARTICLE_EDGE, SKIN_LINE } from '../../anatomy/tones/base.ts'
import { ORGAN_TONE } from '../../anatomy/tones/digestion.ts'
import { HORMONE_TONE } from '../../anatomy/tones/hormones.ts'
import { INSULIN_PATH, LIVER_OUTLINE, PANCREAS_LINE, STOMACH_OUTLINE, along, pancreasOutline } from '../../anatomy/human/hormones.ts'
import { FLAT_LOOK } from '../../flat/look.ts'
import { levelGate } from '../../flat/drives.ts'
import { formatSignal } from '../../lib/formatSignal.ts'
import { DIGESTION } from '../digestion/def.ts'
import { HORMONES } from './row.ts'
import { HORMONES_LESSON } from './lesson.ts'
import { BRAIN_G_PER_H, DOT_BOUNDS, DOT_STEP, dotsOf } from './insulin.ts'
import {
  BRAIN,
  GLUCOSE,
  INSULIN,
  INSULIN_PEAK,
  RISE_X,
  backMin,
  hormonesStripSummary,
  hormonesSummary,
  momentAt,
  seriesOf,
  valueText,
} from './summary.ts'

// The flat body's frame, without its drawing code's page APIs (FlatBody imports the stage).
vi.mock('../../i18n/index.ts', () => ({ localized: () => '' }))
const { frame } = await import('../../flat/FlatBody.tsx')
const { DOT_EDGE, GHOST_LINE, LOOK, frameOf, pancreasLine } = await import('./drawing.tsx')
const UIS = (await import('./ui.tsx')).default
const { DEFS } = await import('./ui.tsx')

/** English text at a key, filled like i18next ({{x}}). */
const t = ((key: string, vars: Record<string, unknown> = {}) => {
  const text = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)
  return typeof text === 'string' ? text.replace(/{{(\w+)}}/g, (_, v: string) => String(vars[v])) : key
}) as unknown as TFunction

const one = (foodId: string, servings = 1): MealItem[] => [{ foodId, servings }]
const run = (items: MealItem[]): RunResult => simulate({ items }, { lookup: lookupFood, particles: 0 })
const at = (r: RunResult, id: string, min: number) => valueAt(seriesOf(r, id)!, min, r.stepMin)
const values = (r: RunResult, id: string) => [...seriesOf(r, id)!.values]
/** The numbers a sentence says, in order (decimals kept: "7.3"). */
const numbers = (s: string) => [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))

const water = run(one('water'))
const cola = run(one('cola'))
const egg = run(one('egg'))
const roti = run(one('roti'))

describe('water only: insulin exactly 1×, no moment, no dots (S-6 acceptance, anatomy plan §8)', () => {
  it('every minute of the 48 h is exactly 1, its band too, and there is no most-insulin moment', () => {
    for (const r of [water, run([])]) {
      expect(values(r, INSULIN).every((v) => v === 1)).toBe(true)
      expect(momentAt(r, INSULIN_PEAK)).toBeNull()
    }
  })

  it('the picture draws no dots for it, at any minute, however the clock is dragged', () => {
    const gate = levelGate(DOT_BOUNDS, 1000, DOT_STEP)
    let now = 0
    for (let min = 0; min <= 2880; min += 7) expect(dotsOf(gate(at(water, INSULIN, min), (now += 16)))).toBe(0)
  })

  it('protein alone (an egg) leaves it at 1× too: only sugar from food raises insulin here (R91, a known limit)', () => {
    expect(values(egg, INSULIN).every((v) => v === 1)).toBe(true)
    expect(en.limits.insulinSugarOnly).toContain('egg leaves it at 1×')
  })

  it('a meal with sugar draws dots, more as insulin rises, at most 10, changing at most once a second', () => {
    const gate = levelGate(DOT_BOUNDS, 1000, DOT_STEP)
    const peak = momentAt(cola, INSULIN_PEAK)!
    expect(dotsOf(gate(at(cola, INSULIN, peak), 0))).toBeGreaterThan(0)
    expect(dotsOf(DOT_BOUNDS.length)).toBe(10)
    // Dragged across the whole rise in one real second: the count moves once at most.
    const seen = new Set<number>()
    for (let min = 0; min <= peak; min++) seen.add(gate(at(cola, INSULIN, min), 2000 + min))
    expect(seen.size).toBeLessThanOrEqual(2)
  })
})

describe('blood sugar is Digestion’s own line, unchanged (open loop, E1; seal guard: engine test/seal.test.ts)', () => {
  it('the Blood sugar graph shows blood.glucose, the same signal Digestion graphs', () => {
    const [sugar, insulin] = DEFS.hormones.slots!
    expect(sugar!.signals).toEqual([GLUCOSE])
    expect(DIGESTION.slots.find((s) => s.id === 'blood')!.signals).toEqual([GLUCOSE])
    expect(insulin!.signals).toEqual([INSULIN])
    expect(insulin!.unit).toBe('xFasting')
  })

  it('insulin never feeds back: blood sugar is the same with and without the control pack’s rows asked for', () => {
    // A run is one model; blood sugar after cola peaks where v3.0 put it (the lesson "One cola or four" checks 121 mg/dL).
    expect(Math.round(Math.max(...values(cola, GLUCOSE)))).toBe(121)
    expect(values(water, GLUCOSE).every((v) => v === values(water, GLUCOSE)[0])).toBe(true)
  })
})

describe('insulin as × before eating, with its band, never µU/mL', () => {
  it('the row: × before eating, a band (Takahashi 2018), the moment found on it', () => {
    const row = CONTROL_SIGNALS['blood.insulin']
    expect(row.unit).toBe('xFasting')
    expect(row.band?.sourceIds).toEqual(['takahashi2018'])
    const s = seriesOf(cola, INSULIN)!
    const peak = momentAt(cola, INSULIN_PEAK)!
    expect(s.low).toBeDefined()
    expect(s.high).toBeDefined()
    const i = Math.round(peak / cola.stepMin)
    expect(s.low![i]).toBeLessThan(s.values[i]!)
    expect(s.high![i]).toBeGreaterThan(s.values[i]!)
    // Water's band is 1× too: nobody's insulin rises with water.
    const w = seriesOf(water, INSULIN)!
    expect([...w.low!, ...w.high!].every((v) => v === 1)).toBe(true)
  })

  it('written as the stage writes it: "7.3× before eating"', () => {
    const meta = seriesOf(cola, INSULIN)!.meta
    for (const v of [1, 4.96, 7.32, 12.04]) expect(valueText(v, meta, t, 'en')).toBe(formatSignal(v, meta, t, 'en'))
    expect(valueText(7.32, meta, t, 'en')).toBe('7.3× before eating')
    expect(valueText(1, meta, t, 'en')).toBe('1× before eating')
  })

  it('no English text says µU/mL, pmol or mU (content-i18n §6: never a lab unit on screen)', () => {
    expect(JSON.stringify(en)).not.toMatch(/µU|μU|uU\/mL|pmol|mU\/L/)
  })
})

describe('the brain card: about 4.4 g an hour, the same all day (Mergenthaler 2013, Cahill & Owen 1968)', () => {
  it('the card, the limit and the worksheet say the engine’s number, and it never moves with a meal', () => {
    expect(BRAIN_G_PER_H).toBe(PACK_PARAMS.brain.glucoseGPerH)
    for (const r of [water, cola, egg, roti]) expect(values(r, BRAIN).every((v) => Math.abs(v - BRAIN_G_PER_H) < 1e-6)).toBe(true)
    for (const text of [en.sys.control.brain.value, en.limits.brainGlucoseConstant, en.sheet.lessons.insulinCola.tasks[2]!.k!])
      expect(numbers(text)[0], text).toBe(BRAIN_G_PER_H)
    // 4.4 g an hour is 106 g a day, inside Cahill & Owen's 100–145.
    expect(numbers(en.limits.brainGlucoseConstant).slice(0, 4)).toEqual([4.4, Math.round(BRAIN_G_PER_H * 24), 100, 145])
    expect(en.sys.control.brain.value).toContain('about the same all day')
    expect(en.sys.control.brain.back).toBe('The liver supplies it even if you eat no sugar.')
  })
})

describe('the words are the model’s numbers (ui-ux §6, §7)', () => {
  it('cola: the most insulin, when, and when it is back near 1×', () => {
    const s = hormonesSummary(cola, null, t, 'en')!
    const peak = momentAt(cola, INSULIN_PEAK)!
    const most = Math.max(...values(cola, INSULIN))
    expect(s.key?.text).toBe((Math.round(most * 10) / 10).toString())
    expect(s.headline).toBe(t('sys.control.summary.peak', { n: s.key!.text, time: `${Math.round(peak / 5) * 5} min` }))
    const back = backMin(seriesOf(cola, INSULIN)!, cola.stepMin, peak)!
    expect(at(cola, INSULIN, back)).toBeLessThan(RISE_X)
    expect(at(cola, INSULIN, back - 1)).toBeGreaterThanOrEqual(RISE_X)
    expect(s.reason).toContain('back near the before-eating level')
  })

  it('water: stays at 1×, and why', () => {
    const s = hormonesSummary(water, null, t, 'en')!
    expect(s.headline).toBe(en.sys.control.summary.flat)
    expect(s.key).toBeUndefined()
    expect(hormonesStripSummary(INSULIN as never, water, t, 'en')).toBe('Insulin: about 1× before eating all the way.')
  })

  it('beside a kept plan: the most of each; about the same when they are', () => {
    const s = hormonesSummary(cola, water, t, 'en')!
    expect(numbers(s.headline)).toEqual([Math.round(Math.max(...values(cola, INSULIN)) * 10) / 10, 1])
    expect(hormonesSummary(cola, cola, t, 'en')!.headline).toContain('about the same in both')
  })

  it('a graph’s sentence: from its start to its highest, and when', () => {
    const peak = momentAt(cola, INSULIN_PEAK)!
    expect(hormonesStripSummary(INSULIN as never, cola, t, 'en')).toBe(
      `Insulin: 1× before eating at the start, ${(Math.round(Math.max(...values(cola, INSULIN)) * 10) / 10).toString()}× before eating at the most, at ${Math.round(peak / 5) * 5} min.`,
    )
  })

  it('its one moment is the most insulin, none for water', () => {
    expect(UIS.hormones.moments(cola)).toEqual([{ id: INSULIN_PEAK, atMin: momentAt(cola, INSULIN_PEAK) }])
    expect(UIS.hormones.moments(water)).toEqual([])
  })

  it('a big solid meal’s insulin is still raised at 8 h (slow emptying, R91): the limit says so', () => {
    const burger = run([...one('cheeseburger'), ...one('fries')])
    expect(at(burger, INSULIN, 480)).toBeGreaterThan(2)
    expect(en.limits.insulinHigh).toContain('stays raised for hours')
    // The 2-hour figure is about the lab test, said as such, with its study (V-6: Takahashi 2018, 62 young women, 5.8× at 120 min; R120 #8).
    expect(en.limits.insulinHigh).toMatch(/75 g glucose drink \(the lab sugar test, not one of the app’s foods\)/)
    expect(en.limits.insulinHigh).toMatch(/young women measured about 6×: Takahashi 2018/)
  })
})

describe('the words never score, never dose (content-i18n §6)', () => {
  it('"not an injection guide" is the caption under the insulin graph, word for word', () => {
    expect(en.sys.control.notGuide).toBe('This insulin is for a body that makes its own; it is not an injection guide.')
  })

  it('exactly one diabetes line, in the limits', () => {
    const hits = JSON.stringify(en).match(/diabetes/gi) ?? []
    const all = (o: unknown, path = ''): [string, string][] =>
      typeof o === 'string' ? [[path, o]] : o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => all(v, `${path}.${k}`)) : []
    const control = all(en).filter(([p, s]) => /diabetes/i.test(s) && /(control|insulin|limits\.insulin)/i.test(p))
    expect(control.map(([p]) => p)).toEqual(['.limits.insulinHealthy'])
    expect(hits.length).toBeGreaterThan(0)
  })

  it('the other hormones are Drawing only: no numbers in their cards', () => {
    for (const key of ['adrenaline', 'thyroxin', 'growth', 'hunger'] as const) {
      const card = en.sys.control.others[key]
      expect(numbers(`${card.name} ${card.text}`), key).toEqual([])
    }
  })
})

describe('the pack’s own copies of the catalog’s names (systems/hormones/text.ts)', () => {
  it('sys.control.sig.* say what signals.* say', () => {
    expect(en.sys.control.sig.insulin.name).toBe(en.signals.blood.insulin.name)
    expect(en.sys.control.sig.insulin.short).toBe(en.signals.blood.insulin.short)
    expect(en.sys.control.sig.insulinPeak.name).toBe(en.signals.event.insulinPeak.name)
  })
})

describe('the lesson (R18): cola against water, opened at the most insulin', () => {
  it('v3.1, on the insulin graph, at the cola’s insulin peak; water stays at 1×', () => {
    expect(HORMONES_LESSON.release).toBe('v3.1')
    expect(HORMONES_LESSON.layer).toBe('hormones')
    expect(HORMONES_LESSON.slot).toBe('insulin')
    expect(HORMONES_LESSON.t).toBe(Math.round(momentAt(run(HORMONES_LESSON.meal), INSULIN_PEAK)!))
    expect(values(run(HORMONES_LESSON.kept), INSULIN).every((v) => v === 1)).toBe(true)
  })
})

describe('what the pack writes out matches the stage and Digestion’s anatomy', () => {
  it('the frame, the outline look, the ghost line and the dots’ edge', () => {
    for (const [w, h] of <[number, number][]>[
      [360, 170],
      [800, 600],
    ]) {
      const a = frameOf(w, h, FRAMINGS.upper)
      const b = frame(w, h, FRAMINGS.upper)
      for (const p of [-1.2, 0, 0.7]) {
        expect(a.X(p)).toBeCloseTo(b.X(p), 6)
        expect(a.Y(p)).toBeCloseTo(b.Y(p), 6)
      }
    }
    expect(LOOK.normal).toEqual({ ink: FLAT_LOOK.normal.ink, line: FLAT_LOOK.normal.line })
    expect(LOOK.projector).toEqual({ ink: FLAT_LOOK.projector.ink, line: FLAT_LOOK.projector.line })
    expect(GHOST_LINE).toBe(SKIN_LINE)
    expect(DOT_EDGE).toBe(PARTICLE_EDGE)
    expect(pancreasLine(LOOK.projector)).toBe(3)
  })

  it('the liver and the pancreas’s colours are Digestion’s', () => {
    expect(LIVER_OUTLINE).toEqual(GUT_LIVER)
    expect(HORMONE_TONE.liver).toBe(ORGAN_TONE.liver)
    expect(HORMONE_TONE.pancreas).toBe(ORGAN_TONE.pancreas)
  })

  it('the pancreas lies along Digestion’s, and the stomach’s outline round Digestion’s stomach', () => {
    const p = new Vec3()
    PANCREAS_LINE.forEach(([x, y], i) => {
      PANCREAS.getPointAt(i / (PANCREAS_LINE.length - 1), p)
      expect(Math.hypot(x - p.x, y - p.y)).toBeLessThan(0.01)
    })
    // Every outline point is about a stretched radius from the stomach's centre line.
    for (const [x, y] of STOMACH_OUTLINE) {
      let best = Infinity
      for (let u = 0; u <= 1; u += 0.005) {
        STOMACH.getPointAt(u, p)
        best = Math.min(best, Math.abs(Math.hypot(x - p.x, y - p.y) - stomachFillRadius(u, 0.25)))
      }
      expect(best).toBeLessThan(0.02)
    }
    expect(pancreasOutline()).toHaveLength(2 * PANCREAS_LINE.length)
  })

  it('the dots’ path starts on the pancreas and ends in the liver', () => {
    const [x0, y0] = along(INSULIN_PATH, 0)
    const inside = (pts: readonly (readonly [number, number])[], x: number, y: number) => {
      let c = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!
        const [xj, yj] = pts[j]!
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
      }
      return c
    }
    expect(inside(pancreasOutline(), x0, y0)).toBe(true)
    const [x1, y1] = along(INSULIN_PATH, 1)
    expect(inside(LIVER_OUTLINE, x1, y1)).toBe(true)
  })

  it('its row: the control pack, the upper framing, 0–12 h, public (U-6 acceptance)', () => {
    expect([HORMONES.pack, HORMONES.camera.framing, HORMONES.graphWindowMin, HORMONES.public]).toEqual(['control', 'upper', 720, true])
  })
})

describe('the other hormones’ lines follow their source (R120 #20)', () => {
  it('ghrelin as OpenStax A&P 2e Table 23.6 has it: made by the stomach when fasting, rising just before meals, acting on the brain for hunger', () => {
    // Table 23.6: "Stomach mucosa, mainly fundus"; "Fasting state (levels increase just prior to meals)";
    // target "Hypothalamus"; "Regulates food intake, primarily by stimulating hunger and satiety".
    const hunger = en.sys.control.others.hunger
    expect(hunger.source).toBe('OpenStax Anatomy and Physiology 2e, §23.4, Table 23.6')
    expect(hunger.text).toBe('Made by the stomach while fasting; it rises just before meals and acts on the brain to make us feel hungry.')
  })
})
