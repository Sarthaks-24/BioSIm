import type { Food, FoodLookup } from '@lifepeek/engine'

/**
 * Foods live in /content/foods/*.json (one file per food, cited inputs only) and are bundled
 * at build time, so the app works offline. CI validates every file against the full schema
 * (`npm run validate`, the engine's zod `Food`), and `foods.test.ts` checks that every file
 * passes both that schema and the quick check below. In the browser a file is only checked for
 * the fields the app reads, so a bad file is skipped rather than breaking the app, without
 * shipping the schema library to every page (about 20 KB gzipped).
 */
const files = import.meta.glob('../../../../content/foods/*.json', { eager: true, import: 'default' })

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isText = (v: unknown) => isObject(v) && typeof v.en === 'string' && v.en.length > 0
const isAmount = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const NUTRIENT_KEYS = ['energyKcal', 'carbsG', 'sugarsG', 'fiberG', 'proteinG', 'fatG', 'waterG'] as const

/** The fields the app and the engine read, with the right types. */
export function isUsableFood(data: unknown): data is Food {
  if (!isObject(data) || !isObject(data.serving) || !isObject(data.nutrients)) return false
  const { nutrients, serving, glycemicIndex } = data
  return (
    typeof data.id === 'string' &&
    /^[a-z0-9-]+$/.test(data.id) &&
    isText(data.name) &&
    typeof data.emoji === 'string' &&
    (data.phase === 'liquid' || data.phase === 'solid') &&
    isText(serving.label) &&
    isAmount(serving.grams) &&
    NUTRIENT_KEYS.every((k) => isAmount(nutrients[k])) &&
    (glycemicIndex === null || (isObject(glycemicIndex) && isAmount(glycemicIndex.value))) &&
    Array.isArray(data.sources) &&
    data.sources.length > 0
  )
}

export const FOODS: Food[] = Object.entries(files)
  .flatMap(([path, data]) => {
    if (!isUsableFood(data)) {
      console.error(`Skipping invalid food file ${path}`)
      return []
    }
    return [data]
  })
  .sort((a, b) => a.name.en.localeCompare(b.name.en))

const byId = new Map(FOODS.map((f) => [f.id, f]))

export const lookupFood: FoodLookup = (id) => byId.get(id)
