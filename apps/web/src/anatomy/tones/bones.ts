import type { ToneSet } from './base.ts'

/**
 * Bones' tones (anatomy plan §5): bone a warm ivory, cartilage a cool blue, the marked joints a deep
 * blue. Bone is pale (L* > 85), so on the projector its outline is 3 px of ink (§5).
 */
export const BONES_TONE = {
  bone: '#ece3cb',
  cartilage: '#7fb0c4',
  joint: '#2f4f6f',
} as const

export const TONES: ToneSet = {
  tones: BONES_TONE,
  neighbours: [
    ['bone', 'cartilage'],
    ['bone', 'joint'],
    ['cartilage', 'joint'],
  ],
}
