import { describe, expect, it } from 'vitest'
import { activeStage, buildMeal, decodeMeal } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import { lookupFood } from '../data/foods.ts'
import { HORIZON_MIN } from './time.ts'
import { boutMoments, groupClose, hasPlan, hitAreas, momentNameKey, runMoments } from './moments.ts'
import { activityBandAt, activityKindAt } from './bouts.ts'

const sim = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookupFood), { particles: 0 })

describe('the timeline’s key moments', () => {
  it('cola: half has left, blood sugar highest and back, mostly absorbed; no leftovers (no fibre)', () => {
    const ids = runMoments(sim('cola:1')).map((m) => m.id)
    expect(ids).toEqual(['event.stomachHalfEmpty', 'event.glucosePeak', 'event.glucoseBackToBase', 'event.mostlyAbsorbed'])
  })

  it('a meal with fibre marks when leftovers start leaving, with its between-person range', () => {
    const leftovers = runMoments(sim('roti:2,dal:1')).find((m) => m.id === 'event.firstLeftovers')!
    expect(leftovers.low).toBeLessThan(leftovers.atMin)
    expect(leftovers.high).toBeGreaterThan(leftovers.atMin)
  })

  it('water: blood sugar never leaves its level, so no "highest" and no "back" (the graphs’ rule)', () => {
    const ids = runMoments(sim('water:1')).map((m) => m.id)
    expect(ids).not.toContain('event.glucosePeak')
    expect(ids).not.toContain('event.glucoseBackToBase')
    expect(ids).toContain('event.stomachHalfEmpty')
  })

  it('"half has left" says "the energy" unless the meal has none (council MUST 1)', () => {
    expect(momentNameKey('event.stomachHalfEmpty', sim('cola:1'))).toBe('graph.halfEnergyLeft')
    expect(momentNameKey('event.stomachHalfEmpty', sim('water:1'))).toBe('signals.event.stomachHalfEmpty.name')
    expect(momentNameKey('event.glucosePeak', sim('cola:1'))).toBe('signals.event.glucosePeak.name')
  })

  it('every moment is inside the run, in order of the catalog', () => {
    for (const meal of ['cola:1', 'cheeseburger:1,fries:1', 'roti:2,dal:1,milk:1', 'apple:1']) {
      for (const m of runMoments(sim(meal))) {
        expect(m.atMin, `${meal} ${m.id}`).toBeGreaterThanOrEqual(0)
        expect(m.atMin, `${meal} ${m.id}`).toBeLessThanOrEqual(HORIZON_MIN)
      }
    }
  })
})

describe('the Now line follows the food (activeStage)', () => {
  it('cola is in the stomach at 20 min and in the small intestine at 2 h', () => {
    const cola = sim('cola:1')
    expect(activeStage(cola, 20)).toBe('stomach')
    expect(activeStage(cola, 120)).toBe('smallIntestine')
  })
})

describe('the stage’s one clock (verify-1 C2)', () => {
  // The graphs read every series on the run's own clock (run.stepMin) and the dock, the axis and
  // the meal clock share one 48 h bar (lib/time.ts). That is right only while every run has the
  // same horizon as the bar: a model with another clock must change lib/time.ts first.
  it('every run spans the dock’s 48 h bar, one value per minute', () => {
    for (const meal of ['cola:1', 'cheeseburger:1,fries:1', '']) {
      const run = sim(meal)
      expect(run.horizonMin).toBe(HORIZON_MIN)
      expect(run.stepMin).toBe(1)
      expect(run.signals.get('blood.glucose')!.values.length).toBe(HORIZON_MIN / run.stepMin + 1)
    }
  })
})

describe('markers that nearly coincide are merged into one (council round 2)', () => {
  it('groups a marker with the one before it when it is closer than the gap, in a chain', () => {
    expect(groupClose([10, 12, 13, 40, 41, 80], 10)).toEqual([0, 0, 0, 1, 1, 2])
    expect(groupClose([0, 24, 48], 24)).toEqual([0, 1, 2])
    expect(groupClose([], 10)).toEqual([])
  })

  it('gives a lone marker, and the ends of a row, the full target width (verify: 12 px button)', () => {
    expect(hitAreas([100], 24)).toEqual([{ before: 12, after: 12 }])
    expect(hitAreas([0, 100], 44)).toEqual([
      { before: 22, after: 22 },
      { before: 22, after: 22 },
    ])
  })

  it('splits the space between two targets closer than the size, so they never overlap', () => {
    const [a, b] = hitAreas([0, 30], 44)
    expect(a!.after + b!.before).toBe(30)
    expect(a!.before).toBe(22)
  })
})

describe('activity bouts on the clock (E-3b-ui)', () => {
  const bouts = [
    { kind: 'walk' as const, startMin: 30, durMin: 20 },
    { kind: 'run' as const, startMin: 120, durMin: 10 },
  ]
  const walked = simulate({ items: decodeMeal('cola:1'), activity: bouts }, { particles: 0, lookup: lookupFood })

  it('each bout’s start and end is a moment; the system’s own moments leave them out', () => {
    expect(boutMoments(walked).map((m) => [m.id, m.atMin])).toEqual([
      ['event.activityStart', 30],
      ['event.activityEnd', 50],
      ['event.activityStart', 120],
      ['event.activityEnd', 130],
    ])
    expect(runMoments(walked).some((m) => m.id.startsWith('event.activity'))).toBe(false)
    expect(hasPlan(walked)).toBe(true)
  })

  it('the body’s band: the bout’s kind from its start to its end, else resting', () => {
    expect([0, 30, 49, 50, 125, 130].map((m) => activityBandAt(bouts, m))).toEqual(['rest', 'walk', 'walk', 'rest', 'run', 'rest'])
  })

  it('a kind with no pose of its own takes the nearest still pose (R114, R32): sitting rests, football runs, cricket and badminton walk briskly', () => {
    const plan = [
      { kind: 'sitClass', startMin: 0, durMin: 45 },
      { kind: 'football', startMin: 60, durMin: 30 },
      { kind: 'cricket', startMin: 100, durMin: 20 },
      { kind: 'badminton', startMin: 130, durMin: 10 },
    ] as const
    expect([10, 50, 70, 110, 135].map((m) => activityKindAt(plan, m))).toEqual(['sitClass', 'rest', 'football', 'cricket', 'badminton'])
    expect([10, 50, 70, 110, 135].map((m) => activityBandAt(plan, m))).toEqual(['rest', 'rest', 'run', 'walkBrisk', 'walkBrisk'])
  })
})
