/**
 * The flat diagram's look and its small sRGB colour maths (three's Color would add to the page's
 * download). Apart from FlatBody so the colour audit (lib/colors.test.ts) checks the outline the
 * flat body really draws (review 15, LOW 8), as it checks the 3D one through outlineInk.
 */
export type Rgb = [number, number, number]
export const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb
export const mix = (a: Rgb, b: Rgb, t: number): Rgb => a.map((v, i) => v + (b[i]! - v) * t) as Rgb
export const scale = (a: Rgb, k: number): Rgb => a.map((v) => v * k) as Rgb
export const css = (c: Rgb) => `rgb(${c.map((v) => Math.round(v)).join(',')})`

/**
 * The flat look: how far an empty organ fades, the outline's shade of the organ colour (sRGB) and
 * its width in CSS px (0.75 px more on the active organ). On the projector (3D-5) empty organs fade
 * less and the outline is near-black and 2 px, like the 3D body's (three/look.ts).
 */
export const FLAT_LOOK = {
  normal: { fade: 0.55, ink: 0.42, line: 1.25 },
  projector: { fade: 0.33, ink: 0.2, line: 2 },
} as const
export type FlatLook = (typeof FLAT_LOOK)[keyof typeof FLAT_LOOK]

/** An organ's outline colour in the flat diagram: its colour, shaded. */
export const outlineOf = (c: Rgb, look: FlatLook): Rgb => scale(c, look.ink)
