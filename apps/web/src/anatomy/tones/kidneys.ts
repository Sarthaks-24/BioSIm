import type { ToneSet } from './base.ts'

/**
 * Kidneys & water's tones (anatomy plan §5): the kidneys a deep red-brown, the ureters a straw
 * yellow, the bladder a pale yellow (an L* > 85 fill: a 3 px ink outline on the projector), and the
 * blood vessels in Heart & blood's oxygen-rich red and oxygen-poor blue. Loads with the `kidneys`
 * pack. Nothing changes colour as the bladder fills: only its size and the gauge move.
 */
export const KIDNEY_TONE = {
  kidney: '#7d3a4a',
  ureter: '#d9a521',
  bladder: '#f3dc8c',
  artery: '#e0303f',
  vein: '#2f5fb8',
} as const

export const TONES: ToneSet = {
  tones: KIDNEY_TONE,
  neighbours: [
    ['kidney', 'ureter'],
    ['ureter', 'bladder'],
    ['kidney', 'artery'],
    ['kidney', 'vein'],
    ['bladder', 'artery'],
  ],
}
