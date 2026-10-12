import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { Food } from '@lifepeek/engine'
import { FOODS, isUsableFood } from './foods.ts'

/** The browser's quick food check (foods.ts) never lets through what the full schema rejects in CI. */

const dir = fileURLToPath(new URL('../../../../content/foods/', import.meta.url))
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
const read = (f: string): unknown => JSON.parse(readFileSync(dir + f, 'utf8'))

describe('food files', () => {
  it.each(files)('%s passes the full schema and the quick check', (f) => {
    const data = read(f)
    expect(Food.safeParse(data).success).toBe(true)
    expect(isUsableFood(data)).toBe(true)
  })

  it('the app loads every file', () => {
    expect(FOODS.map((f) => `${f.id}.json`).sort()).toEqual([...files].sort())
  })

  it('the quick check skips a broken file', () => {
    const good = read(files[0]!) as Record<string, unknown>
    const broken: unknown[] = [
      null,
      { ...good, id: 'Not Kebab' },
      { ...good, phase: 'gas' },
      { ...good, nutrients: { ...(good.nutrients as object), fatG: '3' } },
      { ...good, serving: { grams: 100 } },
      { ...good, sources: [] },
    ]
    for (const b of broken) expect(isUsableFood(b)).toBe(false)
  })
})
