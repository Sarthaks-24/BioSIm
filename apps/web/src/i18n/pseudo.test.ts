import { describe, expect, it } from 'vitest'
import en from './en.json'
import { pseudoBundle, pseudoText } from './pseudo.ts'

const placeholders = (s: string) => [...s.matchAll(/{{(\w+)}}/g)].map((m) => m[1]).sort()

describe('pseudo-locale (+40 %)', () => {
  it('is about 40 % longer, accented, in brackets', () => {
    const out = pseudoText('Half has left the stomach')
    expect(out).toMatch(/^⟦.*⟧$/)
    expect(out.length).toBeGreaterThanOrEqual(Math.round('Half has left the stomach'.length * 1.4))
    expect(out).not.toMatch(/[a-z]{3}/)
  })

  it('keeps what the app fills in or reads: placeholders, bold marks, web addresses', () => {
    expect(pseudoText('{{n}} kcal')).toContain('{{n}}')
    expect(pseudoText('**Short version:** see https://vercel.com/legal/privacy-policy.')).toMatch(/^⟦\*\*.*\*\*.*https:\/\/vercel\.com\/legal\/privacy-policy\.⟧$/)
  })

  it('every English string keeps its placeholders and list lengths', () => {
    const walk = (a: unknown, b: unknown, key: string) => {
      if (typeof a === 'string') expect(placeholders(b as string), key).toEqual(placeholders(a))
      else if (Array.isArray(a)) {
        expect((b as unknown[]).length, key).toBe(a.length)
        a.forEach((v, i) => walk(v, (b as unknown[])[i], `${key}[${i}]`))
      } else if (a && typeof a === 'object') for (const [k, v] of Object.entries(a)) walk(v, (b as Record<string, unknown>)[k], `${key}.${k}`)
    }
    walk(en, pseudoBundle(en), 'en')
  })
})
