import type { ToneSet } from './base.ts'

/**
 * Brain & nerves' tones (anatomy plan §5): the brain a soft pink, the spinal cord a pale cream (an
 * L* > 85 fill: a 3 px ink outline on the projector), the nerves and the relay neuron a nerve
 * yellow; the neck arteries in Heart & blood's oxygen-rich red, and the sugar dots going up them in
 * the carbohydrate yellow (lib/colors.ts carbs). A nerve signal is drawn in ink, never a colour.
 * Loads with the `control` pack. Nothing lights up or changes colour (anatomy plan §2.8: no
 * "lighting up"); only the sugar dots move.
 */
export const NERVE_TONE = {
  brain: '#dc97a6',
  cord: '#f2e6bd',
  nerve: '#e0b020',
  artery: '#e0303f',
  sugar: '#f2b705',
} as const

export const TONES: ToneSet = {
  tones: NERVE_TONE,
  neighbours: [
    ['brain', 'cord'],
    ['brain', 'nerve'],
    ['cord', 'nerve'],
    ['artery', 'sugar'],
    ['artery', 'brain'],
  ],
}
