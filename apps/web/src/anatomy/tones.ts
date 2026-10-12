import { ORGAN_COLOR } from '../lib/colors.ts'

/**
 * Colours of the lit organs, shared by the 3D body and the flat diagram (sRGB hex). The gut
 * stages use the app's organ tokens (lib/colors.ts); the rest are picked to sit in the same
 * family: liver dark red-brown, gallbladder green, pancreas pale cream.
 * colors.test.ts audits them (3D-5): organs that touch (its NEIGHBOURS list) stay apart for
 * colour-blind readers, and every organ's outline stands out from the page.
 */
export const LIT_ORGANS = ['esophagus', 'stomach', 'smallIntestine', 'largeIntestine', 'liver', 'gallbladder', 'pancreas'] as const
export type LitOrgan = (typeof LIT_ORGANS)[number]

export const ORGAN_TONE: Record<LitOrgan, string> = {
  esophagus: ORGAN_COLOR.esophagus,
  stomach: ORGAN_COLOR.stomach,
  smallIntestine: ORGAN_COLOR.smallIntestine,
  largeIntestine: ORGAN_COLOR.largeIntestine,
  // WP-17 colour audit: liver one step deeper (it was ΔE 14 from the stomach it touches), pancreas
  // pale cream (pale yellow #e2b45f was the same colour as the small intestine round it, ΔE 4).
  liver: '#80302c',
  gallbladder: '#5f8a3c',
  pancreas: '#f2e6bd',
}

/** Organs with no food in them fade towards this pale, cool grey: still there, clearly not where the meal is. */
export const FADE_TONE = '#dfe6e4'

/** The jejunum (first part of the small intestine) is slightly redder, the ileum (last part) paler. */
export const JEJUNUM_TONE = '#e8866a'
export const ILEUM_TONE = '#f6cd9c'
/** The muscular ring at the stomach's exit, and the antrum next to it. */
export const PYLORUS_TONE = '#a63a52'

/** The dark edge round every food particle (3D and flat): it carries the shape on any tissue and on the paper. */
export const PARTICLE_EDGE = '#141a2e'
