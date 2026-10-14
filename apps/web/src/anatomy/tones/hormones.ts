import type { ToneSet } from './base.ts'

/**
 * Hormones' tones (anatomy plan §5, U-6): the pancreas Digestion's pale cream (an L* > 85 fill: a
 * 3 px ink outline on the projector), the liver Digestion's dark red-brown, the vein to the liver
 * Heart & blood's oxygen-poor blue, the insulin dots a deep green with a dark edge, and the glands
 * that are drawn only (pituitary, thyroid, adrenals) one muted purple (the anatomy plan's pituitary).
 * The stomach is a see-through outline in the skin's line colour, not a tone. Loads with the
 * `control` pack. Nothing changes colour as insulin rises: only the number of dots moves.
 */
export const HORMONE_TONE = {
  pancreas: '#f2e6bd',
  liver: '#80302c',
  vein: '#2f5fb8',
  insulin: '#1f8a5b',
  gland: '#7a5aa6',
} as const

export const TONES: ToneSet = {
  tones: HORMONE_TONE,
  neighbours: [
    ['pancreas', 'vein'],
    ['liver', 'vein'],
    ['insulin', 'vein'],
    ['insulin', 'pancreas'],
    ['insulin', 'liver'],
    ['gland', 'liver'],
  ],
}
