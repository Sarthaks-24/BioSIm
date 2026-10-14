import { describe, expect, it, vi } from 'vitest'
import { decodeShareState, valueAt, type ActivityBout, type MealItem, type RunResult } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import en from '../i18n/en.json'
import { lookupFood } from '../data/foods.ts'
import { CHAPTERS } from './lessons.ts'
import { FLAGSHIP, flagshipHref } from './flagship.ts'
import { HEART_PAUSE, PAUSES } from './flagshipPauses.ts'
import { LESSONS } from './presets.ts'
import { SHEETS, type SheetKey } from './worksheets.ts'
import { BREATHING_LESSON } from '../systems/breathing/lesson.ts'
import { CIRCULATION_LESSON } from '../systems/circulation/lesson.ts'
import { KIDNEYS_LESSON } from '../systems/kidneys/lesson.ts'
import { HORMONES_LESSON } from '../systems/hormones/lesson.ts'
import { MUSCLES_LESSON, SKIN_LESSON } from '../systems/muscles/lesson.ts'
import { FILTER_ML_PER_MIN } from '../systems/kidneys/water.ts'

// The app's i18n setup needs a browser; nothing here draws.
vi.mock('../i18n/index.ts', () => ({ localized: () => '' }))
const { timesRest } = await import('../systems/muscles/effort.ts')

/**
 * The printable worksheets (X-3; ui-ux §8.3, content-i18n §8.4): one per Teach lesson, its QR link
 * the lesson's own link without a version, and every number its answers say recomputed from the
 * model, as presets.test does for the guided lesson (a curve that moves fails here first).
 */
type Answer = { q: string; b?: string; k?: string; m?: string }
type Text = { setup: string; book: string; y: string; tasks: Answer[]; exit: Answer }
const text = (key: SheetKey) => (en.sheet.lessons as Record<SheetKey, Text>)[key]
/** The numbers a sentence says, in order (decimals kept: "0.4 L"). */
const numbers = (s: string | undefined) => [...(s ?? '').matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))
/** Minutes as the answers write them, "4 h 35 min" → [4, 35]. */
const hm = (min: number) => [Math.floor(min / 60), min % 60]
const round = (v: number, step = 1) => Math.round(v / step) * step

const sim = (items: MealItem[], activity: readonly ActivityBout[] = []) =>
  simulate({ items, activity: [...activity] }, { lookup: lookupFood, particles: 0 })
const at = (r: RunResult, id: string, min: number) => valueAt(r.signals.get(id as never)!, min, r.stepMin)
const moment = (r: RunResult, id: string) => r.moments.get(id as never)!.atMin!
/** The highest value of a signal in the first 12 h, and its minute. */
function peak(r: RunResult, id: string) {
  let best = { v: -Infinity, min: 0 }
  for (let min = 0; min <= 720; min++) if (at(r, id, min) > best.v) best = { v: at(r, id, min), min }
  return best
}

describe('worksheets: one per Teach lesson, its QR code opening the lesson', () => {
  const lessons: [string, string][] = [
    [FLAGSHIP.key, flagshipHref(false)],
    ...CHAPTERS.flatMap((c) => c.lessons.map((l) => [l.key, l.href(false)] as [string, string])),
  ]

  it('every lesson Teach can list has a worksheet, and no other', () => {
    expect(Object.keys(SHEETS).sort()).toEqual(lessons.map(([key]) => key).sort())
  })

  it('its link is the lesson’s link without `v=` (like lib/qrPath.ts), and English only: no `lang` (R47)', () => {
    for (const [key, href] of lessons) {
      const link = SHEETS[key as SheetKey].link
      const url = new URL(link, 'https://example.org')
      const lesson = new URL(href, 'https://example.org')
      expect(url.searchParams.get('v'), key).toBeNull()
      expect(url.searchParams.get('lang'), key).toBeNull()
      expect(url.searchParams.get('preview'), key).toBeNull()
      lesson.searchParams.delete('v')
      expect(decodeShareState(url.searchParams), key).toEqual(decodeShareState(lesson.searchParams))
      // Written out readable, character for character the lesson's link once decoded.
      expect(link, key).toBe(decodeURIComponent(lesson.pathname + lesson.search))
    }
  })

  it('3 to 5 questions (four and an exit question), one with axes to sketch on; each answered, book first', () => {
    for (const key of Object.keys(SHEETS) as SheetKey[]) {
      const { tasks, exit, setup, book, y } = text(key)
      expect(tasks.length + 1, key).toBeGreaterThanOrEqual(3)
      expect(tasks.length + 1, key).toBeLessThanOrEqual(5)
      expect([setup, book, y, exit.q].every(Boolean), key).toBe(true)
      const { task, hours } = SHEETS[key].sketch
      expect(tasks[task]?.q, key).toMatch(/^Sketch /)
      expect(tasks[task]?.q, key).toContain(`to ${hours} h`)
      for (const a of [...tasks, exit]) expect(a.b || a.k || a.m, `${key}: ${a.q}`).toBeTruthy()
    }
  })
})

describe('worksheets: the numbers the answers say are the model’s', () => {
  it('the guided lesson, "One roti, one walk"', () => {
    const [walked, rested] = [sim(FLAGSHIP.meal, FLAGSHIP.activity), sim(FLAGSHIP.meal, FLAGSHIP.keptActivity)]
    const { tasks, exit } = text('flagship')
    const breaths = PAUSES.find((p) => p.key === 'breaths')!.t
    expect(numbers(tasks[1]!.m)).toEqual([round(at(walked, 'lungs.breathRate', breaths)), round(at(rested, 'lungs.breathRate', breaths))])
    expect(numbers(tasks[2]!.m)).toEqual([round(at(walked, 'heart.rate', HEART_PAUSE.t)), round(at(rested, 'heart.rate', HEART_PAUSE.t))])
    const water = PAUSES.find((p) => p.key === 'water')!.t
    const less = at(rested, 'kidney.urineTotal', water) - at(walked, 'kidney.urineTotal', water)
    expect(numbers(tasks[3]!.m)).toEqual([...hm(water), round(less, 10)])
    expect(numbers(exit.m)).toEqual(numbers(en.teach.flagship.exitAnswer))
  })

  it('which leaves the stomach first: the Teach answers’ numbers (teachAnswers.test), and the burger’s half', () => {
    const l = LESSONS.find((l) => l.key === 'stomachRace')!
    const [cola, burger] = [sim(l.meal), sim(l.kept!)]
    const { tasks } = text('stomachRace')
    expect(numbers(tasks[0]!.m)).toEqual(numbers(en.teach.answers[0]))
    expect(numbers(tasks[1]!.m)).toEqual([
      round(moment(cola, 'event.stomachHalfEmpty')),
      ...hm(round(moment(burger, 'event.stomachHalfEmpty'), 5)),
    ])
    expect(numbers(tasks[2]!.m)).toEqual(numbers(en.teach.answers[1]))
    expect(numbers(tasks[3]!.m)).toEqual(numbers(en.teach.answers[2]))
  })

  it('which raises blood sugar more gently: roti and dal, or white rice', () => {
    const l = LESSONS.find((l) => l.key === 'rotiDal')!
    const [dal, rice] = [sim(l.meal), sim(l.kept!)]
    const [a, b] = [peak(dal, 'blood.glucose'), peak(rice, 'blood.glucose')]
    const base = at(dal, 'blood.glucose', 0)
    const { tasks } = text('rotiDal')
    expect(numbers(tasks[0]!.m)).toEqual([round(a.v), ...hm(a.min)])
    expect(numbers(tasks[1]!.m)).toEqual([round(b.v), b.min])
    expect(a.v).toBeLessThan(b.v)
    expect(a.min).toBeGreaterThan(b.min)
    expect(numbers(tasks[3]!.q)).toEqual([round(base)])
    expect(numbers(tasks[3]!.m)).toEqual([round(a.v - base), round(b.v - base)])
  })

  it('one cola or four', () => {
    const l = LESSONS.find((l) => l.key === 'colaFour')!
    const [one, four] = [sim(l.meal), sim(l.kept!)]
    const { tasks, exit } = text('colaFour')
    expect(round(peak(one, 'blood.glucose').v)).toBe(round(peak(four, 'blood.glucose').v))
    expect(numbers(tasks[0]!.m)).toEqual([round(peak(four, 'blood.glucose').v), peak(four, 'blood.glucose').min])
    // At the time the lesson opens (2 h).
    expect(numbers(tasks[1]!.q)).toEqual([l.t / 60])
    expect(numbers(tasks[1]!.m)).toEqual([round(at(one, 'blood.glucose', l.t)), round(at(four, 'blood.glucose', l.t))])
    const longer = hm(round(moment(four, 'event.glucoseBackToBase') - moment(one, 'event.glucoseBackToBase'), 5))
    expect(numbers(tasks[2]!.m)).toEqual(longer)
    expect(numbers(exit.m)).toEqual(longer)
    // The Teach note says the same.
    expect(numbers(en.teach.lessonNotes.colaFour).slice(-2)).toEqual(longer)
    expect(numbers(tasks[3]!.m)).toEqual([
      round(moment(one, 'event.stomachHalfEmpty')),
      ...hm(round(moment(four, 'event.stomachHalfEmpty'), 5)),
    ])
  })

  it('why you breathe faster when you run', () => {
    const l = BREATHING_LESSON
    const [r, k] = [sim(l.meal, l.activity), sim(l.kept, l.keptActivity)]
    const { tasks, exit } = text('breathRun')
    expect(numbers(tasks[0]!.m)).toEqual([round(at(k, 'lungs.breathRate', 0))])
    expect(numbers(tasks[1]!.m)).toEqual([round(at(r, 'lungs.breathRate', l.t))])
    expect(numbers(tasks[2]!.m)).toEqual([
      round(at(k, 'lungs.tidalVolume', l.t) / 100) / 10,
      round(at(r, 'lungs.tidalVolume', l.t) / 100) / 10,
    ])
    const most = peak(r, 'lungs.breathRate')
    const end = l.activity[0]!.startMin + l.activity[0]!.durMin
    expect(most.min).toBe(end)
    expect(numbers(tasks[3]!.m)).toEqual([end, round(most.v), round(at(k, 'lungs.breathRate', 0))])
    expect(round(at(r, 'lungs.breathRate', end + 20))).toBeLessThanOrEqual(16)
    expect(numbers(exit.m)).toEqual([round(at(r, 'gas.o2UseRate', l.t) / at(k, 'gas.o2UseRate', l.t))])
  })

  it('where the blood goes after a meal, and in a walk', () => {
    const l = CIRCULATION_LESSON
    const [r, k] = [sim(l.meal, l.activity), sim(l.kept, l.keptActivity)]
    const { tasks } = text('heartWalk')
    expect(numbers(tasks[0]!.m)).toEqual([round(at(k, 'heart.rate', 0))])
    expect(numbers(tasks[1]!.m)).toEqual([round(at(r, 'heart.rate', l.t)), ...hm(l.t)])
    expect(numbers(tasks[2]!.m)).toEqual([
      round(at(k, 'blood.flow.muscle', l.t) / 100) / 10,
      round(at(r, 'blood.flow.muscle', l.t) / 100) / 10,
    ])
    const gut = moment(k, 'event.gutFlowPeak')
    expect(numbers(tasks[3]!.m)).toEqual([round(gut / 60)])
    expect(Math.abs(gut - 60)).toBeLessThanOrEqual(10)
  })

  it('where the water from a drink goes', () => {
    const l = KIDNEYS_LESSON
    const [four, one] = [sim(l.meal, l.activity), sim(l.kept, l.keptActivity)]
    const { tasks, exit } = text('drinkWater')
    const [a, b] = [peak(four, 'kidney.urineRate'), peak(one, 'kidney.urineRate')]
    for (const p of [a, b]) expect(Math.abs(p.min - 60)).toBeLessThanOrEqual(10)
    expect(numbers(tasks[0]!.m)).toEqual([1])
    expect(numbers(tasks[1]!.m)).toEqual([round(a.v, 10), round(b.v, 10)])
    expect(numbers(tasks[2]!.k)[0]).toBe(FILTER_ML_PER_MIN)
    expect(numbers(exit.m)).toEqual([4, round(at(four, 'kidney.urineTotal', 240) - at(one, 'kidney.urineTotal', 240), 10)])
  })

  it('who keeps blood sugar steady: insulin after cola and after water (U-6)', () => {
    const l = HORMONES_LESSON
    const [cola, water] = [sim(l.meal), sim(l.kept)]
    const { tasks } = text('insulinCola')
    const most = peak(cola, 'blood.insulin')
    expect(numbers(tasks[0]!.m)).toEqual([round(most.min, 5), Math.round(most.v * 10) / 10, round(peak(water, 'blood.insulin').v)])
    expect(peak(water, 'blood.insulin').v).toBe(1)
    expect(numbers(tasks[2]!.k)[0]).toBe(round(at(cola, 'brain.glucoseUse', l.t) * 10) / 10)
  })

  it('how much harder muscles work in a run, and where its heat goes', () => {
    const l = MUSCLES_LESSON
    expect(SKIN_LESSON.activity).toEqual(l.activity)
    const [r, k] = [sim(l.meal, l.activity), sim(l.kept, l.keptActivity)]
    const [start, end] = [l.activity[0]!.startMin, l.activity[0]!.startMin + l.activity[0]!.durMin]
    const muscles = text('musclesRun').tasks
    expect(numbers(muscles[0]!.m)).toEqual([timesRest(peak(r, 'muscle.energyRate').v, at(k, 'muscle.energyRate', 0))])
    expect(numbers(muscles[2]!.m)).toEqual([round(at(r, 'heart.rate', l.t), 10), round(at(r, 'lungs.breathRate', l.t))])
    expect(numbers(muscles[3]!.m)).toEqual([start, end])
    const skin = text('sweatRun').tasks
    expect(peak(k, 'skin.sweatTotal').v).toBe(0)
    expect(numbers(skin[0]!.m)).toEqual([round(at(r, 'skin.sweatTotal', 240), 10)])
    expect(numbers(skin[1]!.m)).toEqual([37])
    const sweat = peak(r, 'skin.sweatRate')
    expect(numbers(skin[3]!.m)).toEqual([sweat.min, round(sweat.v, 10)])
    expect(sweat.min).toBe(end)
  })
})
