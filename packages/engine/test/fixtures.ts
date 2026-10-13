import { parseFood, type Food } from '../src/schema.ts'

/**
 * FULL=1 (the nightly run) gives the slow invariance and fuzz suites their full case counts; a
 * normal `npm test` runs a fixed-seed subset, so it does not depend on machine load (R68).
 */
export const FULL = process.env.FULL === '1'

/** All of `items` with FULL=1, else every `stride`-th one (the first always in): the same ones every run. */
export function sample<T>(items: readonly T[], stride: number): readonly T[] {
  return FULL ? items : items.filter((_, i) => i % stride === 0)
}

/**
 * The first index where two arrays differ to the byte (−1 = identical): the invariance tests'
 * check. A byte compare instead of a deep `toEqual`, which costs about a second per run of
 * series on a busy machine; same meaning (NaN = NaN, 0 ≠ −0, the array types must match).
 */
export function firstDiff(a: Float32Array | Float64Array, b: Float32Array | Float64Array | undefined): number {
  if (!b || a.constructor !== b.constructor || a.length !== b.length) return 0
  const bytes = (x: Float32Array | Float64Array) => Buffer.from(x.buffer, x.byteOffset, x.byteLength)
  if (bytes(a).equals(bytes(b))) return -1
  for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return i
  return -1
}

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

/** Charrière et al. 2016's drink: 60 g glucose in 500 mL water (240 kcal). */
export const glucose60 = food({
  id: 'glucose-60',
  phase: 'liquid',
  grams: 560,
  nutrients: { energyKcal: 240, carbsG: 60, sugarsG: 60, fiberG: 0, proteinG: 0, fatG: 0, waterG: 500 },
  glycemicIndex: { value: 100, reference: 'glucose' },
})

/**
 * Gribok et al. 2016's lunch shakes (Table 2), drunk in under 15 min: high-carbohydrate 548 kcal
 * (123 g carbohydrate, 3 g fat, 7 g protein) and high-fat 519 kcal (12 g, 51 g, 7 g). The paper
 * gives no GI or volume: GI 70 and 400 g are fixture choices (the RQ goldens also try GI 50 and 100).
 */
export function gribokShake(kind: 'carb' | 'fat', gi = 70): Food {
  const n = kind === 'carb' ? { energyKcal: 548, carbsG: 123, fatG: 3 } : { energyKcal: 519, carbsG: 12, fatG: 51 }
  return food({
    id: `gribok-${kind}-${gi}`,
    phase: 'liquid',
    grams: 400,
    nutrients: { ...n, sugarsG: 0, fiberG: 0, proteinG: 7, waterG: 400 - n.carbsG - n.fatG - 7 },
    glycemicIndex: { value: gi, reference: 'glucose' },
  })
}

export const all = [glucose50, water, standardMeal, bread50, fattyMeal, glucose60, gribokShake('carb'), gribokShake('fat')]
export const lookup = (id: string) => all.find((f) => f.id === id)
