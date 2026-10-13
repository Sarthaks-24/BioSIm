import { describe, expect, it } from 'vitest'
import { USER_PLACEHOLDERS, findPlaceholders } from './lint-placeholders.mjs'

describe('placeholder lint', () => {
  it('finds the user-owned placeholders, in English and Hindi', () => {
    const found = findPlaceholders('{"a": "email: **<project email>**",\n"b": "ईमेल करें: <प्रोजेक्ट ईमेल>"}')
    expect(found.map((f) => [f.line, f.found])).toEqual([
      [1, '<project email>'],
      [2, '<प्रोजेक्ट ईमेल>'],
    ])
    expect(found.every((f) => f.owner.startsWith('user'))).toBe(true)
  })

  it('finds TO VERIFY anywhere, and TODO/TBD only in strings files', () => {
    expect(findPlaceholders('// TO VERIFY: the source').map((f) => f.found)).toEqual(['TO VERIFY'])
    expect(findPlaceholders('"x": "TBD"')).toEqual([])
    expect(findPlaceholders('"x": "TBD"', { strings: true }).map((f) => f.found)).toEqual(['TBD'])
  })

  it('leaves ordinary text and links alone', () => {
    expect(findPlaceholders('See <https://example.org> and the date 2026-10-20. Todos are fine.', { strings: true })).toEqual([])
  })

  it('names every user placeholder with its owner', () => {
    for (const p of USER_PLACEHOLDERS) expect(p.owner).toMatch(/^user: /)
  })
})
