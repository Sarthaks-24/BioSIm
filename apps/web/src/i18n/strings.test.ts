import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from './en.json'
import hi from './hi.json'
import { LESSONS } from '../lib/presets.ts'

/**
 * FP-8 strings (T9a; qa-fixes §1). The tag for the "assumption" status is "Model estimate", not
 * "Best guess" (D-5, R44): the values change, the keys stay. Its help keeps the meaning "worked
 * out by the app's maths, not measured". Teach step 2 says what the first lesson's link does (B23).
 */

/** Every string in a JSON tree. */
const strings = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []

const root = fileURLToPath(new URL('..', import.meta.url))
const self = fileURLToPath(import.meta.url)
function sources(dir = root, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) sources(path, out)
    else if (/\.tsx?$/.test(name) && path !== self) out.push(path)
  }
  return out
}

describe('the "Model estimate" tag (D-5, R44)', () => {
  it('no English string says "best guess"', () => {
    expect(strings(en).filter((s) => /best guess/i.test(s))).toEqual([])
  })

  it('no source file has "Best guess" written into it', () => {
    const found = sources().filter((f) => /best guess/i.test(readFileSync(f, 'utf8')))
    expect(found.map((f) => relative(root, f))).toEqual([])
  })

  it('keeps its keys, with the new tag and a help that says it is worked out, not measured', () => {
    expect(en.status.assumption.label).toBe('Model estimate')
    expect(en.status.assumption.help).toMatch(/worked out by the app's maths/i)
    expect(en.status.assumption.help).toMatch(/not measured/i)
  })
})

describe('Teach step 2 (B23)', () => {
  it('says the first lesson opens at its time, and that Home goes back to eating', () => {
    const step2 = en.teach.steps[1]!
    expect(step2).toContain(`opens at ${LESSONS[0]!.t} min`)
    expect(step2).toMatch(/press Home/)
  })
})

/**
 * R9 (content-i18n §0): a book value names its book ("Older NCERT Class 7 book (2024-25) says"),
 * never "your book": the class may use another book, or none. Every screen string is checked, in
 * both languages, and every string written into a source file (comments may still name the rule).
 */
describe('never "your book" on screen (R9)', () => {
  const YOUR_BOOK = /\byour\s+(text)?book/i
  const YOUR_BOOK_HI = /(आपकी|तुम्हारी|अपनी)\s+(पाठ्य)?(पुस्तक|किताब)/

  it('no English or Hindi string says it', () => {
    expect(strings(en).filter((s) => YOUR_BOOK.test(s))).toEqual([])
    expect(strings(hi).filter((s) => YOUR_BOOK.test(s) || YOUR_BOOK_HI.test(s))).toEqual([])
  })

  it('no source file has it in a string', () => {
    const quoted = /'[^'\n]*'|"[^"\n]*"|`[^`]*`|>[^<>{}\n]+</g
    const found = sources().filter((f) => {
      const code = readFileSync(f, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
        .join('\n')
      return [...code.matchAll(quoted)].some((m) => YOUR_BOOK.test(m[0]) || YOUR_BOOK_HI.test(m[0]))
    })
    expect(found.map((f) => relative(root, f))).toEqual([])
  })

  it('the check catches it', () => {
    expect(YOUR_BOOK.test('Your book says 15–18')).toBe(true)
    expect(YOUR_BOOK.test('as in your textbook')).toBe(true)
    expect(YOUR_BOOK_HI.test('आपकी पुस्तक कहती है')).toBe(true)
    expect(YOUR_BOOK.test('Older NCERT Class 7 book (2024-25) says')).toBe(false)
  })
})
