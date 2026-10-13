import { describe, expect, it } from 'vitest'
import { MODEL_VERSION, buildMeal, decodeMeal, decodeShareState, encodeShareState } from '../src/index.ts'
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

// B21 (FP-6): a link that this version changes on load says so. `changes` names each part.
describe('share links: what changed on load (changes)', () => {
  const decode = (q: string) => decodeShareState(new URLSearchParams(q))

  it('a link this version shows as written has no changes', () => {
    for (const q of [
      'v=2&a=cola:1',
      'v=2&a=roti:2,dal:1,milk:1&b=cheeseburger:1,fries:1&t=90',
      'a=cola:1,cola:2',
      'v=1&a=cola:0.25&lang=hi',
      '',
    ])
      expect(decode(q)).not.toHaveProperty('changes')
  })

  it('names servings it changed, foods past the sixth and parts it could not read', () => {
    expect(decode('a=cola:999').changes).toEqual([{ param: 'a', asked: 'cola:999', shown: '5' }])
    expect(decode('b=milk:0.3').changes).toEqual([{ param: 'b', asked: 'milk:0.3', shown: '0.25' }])
    expect(decode('a=water:1,milk:1,roti:1,dal:1,apple:1,banana:1,cola:1,fries:1').changes).toEqual([
      { param: 'a', asked: 'cola:1' },
      { param: 'a', asked: 'fries:1' },
    ])
    expect(decode('a=<script>,cola:1,').changes).toEqual([{ param: 'a', asked: '<script>' }])
  })

  it('names a time past the end, and parameters it could not read', () => {
    expect(decode('t=99999').changes).toEqual([{ param: 't', asked: '99999' }])
    expect(decode('v=xyz&t=-5&lang=fr&who=teen-ref&layer=<b>').changes?.map((c) => c.param)).toEqual(['v', 't', 'lang', 'who', 'layer'])
  })

  it('names activity bouts, which this version cannot show', () => {
    expect(decode('v=3&a=cola:1&act=walk.120.20').changes).toEqual([{ param: 'act', asked: 'walk.120.20' }])
  })

  it('a huge link is read only so far, and the rest is one change', () => {
    const s = decode('a=' + Array.from({ length: 5000 }, () => 'x').join(','))
    expect(s.changes).toHaveLength(13)
    expect(s.changes!.every((c) => c.asked.length <= 40)).toBe(true)
  })

  /**
   * Fuzz (qa-fixes FP-6): canon(encode(decode(x))) ≠ canon(x) ⇒ at least one note. A note is a
   * change, an unknown organism, or a link from another model version (the stage's notes).
   * canon() is how a link reads: the parameters this version knows, numbers as numbers, a food
   * listed twice summed, `t` in whole minutes, `o=human` and empty values as absent.
   */
  it('fuzz: every link that comes back different has a note', () => {
    const ITEM = /^([a-z0-9-]{1,40}):(\d+(?:\.\d+)?)$/
    const meal = (raw: string | null) => {
      const sum = new Map<string, number>()
      const bad: string[] = []
      for (const part of (raw ?? '').split(',')) {
        const m = ITEM.exec(part.trim())
        if (m) sum.set(m[1]!, (sum.get(m[1]!) ?? 0) + Number(m[2]))
        else if (part.trim()) bad.push(part)
      }
      return [...[...sum].map(([f, n]) => `${f}:${n}`), ...bad].join(',')
    }
    const canon = (q: URLSearchParams) => {
      const out: string[] = []
      const v = q.get('v')
      out.push(`v=${v || MODEL_VERSION}`)
      const o = q.get('o')
      if (o && o !== 'human') out.push(`o=${o}`)
      for (const k of ['a', 'b']) if (meal(q.get(k))) out.push(`${k}=${meal(q.get(k))}`)
      const t = q.get('t')
      const tn = Number(t)
      if (t && tn !== 0) out.push(`t=${Number.isFinite(tn) ? Math.round(tn) : t}`)
      for (const k of ['who', 'layer', 'in', 'lang', 'act', 'bact']) if (q.get(k)) out.push(`${k}=${q.get(k)}`)
      return out.join('&')
    }
    // [values a link this version shows as written, odd ones]. Most links get at most one odd part,
    // so a change that goes unsaid is not hidden by another change's note.
    const POOL: Record<string, [string[], string[]]> = {
      v: [
        ['', '1', '2'],
        ['3', '0', '-1', '1.5', 'abc'],
      ],
      o: [
        ['', 'human'],
        ['frog', 'x'.repeat(50)],
      ],
      t: [
        ['', '0', '60', '90.4', '2880', '1e3'],
        ['-5', 'abc', '2881', '99999', 'Infinity'],
      ],
      who: [
        ['', 'adult-ref'],
        ['teen-ref', '<x>'],
      ],
      layer: [
        ['', 'digestion', 'circulation'],
        ['<x>', 'v'.repeat(41)],
      ],
      in: [['', 'villus'], ['<x>']],
      lang: [
        ['', 'en', 'hi'],
        ['fr', 'pseudo'],
      ],
      act: [[''], ['walk.120.20']],
      bact: [[''], ['run.0.30']],
      bo: [['', 'frog'], []],
      utm_source: [['', 'whatsapp'], []],
    }
    const PARTS: [string[], string[]] = [
      ['cola:1', 'fries:0.5', 'cola:2', 'water:1.25', 'apple:5', '', '  cola:1 ', 'a-b:01', 'roti:2', 'dal:1', 'milk:1', 'idli:1'],
      ['roti:999', 'dal:0', 'milk:0.3', 'banana:5.01', 'COLA:1', '<x>', 'idli:abc', 'egg:1.10', 'x'.repeat(41) + ':1'],
    ]
    let seed = 42
    // The high bits of the LCG: its low bits repeat with a short period.
    const rand = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), Math.floor((seed / 2 ** 31) * n))
    const pick = ([good, odd]: [string[], string[]]) => (odd.length && !rand(25) ? odd[rand(odd.length)]! : good[rand(good.length)]!)
    let changed = 0
    for (let i = 0; i < 10000; i++) {
      const q = new URLSearchParams()
      for (const [k, pool] of Object.entries(POOL)) if (rand(2)) q.set(k, pick(pool))
      for (const k of ['a', 'b']) if (rand(3)) q.set(k, Array.from({ length: rand(12) }, () => pick(PARTS)).join(','))
      const s = decodeShareState(q)
      if (canon(encodeShareState(s)) === canon(q)) continue
      changed++
      const noted = !!s.changes?.length || !!s.unknownOrganism || s.modelVersion !== MODEL_VERSION
      expect(noted, `?${q} came back as ?${encodeShareState(s)} with no note`).toBe(true)
    }
    expect(changed).toBeGreaterThan(2000)
  })
})
