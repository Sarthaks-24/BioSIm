import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from './en.json'
import hi from './hi.json'

/**
 * The framing lint (G10, plan-graphs §3.8): no screen text may score a food or a body. Blood
 * sugar is "highest" and "back near the before-meal level", never a spike or a crash; energy is
 * described ("When more comes in than is used, the body stores the extra for later"), never
 * something to burn off; no food is bad, junk or dangerous. A 13-year-old reads a label as a
 * verdict on what they ate, so these words are banned outright, not left to review.
 *
 * Matching is whole-word and case-insensitive, over every string in en.json, hi.json and the
 * food files (content/foods/*.json, both languages).
 */

/** English: the plan's list, with the inflections a translator would reach for. */
const BANNED_EN = [
  'spike',
  'spikes',
  'spiked',
  'spiking',
  'crash',
  'crashes',
  'crashed',
  'crashing',
  'sugar rush',
  'sugar high',
  'bad',
  'unhealthy',
  'danger',
  'dangers',
  'dangerous',
  'junk',
  'junk food',
  'burn off',
  'burns off',
  'burned off',
  'burnt off',
  'burning off',
  'burn it',
  'burn it off',
  'burn them off',
  'work it off',
]

/**
 * Hindi: bad, harmful, dangerous (with and without the nukta) until the Hindi reviewer adds the
 * rest of the list (03 WP-13; i18n/REVIEW.md asks for it).
 */
const BANNED_HI = ['खराब', 'ख़राब', 'हानिकारक', 'खतरनाक', 'ख़तरनाक']

/**
 * A word or phrase as a whole-word, case-insensitive pattern. `\b` only knows ASCII letters, so
 * the edges are "no letter, mark or digit on either side" in Unicode terms: Devanagari vowel
 * signs are marks, so "खराबी" does not hide a "खराब" and "badge" never matches "bad".
 */
function bannedPattern(phrase: string): RegExp {
  const body = phrase
    .normalize('NFC')
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${body}(?![\\p{L}\\p{M}\\p{N}])`, 'iu')
}

/** Every string in a JSON value, with its path ("graph.highest", "name.hi"). */
function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`))
  if (value && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k))
  return []
}

/** "file › path: phrase" for every banned phrase found in the strings. */
function findBanned(file: string, entries: [string, string][], phrases: readonly string[]): string[] {
  const patterns = phrases.map((p) => [p, bannedPattern(p)] as const)
  const hits: string[] = []
  for (const [path, text] of entries) {
    const t = text.normalize('NFC')
    for (const [phrase, re] of patterns) if (re.test(t)) hits.push(`${file} › ${path}: "${phrase}"`)
  }
  return hits
}

const ALL = [...BANNED_EN, ...BANNED_HI]
const foodsDir = fileURLToPath(new URL('../../../../content/foods/', import.meta.url))
const foodFiles = readdirSync(foodsDir).filter((f) => f.endsWith('.json'))

describe('framing lint: no banned words on screen', () => {
  it('matches whole words only, ignoring case, in both scripts', () => {
    expect(bannedPattern('bad').test('A Bad meal')).toBe(true)
    expect(bannedPattern('bad').test('badge, Baden')).toBe(false)
    expect(bannedPattern('burn off').test('to burn  it off')).toBe(false)
    expect(bannedPattern('burn it off').test('Burn it off!')).toBe(true)
    expect(bannedPattern('sugar rush').test('a sugar\nrush')).toBe(true)
    expect(bannedPattern('खराब').test('यह खराब है')).toBe(true)
    expect(bannedPattern('खराब').test('खराबी')).toBe(false)
    // The nukta written as one letter or as two (NFC keeps it as two).
    expect(bannedPattern('ख़राब').test('ख़राब')).toBe(true)
  })

  it('en.json has none', () => {
    expect(findBanned('en.json', strings(en), ALL)).toEqual([])
  })

  it('hi.json has none (Hindi and any English left in it)', () => {
    expect(findBanned('hi.json', strings(hi), ALL)).toEqual([])
  })

  it('the food files have none', () => {
    expect(foodFiles.length).toBeGreaterThan(0)
    const hits = foodFiles.flatMap((f) => findBanned(f, strings(JSON.parse(readFileSync(foodsDir + f, 'utf8'))), ALL))
    expect(hits).toEqual([])
  })

  it('would catch a banned word slipped into a string', () => {
    const planted: [string, string][] = [
      ['a', 'Cola gives a sugar spike'],
      ['b', 'Walk to burn it off'],
      ['c', 'यह भोजन हानिकारक है'],
    ]
    const caught = new Set(findBanned('test', planted, ALL).map((hit) => hit.split(':')[0]))
    expect([...caught]).toEqual(['test › a', 'test › b', 'test › c'])
  })
})
