import type { ToneSet } from './base.ts'

/**
 * Skin & temperature's tones (anatomy plan §5): a neutral rim, sweat blue, the skin's blood vessels
 * the oxygen-rich red of the heart's picture. Nothing in skin's picture ever turns red with heat or
 * sweat, and nothing is an alarm (ui-ux §7): the vessels only widen one step in a walk or run.
 */
export const SKIN_TONE = {
  rim: '#c9d3db',
  sweat: '#1f7ae0',
  vessel: '#e0303f',
} as const

export const TONES: ToneSet = {
  tones: SKIN_TONE,
  neighbours: [
    ['rim', 'sweat'],
    ['rim', 'vessel'],
    ['sweat', 'vessel'],
  ],
}
