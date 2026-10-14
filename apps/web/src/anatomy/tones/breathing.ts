import type { ToneSet } from './base.ts'

/**
 * Breathing's tones (anatomy plan §5): the airway (nasal passage, windpipe, bronchi) a cool blue,
 * the lungs pink, the diaphragm a deep muscle red, the air dashes a bright blue, the food pipe a pale
 * ghost beside the windpipe. Loads with the `breathing` pack. The lungs never change colour with a
 * breath (flash safety): only their size moves.
 */
export const BREATHING_TONE = {
  airway: '#3f6f99',
  lungs: '#e8909c',
  diaphragm: '#8a3a32',
  air: '#1f7ae0',
  // base.ts FADE_TONE, written out (this file loads with the pack); breathing.test.ts checks they match.
  ghost: '#dfe6e4',
} as const

export const TONES: ToneSet = {
  tones: BREATHING_TONE,
  neighbours: [
    ['airway', 'lungs'],
    ['lungs', 'diaphragm'],
    ['airway', 'diaphragm'],
    ['airway', 'ghost'],
  ],
}
