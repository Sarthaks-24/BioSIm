import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from './en.json'
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
