import { Food, type FoodLookup } from '@lifepeek/engine'

/**
 * Foods live in /content/foods/*.json (one file per food, cited inputs only) and are bundled
 * at build time, so the app works offline. CI validates every file; a bad file is skipped
 * here rather than breaking the app.
 */
const files = import.meta.glob('../../../../content/foods/*.json', { eager: true, import: 'default' })

export const FOODS: Food[] = Object.entries(files)
  .flatMap(([path, data]) => {
    const parsed = Food.safeParse(data)
    if (!parsed.success) {
      console.error(`Skipping invalid food file ${path}`, parsed.error.issues)
      return []
    }
    return [parsed.data]
  })
  .sort((a, b) => a.name.en.localeCompare(b.name.en))

const byId = new Map(FOODS.map((f) => [f.id, f]))

export const lookupFood: FoodLookup = (id) => byId.get(id)
