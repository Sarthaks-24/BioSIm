/** Shared vocabulary for the whole engine. In code "fiber"/"esophagus" are US spellings; the UI says fibre/oesophagus. */

export type StageId = 'mouth' | 'esophagus' | 'stomach' | 'smallIntestine' | 'largeIntestine'
export const STAGES: StageId[] = ['mouth', 'esophagus', 'stomach', 'smallIntestine', 'largeIntestine']

export type NutrientKind = 'carbs' | 'protein' | 'fat' | 'fiber' | 'water'
export const NUTRIENT_KINDS: NutrientKind[] = ['carbs', 'protein', 'fat', 'fiber', 'water']

/** Food-file field holding each nutrient's grams. */
export const GRAMS_KEY: Record<NutrientKind, 'carbsG' | 'proteinG' | 'fatG' | 'fiberG' | 'waterG'> = {
  carbs: 'carbsG',
  protein: 'proteinG',
  fat: 'fatG',
  fiber: 'fiberG',
  water: 'waterG',
}

/** A value with the spread we expect between healthy people. */
export interface Range {
  low: number
  typical: number
  high: number
}
