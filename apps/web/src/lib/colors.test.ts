import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { INK, LEFT_BODY, MEAL_COLOR, NUTRIENT_COLOR, ORGAN_COLOR } from './colors.ts'

/** colors.ts copies some CSS tokens for WebGL/canvas. This keeps the two copies identical. */
const css = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8')
const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`))?.[1]

describe('colour tokens', () => {
  it('match styles.css', () => {
    for (const [k, v] of Object.entries(NUTRIENT_COLOR)) expect(token(k), k).toBe(v)
    expect(token('meal-a')).toBe(MEAL_COLOR.a)
    expect(token('meal-b')).toBe(MEAL_COLOR.b)
    expect(token('ink')).toBe(INK)
    expect(token('stomach')).toBe(ORGAN_COLOR.stomach)
    expect(token('small-intestine')).toBe(ORGAN_COLOR.smallIntestine)
    expect(token('large-intestine')).toBe(ORGAN_COLOR.largeIntestine)
    expect(token('left-body')).toBe(LEFT_BODY)
  })
})
