import { describe, expect, it, vi } from 'vitest'
import { simulate, valueAt, type ActiveSignalId, type MealItem, type Simulation } from '@lifepeek/engine'
import en from '../i18n/en.json'
import hi from '../i18n/hi.json'
import { lookupFood } from '../data/foods.ts'
import { TASKS } from './presets.ts'
import { summaryData } from './summary.ts'

// The app's i18n setup needs a browser; the food names only need `localized`.
vi.mock('../i18n/index.ts', () => ({
  localized: (text: Record<string, string> | undefined, lang: string) => text?.[lang] ?? text?.en ?? '',
}))

/**
 * The Teach page's "Answers for teachers" (WP-19) are typed into en.json and hi.json, so they are
 * checked here against the model: if a curve moves, this fails and the answers are rewritten.
 * Each question is answered from the screen its link opens (lib/presets.ts TASKS).
 */
const run = (items: MealItem[]) => simulate({ items }, { lookup: lookupFood, particles: 0 })
const at = (sim: Simulation, id: ActiveSignalId, min: number) => valueAt(sim.signals.get(id)!, min)
const [halfLeft, , bloodAt1h, energyAt3h] = TASKS
const cola = run(halfLeft!.meal)
const burgerFries = run(energyAt3h!.kept!)
const glucose = cola.moments.get('event.glucosePeak')!

/** The numbers in each answer, as written (both languages carry the same ones). */
const numbers = (answers: string[]) => answers.map((a) => [...a.matchAll(/\d+/g)].map((m) => Number(m[0])))

describe('Teach: answers for teachers', () => {
  it('both languages give the same numbers', () => {
    expect(numbers(hi.teach.answers)).toEqual(numbers(en.teach.answers))
  })

  const [a1, a2, a3, a4] = numbers(en.teach.answers)

  it('1: when half of the cola has left the stomach (and the accepted range holds it)', () => {
    const half = cola.moments.get('event.stomachHalfEmpty')!.atMin!
    expect(a1).toEqual([Math.round(half), 30, 40])
    expect(half).toBeGreaterThanOrEqual(30)
    expect(half).toBeLessThanOrEqual(40)
  })

  it('2: cola leaves about 8 times faster than a burger with fries, and the reason is that it is a drink', () => {
    const v = summaryData(cola, burgerFries)
    expect(v.kind === 'pair' && v.fast).toBe('run')
    expect(v.kind === 'pair' && v.reason).toBe('drink')
    expect(a2).toEqual([v.kind === 'pair' ? Math.round(v.ratio) : NaN])
  })

  it('3: blood sugar 1 hour after the cola, its highest, and when', () => {
    const at1h = at(run(bloodAt1h!.meal), 'blood.glucose', 60)
    expect(a3![0]).toBe(Math.round(at1h))
    expect(at1h).toBeGreaterThanOrEqual(a3![1]!)
    expect(at1h).toBeLessThanOrEqual(a3![2]!)
    expect(a3!.slice(3)).toEqual([Math.round(at(cola, 'blood.glucose', glucose.atMin!)), Math.round(glucose.atMin!)])
  })

  it('4: at 3 hours the body uses more than comes in from the cola', () => {
    const coming = at(cola, 'energy.inRate', 180)
    const used = at(cola, 'energy.usedRate', 180)
    expect(coming).toBeLessThan(1)
    expect(used).toBeGreaterThan(coming)
    expect(a4).toEqual([Math.round(used)])
  })
})
