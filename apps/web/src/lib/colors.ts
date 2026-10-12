import type { NutrientKind, StageId } from '@biosim/engine'

/** Mirrors the tokens in styles.css for places CSS can't reach (WebGL, canvas). */
export const NUTRIENT_COLOR: Record<NutrientKind, string> = {
  carbs: '#e0662b',
  protein: '#7b4fd0',
  fat: '#c79a00',
  fiber: '#4f8a2b',
  water: '#2f8fd0',
}

export const MEAL_COLOR = { a: '#0f766e', b: '#9d2f6a' } as const

export const ORGAN_COLOR: Record<StageId, string> = {
  mouth: '#d9536a',
  esophagus: '#d98b8b',
  stomach: '#e0707f',
  smallIntestine: '#e7998a',
  largeIntestine: '#c98a74',
}

export const INK = '#14213d'
