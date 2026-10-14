import type { ToneSet } from './base.ts'

/**
 * Muscles' tones (anatomy plan §5): muscle a deep red-brown, tendons a dull gold, the bones under
 * them a pale ghost (base.ts FADE_TONE, written out: this file loads with the `effort` pack;
 * effort.test.ts checks they match). A working group gets a hatch and one lightness step (< 10 %
 * relative luminance), never another colour.
 */
export const MUSCLES_TONE = {
  muscle: '#b5444b',
  tendon: '#c9a85f',
  ghost: '#dfe6e4',
} as const

export const TONES: ToneSet = {
  tones: MUSCLES_TONE,
  neighbours: [
    ['muscle', 'tendon'],
    ['muscle', 'ghost'],
    ['tendon', 'ghost'],
  ],
}
