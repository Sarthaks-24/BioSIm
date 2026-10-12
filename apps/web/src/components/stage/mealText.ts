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

/**
 * A food's name without its details: "Roti / chapati (whole wheat)" → "Roti", "Dal (masoor)" → "Dal".
 * A name that is all details ("(test meal)") stays whole rather than becoming empty.
 */
export const shortFoodName = (name: string) =>
  name
    .replace(/\s*\([^)]*\)/g, '')
    .split(' / ')[0]!
    .trim() || name

/**
 * A meal in few words, for the graphs' legend: short food names, the first two foods and "…" for
 * the rest ("Roti ×2 + Dal", "Cheeseburger + French fries + …"). The meal bar has the full names.
 */
export function shortMealNames(items: readonly MealItem[], lang: string): string {
  const names = items.slice(0, 2).map((i) => {
    const name = shortFoodName(localized(lookupFood(i.foodId)?.name, lang))
    return i.servings === 1 ? name : `${name} ×${i.servings}`
  })
  return items.length > 2 ? `${names.join(' + ')} + …` : names.join(' + ')
}

/** Total food energy, rounded to a whole kcal (what the meal bar shows). */
export const mealKcalRounded = (items: readonly MealItem[]) => Math.round(mealKcal([...items], lookupFood))
