import { describe, expect, it } from 'vitest'
import i18n from 'i18next'
import { buildMeal, decodeMeal } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import en from '../i18n/en.json'
import { lookupFood } from '../data/foods.ts'
import { stripSummary } from '../systems/digestion/stripSummary.ts'
import { stripDescription } from './stripSummary.ts'
import { runMoments } from './moments.ts'
import { cellValue, momentRows, tableColumns, tableTimes } from './stripTable.ts'

/**
 * The graphs' text alternatives (G8): what a screen reader hears after each graph's name, and the
 * numbers of "Show as table". They must say what the graph shows, and nothing it doesn't.
 */
const sim = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookupFood), { particles: 0 })
const inst = i18n.createInstance()
await inst.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
const t = inst.getFixedT('en')

describe('each graph in a sentence', () => {
  it('stomach: what it holds at the start, and when half the food energy has left', () => {
    const s = stripSummary('gut.stomach.contentG', sim('cola:1'), t, 'en')!
    expect(s).toMatch(/^The stomach holds \d+ g at the start\. Half of the meal's food energy has left by \d+ min\.$/)
  })

  it('stomach with water only: halved by weight, and never says "food energy"', () => {
    const s = stripSummary('gut.stomach.contentG', sim('water:1'), t, 'en')!
    expect(s).toMatch(/^The stomach holds \d+ g at the start\. Half of it has left by \d+ min\.$/)
    expect(s).not.toContain('energy')
  })

  it('blood sugar: start, highest and back near the before-meal level, from the same moments as the ring', () => {
    const s = stripSummary('blood.glucose', sim('cola:1'), t, 'en')!
    expect(s).toMatch(/^Blood sugar starts at about \d+ mg\/dL, is highest at about \d+ mg\/dL after \d+ min, and is back .* by .+\.$/)
  })

  it('blood sugar that never clearly leaves its level says so (the graphs’ 5 mg/dL rule)', () => {
    expect(stripSummary('blood.glucose', sim('water:1'), t, 'en')).toMatch(/^Blood sugar stays near \d+ mg\/dL/)
  })

  it('energy: what came in and what the resting body used in the first 6 h', () => {
    expect(stripSummary('energy.inRate', sim('cola:1'), t, 'en')).toMatch(
      /^In the first 6 h, about \d+ kcal from this meal entered the body/,
    )
  })

  it('an empty meal has nothing to describe', () => {
    expect(stripSummary('blood.glucose', sim(''), t, 'en')).toBeNull()
  })

  it('with a kept meal, the description names it and adds its own sentence', () => {
    const d = stripDescription(
      stripSummary,
      'gut.stomach.contentG',
      sim('cola:1'),
      sim('cheeseburger:1,fries:1'),
      'Cheeseburger + French fries',
      t,
      'en',
    )!
    expect(d).toMatch(/^The stomach holds .+ Kept: Cheeseburger \+ French fries\. The stomach holds .+\.$/)
  })
})

describe('"Show as table"', () => {
  it('reads every row at 0, 15, 30, 45 min, 1, 1.5, 2, 3, 4, 6, 12, 24 and 48 h: the last row is the run’s own end', () => {
    expect(tableTimes(sim('cola:1').horizonMin)).toEqual([0, 15, 30, 45, 60, 90, 120, 180, 240, 360, 720, 1440, 2880])
    expect(tableTimes(600)).toEqual([0, 15, 30, 45, 60, 90, 120, 180, 240, 360, 600])
  })

  it('blood sugar: this meal, how much people differ (low ≤ value ≤ high), then the kept meal', () => {
    const run = sim('cola:1')
    const cols = tableColumns(['blood.glucose'], run, sim('apple:1'))
    expect(cols.map((c) => c.kind)).toEqual(['run', 'range', 'kept'])
    for (const min of tableTimes(run.horizonMin)) {
      const v = cellValue(cols[0]!, min, run.stepMin) as number
      const [low, high] = cellValue(cols[1]!, min, run.stepMin) as [number, number]
      expect(low).toBeLessThanOrEqual(v + 1e-6)
      expect(high).toBeGreaterThanOrEqual(v - 1e-6)
    }
  })

  it('energy: both lines of the graph, and only the first one for the kept meal (as drawn)', () => {
    const cols = tableColumns(['energy.inRate', 'energy.usedRate'], sim('cola:1'), sim('apple:1'))
    expect(cols.map((c) => `${c.kind}:${c.series.meta.id}`)).toEqual(['run:energy.inRate', 'run:energy.usedRate', 'kept:energy.inRate'])
  })

  it('the stomach at 0 min is the value the graph starts from', () => {
    const run = sim('roti:2,dal:1')
    const [col] = tableColumns(['gut.stomach.contentG'], run, null)
    expect(cellValue(col!, 0, run.stepMin)).toBe(run.signals.get('gut.stomach.contentG')!.values[0])
  })

  it('key moments of both meals, one row each, including one only the kept meal has', () => {
    const rows = momentRows(runMoments, sim('cola:1'), sim('roti:2,dal:1'))
    const leftovers = rows.find((r) => r.id === 'event.firstLeftovers')!
    // Cola has no fibre, so no leftovers: only the kept roti + dal has that moment.
    expect(leftovers.run).toBeUndefined()
    expect(leftovers.kept?.atMin).toBeGreaterThan(0)
    // "Mostly absorbed" is listed by its own name, not under one nutrient's graph (verify-1 S6).
    expect(rows.map((r) => r.id)).toContain('event.mostlyAbsorbed')
  })
})
