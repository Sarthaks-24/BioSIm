import { describe, expect, it } from 'vitest'
import { buildMeal, decodeMeal, indexAt, simulate, stomachFraction, valueAt, type Simulation } from '@lifepeek/engine'
import { FOODS, lookupFood } from '../../data/foods.ts'
import { stripMarker } from './marks.ts'

const run = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookupFood), { particles: 0 })
const meals = [...FOODS.map((f) => `${f.id}:1`), 'cheeseburger:1,fries:1,cola:1', 'cheeseburger:1,fries:1', 'roti:2,dal:1', 'cola:4']

/** Grams in the stomach as a share of the meal's grams, at minute m. */
const gramsShare = (sim: Simulation, m: number) => valueAt(sim.signals.get('gut.stomach.contentG')!, m) / sim.meal.total.massG

describe('the ring on the stomach graph says what it marks (council MUST 1)', () => {
  it.each(meals)('%s: the ring sits on the grams line, and the quantity its label names is half there', (meal) => {
    const sim = run(meal)
    const ring = stripMarker('gut.stomach.contentG', sim)!
    expect(ring).not.toBeNull()
    // The ring is drawn at the line's own value (SignalStrip puts it at yAt(value)).
    expect(ring.value).toBe(valueAt(sim.signals.get('gut.stomach.contentG')!, ring.atMin))
    const i = indexAt(sim, ring.atMin)
    if (ring.labelKey === 'graph.halfEnergyLeft') {
      // "Half the energy has left": the food energy still in the stomach crosses one half here.
      expect(stomachFraction(sim, i)).toBeLessThanOrEqual(0.5)
      expect(stomachFraction(sim, i - 1)).toBeGreaterThan(0.5)
    } else {
      // "Half has left" (no energy, so by weight): the drawn grams themselves cross one half here.
      expect(ring.labelKey).toBe('signals.event.stomachHalfEmpty.name')
      expect(sim.events.noNutrients).toBe(true)
      expect(ring.value / sim.meal.total.massG).toBeLessThanOrEqual(0.5)
      expect(gramsShare(sim, ring.atMin - 1)).toBeGreaterThan(0.5)
    }
  })

  it('burger + fries + cola: at the ring the grams are well under half, so the label must say "energy"', () => {
    const sim = run('cheeseburger:1,fries:1,cola:1')
    const ring = stripMarker('gut.stomach.contentG', sim)!
    expect(ring.labelKey).toBe('graph.halfEnergyLeft')
    expect(ring.value / sim.meal.total.massG).toBeLessThan(0.45)
  })

  it('water: no energy, so it is halved by weight and the label says just "half has left"', () => {
    expect(stripMarker('gut.stomach.contentG', run('water:1'))?.labelKey).toBe('signals.event.stomachHalfEmpty.name')
  })
})

describe('the ring on the blood-sugar graph', () => {
  it.each(['cola:1', 'cola:4', 'white-rice:1', 'cheeseburger:1,fries:1,cola:1'])(
    '%s: "Highest: N" is the drawn value at the ring, and the highest',
    (meal) => {
      const sim = run(meal)
      const g = sim.signals.get('blood.glucose')!
      const ring = stripMarker('blood.glucose', sim)!
      expect(ring.labelKey).toBe('graph.highest')
      expect(ring.value).toBe(valueAt(g, ring.atMin))
      expect(ring.value).toBe(Math.max(...g.values))
    },
  )

  it('water: no ring (blood sugar never leaves the before-meal level)', () => {
    expect(stripMarker('blood.glucose', run('water:1'))).toBeNull()
  })

  it('energy has no ring', () => {
    expect(stripMarker('energy.inRate', run('cola:1'))).toBeNull()
  })
})
