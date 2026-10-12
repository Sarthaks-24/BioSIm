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
})
