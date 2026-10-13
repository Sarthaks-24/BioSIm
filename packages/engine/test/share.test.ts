import { describe, expect, it } from 'vitest'
import { MODEL_VERSION, buildMeal, decodeActivity, decodeMeal, decodeShareState, encodeShareState } from '../src/index.ts'
import { lookup } from './fixtures.ts'

describe('share links', () => {
  it('round-trips a comparison, including language', () => {
    const state = { a: [{ foodId: 'glucose-50', servings: 1 }], b: [{ foodId: 'fatty-meal', servings: 1.5 }], t: 125, lang: 'hi' as const }
    const decoded = decodeShareState(encodeShareState(state))
    expect(decoded).toEqual({ modelVersion: MODEL_VERSION, organism: 'human', ...state })
  })

  it('a link made with model v1 still opens the same meals (format is a contract)', () => {
    const old = decodeShareState(new URLSearchParams('v=1&a=cola%3A1&b=cheeseburger%3A1%2Cfries%3A1&t=90'))
    expect(old.modelVersion).toBe(1)
    expect(old.a).toEqual([{ foodId: 'cola', servings: 1 }])
    expect(old.b).toEqual([
      { foodId: 'cheeseburger', servings: 1 },
      { foodId: 'fries', servings: 1 },
    ])
    expect(old.t).toBe(90)
    expect(old.organism).toBe('human')
    expect(old).not.toHaveProperty('unknownOrganism')
  })

  it('survives garbage without throwing', () => {
    const decoded = decodeShareState(new URLSearchParams('a=<script>,cola:abc,cola:99&b=&t=-5&v=xyz&lang=fr'))
    expect(decoded.a).toEqual([{ foodId: 'cola', servings: 5 }])
    expect(decoded.b).toEqual([])
    expect(decoded.t).toBe(0)
    expect(decoded.modelVersion).toBe(MODEL_VERSION)
    expect(decoded.lang).toBeUndefined()
  })

  it('merges a food listed twice instead of creating two rows', () => {
    expect(decodeMeal('cola:1,cola:2')).toEqual([{ foodId: 'cola', servings: 3 }])
  })

  it('clamps time to the 48 h window', () => {
    expect(decodeShareState(new URLSearchParams('t=999999')).t).toBe(48 * 60)
  })

  it('unknown foods in a link are skipped and reported', () => {
    const meal = buildMeal(decodeMeal('nope:1,glucose-50:2'), lookup)
    expect(meal.items.map((i) => i.food.id)).toEqual(['glucose-50'])
    expect(meal.unknownIds).toEqual(['nope'])
    expect(meal.total.carbsG).toBe(100)
  })

  it('a v1-style state is written exactly as v1 wrote it (no new parameters appear)', () => {
    const p = encodeShareState({ a: [{ foodId: 'cola', servings: 1 }], b: [{ foodId: 'water', servings: 1 }], t: 90, lang: 'hi' })
    expect(p.toString()).toBe(`v=${MODEL_VERSION}&a=cola%3A1&b=water%3A1&t=90&lang=hi`)
  })
})

describe('share links: v2 parameters (o, who, layer, in)', () => {
  const meal = [{ foodId: 'cola', servings: 1 }]
  const decode = (q: string) => decodeShareState(new URLSearchParams(q))

  it('o absent ⇒ human; o=human ⇒ human; o=human is never written', () => {
    expect(decode('a=cola:1').organism).toBe('human')
    expect(decode('o=human&a=cola:1')).toEqual(decode('a=cola:1'))
    const p = encodeShareState({ organism: 'human', a: meal, b: [], t: 0 })
    expect(p.has('o')).toBe(false)
    expect(decodeShareState(p).organism).toBe('human')
  })

  it('an unknown o opens human and is reported; its who/layer/in are not read', () => {
    const s = decode('v=9&o=frog&a=cola:1&t=30&who=frog-ref&layer=digestion&in=villus')
    expect(s).toEqual({ modelVersion: 9, organism: 'human', unknownOrganism: 'frog', a: meal, b: [], t: 30 })
    expect(decode('o=' + 'x'.repeat(500)).unknownOrganism).toHaveLength(40)
    expect(decode('o=').organism).toBe('human')
    expect(decode('o=')).not.toHaveProperty('unknownOrganism')
  })

  it('who, layer and in round-trip', () => {
    const state = { a: meal, b: [], t: 60, who: 'adult-ref' as const, layer: 'digestion', inside: 'villus', lang: 'en' as const }
    const p = encodeShareState(state)
    expect(p.toString()).toBe(`v=${MODEL_VERSION}&a=cola%3A1&t=60&who=adult-ref&layer=digestion&in=villus&lang=en`)
    expect(decodeShareState(p)).toEqual({ modelVersion: MODEL_VERSION, organism: 'human', ...state })
  })

  it('a bad who, layer or in is dropped, so the screen falls back to the default', () => {
    const s = decode('a=cola:1&who=teen-ref&layer=<script>&in=' + 'v'.repeat(41))
    expect(s).not.toHaveProperty('who')
    expect(s).not.toHaveProperty('layer')
    expect(s).not.toHaveProperty('inside')
    expect(decode('who=&layer=&in=')).toEqual(decode(''))
  })

  it('bo is reserved: read and ignored, never written', () => {
    const s = decode('a=cola:1&bo=frog')
    expect(s).toEqual(decode('a=cola:1'))
    expect(encodeShareState(s).has('bo')).toBe(false)
  })
})

describe('share links: activity (act, bact; E-3b-eng, architecture §2)', () => {
  const meal = [{ foodId: 'cola', servings: 1 }]
  const decode = (q: string) => decodeShareState(new URLSearchParams(q))
  const walk = { kind: 'walk', startMin: 30, durMin: 20 } as const
  const run = { kind: 'run', startMin: 240, durMin: 10 } as const

  it('act and bact round-trip, in start order, after every older parameter', () => {
    const state = { a: meal, b: meal, t: 60, act: [run, walk], bact: [{ kind: 'walkBrisk', startMin: 0, durMin: 60 }] as const }
    const p = encodeShareState({ ...state, bact: [...state.bact] })
    expect(p.toString()).toBe(`v=${MODEL_VERSION}&a=cola%3A1&b=cola%3A1&t=60&act=walk.30.20%2Crun.240.10&bact=walkBrisk.0.60`)
    expect(decodeShareState(p)).toEqual({
      modelVersion: MODEL_VERSION,
      organism: 'human',
      a: meal,
      b: meal,
      t: 60,
      act: [walk, run],
      bact: state.bact,
    })
  })

  it('a resting run writes no act or bact, and an empty act reads as resting', () => {
    expect(encodeShareState({ a: meal, b: [], t: 0, act: [], bact: [] }).toString()).toBe(`v=${MODEL_VERSION}&a=cola%3A1`)
    expect(decode('a=cola:1&act=&bact=')).toEqual(decode('a=cola:1'))
  })

  it('drops and names what it cannot show: hidden or unknown kinds, out of limits, overlaps, past the eighth', () => {
    const changes: { param: string; asked: string }[] = []
    const bouts = decodeActivity(
      'football.0.30,jog.40.10,walk.2881.5,walk.10.4,run.0.121,walk.100.20,run.110.10,<script>,walk.300.20',
      'act',
      changes,
    )
    expect(bouts).toEqual([
      { kind: 'walk', startMin: 100, durMin: 20 },
      { kind: 'walk', startMin: 300, durMin: 20 },
    ])
    expect(changes.map((c) => c.asked)).toEqual([
      'football.0.30',
      'jog.40.10',
      'walk.2881.5',
      'walk.10.4',
      'run.0.121',
      '<script>',
      'run.110.10',
    ])
    expect(changes.every((c) => c.param === 'act')).toBe(true)
    // At most 8 bouts; a bout may start the minute the one before it ends.
    const nine = Array.from({ length: 9 }, (_, i) => `walk.${i * 20}.20`).join(',')
    const more: { param: string; asked: string }[] = []
    expect(decodeActivity(nine, 'bact', more)).toHaveLength(8)
    expect(more).toEqual([{ param: 'bact', asked: 'walk.160.20' }])
  })

  it('a huge act is not read part by part, and never throws', () => {
    const changes: { param: string; asked: string }[] = []
    expect(decodeActivity(Array.from({ length: 5000 }, () => 'walk.0.5').join(','), 'act', changes)).toEqual([
      { kind: 'walk', startMin: 0, durMin: 5 },
    ])
    expect(changes.length).toBeLessThanOrEqual(17)
    expect(decode('act=%00%FF,,,.&bact=walk..')).toEqual(decode(''))
  })

  it('an unknown organism’s bouts are not read', () => {
    expect(decode('o=frog&a=cola:1&act=walk.30.20')).not.toHaveProperty('act')
  })

  it('every v1 and v2 link fixture decodes exactly as before (no act, no bact)', () => {
    for (const q of [
      'v=1&a=cola%3A1&b=cheeseburger%3A1%2Cfries%3A1&t=90',
      'v=2&a=cola:1&who=adult-ref&layer=digestion&in=villus&lang=hi',
      'v=3&a=roti:2,dal:1&t=120',
    ]) {
      const s = decode(q)
      expect(s).not.toHaveProperty('act')
      expect(s).not.toHaveProperty('bact')
      expect(encodeShareState(s).has('act')).toBe(false)
    }
  })
})
