import { z } from 'zod'

/**
 * A food file holds only *inputs* that can be looked up and cited.
 * Timings and curves are computed by the engine — never typed by hand.
 */

export const FOOD_SCHEMA_VERSION = 1

/** Text shown to users. English is required; other languages are optional and fall back to English. */
export const LocalizedText = z.object({
  en: z.string().min(1),
  hi: z.string().min(1).optional(),
})
export type LocalizedText = z.infer<typeof LocalizedText>

export const FoodPhase = z.enum(['liquid', 'solid'])
export type FoodPhase = z.infer<typeof FoodPhase>

export const FoodCategory = z.enum(['drink', 'fruit', 'grain', 'legume', 'dairy', 'vegetable', 'egg', 'fast-food', 'meat'])
export type FoodCategory = z.infer<typeof FoodCategory>

const grams = z.number().min(0).max(2000)

export const Nutrients = z.object({
  energyKcal: z.number().min(0).max(3000),
  /** Available (digestible) carbohydrate, excluding fibre. */
  carbsG: grams,
  sugarsG: grams,
  fiberG: grams,
  proteinG: grams,
  fatG: grams,
  waterG: grams,
})
export type Nutrients = z.infer<typeof Nutrients>

export const SourceField = z.enum(['nutrients', 'glycemicIndex', 'serving', 'notes'])

export const Source = z.object({
  /** Short human label, e.g. "USDA FoodData Central". */
  label: z.string().min(1),
  /** Full citation a teacher could look up. */
  citation: z.string().min(1),
  /** http(s) only: the web app renders it as a link, so javascript: or data: must never pass. */
  url: z.httpUrl().optional(),
  /** Which parts of this file the source backs. */
  fields: z.array(SourceField).min(1),
})
export type Source = z.infer<typeof Source>

export const GlycemicIndex = z.object({
  value: z.number().min(0).max(150),
  /** Reference food the value is measured against. */
  reference: z.enum(['glucose']),
})

export const Food = z
  .object({
    schemaVersion: z.literal(FOOD_SCHEMA_VERSION),
    id: z.string().regex(/^[a-z0-9-]+$/, 'id must be kebab-case'),
    name: LocalizedText,
    emoji: z.string().min(1).max(8),
    category: FoodCategory,
    phase: FoodPhase,
    serving: z.object({
      label: LocalizedText,
      grams: z.number().positive().max(2000),
    }),
    /** Nutrients for ONE serving. */
    nutrients: Nutrients,
    /** null when no published value exists (e.g. foods with almost no carbohydrate). */
    glycemicIndex: GlycemicIndex.nullable(),
    sources: z.array(Source).min(1),
    notes: LocalizedText.optional(),
  })
  .superRefine((food, ctx) => {
    const n = food.nutrients
    const massG = n.carbsG + n.fiberG + n.proteinG + n.fatG + n.waterG
    // Ash and rounding mean the parts never sum exactly to the serving; allow 15 % slack.
    if (massG > food.serving.grams * 1.15) {
      ctx.addIssue({
        code: 'custom',
        path: ['nutrients'],
        message: `nutrient mass ${massG.toFixed(0)} g exceeds serving ${food.serving.grams} g`,
      })
    }
    if (n.sugarsG > n.carbsG + 0.5) {
      ctx.addIssue({ code: 'custom', path: ['nutrients', 'sugarsG'], message: 'sugars cannot exceed carbs' })
    }
    // Atwater check: energy should roughly match 4/4/9 (+2 for fibre). Catches typos like 10× errors.
    const atwater = 4 * n.carbsG + 4 * n.proteinG + 9 * n.fatG + 2 * n.fiberG
    if (Math.abs(atwater - n.energyKcal) > Math.max(25, n.energyKcal * 0.2)) {
      ctx.addIssue({
        code: 'custom',
        path: ['nutrients', 'energyKcal'],
        message: `energy ${n.energyKcal} kcal far from Atwater estimate ${atwater.toFixed(0)} kcal`,
      })
    }
    if (n.carbsG >= 5 && food.glycemicIndex === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['glycemicIndex'],
        message: 'foods with ≥5 g carbohydrate need a published glycemic index',
      })
    }
    const covered = new Set(food.sources.flatMap((s) => s.fields))
    if (!covered.has('nutrients')) {
      ctx.addIssue({ code: 'custom', path: ['sources'], message: 'a source must back "nutrients"' })
    }
    if (food.glycemicIndex && !covered.has('glycemicIndex')) {
      ctx.addIssue({ code: 'custom', path: ['sources'], message: 'a source must back "glycemicIndex"' })
    }
  })
export type Food = z.infer<typeof Food>

export function parseFood(data: unknown): Food {
  return Food.parse(data)
}
