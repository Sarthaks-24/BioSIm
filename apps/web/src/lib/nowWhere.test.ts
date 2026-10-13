import { describe, expect, it } from 'vitest'
import { activeStage, buildMeal, decodeMeal, gutIsDone, mealLocationAt, simulate } from '@lifepeek/engine'
import { FOODS, lookupFood } from '../data/foods.ts'
import { amountOf, nowKey, nowWhere, parseNowKey } from './nowWhere.ts'

const sim = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookupFood), { particles: 0 })

/**
 * The Now line's words (council round 2, C1; review 14-17 HIGH 1): where most of the meal is,
 * from the model's own location signals, and a "done" state once the gut has finished with it.
 */
describe('where the meal is now', () => {
  it('cola at 40 min: about half still in the stomach, and the rest is named (not "Stomach" alone)', () => {
    const w = nowWhere(sim('cola:1'), 40)
    expect(w).toEqual({ kind: 'gut', stage: 'stomach', here: 'half', also: { place: 'smallIntestine', amount: 'some' } })
  })

  it('cola at 5 min: almost all of it is in the stomach, nothing else worth naming', () => {
    expect(nowWhere(sim('cola:1'), 5)).toEqual({ kind: 'gut', stage: 'stomach', here: 'all', also: null })
  })

  it('cola at 90 min: some in the small intestine, most already taken into the body', () => {
    expect(nowWhere(sim('cola:1'), 90)).toEqual({
      kind: 'gut',
      stage: 'smallIntestine',
      here: 'some',
      also: { place: 'body', amount: 'most' },
    })
  })

  it('burger + fries at 6 h: still the stomach, and about half already taken into the body', () => {
    expect(nowWhere(sim('cheeseburger:1,fries:1'), 360)).toEqual({
      kind: 'gut',
      stage: 'stomach',
      here: 'some',
      also: { place: 'body', amount: 'half' },
    })
  })

  it('before the stomach: being eaten, then on the way down', () => {
    expect(nowWhere(sim('cheeseburger:1'), 1)).toEqual({ kind: 'before', stage: 'mouth' })
  })

  it('cheeseburger at 30 h: done, never "Stomach" (the engine used to fall back to it from 1808 min)', () => {
    const burger = sim('cheeseburger:1')
    for (const t of [1808, 30 * 60, 40 * 60, burger.horizonMin]) {
      const w = nowWhere(burger, t)
      expect(w.stage, `${t} min`).toBe('done')
      expect(activeStage(burger, t), `${t} min`).toBe('largeIntestine')
    }
    expect(nowWhere(burger, 30 * 60)).toMatchObject({ kind: 'done', body: 'all', restLeft: true })
  })

  it('every food, every minute: once done it stays done, and the body never lights the stomach again', () => {
    for (const meal of ['cola:1', 'roti:1', 'orange-juice:1', 'water:1', 'cheeseburger:1,fries:1', 'apple:1', 'roti:2,dal:1,milk:1']) {
      const run = sim(meal)
      let done = false
      let leftStomach = false
      for (let t = 0; t <= run.horizonMin; t += 7) {
        const w = nowWhere(run, t)
        if (done) expect(w.stage, `${meal} ${t} min`).toBe('done')
        done ||= w.stage === 'done'
        if (leftStomach) expect(activeStage(run, t), `${meal} ${t} min`).not.toBe('stomach')
        leftStomach ||= ['smallIntestine', 'largeIntestine'].includes(activeStage(run, t))
      }
    }
  })

  // FIX-C review: "done" fired while a fifth to a half of the waste was still in the colon (the
  // engine's 1 % counts the meal's water), and said "the rest left as waste" for cola or water.
  const meals = [...FOODS.map((f) => `${f.id}:1`), 'cheeseburger:1,fries:1', 'water:3', 'roti:2,dal:1,milk:1', 'cola:1,apple:1']
  it.each(meals)('%s: "done" only once the waste has left, and "the rest left as waste" only with leftovers', (meal) => {
    const run = sim(meal)
    const out = run.excretedG[run.length - 1]!
    let first: number | null = null
    for (let t = 0; t <= run.horizonMin; t += run.stepMin) {
      if (nowWhere(run, t).stage === 'done') {
        first = t
        break
      }
    }
    expect(first, 'done within 48 h').not.toBeNull()
    const loc = mealLocationAt(run, first!)
    expect(loc.largeIntestine, 'still in the large intestine').toBeLessThanOrEqual(0.1 * out)
    expect(loc.stomach + loc.smallIntestine, 'still in the stomach and small intestine').toBeLessThan(0.01 * loc.total)
    if (run.events.firstExit) expect(first!, 'not before the leftovers start leaving').toBeGreaterThanOrEqual(run.events.firstExit.typical)
    expect(nowWhere(run, run.horizonMin)).toMatchObject({ kind: 'done', restLeft: run.events.firstExit !== null })
  })

  // Review FIX-D + WP-18, MED 1: a big meal is still passing its last waste at 48 h, and against
  // the little that has left by then its colon never looked "nearly all passed on": never "done".
  it('three burgers and fries: done at the last minute, never before the leftovers leave, and no "the rest left"', () => {
    const run = sim('cheeseburger:3,fries:3')
    const end = run.horizonMin
    expect(run.meal.overCap).toBe(true)
    expect(gutIsDone(mealLocationAt(run, end))).toBe(true)
    expect(nowWhere(run, end)).toEqual({ kind: 'done', stage: 'done', body: 'all', restLeft: false })
    // Some of the waste is still in the colon at 48 h: the words claim only what was absorbed.
    const loc = mealLocationAt(run, end)
    expect(loc.largeIntestine).toBeGreaterThan(0.1 * run.excretedG[run.length - 1]!)
    for (let t = 0; t < end; t += run.stepMin) expect(nowWhere(run, t).stage, `${t} min`).not.toBe('done')
    expect(nowWhere(run, end - run.stepMin)).toMatchObject({ kind: 'gut', stage: 'largeIntestine' })
  })

  // Six foods, five servings each (the most a meal can hold): several kilos, far over the model's
  // limit (the notes say so). Done at 48 h only if the engine says the gut has finished; otherwise
  // the line says where the meal still is, as the body shows it (a 4.7 kg meal is still partly in
  // the stomach at 48 h in the model, and "Stomach" there is the model's honest answer).
  const ids = FOODS.map((f) => f.id)
  const sixByFive = [0, 3, 6, 9, 12]
    .map((k) =>
      ids
        .slice(k, k + 6)
        .map((id) => `${id}:5`)
        .join(','),
    )
    .filter((m) => m.split(',').length === 6)
  it.each(sixByFive)('%s at 2880 min: done only when the gut is, else the words say where it still is', (meal) => {
    const run = sim(meal)
    const end = run.horizonMin
    expect(end).toBe(2880)
    expect(run.meal.overCap).toBe(true)
    const loc = mealLocationAt(run, end)
    const w = nowWhere(run, end)
    if (gutIsDone(loc)) {
      expect(w).toMatchObject({
        kind: 'done',
        restLeft: run.events.firstExit !== null && loc.largeIntestine <= 0.1 * run.excretedG[run.length - 1]!,
      })
    } else {
      expect(w.kind).toBe('gut')
      if (w.kind !== 'gut') return
      expect(w.stage).toBe(activeStage(run, end))
      const held = { stomach: loc.stomach, smallIntestine: loc.smallIntestine, largeIntestine: loc.largeIntestine }[w.stage]
      expect(w.here).toBe(amountOf(held / loc.total))
      expect(held, 'the organ named holds food').toBeGreaterThan(0.01 * loc.total)
    }
    for (let t = 0; t < (run.events.firstExit?.typical ?? 0); t += run.stepMin) expect(nowWhere(run, t).stage, `${t} min`).not.toBe('done')
  })

  it('both ends of the 6 × 5 meals: one still has food in the stomach at 48 h, one is done', () => {
    const ends = sixByFive.map((m) => nowWhere(sim(m), 2880).stage)
    expect(ends).toContain('stomach')
    expect(ends).toContain('done')
  })

  it("every meal under the model's limit is done by 48 h", () => {
    for (const meal of [
      'cheeseburger:2,fries:1',
      'roti:4,dal:2,milk:1',
      'idli:4,dal:2',
      'apple:3,banana:2',
      'white-rice:3,dal:2,green-salad:2',
    ]) {
      const run = sim(meal)
      expect(run.meal.overCap, meal).toBe(false)
      expect(nowWhere(run, run.horizonMin).stage, meal).toBe('done')
    }
  })

  it('no leftovers marker, no "the rest left as waste": cola, water, milk, orange juice, boiled egg, white rice', () => {
    for (const food of ['cola', 'water', 'milk', 'orange-juice', 'boiled-egg', 'white-rice']) {
      const run = sim(`${food}:1`)
      expect(run.events.firstExit, food).toBeNull()
      expect(nowWhere(run, run.horizonMin), food).toMatchObject({ kind: 'done', body: 'all', restLeft: false })
    }
  })

  it('the words survive the round trip through their key (what the Now line re-renders on)', () => {
    const run = sim('roti:2,dal:1')
    for (const t of [0, 3, 30, 200, 400, 900, 2000, 2880]) {
      const w = nowWhere(run, t)
      expect(parseNowKey(nowKey(w)), `${t} min`).toEqual(w)
    }
  })

  it('amount words: "about half" is 40–60 %', () => {
    expect([0.95, 0.7, 0.45, 0.2, 0.05].map(amountOf)).toEqual(['all', 'most', 'half', 'some', 'little'])
  })
})
