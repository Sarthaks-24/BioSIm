import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from './en.json'
import hi from './hi.json'

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

  it('every key used in code exists, and every key in en.json is used', () => {
    const { called, literal, prefixes } = keysInSource()
    for (const k of called) expect(fe.has(k) || [...fe.keys()].some((f) => f.startsWith(`${k}.`)), `missing key ${k}`).toBe(true)
    const used = (k: string) =>
      literal.has(k) || [...literal].some((l) => k.startsWith(`${l}.`)) || [...prefixes].some((p) => p && k.startsWith(p))
    const unused = [...fe.keys()].filter((k) => !used(k))
    expect(unused).toEqual([])
  })
})
