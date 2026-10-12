import { describe, expect, it, vi } from 'vitest'
import { shortFoodName, shortMealNames } from './mealText.ts'

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
