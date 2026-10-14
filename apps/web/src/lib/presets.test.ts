import { describe, expect, it } from 'vitest'
import { decodeMeal, decodeShareState, encodeShareState, valueAt, type ActivityBout, type MealItem, type RunResult } from '@lifepeek/engine'
import { PACK_PARAMS, simulate } from '@lifepeek/engine/run'
import en from '../i18n/en.json'
import { DIGESTION } from '../systems/digestion/def.ts'
import { systemOf } from '../systems/registry.ts'
import { FLAGSHIP, flagshipHref, flagshipShown } from './flagship.ts'
import { HEART_PAUSE, PAUSES, pausesFor, type Pause } from './flagshipPauses.ts'
import { lookupFood } from '../data/foods.ts'
import { runMoments } from './moments.ts'
import { LESSONS, PRESETS, TASKS } from './presets.ts'
import { QR_PATH } from './qrPath.ts'

const run = (items: MealItem[]) => simulate({ items }, { lookup: lookupFood, particles: 0 })
const moments = (items: MealItem[] | undefined) => (items?.length ? runMoments(run(items)).map((m) => m.atMin) : [])

describe('ready links', () => {
  it('every lesson but "One cola or four" opens at its first key moment (the first marker on the timeline)', () => {
    for (const l of LESSONS.filter((l) => l.key !== 'colaFour')) {
      const first = Math.min(...moments(l.meal), ...moments(l.kept))
      expect(l.t, l.key).toBe(Math.round(first))
    }
  })

  it('"One cola or four" opens at the half hour where four colas keep blood sugar raised furthest above one (council round 3)', () => {
    const l = LESSONS.find((l) => l.key === 'colaFour')!
    const [one, four] = [run(l.meal), run(l.kept!)]
    const gap = (min: number) =>
      valueAt(four.signals.get('blood.glucose')!, min, four.stepMin) - valueAt(one.signals.get('blood.glucose')!, min, one.stepMin)
    let best = 0
    for (let m = 1; m <= 6 * 60; m++) if (gap(m) > gap(best)) best = m
    expect(l.t).toBe(Math.round(best / 30) * 30)
    expect(gap(l.t)).toBeGreaterThan(0.99 * gap(best))
    // There, one cola is back near the before-meal level (within 5 mg/dL) and four are not.
    const base = one.signals.get('blood.glucose')!.values[0]!
    expect(valueAt(one.signals.get('blood.glucose')!, l.t, one.stepMin) - base).toBeLessThan(5)
    expect(valueAt(four.signals.get('blood.glucose')!, l.t, four.stepMin) - base).toBeGreaterThan(5)
  })

  it('every preset, lesson and question uses real foods', () => {
    for (const p of [...PRESETS, ...LESSONS, ...TASKS])
      for (const i of [...p.meal, ...(p.kept ?? [])]) expect(lookupFood(i.foodId), `${p.key}: ${i.foodId}`).toBeDefined()
  })

  it('the Teach QR code opens the screen questions 1 to 3 start from (council round 3)', () => {
    const url = new URL(QR_PATH, 'https://example.org')
    expect(url.pathname).toBe('/sim')
    expect(url.searchParams.get('t')).toBeNull()
    expect(url.searchParams.get('b')).toBeNull()
    for (const task of TASKS.slice(0, 3)) {
      expect(task.kept ?? []).toEqual([])
      expect(decodeMeal(url.searchParams.get('a')!)).toEqual(task.meal)
    }
  })
})

/**
 * The flagship guided lesson (X-1; ui-ux §8.1, content-i18n §8.2): every pause's time and every
 * number its words say are the model's, recomputed here (R30, R34, R37, R38).
 */
describe('the flagship lesson, "One roti, one walk"', () => {
  const plan = (activity: ActivityBout[]) => simulate({ items: FLAGSHIP.meal, activity }, { lookup: lookupFood, particles: 0 })
  const walked = plan([...FLAGSHIP.activity])
  const rested = plan([...FLAGSHIP.keptActivity])
  const at = (r: RunResult, id: string, min: number) => valueAt(r.signals.get(id as never)!, min, r.stepMin)
  const pause = (key: Pause['key']) => [...PAUSES, HEART_PAUSE].find((p) => p.key === key)!
  const model = (key: Pause['key']) => en.flagship.pauses[key].model
  /** The numbers a sentence says, in order. */
  const numbers = (text: string) => [...text.matchAll(/\d+/g)].map((m) => Number(m[0]))
  const bout = FLAGSHIP.activity[0]!
  const [walkStart, walkEnd] = [bout.startMin, bout.startMin + bout.durMin]

  it('the plan: roti and a glass of water, `walk.60.20`, the same meal at rest kept; v3.0', () => {
    expect(FLAGSHIP.meal).toEqual([
      { foodId: 'roti', servings: 1 },
      { foodId: 'water', servings: 1 },
    ])
    expect(FLAGSHIP.activity).toEqual([{ kind: 'walk', startMin: 60, durMin: 20 }])
    expect(FLAGSHIP.kept).toEqual(FLAGSHIP.meal)
    expect(FLAGSHIP.keptActivity).toEqual([])
    expect(FLAGSHIP.release).toBe('v3.0')
  })

  it('at most five pauses, in clock order, on v3.0 systems only, each on a different system (R30, R38)', () => {
    for (const skin of [true, false]) {
      const pauses = pausesFor(skin)
      expect(pauses.length).toBeLessThanOrEqual(5)
      expect(pauses.map((p) => p.t)).toEqual([...pauses.map((p) => p.t)].sort((a, b) => a - b))
      for (const p of pauses) expect(['digestion', 'circulation', 'breathing', 'skin', 'kidneys']).toContain(p.system)
    }
    expect(new Set(pausesFor(true).map((p) => p.system)).size).toBe(5)
    // Pause 4 is skin's; while skin is hidden, the heart's in the walk (R34).
    expect(pausesFor(true)[3]!.system).toBe('skin')
    expect(pausesFor(false)[3]).toEqual(HEART_PAUSE)
    // The systems it pauses on whatever is public are the ones Home and Teach wait for.
    expect(new Set(pausesFor(false).map((p) => p.system))).toEqual(new Set(FLAGSHIP.systems))
    // The links open at the first pause.
    expect([FLAGSHIP.layer, FLAGSHIP.t]).toEqual([PAUSES[0]!.system, PAUSES[0]!.t])
  })

  it('each pause opens on a graph its system has', () => {
    const slots: Record<string, string[]> = {
      digestion: DIGESTION.slots.map((s) => s.id),
      breathing: ['breaths', 'depth', 'gas'],
      circulation: ['beats', 'pumped', 'where'],
      kidneys: ['urine', 'water'],
      skin: ['sweat'],
    }
    for (const p of [...PAUSES, HEART_PAUSE]) expect(slots[p.system], p.key).toContain(p.slot)
  })

  it('1 · Digestion at 0:30: the roti is leaving the stomach a little at a time, and its sugar is reaching the blood', () => {
    const p = pause('stomach')
    expect(p.t).toBe(30)
    const stomach = (m: number) => at(walked, 'gut.stomach.contentG', m)
    expect(stomach(p.t)).toBeGreaterThan(0)
    expect(stomach(p.t)).toBeLessThan(stomach(p.t - 5))
    expect(stomach(p.t)).toBeGreaterThan(stomach(p.t + 5))
    expect(at(walked, 'blood.glucose', p.t)).toBeGreaterThan(at(walked, 'blood.glucose', 0) + 5)
    expect(at(walked, 'blood.glucose', p.t)).toBeGreaterThan(at(walked, 'blood.glucose', p.t - 5))
  })

  it('2 · Heart & blood at the most blood to the gut: more blood flows to the intestine', () => {
    const p = pause('blood')
    expect(p.t).toBe(Math.round(walked.moments.get('event.gutFlowPeak' as never)!.atMin!))
    expect(p.t).toBeLessThan(walkStart)
    expect(at(walked, 'blood.flow.gut', p.t)).toBeGreaterThan(1.1 * at(walked, 'blood.flow.gut', 0))
  })

  it('3 · Breathing in the walk: faster and deeper, the numbers its sentence says', () => {
    const p = pause('breaths')
    expect(p.t).toBeGreaterThan(walkStart)
    expect(p.t).toBeLessThan(walkEnd)
    expect(numbers(model('breaths'))).toEqual([
      Math.round(at(walked, 'lungs.breathRate', p.t)),
      Math.round(at(rested, 'lungs.breathRate', p.t)),
    ])
    expect(at(walked, 'lungs.tidalVolume', p.t)).toBeGreaterThan(1.5 * at(rested, 'lungs.tidalVolume', p.t))
    expect(at(walked, 'gas.o2UseRate', p.t)).toBeGreaterThan(2 * at(rested, 'gas.o2UseRate', p.t))
  })

  it('4 · Skin in the walk: sweat carries the extra heat of walking away (none at rest); 37 °C is the book’s, held', () => {
    const p = pause('sweat')
    expect(p.t).toBeGreaterThan(walkStart)
    expect(p.t).toBeLessThan(walkEnd)
    expect(at(rested, 'skin.sweatRate', p.t)).toBe(0)
    const sweat = at(walked, 'skin.sweatRate', p.t)
    expect(sweat).toBeGreaterThan(100)
    // All the extra energy of moving ends as heat (e = 0), and sweat takes it away: kcal/h = mL/h × kcal/mL.
    expect(sweat * PACK_PARAMS.effort.sweatKcalPerMl).toBeCloseTo(at(walked, 'energy.activityRate', p.t), 0)
    expect(numbers(model('sweat'))).toEqual([37])
  })

  it('4 (skin hidden) · Heart & blood in the walk: the beats its sentence says, more blood to the muscles', () => {
    const p = HEART_PAUSE
    expect(p.t).toBe(pause('sweat').t)
    expect(numbers(model('heart'))).toEqual([Math.round(at(walked, 'heart.rate', p.t)), Math.round(at(rested, 'heart.rate', p.t))])
    expect(at(walked, 'blood.flow.muscle', p.t)).toBeGreaterThan(2 * at(rested, 'blood.flow.muscle', p.t))
  })

  it('5 · Kidneys when half the meal’s water has left: less has come out after the walk, by the amount it says', () => {
    const p = pause('water')
    expect(p.t).toBe(Math.round(walked.moments.get('event.halfMealWaterPassed' as never)!.atMin!))
    const [walk, rest] = [at(walked, 'kidney.urineTotal', p.t), at(rested, 'kidney.urineTotal', p.t)]
    // Not "about the same" (FIX-G): at least a tenth less.
    expect(walk).toBeLessThan(0.9 * rest)
    expect(numbers(model('water'))).toEqual([Math.round((rest - walk) / 10) * 10])
    expect(at(walked, 'skin.sweatTotal', p.t)).toBeGreaterThan(0)
  })

  it('the exit question’s answer: breathing hardly moves after the roti, a lot in the walk (Teach)', () => {
    const [after, during] = numbers(en.teach.flagship.exitAnswer)
    let most = 0
    for (let m = 0; m <= 6 * 60; m++) most = Math.max(most, at(rested, 'lungs.breathRate', m))
    expect(after).toBe(Math.round(most))
    expect(during).toBe(Math.round(at(walked, 'lungs.breathRate', pause('breaths').t)))
  })

  it('Home and Teach offer it only once every system it pauses on is public, or in a preview (R18, R30)', () => {
    expect(flagshipShown(false)).toBe(FLAGSHIP.systems.every((id) => systemOf(id)!.public))
    // Today (before H-1) its systems are hidden: only a preview shows it.
    expect(flagshipShown(false)).toBe(false)
    expect(flagshipShown(true)).toBe(true)
  })

  it('its link opens the first pause, keeping a preview a preview; no lesson parameter', () => {
    const url = new URL(flagshipHref(false), 'https://example.org')
    const s = decodeShareState(url.searchParams)
    expect([s.a, s.b, s.t, s.layer, s.act]).toEqual([FLAGSHIP.meal, FLAGSHIP.kept, 30, 'digestion', FLAGSHIP.activity])
    expect(s.bact).toBeUndefined()
    expect(url.searchParams.get('preview')).toBeNull()
    expect(new URL(flagshipHref(true), 'https://example.org').searchParams.get('preview')).toBe('1')
    expect([...url.searchParams.keys()].sort()).toEqual(['a', 'act', 'b', 'layer', 't', 'v'])
    // The walk written out as the codec writes it: the same link, character for character.
    expect(decodeURIComponent(flagshipHref(false))).toBe(
      decodeURIComponent(
        `/sim?${encodeShareState({ a: FLAGSHIP.meal, b: FLAGSHIP.kept, t: FLAGSHIP.t, layer: FLAGSHIP.layer, act: FLAGSHIP.activity })}`,
      ),
    )
  })
})
