import { describe, expect, it, vi } from 'vitest'
import { shortFoodName, shortMealNames } from './mealText.ts'
import { boutLabel, planNames, shortPlanNames } from './boutText.ts'
import en from '../../i18n/en.json'

// The app's i18n setup needs a browser; the food names only need `localized`.
vi.mock('../../i18n/index.ts', () => ({
  localized: (text: Record<string, string> | undefined, lang: string) => text?.[lang] ?? text?.en ?? '',
}))

describe('short meal names for the graphs’ legend', () => {
  it('drops a food’s details', () => {
    expect(shortFoodName('Roti / chapati (whole wheat)')).toBe('Roti')
    expect(shortFoodName('Dal (masoor)')).toBe('Dal')
    expect(shortFoodName('दाल (मसूर)')).toBe('दाल')
    expect(shortFoodName('French fries')).toBe('French fries')
    expect(shortFoodName('(test meal)')).toBe('(test meal)')
  })

  it('names two foods and stands in "…" for more', () => {
    expect(
      shortMealNames(
        [
          { foodId: 'cheeseburger', servings: 1 },
          { foodId: 'fries', servings: 1 },
        ],
        'en',
      ),
    ).toBe('Cheeseburger + French fries')
    expect(
      shortMealNames(
        [
          { foodId: 'roti', servings: 2 },
          { foodId: 'dal', servings: 1 },
        ],
        'en',
      ),
    ).toBe('Roti ×2 + Dal')
    expect(
      shortMealNames(
        [
          { foodId: 'cheeseburger', servings: 1 },
          { foodId: 'fries', servings: 1 },
          { foodId: 'cola', servings: 1 },
        ],
        'hi',
      ),
    ).toBe('चीज़बर्गर + फ़्रेंच फ़्राइज़ + …')
  })
})

describe('activity bouts in words (E-3b-ui, ui-ux §5)', () => {
  // A stand-in t over en.json: enough for the bout words.
  const t = ((key: string, o: Record<string, unknown> = {}) =>
    String(key.split('.').reduce<unknown>((x, k) => (x as Record<string, unknown>)[k], en)).replace(/\{\{(\w+)\}\}/g, (_, k) =>
      String(o[k]),
    )) as never
  const walk = { kind: 'walk' as const, startMin: 120, durMin: 20 }

  it('a chip says the kind, its length and its start, never kcal', () => {
    expect(boutLabel(walk, t)).toBe('Walk 20 min, from 2:00')
    expect(boutLabel({ kind: 'run', startMin: 350, durMin: 5 }, t)).toBe('Run 5 min, from 5:50')
  })

  it('a kept plan names the meal, then its bouts in lower case; bouts alone start with a capital', () => {
    expect(planNames([{ foodId: 'cola', servings: 1 }], [walk], 'en', t)).toBe('Cola + walk 20 min, from 2:00')
    expect(planNames([], [walk], 'en', t)).toBe('Walk 20 min, from 2:00')
    expect(shortPlanNames([{ foodId: 'cola', servings: 1 }], [walk], 'en', t)).toBe('Cola + walk')
  })
})
