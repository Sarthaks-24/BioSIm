import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from './en.json'
import hi from './hi.json'
import { catalogKeys, registryKeys } from '../registry/i18nKeys.ts'
import { REVIEW_FILE, STATUS, reviewRows, syncReview } from '../../scripts/hi-review.mjs'

/** Flatten to "a.b.c" → value, with arrays as a single entry holding their length. */
function flatten(obj: unknown, prefix = ''): Map<string, unknown> {
  const out = new Map<string, unknown>()
  if (Array.isArray(obj)) out.set(prefix, `array:${obj.length}`)
  else if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) for (const [kk, vv] of flatten(v, prefix ? `${prefix}.${k}` : k)) out.set(kk, vv)
  } else out.set(prefix, obj)
  return out
}

const placeholders = (s: unknown) => (typeof s === 'string' ? [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort() : [])

/** All t('…') / t(`…`) keys in the app source. Template keys like `stages.${s}.name` become prefixes. */
function keysInSource() {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const called = new Set<string>()
  const literal = new Set<string>()
  const prefixes = new Set<string>()
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) walk(path)
      else if (/\.tsx?$/.test(name) && !name.endsWith('.test.ts')) {
        const src = readFileSync(path, 'utf8')
        for (const m of src.matchAll(/t\(\s*'([\w.]+)'/g)) called.add(m[1]!)
        // Any quoted dotted string counts, so keys passed through helpers (e.g. list('teach.steps')) are seen too.
        for (const m of src.matchAll(/'(\w+\.[\w.]+)'/g)) literal.add(m[1]!)
        for (const m of src.matchAll(/\bt\(\s*`([\w.]*)\$\{/g)) prefixes.add(m[1]!)
      }
    }
  }
  walk(root)
  return { called, literal, prefixes }
}

describe('translations', () => {
  const fe = flatten(en)
  const fh = flatten(hi)

  it('Hindi has exactly the English keys', () => {
    expect([...fh.keys()].sort()).toEqual([...fe.keys()].sort())
  })

  it('placeholders and list lengths match', () => {
    for (const [key, value] of fe) {
      if (typeof value === 'string' && value.startsWith('array:')) expect(fh.get(key), key).toBe(value)
      else expect(placeholders(fh.get(key)), key).toEqual(placeholders(value))
    }
  })

  // Keys built at run time from the catalog and the registry (`${i18nKey}.name` …).
  const catalog = catalogKeys()
  const registry = registryKeys()
  const built = new Set([...catalog.required, ...catalog.optional, ...registry.required, ...registry.optional])

  it('every catalog and registry key exists as text', () => {
    const missing = [...catalog.required, ...registry.required].filter((k) => typeof fe.get(k) !== 'string')
    expect(missing).toEqual([])
  })

  it('every key used in code exists, and every key in en.json is used', () => {
    const { called, literal, prefixes } = keysInSource()
    for (const k of called) expect(fe.has(k) || [...fe.keys()].some((f) => f.startsWith(`${k}.`)), `missing key ${k}`).toBe(true)
    // A plural form (summary.amount_one, _other) is used where its key is (i18next picks the form by `count`).
    const used = (key: string, k = key.replace(/_(zero|one|two|few|many|other)$/, '')) =>
      built.has(k) || literal.has(k) || [...literal].some((l) => k.startsWith(`${l}.`)) || [...prefixes].some((p) => p && k.startsWith(p))
    const unused = [...fe.keys()].filter((k) => !used(k))
    expect(unused).toEqual([])
  })

  // 00 gate 3.1 / 03 WP-18: every Hindi string has a reviewer status, and the list shows the texts
  // that ship. Fix with: node apps/web/scripts/hi-review.mjs --write
  it('REVIEW.md lists every Hindi string, with its current texts and a status', () => {
    const markdown = readFileSync(REVIEW_FILE, 'utf8')
    expect(syncReview(markdown).problems).toEqual([])
    for (const row of reviewRows(markdown)) expect(row.status, row.key).toMatch(STATUS)
  })

  // Review FIX-D + WP-18, LOW 5: the list's own rules, on a made-up list.
  it('a reviewed row goes back to draft when its Hindi or its English changes; a malformed status is a problem', () => {
    const texts = {
      en: new Map([
        ['a', 'One'],
        ['b', 'Two'],
        ['c', 'Three'],
        ['d', 'Four'],
      ]),
      hi: new Map([
        ['a', 'एक'],
        ['b', 'दो'],
        ['c', 'तीन'],
        ['d', 'चार'],
      ]),
    }
    const row = (key: string, en: string, hi: string, status: string) => `| \`${key}\` | ${en} | ${hi} | ${status} |`
    const before = [
      row('a', 'One', 'एक', 'reviewed by AB 2026-10-01'),
      row('b', 'Two (old)', 'दो', 'reviewed by AB 2026-10-01'),
      row('c', 'Three', 'तीन (पुराना)', 'reviewed by AB 2026-10-01'),
      row('d', 'Four', 'चार', 'Reviewed by AB'),
    ].join('\n')
    const { markdown, problems } = syncReview(before, texts)
    expect(reviewRows(markdown).map((r) => [r.key, r.status])).toEqual([
      ['a', 'reviewed by AB 2026-10-01'],
      ['b', 'draft'],
      ['c', 'draft'],
      ['d', 'draft'],
    ])
    expect(problems).toEqual([
      'b: English differs from en.json',
      'c: Hindi differs from hi.json',
      'd: status "Reviewed by AB" is neither draft nor "reviewed by <initials> <YYYY-MM-DD>"',
    ])
    expect(syncReview(markdown, texts).problems).toEqual([])
  })
})
