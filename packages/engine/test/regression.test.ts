import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MODEL_VERSION, buildMeal, decodeMeal, parseFood, type ActiveSignalId, type RunEventId } from '../src/index.ts'
import { simulate } from '../src/run.ts'

/**
 * Regression pin (plan-model M3 rule: snapshots live apart from the physiology tests). These are
 * the model's own outputs for MODEL_VERSION 3, NOT published figures: they only make an
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
type Pin = { moments: Partial<Record<RunEventId, Moment>> } & Record<30 | 60 | 120 | 240, Partial<Record<ActiveSignalId, number>>>

/** Values at minutes 30, 60, 120 and 240 (rounded to 0.001) and every event. Model version 3,
 * frozen at the seal (R103; E-3a set them from the reviewed diff docs/MODEL-V3-DIFF.md, the seal
 * added the v3 moments). Every other output is pinned byte for byte by test/seal.test.ts. */
const PINNED: Record<string, Pin> = {
  'cola:1': {
    moments: {
      'event.stomachHalfEmpty': 35,
      'event.glucosePeak': 35,
      'event.glucoseBackToBase': 88,
      'event.mostlyAbsorbed': 77,
      'event.firstLeftovers': null,
      'event.activityStart': null,
      'event.activityEnd': null,
      'event.gutFlowPeak': 33,
      'event.bladderFirstUrge': 68,
      'event.halfMealWaterPassed': 91,
    },
    30: {
      'gut.stomach.contentG': 196.947,
      'gut.stomach.liquidG': 196.947,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 82.691,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 9.693,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 54.071,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 120.268,
    },
    60: {
      'gut.stomach.contentG': 44.297,
      'gut.stomach.liquidG': 44.297,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 112.42,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 24.733,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 161.331,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 110.821,
    },
    120: {
      'gut.stomach.contentG': 1.993,
      'gut.stomach.liquidG': 1.993,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 40.027,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 34.158,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 266.43,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90.768,
    },
    240: {
      'gut.stomach.contentG': 0.011,
      'gut.stomach.liquidG': 0.011,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 31.819,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 34.53,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 276.24,
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
      'event.activityStart': null,
      'event.activityEnd': null,
      'event.gutFlowPeak': 78,
      'event.bladderFirstUrge': 135,
      'event.halfMealWaterPassed': 338,
    },
    30: {
      'gut.stomach.contentG': 232.795,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 232.795,
      'gut.small.contentG': 2.275,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0.453,
      'gut.absorbed.proteinG': 0.04,
      'gut.absorbed.fatG': 0.046,
      'gut.absorbed.waterG': 0.33,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 93.754,
    },
    60: {
      'gut.stomach.contentG': 220.146,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 220.146,
      'gut.small.contentG': 8.039,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 3.537,
      'gut.absorbed.proteinG': 0.415,
      'gut.absorbed.fatG': 0.511,
      'gut.absorbed.waterG': 3.05,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 108.525,
    },
    120: {
      'gut.stomach.contentG': 191.457,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 191.457,
      'gut.small.contentG': 13.278,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 12.523,
      'gut.absorbed.proteinG': 2.125,
      'gut.absorbed.fatG': 2.876,
      'gut.absorbed.waterG': 12.891,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 101.127,
    },
    240: {
      'gut.stomach.contentG': 134.079,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 134.079,
      'gut.small.contentG': 19.006,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 30.706,
      'gut.absorbed.proteinG': 6.471,
      'gut.absorbed.fatG': 9.719,
      'gut.absorbed.waterG': 34.076,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 97.793,
    },
  },
  'roti:1,dal:1': {
    moments: {
      'event.stomachHalfEmpty': 108,
      'event.glucosePeak': 66,
      'event.glucoseBackToBase': 200,
      'event.mostlyAbsorbed': 195,
      'event.firstLeftovers': [932, 1592, 2114],
      'event.activityStart': null,
      'event.activityEnd': null,
      'event.gutFlowPeak': 61,
      'event.bladderFirstUrge': 114,
      'event.halfMealWaterPassed': 169,
    },
    30: {
      'gut.stomach.contentG': 212.502,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 212.502,
      'gut.small.contentG': 6.732,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0.633,
      'gut.absorbed.proteinG': 0.05,
      'gut.absorbed.fatG': 0.03,
      'gut.absorbed.waterG': 1.728,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 93.983,
    },
    60: {
      'gut.stomach.contentG': 176.055,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 176.055,
      'gut.small.contentG': 23.257,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 4.795,
      'gut.absorbed.proteinG': 0.511,
      'gut.absorbed.fatG': 0.316,
      'gut.absorbed.waterG': 15.493,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 108.867,
    },
    120: {
      'gut.stomach.contentG': 93.905,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 93.905,
      'gut.small.contentG': 37.904,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 16.793,
      'gut.absorbed.proteinG': 2.584,
      'gut.absorbed.fatG': 1.758,
      'gut.absorbed.waterG': 64.671,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 101.187,
    },
    240: {
      'gut.stomach.contentG': 0,
      'gut.stomach.liquidG': 0,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 27.794,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 32.774,
      'gut.absorbed.proteinG': 6.836,
      'gut.absorbed.fatG': 5.279,
      'gut.absorbed.waterG': 141.717,
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
      'event.activityStart': null,
      'event.activityEnd': null,
      'event.gutFlowPeak': null,
      'event.bladderFirstUrge': 62,
      'event.halfMealWaterPassed': 77,
    },
    30: {
      'gut.stomach.contentG': 71.483,
      'gut.stomach.liquidG': 71.483,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 92.957,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 85.56,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90,
    },
    60: {
      'gut.stomach.contentG': 19.488,
      'gut.stomach.liquidG': 19.488,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 60.99,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 169.522,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90,
    },
    120: {
      'gut.stomach.contentG': 1.448,
      'gut.stomach.liquidG': 1.448,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 29.606,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 218.946,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90,
    },
    240: {
      'gut.stomach.contentG': 0.008,
      'gut.stomach.liquidG': 0.008,
      'gut.stomach.solidG': 0,
      'gut.small.contentG': 25.036,
      'gut.colon.contentG': 0,
      'gut.absorbed.carbsG': 0,
      'gut.absorbed.proteinG': 0,
      'gut.absorbed.fatG': 0,
      'gut.absorbed.waterG': 224.956,
      'gut.absorbed.fibreG': 0,
      'gut.leftBodyG': 0,
      'blood.glucose': 90,
    },
  },
}

/** Pinned values are rounded to 0.001; allow that plus Float32 and Math.exp differences between machines. */
const close = (actual: number, expected: number) => Math.abs(actual - expected) <= 0.002 + 1e-5 * Math.abs(expected)

describe('regression pin (model version 3)', () => {
  it('pins are for this model version', () => {
    expect(MODEL_VERSION).toBe(3)
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
      for (const [id, expected] of Object.entries(pin.moments) as [RunEventId, Moment][]) {
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
    // Target: < 10 ms (5–8 ms when this file runs alone); the log line above is the real report.
    // Parallel test files, a busy laptop or a slow CI runner can multiply that several times, so the
    // assertion only catches a ten-fold regression and can't flake.
    expect(fastest).toBeLessThan(200)
  })
})
