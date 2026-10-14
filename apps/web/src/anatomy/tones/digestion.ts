import { ORGAN_COLOR } from '../../lib/colors.ts'
import type { ToneSet } from './base.ts'

/**
 * Colours of Digestion's lit organs, shared by the 3D body and the flat diagram (sRGB hex). The gut
 * stages use the app's organ tokens (lib/colors.ts); the rest are picked to sit in the same
 * family: liver dark red-brown, gallbladder green, pancreas pale cream.
 * colors.test.ts audits them (3D-5): organs that touch (NEIGHBOURS) stay apart for colour-blind
 * readers, and every organ's outline stands out from the page.
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

/** The jejunum (first part of the small intestine) is slightly redder, the ileum (last part) paler. */
export const JEJUNUM_TONE = '#e8866a'
export const ILEUM_TONE = '#f6cd9c'
/** The muscular ring at the stomach's exit, and the antrum next to it. */
export const PYLORUS_TONE = '#a63a52'

/**
 * Organs (and parts of the small intestine) that touch in the picture, front-on. The audit checks
 * each pair; a new organ joins this list with its neighbours.
 */
const NEIGHBOURS: ToneSet['neighbours'] = [
  ['esophagus', 'stomach'],
  ['esophagus', 'liver'],
  ['stomach', 'liver'],
  ['stomach', 'pancreas'],
  ['stomach', 'smallIntestine'],
  ['stomach', 'jejunum'],
  ['stomach', 'largeIntestine'],
  ['liver', 'gallbladder'],
  ['gallbladder', 'smallIntestine'],
  ['gallbladder', 'pancreas'],
  ['pancreas', 'smallIntestine'],
  ['pancreas', 'jejunum'],
  ['smallIntestine', 'largeIntestine'],
  ['jejunum', 'largeIntestine'],
  ['ileum', 'largeIntestine'],
]

/** Digestion's tones for the audits: the organs plus the small intestine's two ends, and the pairs that touch. */
export const TONES: ToneSet = {
  tones: { ...ORGAN_TONE, jejunum: JEJUNUM_TONE, ileum: ILEUM_TONE },
  neighbours: NEIGHBOURS,
}
