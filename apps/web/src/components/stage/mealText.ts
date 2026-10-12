import { mealKcal, type MealItem } from '@lifepeek/engine'
import { lookupFood } from '../../data/foods.ts'
import { localized } from '../../i18n/index.ts'

/**
 * A meal as words: "Cheeseburger + Fries", with "×2" after a food eaten more than once. Used by
 * the kept tag, the body's accessible name and the notes. Food names are proper nouns in both
 * languages, so " + " needs no translation.
 */
export function mealNames(items: readonly MealItem[], lang: string): string {
  return items
    .map((i) => {
      const name = localized(lookupFood(i.foodId)?.name, lang)
      return i.servings === 1 ? name : `${name} ×${i.servings}`
    })
    .join(' + ')
}

/** Total food energy, rounded to a whole kcal (what the meal bar shows). */
export const mealKcalRounded = (items: readonly MealItem[]) => Math.round(mealKcal([...items], lookupFood))
