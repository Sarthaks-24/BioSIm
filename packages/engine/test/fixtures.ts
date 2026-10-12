import { parseFood, type Food } from '../src/schema.ts'

/** Reference test meals used in clinical studies — not shipped as app content. */
const src = [
  { label: 'test fixture', citation: 'Synthetic reference meal for calibration', fields: ['nutrients', 'glycemicIndex'] as const },
]

function food(partial: Omit<Food, 'schemaVersion' | 'sources' | 'name' | 'emoji' | 'serving' | 'category'> & { grams: number }): Food {
  const { grams, ...rest } = partial
  return parseFood({
    schemaVersion: 1,
    name: { en: rest.id },
    emoji: '🧪',
    category: 'drink',
    serving: { label: { en: `${grams} g` }, grams },
    sources: src.map((s) => ({ ...s, fields: [...s.fields] })),
    ...rest,
  })
}

/** Oral glucose tolerance test drink: 50 g glucose in 250 mL water. */
export const glucose50 = food({
  id: 'glucose-50',
  phase: 'liquid',
  grams: 300,
  nutrients: { energyKcal: 200, carbsG: 50, sugarsG: 50, fiberG: 0, proteinG: 0, fatG: 0, waterG: 250 },
  glycemicIndex: { value: 100, reference: 'glucose' },
})

export const water = food({
  id: 'water-test',
  phase: 'liquid',
  grams: 250,
  nutrients: { energyKcal: 0, carbsG: 0, sugarsG: 0, fiberG: 0, proteinG: 0, fatG: 0, waterG: 250 },
  glycemicIndex: null,
})

/**
 * Consensus scintigraphy test meal (Abell et al. 2008): egg-white sandwich + jam + water,
 * ~255 kcal. Treated here as one solid portion.
 */
export const standardMeal = food({
  id: 'standard-meal',
  phase: 'solid',
  grams: 250,
  nutrients: { energyKcal: 255, carbsG: 45, sugarsG: 12, fiberG: 2, proteinG: 16, fatG: 1.5, waterG: 180 },
  glycemicIndex: { value: 70, reference: 'glucose' },
})

/** White bread portion with 50 g available carbohydrate — the classic GI test food (GI 75). */
export const bread50 = food({
  id: 'bread-50',
  phase: 'solid',
  grams: 107,
  nutrients: { energyKcal: 285, carbsG: 50, sugarsG: 6, fiberG: 3, proteinG: 9.4, fatG: 3.6, waterG: 38 },
  glycemicIndex: { value: 75, reference: 'glucose' },
})

/** A large high-fat solid meal (~700 kcal). */
export const fattyMeal = food({
  id: 'fatty-meal',
  phase: 'solid',
  grams: 300,
  nutrients: { energyKcal: 700, carbsG: 65, sugarsG: 8, fiberG: 4, proteinG: 28, fatG: 36, waterG: 150 },
  glycemicIndex: { value: 60, reference: 'glucose' },
})

export const all = [glucose50, water, standardMeal, bread50, fattyMeal]
export const lookup = (id: string) => all.find((f) => f.id === id)
