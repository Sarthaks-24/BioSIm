import { describe, expect, it, vi } from 'vitest'
import i18n from 'i18next'
import { buildMeal, decodeMeal, simulate } from '@lifepeek/engine'
import en from '../i18n/en.json'
import { lookupFood } from '../data/foods.ts'
import { PRESETS } from './presets.ts'
import { compareSummary, singleSummary, summaryData } from './summary.ts'

/**
 * The summary sentence is what students read first, so it must be true for every lesson the app
 * offers. The first seven cases are v1's verdict.test.ts, ported one for one (meal A = this
 * meal, meal B = the kept meal); the rest are new.
 */
const sim = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookupFood), { particles: 0 })
const pair = (a: string, b: string) => summaryData(sim(a), sim(b))
const encode = (items: { foodId: string; servings: number }[]) => items.map((i) => `${i.foodId}:${i.servings}`).join(',')

// The app's i18n setup needs a browser; the food names only need `localized`.
vi.mock('../i18n/index.ts', () => ({
  localized: (text: Record<string, string> | undefined, lang: string) => text?.[lang] ?? text?.en ?? '',
}))

const inst = i18n.createInstance()
await inst.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
const t = inst.getFixedT('en')

describe('summary: the ported verdict cases', () => {
  it('cola vs burger + fries: cola is faster, because it is only a drink', () => {
    const v = pair('cola:1', 'cheeseburger:1,fries:1')
    expect(v).toMatchObject({ kind: 'pair', fast: 'run', reason: 'drink' })
    if (v.kind === 'pair') expect(v.ratio).toBeGreaterThan(4)
  })

  it('apple vs orange juice: the juice is faster even with more calories — reason is drink, never calories', () => {
    expect(pair('apple:1', 'orange-juice:1')).toMatchObject({ kind: 'pair', fast: 'kept', reason: 'drink' })
  })

  it('cola vs salad: never claims calories as the reason when the faster meal has more', () => {
    const v = pair('cola:1', 'green-salad:1')
    expect(v.kind).toBe('pair')
    if (v.kind === 'pair') expect(v.reason).not.toBe('calories')
  })

  it('adding a cola to burger + fries does not make that meal "faster"', () => {
    const v = pair('cheeseburger:1,fries:1', 'cheeseburger:1,fries:1,cola:1')
    expect(v.kind).toBe('pair')
    if (v.kind === 'pair') expect(v.similar || v.fast === 'run').toBe(true)
  })

  it('whenever calories are given as the reason, the slower meal really has more of them', () => {
    const meals = [
      'cola:1',
      'water:1',
      'milk:1',
      'apple:1',
      'white-rice:1',
      'roti:1,dal:1',
      'cheeseburger:1,fries:1',
      'green-salad:1',
      'idli:1',
    ]
    const runs = new Map(meals.map((m) => [m, sim(m)]))
    for (const a of meals)
      for (const b of meals) {
        if (a === b) continue
        const v = summaryData(runs.get(a)!, runs.get(b)!)
        if (v.kind === 'pair' && v.reason === 'calories') expect(v.kcal[v.slow], `${a} vs ${b}`).toBeGreaterThan(v.kcal[v.fast])
      }
  })

  it('every ready-made lesson gives a sensible summary', () => {
    for (const p of PRESETS) {
      const v = pair(encode(p.a), encode(p.b))
      expect(v.kind, p.key).toBe('pair')
      expect(compareSummary(sim(encode(p.a)), sim(encode(p.b)), t, 'en')?.headline, p.key).toBeTruthy()
    }
  })

  it("this meal's numbers don't depend on what the kept meal is", () => {
    const a1 = pair('cola:1', 'water:1')
    const a2 = pair('cola:1', 'cheeseburger:1,fries:1')
    expect(a1.kind === 'pair' && a2.kind === 'pair' && a1.half.run === a2.half.run).toBe(true)
  })
})

describe('summary: the sentences', () => {
  it('cola against a kept burger + fries says which stomach is faster, and why', () => {
    const s = compareSummary(sim('cola:1'), sim('cheeseburger:1,fries:1'), t, 'en')!
    expect(s.headline).toMatch(/^Cola leaves the stomach about \d+× faster than Cheeseburger \+ French fries\.$/)
    expect(s.reason).toMatch(/^Cola is only a drink/)
  })

  it('kept the other way round, the kept meal is the faster one', () => {
    const s = compareSummary(sim('cheeseburger:1,fries:1'), sim('cola:1'), t, 'en')!
    expect(s.headline).toMatch(/^Cola leaves the stomach about \d+× faster than Cheeseburger \+ French fries\.$/)
  })

  it('more calories is the reason only when it is true', () => {
    const s = compareSummary(sim('roti:1'), sim('roti:4'), t, 'en')!
    expect(s.headline).toMatch(/^Roti leaves the stomach about [\d.]+× faster than Roti ×4\.$/)
    expect(s.reason).toMatch(/^Roti ×4 has more food energy \(\d+ vs \d+ kcal\)/)
  })

  it('meals with the same name become "this meal" and "the kept meal"', () => {
    const s = compareSummary(sim('cola:1'), sim('cola:1'), t, 'en')!
    expect(s.headline).toBe('This meal and the kept meal leave the stomach at about the same speed.')
  })
})

describe('summary: one meal (new)', () => {
  it('a drink: half of its food energy, in minutes', () => {
    expect(singleSummary(sim('cola:1'), t, 'en')!.headline).toMatch(
      /^Half of the food energy in Cola has left the stomach after \d+ min\.$/,
    )
  })

  it('water has no energy, so it is halved by weight', () => {
    expect(singleSummary(sim('water:1'), t, 'en')!.headline).toMatch(/^Half of Water has left the stomach after \d+ min\.$/)
  })

  it('a big meal takes hours, and names its foods', () => {
    const s = singleSummary(sim('cheeseburger:1,fries:1'), t, 'en')!
    expect(s.headline).toMatch(/^Half of the food energy in Cheeseburger \+ French fries has left the stomach after \d+ h( \d+ min)?\.$/)
    expect(s.reason).toBeUndefined()
  })

  it('a meal of three foods is "this meal", and an empty meal has no sentence', () => {
    expect(singleSummary(sim('roti:1,dal:1,milk:1'), t, 'en')!.headline).toMatch(/^Half of the food energy in this meal has left/)
    expect(singleSummary(sim(''), t, 'en')).toBeNull()
    expect(summaryData(sim(''), sim('cola:1'))).toEqual({ kind: 'empty' })
  })
})

describe('summary: the key number and "more than" (council round 2 C4; review 14-17 LOW 6)', () => {
  /** The run as if half of it never left the stomach within the 48 h. */
  const neverHalf = (s: ReturnType<typeof sim>) => {
    const moments = new Map(s.moments)
    moments.delete('event.stomachHalfEmpty')
    return { ...s, moments }
  }

  it('the key number is in the headline and belongs to the faster meal’s line', () => {
    const s = compareSummary(sim('cheeseburger:1,fries:1'), sim('cola:1'), t, 'en')!
    expect(s.key).toMatchObject({ line: 'kept' })
    expect(s.headline).toContain(s.key!.text)
    expect(s.key!.text).toMatch(/^\d+×$/)
    const one = singleSummary(sim('cola:1'), t, 'en')!
    expect(one.key).toMatchObject({ line: 'run' })
    expect(one.headline).toContain(one.key!.text)
  })

  it('half never left within 48 h: the sentence says "more than", never "after 48 h"', () => {
    expect(singleSummary(neverHalf(sim('cola:1')), t, 'en')!.headline).toBe(
      'Half of the food energy in Cola takes more than 48 h to leave the stomach.',
    )
    const s = compareSummary(sim('cola:1'), neverHalf(sim('cheeseburger:1,fries:1')), t, 'en')!
    expect(s.headline).toMatch(/^Cola leaves the stomach more than \d+× faster than Cheeseburger \+ French fries\.$/)
    // Neither half-empties: no comparison is claimed.
    expect(compareSummary(neverHalf(sim('cola:1')), neverHalf(sim('apple:1')), t, 'en')!.headline).toMatch(
      /^Half of the food energy in Cola takes more than/,
    )
  })
})
