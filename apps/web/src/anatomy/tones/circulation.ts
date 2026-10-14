import type { ToneSet } from './base.ts'

/**
 * Heart & blood's tones (anatomy plan §5): the heart a deep muscle red, oxygen-rich blood red,
 * oxygen-poor blood blue (a drawing convention, captioned "blood is always red"; the hepatic and
 * portal veins too), the lungs a pale pink ghost, the liver, gut and kidneys the shared pale ghost.
 * Loads with the `circulation` pack. Nothing changes colour with a beat (flash safety): only the
 * heart's size moves, and the dashes along the vessels.
 */
export const CIRCULATION_TONE = {
  heart: '#7a1e2e',
  rich: '#e0303f',
  poor: '#2f5fb8',
  lungs: '#e8909c',
  // base.ts FADE_TONE, written out (this file loads with the pack); circulation.test.ts checks they match.
  ghost: '#dfe6e4',
} as const

export const TONES: ToneSet = {
  tones: CIRCULATION_TONE,
  neighbours: [
    ['heart', 'rich'],
    ['heart', 'poor'],
    ['rich', 'poor'],
    ['rich', 'lungs'],
    ['poor', 'lungs'],
    ['rich', 'ghost'],
    ['poor', 'ghost'],
  ],
}
