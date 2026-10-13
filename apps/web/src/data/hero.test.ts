import { describe, expect, it } from 'vitest'
import { lookupFood } from './foods.ts'
import { computeHero } from './hero.ts'
import hero from './hero.json'

describe('the picture on Home', () => {
  it('hero.json is what the model gives today (else run: npx tsx apps/web/scripts/build-hero.ts)', () => {
    expect(hero).toEqual(computeHero(lookupFood))
  })

  it('cola leaves the stomach first, as the headline says', () => {
    // After the meal is all in the stomach (eating takes a few minutes).
    const half = (s: number[]) => {
      const full = s.indexOf(Math.max(...s))
      return full + s.slice(full).findIndex((f) => f <= 0.5)
    }
    expect(half(hero.meal.stomach)).toBeGreaterThan(0)
    expect(half(hero.meal.stomach)).toBeLessThan(half(hero.kept.stomach))
  })
})
