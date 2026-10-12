import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MODEL_VERSION, buildMeal, decodeMeal, parseFood, simulate, type ActiveSignalId, type EventId } from '../src/index.ts'

/**
 * Regression pin (plan-model M3 rule: snapshots live apart from the physiology tests). These are
 * the model's own outputs for MODEL_VERSION 2, NOT published figures: they only make an
 * accidental model change fail CI.
 *
 * If you changed the model ON PURPOSE: bump MODEL_VERSION in params.ts, make sure the golden
 * tests in model.test.ts still pass, then regenerate these numbers and say why in the commit.
 * Never edit these numbers to make a test pass without bumping MODEL_VERSION.
 */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => foods.find((f) => f.id === id)
const run = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookup))

type Moment = number | null | [low: number, typical: number, high: number]
type Pin = { moments: Partial<Record<EventId, Moment>> } & Record<30 | 60 | 120 | 240, Partial<Record<ActiveSignalId, number>>>

/** Values at minutes 30, 60, 120 and 240 (rounded to 0.001) and every event. Model version 2. */
const PINNED: Record<string, Pin> = {
  'cola:1': {
    moments: {
      'event.stomachHalfEmpty': 35,
      'event.glucosePeak': 35,
      'event.glucoseBackToBase': 88,
      'event.mostlyAbsorbed': 77,
      'event.firstLeftovers': null,
    },
    30: {
      'gut.stomach.contentG': 196.947,
      'gut.stomach.liquidG': 196.947,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 88.898,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 9.493,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 48.063,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 119.771,
    },
    60: {
      'gut.stomach.contentG': 44.297,
      'gut.stomach.liquidG': 44.297,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 130.855,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 24.223,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 143.405,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 110.659,
    },
    120: {
      'gut.stomach.contentG': 1.993,
      'gut.stomach.liquidG': 1.993,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 70.335,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 33.453,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 236.827,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90.763,
    },
    240: {
      'gut.stomach.contentG': 0.011,
      'gut.stomach.liquidG': 0.011,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 63.224,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 33.818,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 245.547,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90.006,
    },
  },
  'cheeseburger:1,fries:1': {
    moments: {
      'event.stomachHalfEmpty': 274,
      'event.glucosePeak': 67,
      'event.glucoseBackToBase': 528,
      'event.mostlyAbsorbed': 498,
      'event.firstLeftovers': [952, 1612, 2134],
    },
    30: {
      'gut.stomach.contentG': 232.795,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 232.795,
      'gut.small.contentG': 2.323,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0.444,
      'gut.absorbed.proteinG': 0.037,
      'gut.absorbed.fatG': 0.046,
      'gut.absorbed.waterG': 0.293,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 93.677,
    },
    60: {
      'gut.stomach.contentG': 220.146,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 220.146,
      'gut.small.contentG': 8.473,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 3.464,
      'gut.absorbed.proteinG': 0.393,
      'gut.absorbed.fatG': 0.511,
      'gut.absorbed.waterG': 2.711,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 108.23,
    },
    120: {
      'gut.stomach.contentG': 191.457,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 191.457,
      'gut.small.contentG': 15.08,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 12.265,
      'gut.absorbed.proteinG': 2.013,
      'gut.absorbed.fatG': 2.876,
      'gut.absorbed.waterG': 11.459,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 101.02,
    },
    240: {
      'gut.stomach.contentG': 134.079,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 134.079,
      'gut.small.contentG': 23.766,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 30.073,
      'gut.absorbed.proteinG': 6.13,
      'gut.absorbed.fatG': 9.719,
      'gut.absorbed.waterG': 30.289,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 97.71,
    },
  },
  'roti:1,dal:1': {
    moments: {
      'event.stomachHalfEmpty': 108,
      'event.glucosePeak': 67,
      'event.glucoseBackToBase': 200,
      'event.mostlyAbsorbed': 195,
      'event.firstLeftovers': [932, 1592, 2114],
    },
    30: {
      'gut.stomach.contentG': 212.502,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 212.502,
      'gut.small.contentG': 6.94,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0.619,
      'gut.absorbed.proteinG': 0.048,
      'gut.absorbed.fatG': 0.03,
      'gut.absorbed.waterG': 1.536,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 93.902,
    },
    60: {
      'gut.stomach.contentG': 176.055,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 176.055,
      'gut.small.contentG': 25.104,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 4.696,
      'gut.absorbed.proteinG': 0.484,
      'gut.absorbed.fatG': 0.316,
      'gut.absorbed.waterG': 13.771,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 108.57,
    },
    120: {
      'gut.stomach.contentG': 93.905,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 93.905,
      'gut.small.contentG': 45.572,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 16.447,
      'gut.absorbed.proteinG': 2.448,
      'gut.absorbed.fatG': 1.758,
      'gut.absorbed.waterG': 57.486,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 101.079,
    },
    240: {
      'gut.stomach.contentG': 0,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 44.576,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 32.098,
      'gut.absorbed.proteinG': 6.476,
      'gut.absorbed.fatG': 5.279,
      'gut.absorbed.waterG': 125.971,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90.12,
    },
  },
  'water:1': {
    moments: {
      'event.stomachHalfEmpty': 18,
      'event.glucosePeak': null,
      'event.glucoseBackToBase': null,
      'event.mostlyAbsorbed': null,
      'event.firstLeftovers': null,
    },
    30: {
      'gut.stomach.contentG': 71.483,
      'gut.stomach.liquidG': 71.483,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 102.464,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 76.053,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90,
    },
    60: {
      'gut.stomach.contentG': 19.488,
      'gut.stomach.liquidG': 19.488,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 79.826,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 150.686,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90,
    },
    120: {
      'gut.stomach.contentG': 1.448,
      'gut.stomach.liquidG': 1.448,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 53.933,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 194.619,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90,
    },
    240: {
      'gut.stomach.contentG': 0.008,
      'gut.stomach.liquidG': 0.008,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 50.031,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 199.961,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90,
    },
  },
}

/** Pinned values are rounded to 0.001; allow that plus Float32 and Math.exp differences between machines. */
const close = (actual: number, expected: number) => Math.abs(actual - expected) <= 0.002 + 1e-5 * Math.abs(expected)

describe('regression pin (model version 2)', () => {
  it('pins are for this model version', () => {
    expect(MODEL_VERSION).toBe(2)
  })

  for (const [meal, pin] of Object.entries(PINNED)) {
    it(`${meal}: signals at 30/60/120/240 min and every moment are unchanged`, () => {
      const sim = run(meal)
      const misses: string[] = []
      for (const t of [30, 60, 120, 240] as const) {
        for (const [id, expected] of Object.entries(pin[t]) as [ActiveSignalId, number][]) {
          const series = sim.signals.get(id)
          const actual = series ? series.values[t / sim.stepMin]! : NaN
          if (!close(actual, expected)) misses.push(`${id} @${t} min: ${actual} (pinned ${expected})`)
        }
      }
      for (const [id, expected] of Object.entries(pin.moments) as [EventId, Moment][]) {
        const p = sim.moments.get(id)!
        const actual: Moment = p.atMin === null ? null : p.low !== undefined ? [p.low, p.atMin, p.high!] : p.atMin
        const same =
          expected === null || actual === null
            ? expected === actual
            : Array.isArray(expected)
              ? Array.isArray(actual) && expected.every((e, k) => close(actual[k]!, e))
              : typeof actual === 'number' && close(actual, expected)
        if (!same) misses.push(`${id}: ${JSON.stringify(actual)} (pinned ${JSON.stringify(expected)})`)
      }
      expect(misses).toEqual([])
    })
  }

  it('simulate() for cola is fast (Node, warm)', () => {
    const meal = buildMeal(decodeMeal('cola:1'), lookup)
    for (let i = 0; i < 20; i++) simulate(meal)
    const times: number[] = []
    for (let i = 0; i < 21; i++) {
      const t0 = performance.now()
      simulate(meal)
      times.push(performance.now() - t0)
    }
    times.sort((a, b) => a - b)
    const [fastest, median] = [times[0]!, times[10]!]
    console.log(`simulate(cola), warm, 21 runs: fastest ${fastest.toFixed(2)} ms, median ${median.toFixed(2)} ms`)
    // Target: < 10 ms (5–8 ms when this file runs alone). The other test files run in parallel and
    // can double that, and CI runners are slower again, so the assertion only catches a big regression.
    expect(fastest).toBeLessThan(process.env.CI ? 40 : 25)
  })
})
