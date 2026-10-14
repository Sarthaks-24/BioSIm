import { describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { valueAt, type ActivityBout, type MealItem, type RunResult } from '@lifepeek/engine'
import { HUMAN_MODEL, simulate } from '@lifepeek/engine/run'
import KIDNEY_ROWS, { KIDNEY_EVENT_IDS } from '@lifepeek/engine/catalog/kidneys'
import en from '../../i18n/en.json'
import { lookupFood } from '../../data/foods.ts'
import { FRAMINGS } from '../../anatomy/human/base.ts'
import { RIBS as SKELETON_RIBS } from '../../anatomy/human/skeleton.ts'
import { BLADDER_MAX_ML, LABELS, RIBS, bladderRadius, kidneyOutline } from '../../anatomy/human/kidneys.ts'
import { SKIN_LINE } from '../../anatomy/tones/base.ts'
import { KIDNEY_TONE } from '../../anatomy/tones/kidneys.ts'
import { FLAT_LOOK } from '../../flat/look.ts'
import { levelGate } from '../../flat/drives.ts'
import { formatSignal } from '../../lib/formatSignal.ts'
import { KIDNEYS_LESSON } from './lesson.ts'
import { kidneysStripSummary, kidneysSummary, valueText } from './summary.ts'
import {
  BACKGROUND_ML_PER_H,
  BLADDER_BOUNDS,
  EMPTIES_ML,
  FILTER_ML_PER_MIN,
  URGE_ML,
  backgroundOf,
  momentAt,
  seriesOf,
  stepMl,
  ureterSpeed,
} from './water.ts'

// The flat body's frame, without its drawing code's page APIs (FlatBody imports the stage).
vi.mock('../../i18n/index.ts', () => ({ localized: () => '' }))
const { frame } = await import('../../flat/FlatBody.tsx')
const { LOOK, RIB_LINE, bladderLine, frameOf } = await import('./drawing.tsx')
const UIS = (await import('./ui.tsx')).default

/** English text at a key, filled like i18next ({{x}}). */
const t = ((key: string, vars: Record<string, unknown> = {}) => {
  const text = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)
  return typeof text === 'string' ? text.replace(/{{(\w+)}}/g, (_, v: string) => String(vars[v])) : key
}) as unknown as TFunction

const water = (servings: number): MealItem[] => [{ foodId: 'water', servings }]
const run = (items: MealItem[], activity: ActivityBout[] = []): RunResult =>
  simulate({ items, activity }, { lookup: lookupFood, particles: 0 })
const at = (r: RunResult, id: string, min: number) => valueAt(seriesOf(r, id)!, min, r.stepMin)
const runBout: ActivityBout = { kind: 'run', startMin: 30, durMin: 60 }
const walk: ActivityBout = { kind: 'walk', startMin: 30, durMin: 20 }

describe('what the pack writes out matches the model and the stage', () => {
  it('a steady day, the bladder’s urge and emptying, and the filtering are the engine’s numbers', () => {
    const w = HUMAN_MODEL.params.water
    expect(BACKGROUND_ML_PER_H).toBe(w.backgroundUrineMlPerDay / 24)
    expect(URGE_ML).toBe(w.bladderUrgeMl)
    expect(EMPTIES_ML).toBe(w.bladderEmptyMl)
    expect(FILTER_ML_PER_MIN).toBe(w.filtrationMlPerMin)
    // A run with no meal and no activity makes exactly a steady day's urine.
    expect(at(run([]), 'kidney.urineRate', 600)).toBeCloseTo(BACKGROUND_ML_PER_H, 6)
  })

  it('the frame, the outline look and the rib colour', () => {
    for (const [w, h] of <[number, number][]>[
      [360, 170],
      [800, 600],
    ]) {
      const a = frameOf(w, h, FRAMINGS.torso)
      const b = frame(w, h, FRAMINGS.torso)
      for (const p of [-1.2, 0, 0.7]) {
        expect(a.X(p)).toBeCloseTo(b.X(p), 6)
        expect(a.Y(p)).toBeCloseTo(b.Y(p), 6)
      }
    }
    expect(LOOK.normal).toEqual({ ink: FLAT_LOOK.normal.ink, line: FLAT_LOOK.normal.line })
    expect(LOOK.projector).toEqual({ ink: FLAT_LOOK.projector.ink, line: FLAT_LOOK.projector.line })
    expect(RIB_LINE).toBe(SKIN_LINE)
  })

  it('the low ribs are the skeleton’s last four rows, and the right kidney sits lower than the left', () => {
    expect(RIBS).toHaveLength(4)
    expect(SKELETON_RIBS).toHaveLength(12)
    const top = (side: 1 | -1) => Math.max(...kidneyOutline(side).map(([, y]) => y))
    expect(top(-1)).toBeLessThan(top(1))
    // Only the kidneys' upper parts are behind the ribs: the lowest rib (≈ 0.36 at the side) crosses them.
    for (const side of [1, -1] as const) {
      const ys = kidneyOutline(side).map(([, y]) => y)
      expect(Math.max(...ys)).toBeGreaterThan(0.36)
      expect(Math.min(...ys)).toBeLessThan(0.36)
    }
    expect(Object.keys(LABELS)).toEqual(['kidney', 'bladder', 'ureter', 'artery', 'vein', 'urethra'])
    expect(Object.keys(KIDNEY_TONE)).toEqual(['kidney', 'ureter', 'bladder', 'artery', 'vein'])
  })

  it('numbers are written as the stage writes them', () => {
    const r = run(water(1))
    for (const id of ['kidney.urineRate', 'water.bodyExtraMl']) {
      const s = seriesOf(r, id)!
      for (const v of [0, 62.5, 221.7, -358.4]) expect(valueText(v, s.meta, t, 'en')).toBe(formatSignal(v, s.meta, t, 'en'))
    }
  })
})

describe('the bladder as drawn (anatomy plan §2.3, scrub rule)', () => {
  it('grows with the cube root of the urine in it, never drawn above 600 mL', () => {
    expect(bladderRadius(EMPTIES_ML) / bladderRadius(0)).toBeGreaterThan(2.5)
    expect(bladderRadius(1000)).toBe(bladderRadius(BLADDER_MAX_ML))
    expect(BLADDER_MAX_ML).toBe(600)
    expect(stepMl(BLADDER_BOUNDS.length)).toBeLessThanOrEqual(600)
    expect(stepMl(BLADDER_BOUNDS.length + 5)).toBe(600)
    // The model's bladder stays at or under 600 mL (it empties at 300) for the biggest drink.
    expect(Math.max(...seriesOf(run(water(5)), 'kidney.bladderMl')!.values)).toBeLessThanOrEqual(600)
  })

  it('dragged fast across fills and emptyings, the drawn size changes at most once a real second', () => {
    const r = run(water(4))
    const bladder = seriesOf(r, 'kidney.bladderMl')!
    const gate = levelGate(BLADDER_BOUNDS)
    const changes: number[] = []
    let shown = -1
    // 6 h of meal clock dragged through in 3 s: one frame every 16 ms.
    for (let ms = 0; ms <= 3000; ms += 16) {
      const step = gate(valueAt(bladder, (ms / 3000) * 360, r.stepMin), ms)
      if (step !== shown) changes.push(ms)
      shown = step
    }
    for (let i = 2; i < changes.length; i++) expect(changes[i]! - changes[i - 1]!).toBeGreaterThanOrEqual(1000)
  })

  it('a volume sitting on a boundary never flickers (half a step past it before the size moves)', () => {
    const gate = levelGate(BLADDER_BOUNDS)
    const first = gate(URGE_ML, 0)
    const steps = new Set<number>()
    for (let ms = 1000; ms < 20000; ms += 100) steps.add(gate(URGE_ML + (ms % 200 ? 6 : -6), ms))
    expect([...steps]).toEqual([first])
  })

  it('urine runs down the ureters in pulses, faster with more urine, never backwards', () => {
    const speeds = (u: number) => Array.from({ length: 40 }, (_, i) => ureterSpeed(u, i / 20))
    for (const u of [21, BACKGROUND_ML_PER_H, 700]) for (const s of speeds(u)) expect(s).toBeGreaterThan(0)
    const mean = (u: number) => speeds(u).reduce((a, b) => a + b) / 40
    expect(mean(700)).toBeGreaterThan(2 * mean(BACKGROUND_ML_PER_H))
    // A pulse: the drops move several times faster at the squeeze than between squeezes.
    expect(Math.max(...speeds(BACKGROUND_ML_PER_H)) / Math.min(...speeds(BACKGROUND_ML_PER_H))).toBeGreaterThan(4)
  })
})

describe('words and graphs (ui-ux §6, §7)', () => {
  const ui = UIS.kidneys

  it('a glass of water: more urine than a steady day for a while, then back; half its water leaves by about 1.5 h', () => {
    const r = run(water(1))
    const s = kidneysSummary(r, null, t, 'en')!
    expect(s.headline).toMatch(/^Most urine: about 2\d0 mL an hour, at 1 h( \d+ min)? \(a day without this meal: 63 mL an hour\)\.$/)
    expect(s.reason).toMatch(/^Half the meal’s water has left as urine by 1 h \d+ min\.$/)
    expect(kidneysStripSummary('kidney.urineRate' as never, r, t, 'en')).toMatch(
      /^Urine made per hour: 65 mL an hour at the start, 2\d0 mL an hour at the most/,
    )
  })

  it('a long run with nothing to drink: less urine (sweat took water) and body water below zero, said so', () => {
    const r = run([], [runBout])
    const s = kidneysSummary(r, null, t, 'en')!
    expect(s.headline).toMatch(/^Less urine during and after moving, because sweat took some water: about 2\d mL an hour at the least\.$/)
    expect(at(r, 'water.bodyExtraMl', 90)).toBeLessThan(0)
    expect(kidneysStripSummary('water.bodyExtraMl' as never, r, t, 'en')).toMatch(
      /^Water in the body above normal: 0 mL at the start, −?-?\d+ mL at the least/,
    )
    // No meal, no water: no "half the meal's water" moment (R84).
    expect(momentAt(r, 'event.halfMealWaterPassed')).toBeNull()
  })

  it('rest and a walk differ: the walk’s sweat leaves less extra water and less urine for a while', () => {
    const [rest, walked] = [run(water(1)), run(water(1), [walk])]
    expect(at(walked, 'water.bodyExtraMl', 55)).toBeLessThan(at(rest, 'water.bodyExtraMl', 55) - 10)
    expect(at(walked, 'kidney.urineRate', 70)).toBeLessThan(at(rest, 'kidney.urineRate', 70))
    expect(Math.min(...seriesOf(walked, 'kidney.urineRate')!.values)).toBeGreaterThanOrEqual(21)
  })

  it('beside a kept plan: four glasses against one name both waters, compare the most urine, never score a drink', () => {
    const s = kidneysSummary(run(water(4)), run(water(1)), t, 'en')!
    expect(s.headline).toMatch(/^Most urine: about \d+ mL an hour with this plan, 2\d0 with the kept one\.$/)
    expect(s.reason).toBe('Water in: 1,000 mL and 250 mL. Any drink’s water counts the same.')
    const same = kidneysSummary(run(water(1)), run(water(1)), t, 'en')!
    expect(same.headline).toMatch(/^Urine is about the same in both/)
    expect(same.reason).toBeUndefined()
  })

  it('the urine graph’s background line: a day without this meal, the same for every meal, one object per run', () => {
    const r = run(water(1))
    const urine = ui.background!({ id: 'urine' } as never, r)!
    expect(urine).toBe(ui.background!({ id: 'urine' } as never, r))
    expect(ui.background!({ id: 'water' } as never, r)).toBeNull()
    expect(new Set(urine.values)).toEqual(new Set([Math.fround(BACKGROUND_ML_PER_H)]))
    expect(urine.meta.status).toBe('assumption')
    for (const leaf of ['name', 'short', 'desc']) expect(t(`${urine.meta.i18nKey}.${leaf}`)).not.toContain('sys.')
    expect(t(`${urine.meta.i18nKey}.short`)).toBe('A day without this meal')
  })

  it('its moments: the first urge and half the meal’s water gone, named in the dock', () => {
    const r = run(water(1))
    expect(ui.moments(r).map((m) => m.id)).toEqual(['event.bladderFirstUrge', 'event.halfMealWaterPassed'])
    for (const id of KIDNEY_EVENT_IDS) expect(t(`signals.${id}.name`)).not.toContain('signals.')
    expect(t('signals.event.halfMealWaterPassed.name')).toBe('Half the meal’s water has left as urine')
    expect(KIDNEY_ROWS.map((row) => row.id)).toEqual(expect.arrayContaining([...KIDNEY_EVENT_IDS]))
  })

  it('the lesson: four glasses against one at 1 h, both above a steady day, more with more water', () => {
    expect(KIDNEYS_LESSON.release).toBe('v3.0')
    const [r, kept] = [run(KIDNEYS_LESSON.meal, KIDNEYS_LESSON.activity), run(KIDNEYS_LESSON.kept, KIDNEYS_LESSON.keptActivity)]
    const u = (x: RunResult) => at(x, 'kidney.urineRate', KIDNEYS_LESSON.t)
    expect(u(r)).toBeGreaterThan(2 * u(kept))
    expect(u(kept)).toBeGreaterThan(BACKGROUND_ML_PER_H + 50)
    expect(t(KIDNEYS_LESSON.title)).toBe('Where does the water from a drink go?')
  })

  it('the moves line, the constant card with its source line (R10, R13), and below zero said for students (R84)', () => {
    expect(t('sys.kidneys.moves')).toBe('Moves with water in food and drink, and with sweat.')
    expect(t('sys.kidneys.filter.value')).toContain('125 mL a minute')
    expect(t('sys.kidneys.filter.source')).toMatch(/^Source: OpenStax/)
    expect(t('sys.kidneys.below')).toMatch(/^Below zero means sweat took more than you drank/)
    expect(t('signals.water.bodyExtraMl.desc')).toContain('Below zero means sweat took more than you drank')
  })
})

/** Every English string under these keys, with its path. */
function strings(o: unknown, path: string, out: [string, string][] = []): [string, string][] {
  if (typeof o === 'string') out.push([path, o])
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) strings(v, `${path}.${k}`, out)
  return out
}

describe('the kidneys’ words never give water advice or score a drink (model §2.4 lint, ui-ux §7)', () => {
  const j = en as Record<string, Record<string, unknown>>
  const signals = j.signals as Record<string, Record<string, unknown>>
  const kidneyText: [string, string][] = [
    ...strings(j.sys!.kidneys, 'sys.kidneys'),
    ...strings(signals.kidney, 'signals.kidney'),
    ...strings(signals.water, 'signals.water'),
    ...KIDNEY_EVENT_IDS.flatMap((id) => strings(signals.event![id.slice('event.'.length)], `signals.${id}`)),
    ...['waterSteadyDay', 'bladderEmpties', 'gfrFixed', 'waterSimple'].map((k): [string, string] => [`limits.${k}`, String(j.limits![k])]),
  ]

  it.each(['flush', 'detox', 'cleanse', 'hydrating', 'you should drink', 'dehydrat', 'pee'])('no “%s”', (word) => {
    expect(kidneyText.length).toBeGreaterThan(30)
    expect(kidneyText.filter(([, text]) => text.toLowerCase().includes(word)).map(([p]) => p)).toEqual([])
  })

  it('never “cola dehydrates”, anywhere in the English', () => {
    const all = strings(en, 'en')
    expect(all.filter(([, text]) => /cola[^.]*dehydrat|dehydrat[^.]*cola/i.test(text)).map(([p]) => p)).toEqual([])
    expect(all.filter(([, text]) => /\b(drink|drinks)\b[^.]*\bdehydrat/i.test(text)).map(([p]) => p)).toEqual([])
  })
})

describe('the drawing’s projector look', () => {
  it('the pale bladder gets a 3 px outline on the projector', () => {
    expect(bladderLine(LOOK.projector)).toBe(3)
    expect(bladderLine(LOOK.normal)).toBe(LOOK.normal.line)
  })
})
