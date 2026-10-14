import type { ToneSet } from './base.ts'

/**
 * Lymph & germ defence tones (anatomy plan §5): lymph vessels and ducts green, nodes a deeper
 * green, the spleen plum, the thymus pink; fat dots keep their teal. Loads with the `lymph` pack.
 */
export const LYMPH_TONE = {
  vessel: '#5f9e3c',
  node: '#2f6b3a',
  spleen: '#7a3f73',
  thymus: '#e2a6c4',
  fat: '#00a3a3',
} as const

export const TONES: ToneSet = {
  tones: LYMPH_TONE,
  neighbours: [
    ['vessel', 'node'],
    ['vessel', 'spleen'],
    ['node', 'spleen'],
    ['vessel', 'thymus'],
  ],
}
