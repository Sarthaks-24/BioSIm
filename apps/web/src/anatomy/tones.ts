import { ORGAN_COLOR } from '../lib/colors.ts'

/**
 * Colours of the lit organs, shared by the 3D body and the flat diagram (sRGB hex). The gut
 * stages use the app's organ tokens (lib/colors.ts); the rest are picked to sit in the same
 * family: liver dark red-brown, gallbladder green, pancreas pale yellow.
 */
export const LIT_ORGANS = ['esophagus', 'stomach', 'smallIntestine', 'largeIntestine', 'liver', 'gallbladder', 'pancreas'] as const
export type LitOrgan = (typeof LIT_ORGANS)[number]

export const ORGAN_TONE: Record<LitOrgan, string> = {
  esophagus: ORGAN_COLOR.esophagus,
  stomach: ORGAN_COLOR.stomach,
  smallIntestine: ORGAN_COLOR.smallIntestine,
  largeIntestine: ORGAN_COLOR.largeIntestine,
  liver: '#8a332e',
  gallbladder: '#5f8a3c',
  pancreas: '#e2b45f',
}

/** Organs with no food in them fade towards this pale, cool grey: still there, clearly not where the meal is. */
export const FADE_TONE = '#dfe6e4'

/** The jejunum (first part of the small intestine) is slightly redder, the ileum (last part) paler. */
export const JEJUNUM_TONE = '#e8866a'
export const ILEUM_TONE = '#f6cd9c'
/** The muscular ring at the stomach's exit, and the antrum next to it. */
export const PYLORUS_TONE = '#a63a52'
