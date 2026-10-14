import { describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { valueAt, type ActivityBout, type MealItem, type RunResult } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import en from '../../i18n/en.json'
import { lookupFood } from '../../data/foods.ts'
import { FRAMINGS } from '../../anatomy/human/base.ts'
import { APEX, VENTRICLE_ORIGIN } from '../../anatomy/human/circulation.ts'
import { FADE_TONE } from '../../anatomy/tones/base.ts'
import { CIRCULATION_TONE } from '../../anatomy/tones/circulation.ts'
import { FLAT_LOOK } from '../../flat/look.ts'
import { MAX_DRAWN_HZ } from '../../flat/rhythm.ts'
import { activityKindAt } from '../../lib/bouts.ts'
import { formatSignal } from '../../lib/formatSignal.ts'
import {
  GUT_MAX,
  GUT_REST_SHARE,
  LEGS_MAX,
  MAX_SQUEEZE,
  MUSCLE_REST_SHARE,
  SQUEEZED,
  atriaScale,
  beatRate,
  countModel,
  dashDensity,
  dashSpeed,
  doingAt,
  restingOutput,
  seriesOf,
  squeezeOf,
  ventricleScale,
} from './beat.ts'
import { CIRCULATION_LESSON } from './lesson.ts'
import { circulationStripSummary, circulationSummary, peakOf, valueText } from './summary.ts'

// The flat body's frame, without its drawing code's page APIs (FlatBody imports the stage).
vi.mock('../../i18n/index.ts', () => ({ localized: () => '' }))
const { frame } = await import('../../flat/FlatBody.tsx')
const { LOOK, frameOf, vesselPath } = await import('./drawing.tsx')
const { default: UIS, DEFS } = await import('./ui.tsx')

/** English text at a key, filled like i18next ({{x}}). */
const t = ((key: string, vars: Record<string, unknown> = {}) => {
  const text = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)
  return typeof text === 'string' ? text.replace(/{{(\w+)}}/g, (_, v: string) => String(vars[v])) : key
}) as unknown as TFunction

const roti: MealItem[] = [{ foodId: 'roti', servings: 1 }]
const bigMeal: MealItem[] = [
  { foodId: 'cheeseburger', servings: 1 },
  { foodId: 'fries', servings: 1 },
]
const run = (activity: ActivityBout[] = [], items = roti): RunResult => simulate({ items, activity }, { lookup: lookupFood, particles: 0 })
const at = (r: RunResult, id: string, min: number) => valueAt(seriesOf(r, id)!, min, r.stepMin)
const rate = (r: RunResult, min: number) => at(r, 'heart.rate', min)
const walk: ActivityBout = { kind: 'walk', startMin: 30, durMin: 20 }
const runBout: ActivityBout = { kind: 'run', startMin: 30, durMin: 10 }

describe('the beat as drawn (anatomy plan §2.2, flash safety)', () => {
  it('rest and a walk visibly differ: faster, and a bigger squeeze (more blood per beat)', () => {
    const r = run([walk])
    expect(rate(r, 40)).toBeGreaterThan(rate(r, 10) + 20)
    expect(squeezeOf(at(r, 'heart.strokeVolume', 40))).toBeGreaterThan(squeezeOf(at(r, 'heart.strokeVolume', 10)) + 0.01)
  })

  it('never faster than 2.5 beats a second as drawn: a run says "slowed", the number stays true', () => {
    expect(MAX_DRAWN_HZ).toBe(2.5)
    const r = run([runBout])
    expect(rate(r, 38)).toBeGreaterThan(150)
    expect(beatRate(rate(r, 38))).toEqual({ hz: 2.5, slowed: true })
    expect(beatRate(rate(r, 10))).toEqual({ hz: rate(r, 10) / 60, slowed: false })
    expect(beatRate(rate(run([walk]), 40)).slowed).toBe(false)
  })

  it('the squeeze is a size change only, at most 12 %, in the model’s ratio of blood per beat below the cap', () => {
    const r = run([walk])
    const [rest, moving] = [at(r, 'heart.strokeVolume', 10), at(r, 'heart.strokeVolume', 40)]
    expect(squeezeOf(moving) / squeezeOf(rest)).toBeCloseTo(moving / rest, 10)
    expect(squeezeOf(at(run([runBout]), 'heart.strokeVolume', 38))).toBeLessThanOrEqual(MAX_SQUEEZE)
    expect(squeezeOf(1000)).toBe(MAX_SQUEEZE)
    // The atria squeeze first, then the ventricles; relaxed, both are full size.
    expect(atriaScale(0.12, 0.1)).toBeLessThan(1)
    expect(ventricleScale(0.12, 0.1)).toBe(1)
    expect(ventricleScale(SQUEEZED, 0.1)).toBeCloseTo(0.9, 10)
    expect(atriaScale(0.8, 0.1)).toBe(1)
    expect(ventricleScale(0.8, 0.1)).toBe(1)
    // Nothing else: five tones, none of them stepped per beat.
    expect(Object.keys(CIRCULATION_TONE)).toEqual(['heart', 'rich', 'poor', 'lungs', 'ghost'])
  })

  it('a resting beat moves the apex at least 3 px on a 390 × 844 phone (its picture ≈ 300 px tall)', () => {
    const squeeze = squeezeOf(at(run(), 'heart.strokeVolume', 10))
    const travel = (h: number) => {
      const m = frameOf(390, h, FRAMINGS.torso)
      const d = Math.hypot(m.X(APEX.x) - m.X(VENTRICLE_ORIGIN.x), m.Y(APEX.y) - m.Y(VENTRICLE_ORIGIN.y))
      return d * (1 - ventricleScale(SQUEEZED, squeeze))
    }
    expect(travel(300)).toBeGreaterThanOrEqual(3)
    // The smallest body allowed (160 px, a 360 × 640 phone) still shows it: about 1.6 px.
    expect(travel(160)).toBeGreaterThan(1.5)
  })
})

describe('the blood’s dashes: speed by blood pumped, density by where it goes', () => {
  it('speed is held between half and twice resting (Known limits: the run is ≈ 3.5×)', () => {
    const r = run([runBout])
    const co = seriesOf(r, 'heart.output')!
    const rest = restingOutput(co)
    expect(rest).toBeCloseTo(co.values[0]!, 5)
    expect(dashSpeed(at(r, 'heart.output', 38), rest)).toBe(2)
    expect(at(r, 'heart.output', 38) / rest).toBeGreaterThan(3.3)
    expect(at(r, 'heart.output', 38) / rest).toBeLessThan(3.7)
    expect(t('limits.heartDrawing')).toContain('3.5 times')
    expect(dashSpeed(1, 4)).toBe(0.5)
  })

  it('denser on the gut’s vessels after a meal, on the legs’ in a walk; quarter steps, capped', () => {
    const r = run([walk], bigMeal)
    const coRest = restingOutput(seriesOf(r, 'heart.output')!)
    const gut = (min: number) => dashDensity(at(r, 'blood.flow.gut', min), GUT_REST_SHARE * coRest * 1000, GUT_MAX)
    const legs = (min: number) => dashDensity(at(r, 'blood.flow.muscle', min), MUSCLE_REST_SHARE * coRest * 1000, LEGS_MAX)
    expect(gut(0)).toBe(1)
    expect(legs(0)).toBe(1)
    expect(gut(90)).toBeGreaterThan(1.25)
    expect(legs(40)).toBeGreaterThanOrEqual(4)
    expect(legs(90)).toBe(1)
    for (const v of [gut(90), legs(40)]) expect((v * 4) % 1).toBe(0)
  })
})

describe('the pack shares no code with the stage: what it writes out matches the original', () => {
  it('the frame, the outline look and the ghost', () => {
    for (const [w, h] of <[number, number][]>[
      [360, 170],
      [800, 600],
    ])
      for (const view of Object.values(FRAMINGS)) {
        const [a, b] = [frameOf(w, h, view), frame(w, h, view)]
        expect([a.scale, a.X(0.4), a.Y(1.2)]).toEqual([b.scale, b.X(0.4), b.Y(1.2)])
      }
    expect(LOOK.normal).toEqual({ ink: FLAT_LOOK.normal.ink, line: FLAT_LOOK.normal.line })
    expect(LOOK.projector).toEqual({ ink: FLAT_LOOK.projector.ink, line: FLAT_LOOK.projector.line })
    expect(CIRCULATION_TONE.ghost).toBe(FADE_TONE)
    expect(
      vesselPath(
        [
          [0, 0],
          [1, 1],
          [2, 0],
        ],
        { X: (x) => x, Y: (y) => y },
      ),
    ).toBe('M0.0 0.0Q1.0 1.0 2.0 0.0')
  })

  it('what the body is doing, and numbers with their units (litres a minute to one decimal)', () => {
    const bouts = [walk, runBout, { kind: 'walkBrisk', startMin: 100, durMin: 5 } as ActivityBout]
    for (const min of [0, 30, 45, 49.9, 50, 101, 200]) expect(doingAt(bouts, min)).toBe(activityKindAt(bouts, min))
    const games: ActivityBout[] = [
      { kind: 'sitClass', startMin: 0, durMin: 45 },
      { kind: 'football', startMin: 60, durMin: 30 },
      { kind: 'cricket', startMin: 100, durMin: 20 },
      { kind: 'badminton', startMin: 130, durMin: 10 },
    ]
    for (const min of [10, 50, 70, 110, 135, 200]) expect(doingAt(games, min)).toBe(activityKindAt(games, min))
    const r = run([runBout])
    for (const id of ['heart.rate', 'heart.output', 'heart.strokeVolume', 'blood.flow.gut', 'blood.flow.muscle']) {
      const s = seriesOf(r, id)!
      for (const v of [s.values[0]!, peakOf(s, r.stepMin).value, 0])
        expect(valueText(v, s.meta, t, 'en')).toBe(formatSignal(v, s.meta, t, 'en'))
    }
    expect(valueText(4.31, seriesOf(r, 'heart.output')!.meta, t, 'en')).toBe('4.3 L a minute')
  })
})

describe('Heart & blood’s sentences are true (ui-ux §6, §7)', () => {
  it('at rest after a roti: about the same, and try a walk', () => {
    const s = circulationSummary(run(), null, t, 'en')!
    expect(s.headline).toBe(`At rest, the heart stays at about ${Math.round(rate(run(), 0))} beats a minute after this meal.`)
    expect(s.reason).toContain('Try a walk')
  })

  it('after a big meal at rest: a few beats more, and when (a meal moves it a little, R10, R80)', () => {
    const r = run([], bigMeal)
    const peak = peakOf(seriesOf(r, 'heart.rate')!, r.stepMin)
    const up = Math.round(peak.value) - Math.round(rate(r, 0))
    expect(up).toBeGreaterThanOrEqual(2)
    expect(up).toBeLessThanOrEqual(10)
    const s = circulationSummary(r, null, t, 'en')!
    expect(s.headline).toMatch(new RegExp(`^After this meal, up to ${up} beats a minute more: about ${Math.round(peak.value)}, at \\d+ h`))
    expect(s.reason).toContain('more blood flows to it')
  })

  it('in a walk: the fastest beat and the rest beat, and the blood pumped', () => {
    const r = run([walk])
    const peak = peakOf(seriesOf(r, 'heart.rate')!, r.stepMin)
    const s = circulationSummary(r, null, t, 'en')!
    expect(s.headline).toBe(`Fastest while walking: about ${Math.round(peak.value)} beats a minute (rest ${Math.round(rate(r, 0))}).`)
    expect(s.key).toEqual({ text: String(Math.round(peak.value)), line: 'run' })
    expect(s.reason).toMatch(/^The heart pumps about \d+\.\d L of blood a minute then \(rest 4\.3 L\)/)
    expect(s.reason).not.toContain('slows')
  })

  it('in a run: above 150 the drawing is slowed, the number true', () => {
    expect(circulationSummary(run([runBout]), null, t, 'en')!.reason).toContain('The drawing slows above 150 a minute')
  })

  it('beside a kept plan: both fastest rates; the same plan says so', () => {
    const [a, b] = [run([walk]), run()]
    expect(circulationSummary(a, b, t, 'en')!.headline).toMatch(
      /^Fastest: about \d+ beats a minute with this plan, \d+ with the kept one\.$/,
    )
    expect(circulationSummary(a, a, t, 'en')!.headline).toMatch(/^The heart is about the same in both/)
  })

  it('each graph’s sentence: its start, its highest and when', () => {
    const r = run([walk])
    expect(circulationStripSummary('heart.output' as never, r, t, 'en')).toMatch(
      /^Blood pumped a minute: 4\.\d L a minute at the start, \d+\.\d L a minute at the most, at \d+ min\.$/,
    )
    expect(circulationStripSummary('blood.flow.muscle' as never, run([], [{ foodId: 'water', servings: 1 }]), t, 'en')).toMatch(
      /^Blood to the muscles: about [\d,]+ mL a minute all the way\.$/,
    )
  })

  it('the gut-flow peak is its moment after a meal; none without food', () => {
    const ui = UIS.circulation
    const [m] = ui.moments(run([], bigMeal))
    expect(m?.id).toBe('event.gutFlowPeak')
    expect(m!.atMin).toBeGreaterThanOrEqual(30)
    expect(m!.atMin).toBeLessThanOrEqual(120)
    expect(ui.moments(run([walk], []))).toEqual([])
    expect(t('signals.event.gutFlowPeak.name')).toBe('Most blood to the gut')
  })

  it('the lesson stub: in the walk far more blood to the muscles than the kept, resting plan; more to the gut after the meal (R18: release tagged)', () => {
    const l = CIRCULATION_LESSON
    expect(l.release).toBe('v3.0')
    const [r, k] = [run(l.activity, l.meal), run(l.keptActivity, l.kept)]
    expect(doingAt(l.activity, l.t)).toBe('walk')
    expect(at(r, 'blood.flow.muscle', l.t)).toBeGreaterThan(at(k, 'blood.flow.muscle', l.t) + 2000)
    expect(at(k, 'blood.flow.gut', 50)).toBeGreaterThan(at(k, 'blood.flow.gut', 0) + 50)
    expect(DEFS.circulation.slots!.find((s) => s.id === l.slot)?.oneWithKept).toBe(true)
    expect(t(l.title)).toBe('Where does the blood go after a meal, and in a walk?')
  })
})

describe('the book, the children’s band and "Why does the model differ from the book?" (R29, R57, R82, R86)', () => {
  it('the book line and the band, as confirmed', () => {
    expect(t('sys.circulation.book')).toBe('Older NCERT Class 7 book (2024-25) says: 72–80 beats a minute')
    const beats = DEFS.circulation.slots!.find((s) => s.id === 'beats')!
    expect(beats.reference).toEqual({ low: 62, high: 96 })
    expect(t('sys.circulation.children')).toBe('Most children your age (12–15): 62–96 a minute at rest')
    expect(t('sys.circulation.moves')).toBe('Moves mostly with activity; a meal moves it a little.')
    expect(t('sys.circulation.bp.value')).toBe('Blood pressure 120/80: book value, held.')
  })

  it('the card’s model numbers are the model’s: about 66 at rest, about 160 in a run, almost back within a few minutes', () => {
    const r = run([runBout])
    expect(t('sys.circulation.why.rest.model')).toContain(`about ${Math.round(rate(r, 0))} beats`)
    expect(t('sys.circulation.why.run.model')).toContain(`about ${Math.round(rate(r, 38) / 10) * 10} beats`)
    // Recovery is simplified (R82, R86): within 5 minutes of the end, within 3 beats of resting.
    expect(rate(r, 45)).toBeLessThan(rate(r, 0) + 3)
    expect(t('sys.circulation.why.after.why')).toContain('no slow after-exercise rise')
    expect(t('why.exam')).toBe('In the exam, write the book’s value.')
    expect(t('why.title')).toBe('Why does the model differ from the book?')
  })
})

describe('"Count yours" model line (X-2, content §8.3)', () => {
  it('the pulse at rest, and in the walk at the clock minute or else the first bout; never the word "normal"', () => {
    const none = countModel(run(), 100)!
    expect(none).toEqual({ rest: Math.round(rate(run(), 0)) })
    expect(t('sys.circulation.count.model', { rest: none.rest })).toBe(
      `This model: about ${none.rest} a minute at rest, for one resting grown-up.`,
    )
    const r = run([walk])
    const walking = { n: Math.round(rate(r, 40)), doing: 'walk' }
    expect(countModel(r, 40)).toEqual({ rest: Math.round(rate(r, 0)), active: walking })
    expect(countModel(r, 200)).toEqual({ rest: Math.round(rate(r, 0)), active: walking })
    expect(JSON.stringify(en.sys.circulation.count)).not.toMatch(/normal/i)
  })
})
