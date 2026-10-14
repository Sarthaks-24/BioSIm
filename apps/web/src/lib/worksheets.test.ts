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
import { BREATHING_LESSON, FOOTBALL_LESSON } from '../systems/breathing/lesson.ts'
import { CIRCULATION_LESSON } from '../systems/circulation/lesson.ts'
import { KIDNEYS_LESSON } from '../systems/kidneys/lesson.ts'
import { LYMPH_LESSON } from '../systems/lymph/lesson.ts'
import { HORMONES_LESSON } from '../systems/hormones/lesson.ts'
import { MUSCLES_LESSON, SKIN_LESSON } from '../systems/muscles/lesson.ts'
import { FILTER_ML_PER_MIN } from '../systems/kidneys/water.ts'
import { NERVES_LESSON } from '../systems/nerves/lesson.ts'
import { NERVE_PARAMS, brainRoute, reflexTime } from '@lifepeek/engine/demo'
import { PARAMS } from '@lifepeek/engine'
import { teacherSwitch } from '../systems/registry.ts'
import { REPRODUCTION_LESSON } from '../systems/reproduction/lesson.ts'
import { CYCLE_DAYS, CYCLE_RANGE, HORMONES, MENSTRUATION_DRAWN, OVULATION_DAY, makeCurve } from '../systems/reproduction/data.ts'

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
      const sketch = SHEETS[key].sketch
      expect(tasks[sketch.task]?.q, key).toMatch(/^Sketch /)
      // Hours after eating; the nerve demo's in milliseconds after the touch (v3.1); the hormone panel's in days of one cycle (v3.2).
      expect(tasks[sketch.task]?.q, key).toContain(
        'ms' in sketch ? `to ${sketch.ms} ms` : 'days' in sketch ? `from day 1 to day ${sketch.days}` : `to ${sketch.hours} h`,
      )
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

  it('why you pull your hand back (U-7, v3.1): the reflex and the brain route, its slow leg, myelin off; from @lifepeek/engine/demo', () => {
    expect(NERVES_LESSON.key).toBe('reflexHotPan')
    const [reflex, brain, slow] = [reflexTime('hotPan'), brainRoute('hotPan'), reflexTime('hotPan', { myelin: 0 })]
    const { tasks, exit, book } = text('reflexHotPan')
    expect(book).toContain('NCERT Class 10 (Ch 6, p. 102)')
    // Both routes end inside the sketch's axes.
    const sketch = SHEETS.reflexHotPan.sketch
    expect(numbers(tasks[1]!.q)).toEqual([0, sketch.ms])
    expect(brain.totalMs).toBeLessThan(sketch.ms)
    expect(numbers(tasks[1]!.m)).toEqual([round(reflex.totalMs), round(brain.totalMs)])
    expect(Math.round(brain.totalMs / reflex.totalMs)).toBe(3)
    expect(tasks[1]!.m).toContain('about three times as long')
    // The way in is most of the reflex's time, on the fibres' own speeds (Kiernan's table).
    expect(reflex.inMs / reflex.totalMs).toBeGreaterThan(0.5)
    expect(numbers(tasks[2]!.k)).toEqual([NERVE_PARAMS.fibreSpeedMPerS.aDelta, NERVE_PARAMS.fibreSpeedMPerS.aAlpha, 2003])
    expect(numbers(tasks[2]!.m)).toEqual([round(reflex.inMs), round(reflex.totalMs)])
    expect(numbers(tasks[3]!.m)).toEqual([round(slow.totalMs), round(slow.totalMs / reflex.totalMs)])
    expect(numbers(exit.m)).toEqual([round(reflex.totalMs), NERVE_PARAMS.thinkingMs])
    expect(brain.thinkingMs).toBe(NERVE_PARAMS.thinkingMs)
  })

  it('football or a walk (v3.2 Games lesson): breaths and beats in each, air per breath, back to rest, and the oxygen; the Compendium’s values', () => {
    const l = FOOTBALL_LESSON
    expect(l.activity.map((b) => b.kind)).toEqual(['football'])
    expect(l.keptActivity.map((b) => b.kind)).toEqual(['walk'])
    // The same minutes: only the activity differs.
    expect(l.keptActivity.map((b) => [b.startMin, b.durMin])).toEqual(l.activity.map((b) => [b.startMin, b.durMin]))
    const [game, walk] = [sim(l.meal, l.activity), sim(l.kept, l.keptActivity)]
    const [start, end] = [l.activity[0]!.startMin, l.activity[0]!.startMin + l.activity[0]!.durMin]
    expect(start).toBeLessThan(l.t)
    expect(l.t).toBeLessThan(end)
    const { tasks, exit, book, setup } = text('footballWalk')
    expect(book).toContain('Older NCERT Class 7 book (2024-25, Ch 6, p. 60)')
    expect(numbers(setup).slice(0, 4)).toEqual([0, l.activity[0]!.durMin, start, l.keptActivity[0]!.durMin])
    expect(numbers(tasks[0]!.m)).toEqual([round(at(walk, 'lungs.breathRate', 0))])
    expect(numbers(tasks[1]!.q)).toEqual([l.t])
    expect(numbers(tasks[1]!.m)).toEqual([
      round(at(game, 'lungs.breathRate', l.t)),
      round(at(game, 'heart.rate', l.t), 5),
      round(at(walk, 'lungs.breathRate', l.t)),
      round(at(walk, 'heart.rate', l.t), 5),
    ])
    const litres = (r: RunResult, min: number) => round(at(r, 'lungs.tidalVolume', min) / 100) / 10
    expect(numbers(tasks[2]!.m)).toEqual([litres(game, l.t), litres(walk, l.t), litres(walk, 0)])
    // Both lines rise at the start and fall at the end; within 5 minutes both are back near rest.
    expect(numbers(tasks[3]!.m)).toEqual([start, end, round(at(game, 'lungs.breathRate', end + 5)), 5])
    expect(round(at(walk, 'lungs.breathRate', end + 5))).toBe(round(at(game, 'lungs.breathRate', end + 5)))
    for (let min = start + 1; min < end; min++)
      expect(at(game, 'lungs.breathRate', min), String(min)).toBeGreaterThan(at(walk, 'lungs.breathRate', min))
    const met = PARAMS.activity.met
    expect(numbers(exit.k)).toEqual([met.football, met.walk, 2024])
    expect(numbers(exit.m)).toEqual([round(at(game, 'gas.o2UseRate', l.t) / at(walk, 'gas.o2UseRate', l.t), 0.1)])
  })

  it('why the lining of the uterus builds up (R-1, v3.2): the book’s cycle and its egg day, each hormone’s highest day from the panel’s curves; no dates, no one’s own cycle', () => {
    expect(REPRODUCTION_LESSON.key).toBe('cycleHormones')
    const { tasks, exit, book, setup, footer, tagKey } = text('cycleHormones') as Text & { footer: string; tagKey: string }
    expect(book).toContain('NCERT Class 10 (Ch 7, p. 124)')
    expect(exit.b).toContain('NCERT Class 10 (Ch 7, p. 124)')
    expect(SHEETS.cycleHormones.sketch).toEqual({ task: 1, days: CYCLE_DAYS })
    expect(numbers(tasks[0]!.q)).toEqual([CYCLE_DAYS])
    expect(numbers(tasks[0]!.b)).toEqual([9, 11, 221, ...CYCLE_RANGE, CYCLE_DAYS, OVULATION_DAY])
    // Each hormone's highest day on the panel's own curves (a point every quarter day, as drawn).
    const highest = (h: (typeof HORMONES)[number]) => {
      const curve = makeCurve(h)
      let best = { day: 1, v: -Infinity }
      for (let day = 1; day <= CYCLE_DAYS; day += 0.25) if (curve(day) > best.v) best = { day, v: curve(day) }
      return best.day
    }
    expect(numbers(tasks[1]!.q)).toEqual([1, CYCLE_DAYS])
    expect(numbers(tasks[1]!.m)).toEqual([highest('lh'), round(highest('progesterone'))])
    expect(highest('lh')).toBe(OVULATION_DAY)
    expect(highest('progesterone')).toBeGreaterThan(OVULATION_DAY)
    expect(numbers(tasks[2]!.b)).toEqual([9, 11, 221, CYCLE_DAYS, ...MENSTRUATION_DRAWN])
    expect(numbers(tasks[2]!.q)).toEqual([OVULATION_DAY + 1, CYCLE_DAYS])
    // The teacher switch is the gate: the sheet says so, and its link opens the row only where it is on (R117).
    expect(setup).toContain('“Growing up”')
    expect(SHEETS.cycleHormones.link).not.toMatch(/growing|switch/i)
    expect(teacherSwitch.on).toBe(false)
    // Nothing asks for, or about, anyone's own cycle; no dates (R-1, model §2.12).
    const all = JSON.stringify(text('cycleHormones'))
    expect(all).not.toMatch(/your|dates?|track|predict|calendar|fertil/i)
    expect(footer).toContain('not anyone’s own')
    expect(tagKey).toContain('85 women')
  })

  it('how fat reaches the blood (U-5): each meal’s highest blood fat, the burger’s for hours (R90), and the fat each brings', () => {
    const l = LYMPH_LESSON
    const [burger, roti] = [sim(l.meal, l.activity), sim(l.kept, l.keptActivity)]
    const { tasks, exit } = text('fatRoad')
    const most = (r: RunResult) => Math.max(...r.signals.get('blood.triglyceride' as never)!.values)
    expect(numbers(tasks[1]!.m)).toEqual([round(most(burger)), round(most(roti)), round(at(roti, 'blood.triglyceride', 0))])
    // "Stays up for hours": the burger’s blood fat keeps within 3 mg/dL of its highest for over 2 h.
    const top = most(burger)
    const near = burger.signals.get('blood.triglyceride' as never)!.values.filter((v) => v >= top - 3).length * burger.stepMin
    expect(near).toBeGreaterThan(120)
    expect(numbers(tasks[3]!.k)).toEqual([3, 2])
    expect(numbers(exit.m)).toEqual([round(burger.meal.total.fatG), round(roti.meal.total.fatG)])
    // The burger’s food leaves the stomach slowly (half its energy after more than 2 h), the reason the exit answer gives.
    expect(moment(burger, 'event.stomachHalfEmpty')).toBeGreaterThan(120)
  })
})
