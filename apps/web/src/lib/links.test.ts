import { describe, expect, it } from 'vitest'
import { MODEL_VERSION, decodeShareState, encodeShareState } from '@lifepeek/engine'
import { V1_LINKS } from './v1-links.fixture.ts'
import { PRESETS, presetHref } from './presets.ts'

/** The link contract (ROADMAP Step 0d): every v1 link opens as before, as human. */

const query = (href: string) => new URLSearchParams(href.split('?')[1] ?? '')
const decode = (href: string) => decodeShareState(query(href))
const withFrog = (href: string) => `${href}${href.includes('?') ? '&' : '?'}o=frog`

describe('v1 links still open the same meals', () => {
  it.each(V1_LINKS.map((l) => [l.href, l] as const))('%s', (href, link) => {
    const s = decode(href)
    expect(s.organism).toBe('human')
    expect(s).not.toHaveProperty('unknownOrganism')
    expect({ a: s.a, b: s.b, t: s.t }).toEqual({ a: link.a, b: link.b, t: link.t })
    expect(s.modelVersion).toBe(link.modelVersion ?? MODEL_VERSION)
    expect(s.lang).toBe(link.lang)
  })

  it('a v2 link written again comes out with the same parameters (nothing new is added)', () => {
    for (const link of V1_LINKS.filter((l) => l.modelVersion === MODEL_VERSION)) {
      expect([...encodeShareState(decode(link.href))], link.href).toEqual([...query(link.href)])
    }
  })

  it('the presets still make the links in the fixture', () => {
    const hrefs = V1_LINKS.map((l) => l.href)
    for (const p of PRESETS) expect(hrefs, p.key).toContain(presetHref(p))
  })
})

describe('organism parameter', () => {
  it('a link with o=frog opens as human with the same meals, and says so', () => {
    for (const link of V1_LINKS) {
      const s = decode(withFrog(link.href))
      expect(s.organism).toBe('human')
      expect(s.unknownOrganism).toBe('frog')
      expect({ a: s.a, b: s.b, t: s.t }).toEqual({ a: link.a, b: link.b, t: link.t })
    }
  })

  it('encodeShareState never writes o (human is the default, forever)', () => {
    for (const link of V1_LINKS) {
      const s = decode(link.href)
      expect(encodeShareState(s).has('o')).toBe(false)
      expect(encodeShareState({ ...s, organism: 'human' }).has('o')).toBe(false)
      expect(encodeShareState(decode(withFrog(link.href))).has('o')).toBe(false)
    }
  })
})
