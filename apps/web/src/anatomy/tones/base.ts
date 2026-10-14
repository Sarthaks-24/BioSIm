/**
 * Colours every system shares (anatomy plan §5): the skin outline, the fade of an empty organ and
 * the dark edge of every dot. Each system's own organ tones are in tones/<systemId>.ts and load with
 * its pack; colors.test.ts and the flat registry check (systems/check.ts) audit them.
 */

/** Organs with no food in them fade towards this pale, cool grey: still there, clearly not where the meal is. */
export const FADE_TONE = '#dfe6e4'

/** The dark edge round every food particle (3D and flat): it carries the shape on any tissue and on the paper. */
export const PARTICLE_EDGE = '#141a2e'

/** The flat body's skin: a faint fill and a crisp, cool outline (the 3D shell's rim). */
export const SKIN = { fill: 'rgba(61,76,107,0.05)', line: 'rgba(61,76,107,0.55)' } as const

/**
 * One system's tones (≤ 5, anatomy plan §5) by name, and the pairs of them that touch in its
 * picture: those must stay apart for colour-blind readers and everyone else.
 */
export interface ToneSet {
  tones: Readonly<Record<string, string>>
  neighbours: readonly (readonly [string, string])[]
}
