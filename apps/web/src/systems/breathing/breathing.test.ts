import { describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { valueAt, type ActivityBout, type MealItem, type RunResult } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import en from '../../i18n/en.json'
import { lookupFood } from '../../data/foods.ts'
import { FRAMINGS } from '../../anatomy/human/base.ts'
import { RIBS as SKELETON_RIBS } from '../../anatomy/human/skeleton.ts'
import { RIBS } from '../../anatomy/human/breathing.ts'
import { FADE_TONE, SKIN_LINE } from '../../anatomy/tones/base.ts'
import { BREATHING_TONE } from '../../anatomy/tones/breathing.ts'
import { FLAT_LOOK } from '../../flat/look.ts'
import { MAX_BREATH_HZ } from '../../flat/rhythm.ts'
import { activityBandAt } from '../../lib/bouts.ts'
import { formatSignal } from '../../lib/formatSignal.ts'
import { createTicker } from '../../lib/ticker.ts'
import { STILL_BREATH, breathRate, doingAt, fillAt, lungScale, seriesOf } from './breath.ts'
import { BREATHING_LESSON } from './lesson.ts'
import { breathingStripSummary, breathingSummary, peakOf, valueText } from './summary.ts'

// The flat body's frame, without its drawing code's page APIs (FlatBody imports the stage).
vi.mock('../../i18n/index.ts', () => ({ localized: () => '' }))
const { frame } = await import('../../flat/FlatBody.tsx')
const { LOOK, RIB_LINE, frameOf } = await import('./drawing.tsx')

/** English text at a key, filled like i18next ({{x}}). */
const t = ((key: string, vars: Record<string, unknown> = {}) => {
  const text = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)
  return typeof text === 'string' ? text.replace(/{{(\w+)}}/g, (_, v: string) => String(vars[v])) : key
}) as unknown as TFunction

const roti: MealItem[] = [{ foodId: 'roti', servings: 1 }]
const run = (activity: ActivityBout[] = [], items = roti): RunResult => simulate({ items, activity }, { lookup: lookupFood, particles: 0 })
const rate = (r: RunResult, min: number) => valueAt(seriesOf(r, 'lungs.breathRate')!, min, r.stepMin)
const tidal = (r: RunResult, min: number) => valueAt(seriesOf(r, 'lungs.tidalVolume')!, min, r.stepMin)
const walk: ActivityBout = { kind: 'walk', startMin: 30, durMin: 20 }
const runBout: ActivityBout = { kind: 'run', startMin: 30, durMin: 10 }

describe('the breath as drawn (anatomy plan §2.1, flash safety)', () => {
  it('rest and a walk visibly differ: faster and deeper, so a bigger swell', () => {
    const r = run([walk])
    expect(rate(r, 40)).toBeGreaterThan(rate(r, 10) + 5)
    expect(lungScale(tidal(r, 40), 1)).toBeGreaterThan(lungScale(tidal(r, 10), 1) + 0.02)
  })

  it('never faster than 0.8 breaths a second as drawn; faster says "slowed", the number stays true', () => {
    expect(MAX_BREATH_HZ).toBe(0.8)
    const r = run([runBout])
    // A run's 33 or so a minute is drawn at its true speed (0.55 Hz).
    expect(breathRate(rate(r, 38))).toEqual({ hz: rate(r, 38) / 60, slowed: false })
    expect(breathRate(rate(r, 38)).hz).toBeLessThan(0.6)
    expect(breathRate(60)).toEqual({ hz: 0.8, slowed: true })
  })

  it('a resting breath moves the diaphragm at least 4 px on a 360 × 640 phone (its picture ≥ 160 px tall)', () => {
    const m = frameOf(360, 170, FRAMINGS.chest)
    const lungHeight = m.Y(0.95) - m.Y(2.05)
    expect((lungScale(tidal(run(), 10), 1) - 1) * lungHeight).toBeGreaterThanOrEqual(4)
  })

  it('rest and a run keep the model’s ratio of the swell (the cube root of the volume, one gain)', () => {
    const [rest, hard] = [tidal(run([runBout]), 10), tidal(run([runBout]), 38)]
    const ratio = (lungScale(hard, 1) - 1) / (lungScale(rest, 1) - 1)
    const model = (Math.cbrt((2400 + hard) / 2400) - 1) / (Math.cbrt((2400 + rest) / 2400) - 1)
    expect(ratio).toBeCloseTo(model, 10)
  })

  it('reduced motion stands half breathed in; a breath is a smooth size change only', () => {
    expect(fillAt(STILL_BREATH)).toBeCloseTo(0.5, 10)
    expect(fillAt(0)).toBe(0)
    expect(fillAt(0.5)).toBe(1)
    expect(Object.keys(BREATHING_TONE)).toEqual(['airway', 'lungs', 'diaphragm', 'air', 'ghost'])
  })
})

describe('the pack shares no code with the stage: what it writes out matches the original', () => {
  it('the frame, the outline look, the ghost and rib colours', () => {
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
    expect(BREATHING_TONE.ghost).toBe(FADE_TONE)
    expect(RIB_LINE).toBe(SKIN_LINE)
    // The faint ribs start where the skeleton's ribs 2–9 leave the backbone.
    expect(RIBS.map((r) => r[0]![1] + 0.02)).toEqual(SKELETON_RIBS.slice(1, 9).map((c) => c.getPointAt(0).y))
  })

  it('what the body is doing, and numbers with their units', () => {
    const bouts = [walk, runBout, { kind: 'walkBrisk', startMin: 100, durMin: 5 } as ActivityBout]
    for (const min of [0, 30, 45, 49.9, 50, 101, 200]) expect(doingAt(bouts, min)).toBe(activityBandAt(bouts, min))
    const r = run([runBout])
    for (const id of ['lungs.breathRate', 'lungs.tidalVolume', 'gas.o2UseRate']) {
      const s = seriesOf(r, id)!
      for (const v of [s.values[0]!, peakOf(s, r.stepMin).value, 0])
        expect(valueText(v, s.meta, t, 'en')).toBe(formatSignal(v, s.meta, t, 'en'))
    }
  })
})

describe('breathing’s sentences are true (ui-ux §6, §7)', () => {
  it('at rest: about the same after a meal, and try a walk', () => {
    const s = breathingSummary(run(), null, t, 'en')!
    expect(s.headline).toBe(`At rest, breathing stays about the same after a meal: about ${Math.round(rate(run(), 0))} a minute.`)
    expect(s.reason).toContain('Try a walk')
  })

  it('in a run: the fastest rate and the rest rate, deeper breaths, the older book’s 25', () => {
    const r = run([runBout])
    const peak = peakOf(seriesOf(r, 'lungs.breathRate')!, r.stepMin)
    expect(peak.atMin).toBeGreaterThanOrEqual(30)
    expect(peak.atMin).toBeLessThanOrEqual(40)
    const s = breathingSummary(r, null, t, 'en')!
    expect(s.headline).toBe(`Fastest during the run: about ${Math.round(peak.value)} a minute (rest ${Math.round(rate(r, 0))}).`)
    expect(s.key).toEqual({ text: String(Math.round(peak.value)), line: 'run' })
    expect(s.reason).toMatch(/deeper too: about [\d,]+ mL at rest, [\d,]+ mL then\. Older NCERT Class 7 book: up to 25/)
  })

  it('beside a kept plan: both fastest rates; the same plan says so', () => {
    const [a, b] = [run([runBout]), run()]
    expect(breathingSummary(a, b, t, 'en')!.headline).toMatch(/^Fastest: about \d+ a minute with this plan, \d+ with the kept one\.$/)
    expect(breathingSummary(a, a, t, 'en')!.headline).toMatch(/^Breathing is about the same in both/)
  })

  it('each graph’s sentence: its start, its highest and when', () => {
    const r = run([walk])
    expect(breathingStripSummary('lungs.breathRate' as never, r, t, 'en')).toMatch(
      /^Breaths a minute: \d+ breaths a minute at the start, \d+ breaths a minute at the most, at \d+ min\.$/,
    )
  })

  it('the lesson stub: a 10-minute run from 0:30 opens in the run, well above the kept, resting line (R18: release tagged)', () => {
    const l = BREATHING_LESSON
    expect(l.release).toBe('v3.0')
    const [r, k] = [run(l.activity, l.meal), run(l.keptActivity, l.kept)]
    expect(doingAt(l.activity, l.t)).toBe('run')
    expect(rate(r, l.t)).toBeGreaterThan(rate(k, l.t) + 10)
    expect(t(l.title)).toBe('Why do you breathe faster when you run?')
  })
})

describe('the real clock (lib/ticker.ts, architecture §1.7)', () => {
  function fakePage() {
    let next: ((now: number) => void) | null = null
    let shown = true
    let watcher = () => {}
    const ticker = createTicker({
      request: (f) => ((next = f), 1),
      cancel: () => (next = null),
      allowed: () => shown,
      watch: (w) => (watcher = w),
    })
    return {
      ticker,
      frame: (now: number) => next?.(now),
      hide: () => ((shown = false), watcher()),
    }
  }

  it('runs only while a drawing listens and the tab is shown, at most 30 frames a second', () => {
    const page = fakePage()
    expect(page.ticker.running()).toBe(false)
    const dts: number[] = []
    const stop = page.ticker.onTick((dt) => dts.push(dt))
    expect(page.ticker.running()).toBe(true)
    // A 60 Hz screen: every other frame is skipped.
    for (let i = 0; i <= 12; i++) page.frame(1000 + i * (1000 / 60))
    expect(dts.length).toBe(7)
    expect(dts.slice(1).every((dt) => Math.abs(dt - 1 / 30) < 1e-9)).toBe(true)
    page.hide()
    expect(page.ticker.running()).toBe(false)
    stop()
    expect(page.ticker.running()).toBe(false)
  })
})
