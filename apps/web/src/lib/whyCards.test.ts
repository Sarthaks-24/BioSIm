import { describe, expect, it } from 'vitest'
import { PARAMS, valueAt, type RunResult } from '@lifepeek/engine'
import { PACK_PARAMS, simulate } from '@lifepeek/engine/run'
import en from '../i18n/en.json'
import { lookupFood } from '../data/foods.ts'
import { BREATHING_LESSON } from '../systems/breathing/lesson.ts'
import { CIRCULATION_LESSON } from '../systems/circulation/lesson.ts'
import { KIDNEYS_LESSON } from '../systems/kidneys/lesson.ts'
import { LYMPH_LESSON } from '../systems/lymph/lesson.ts'
import { SKIN_LESSON } from '../systems/muscles/lesson.ts'
import type { SystemLesson } from '../systems/registry.ts'
import { brainRoute, reflexTime } from '@lifepeek/engine/demo'

/**
 * "Why does the model differ from the book?" cards (X-4; content-i18n §8.5, ui-ux §8.4, R9, R54,
 * R56, R86, R100). Every number a card says for the model is the model's, recomputed here from its
 * lesson's plan or its parameters; every book value names its book, chapter and page (read on the
 * NCERT pages, R31); the exhaled air is the book's only (R54).
 */

interface Row {
  what: string
  book: string
  model: string
  why: string
}
type Card = Record<string, Row | string>

/** Every card by the words' key its component is given (components/WhyCard.tsx `text`). */
const CARDS: Record<string, Card> = {
  'why.digestion': en.why.digestion,
  'sys.breathing.why': en.sys.breathing.why,
  'sys.circulation.why': en.sys.circulation.why,
  'sys.kidneys.why': en.sys.kidneys.why,
  'sys.effort.why': en.sys.effort.why,
  'sys.lymph.why': en.sys.lymph.why,
  'sys.control.why': en.sys.control.why,
  'sys.control.nerves.why': en.sys.control.nerves.why,
}
const rowsOf = (card: Card) => Object.entries(card).filter((e): e is [string, Row] => typeof e[1] === 'object')

/** The numbers a sentence says, in order ("1.4" is one number; "10-minute" is 10). */
const numbers = (text: string) => [...text.matchAll(/\d+(?:\.\d+)?/g)].map((m) => Number(m[0]))

const plan = (l: SystemLesson, kept = false) =>
  simulate({ items: kept ? l.kept! : l.meal, activity: kept ? l.keptActivity! : l.activity }, { lookup: lookupFood, particles: 0 })
const at = (r: RunResult, id: string, min: number) => valueAt(r.signals.get(id as never)!, min, r.stepMin)
const most = (r: RunResult, id: string) => Math.max(...r.signals.get(id as never)!.values)

describe('the cards’ words (R9)', () => {
  it('the title, the link, the four lines and the exam line', () => {
    expect(en.why.title).toBe('Why does the model differ from the book?')
    expect(en.why.open).toBe('Why different? ›')
    expect([en.why.book, en.why.model, en.why.reason]).toEqual(['The book says', 'This model says', 'Why they differ'])
    expect(en.why.exam).toBe('In the exam, write the book’s value.')
  })

  it('every row has its four lines, and every card a question to discuss', () => {
    for (const [key, card] of Object.entries(CARDS)) {
      expect(rowsOf(card).length, key).toBeGreaterThan(0)
      for (const [name, row] of rowsOf(card)) expect(Object.keys(row).sort(), `${key}.${name}`).toEqual(['book', 'model', 'what', 'why'])
      expect(typeof card.ask, key).toBe('string')
    }
  })

  it('every book value names its book and page, as read (R29, R31, R100)', () => {
    for (const [key, card] of Object.entries(CARDS))
      for (const [name, row] of rowsOf(card)) {
        if (/^no (number|time)/.test(row.book) || row.book.includes('(same page)')) continue
        expect(row.book, `${key}.${name}`).toMatch(/\((older )?NCERT Class (6|7|10)\b.*\bCh \d+, p\. \d+\)$/)
      }
  })
})

describe('Digestion: where food is taken in (NCERT Class 10, Ch 5, pp. 86, 98)', () => {
  const card = en.why.digestion
  it('the shares the small and large intestine take in are the model’s', () => {
    const a = PARAMS.absorbedInSmallIntestine
    expect(numbers(card.where.model)).toEqual([a.carbs, a.protein, a.fat].map((x) => Math.round(x * 100)))
    expect(numbers(card.water.model)).toEqual([a.water, PARAMS.colonWaterAbsorbed].map((x) => Math.round(x * 100)))
  })
})

describe('Breathing (older NCERT Class 7 book, Ch 6, pp. 60, 64; R54, R56)', () => {
  const card = en.sys.breathing.why
  const [run, rest] = [plan(BREATHING_LESSON), plan(BREATHING_LESSON, true)]
  const bout = BREATHING_LESSON.activity[0]!

  it('at rest: the model’s rate', () => {
    expect(numbers(card.rest.model)).toEqual([Math.round(at(rest, 'lungs.breathRate', 0))])
    expect(numbers(card.rest.book)).toEqual([15, 18, 7, 2024, 25, 6, 60])
  })

  it('in the lesson’s run: the fastest rate, the run’s minutes, and each breath at its deepest and at rest, in litres', () => {
    expect(bout.kind).toBe('run')
    expect(numbers(card.run.model)).toEqual([
      Math.round(most(run, 'lungs.breathRate')),
      bout.durMin,
      Math.round(most(run, 'lungs.tidalVolume') / 100) / 10,
      Math.round(at(rest, 'lungs.tidalVolume', 0) / 100) / 10,
    ])
    expect(card.run.why).toBe(
      'The model follows studies of grown-ups exercising hard. At their hardest effort, adults average about 36 breaths a minute (Blackie 1991); trained runners in a marathon measured 47–56 (Bosch 1990). Both agree: faster and deeper.',
    )
  })

  it('the air breathed out: the book’s 16.4 % and 4.4 % only; no model number (R54)', () => {
    expect(numbers(card.exhaled.book).slice(0, 2)).toEqual([16.4, 4.4])
    expect(numbers(card.exhaled.model)).toEqual([])
    expect(numbers(card.exhaled.why)).toEqual([])
  })
})

describe('Heart & blood (older NCERT Class 7 book, Ch 7, p. 71; R86)', () => {
  const card = en.sys.circulation.why
  it('rest from the lesson’s kept plan; the run and the quick recovery are checked in circulation.test', () => {
    const rest = plan(CIRCULATION_LESSON, true)
    expect(card.rest.model).toBe(`about ${Math.round(at(rest, 'heart.rate', 0))} beats a minute (model estimate)`)
    expect(card.after.why).toContain('no slow after-exercise rise')
  })
})

describe('Kidneys (NCERT Class 10, Ch 5, p. 97)', () => {
  const card = en.sys.kidneys.why
  const w = PACK_PARAMS.water

  it('filtered a minute and a day, and the background day’s urine, are the model’s', () => {
    expect(numbers(card.filtered.model)).toEqual([
      w.filtrationMlPerMin,
      (w.filtrationMlPerMin * 24 * 60) / 1000,
      w.backgroundUrineMlPerDay / 1000,
    ])
    expect(numbers(card.filtered.book).slice(0, 1)).toEqual([180])
  })

  it('half of four glasses’ water has left as urine when the model says (to 5 minutes)', () => {
    expect(KIDNEYS_LESSON.meal).toEqual([{ foodId: 'water', servings: 4 }])
    expect(card.drink.model).toContain('four glasses')
    const half = plan(KIDNEYS_LESSON).moments.get('event.halfMealWaterPassed' as never)!.atMin!
    const min = Math.round(half / 5) * 5
    expect(numbers(card.drink.model)).toEqual([Math.floor(min / 60), min % 60])
  })
})

describe('Skin & temperature (NCERT Class 6, Curiosity, Ch 7, p. 128)', () => {
  const card = en.sys.effort.why
  it('temperature held near 37 °C, and the sweat of the lesson’s run (to 10 mL)', () => {
    const run = plan(SKIN_LESSON)
    const bout = SKIN_LESSON.activity[0]!
    expect(numbers(card.temperature.model)).toEqual([37, Math.round(most(run, 'skin.sweatTotal') / 10) * 10, bout.durMin])
    expect(numbers(card.temperature.book).slice(0, 1)).toEqual([37.0])
  })
})

describe('Hormones: what insulin does (NCERT Class 10, Ch 6, p. 111, read for U-6)', () => {
  it('the book’s feedback; the model says no number, and that its insulin does not pull blood sugar down (open loop, R91)', () => {
    const card = en.sys.control.why
    expect(card.feedback.book).toContain('a feedback mechanism')
    expect(numbers(card.feedback.model)).toEqual([])
    expect(card.feedback.model).toContain('does not pull blood sugar down')
    // The same page, word for word where the stage quotes it (the insulin graph's book line, the lesson's pause and worksheet).
    for (const line of [en.sys.control.book, en.sheet.lessons.insulinCola.book]) expect(line).toMatch(/pancreas makes more insulin/)
  })
})

describe('Brain & nerves: the hot pan (NCERT Class 10, Ch 6, p. 102, read for U-7; v3.1 Teach step, R109)', () => {
  const card = en.sys.control.nerves.why
  it('the book’s words as read (no number); the model’s two routes are reflexTime’s, as the demo’s counters', () => {
    expect(card.speed.book).toContain('“the thinking process of the brain is not fast enough”')
    expect(numbers(card.speed.book)).toEqual([10, 6, 102])
    // The demo's own book line quotes the same page.
    expect(en.sys.control.nerves.demo.book).toContain('the thinking process of the brain is not fast enough')
    expect(numbers(card.speed.model)).toEqual([Math.round(reflexTime('hotPan').totalMs), Math.round(brainRoute('hotPan').totalMs)])
    expect(numbers(card.ask)).toEqual([Math.round(reflexTime('hotPan').totalMs)])
  })
})

describe('Lymph (NCERT Class 10, Ch 5, p. 94; U-5)', () => {
  const card = en.sys.lymph.why
  it('the book’s words as read on p. 94 (R31), quoted', () => {
    expect(card.road.book).toBe(
      'lymph carries digested and absorbed fat from the intestine and drains excess fluid from extra cellular space back into the blood (NCERT Class 10, Ch 5, p. 94)',
    )
  })

  it('after the lesson’s cheeseburger with fries, blood fat from fasting to its highest, as the model says (R90: stays up for hours)', () => {
    expect(LYMPH_LESSON.meal.map((i) => i.foodId)).toEqual(['cheeseburger', 'fries'])
    expect(card.road.model).toContain('cheeseburger with fries')
    expect(numbers(card.road.model)).toEqual([PACK_PARAMS.lymph.fastingMgDl, Math.round(most(plan(LYMPH_LESSON), 'blood.triglyceride'))])
  })

  it('before eating: the model’s 80 and the ICMR-INDIAB 116 mg/dL (R90, Joshi 2014)', () => {
    expect(numbers(card.before.model)).toEqual([PACK_PARAMS.lymph.fastingMgDl, 2022])
    expect(numbers(card.before.why)).toEqual([116, 2014])
  })
})

describe('the guided lesson’s two book lines, as read (R100; the blood-fat pause since v3.1, U-5)', () => {
  it('NCERT Class 10 p. 94 and Class 6 p. 128', () => {
    expect(en.flagship.pauses.fat.book).toBe('NCERT Class 10 (Ch 5, p. 94): lymph carries digested and absorbed fat from the intestine.')
    expect(en.flagship.pauses.sweat.book).toBe(
      'NCERT Class 6 (Curiosity, Ch 7, p. 128): the normal temperature of a healthy human body is taken to be 37.0 °C.',
    )
  })
})
