import type { NutrientKind, StageId } from '@biosim/engine'

/**
 * Mirrors the tokens in styles.css for places CSS can't reach (WebGL, canvas, SVG fills).
 * colors.test.ts fails if the two drift apart.
 *
 * Nutrient colours are deliberately outside the pink/peach tissue range so particles stay
 * visible inside organs; every nutrient also has its own shape.
 */
export const NUTRIENT_COLOR: Record<NutrientKind, string> = {
  carbs: '#f2b705',
  protein: '#6a3fd6',
  fat: '#00a3a3',
  fiber: '#3d8b1f',
  water: '#1f7ae0',
}

export const MEAL_COLOR = { a: '#0f766e', b: '#9d2f6a' } as const

/** Organ colours, used by the 3D body, the flat diagram and the charts. Stomach and small intestine differ in lightness too, for projectors. */
export const ORGAN_COLOR: Record<StageId, string> = {
  mouth: '#d9536a',
  esophagus: '#d98b8b',
  stomach: '#c8405f',
  smallIntestine: '#f0a868',
  largeIntestine: '#9c6b57',
}

export const INK = '#14213d'
export const LEFT_BODY = '#b8c4c9'
