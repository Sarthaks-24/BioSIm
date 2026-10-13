import { describe, expect, it } from 'vitest'
import { activeStage, buildMeal, decodeMeal, simulate } from '@lifepeek/engine'
import { lookupFood } from '../data/foods.ts'
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
