/**
 * The 3D body's two looks and the colour maths the colour audit shares with the shaders. Only the
 * 3D chunk and colors.test.ts import this file, so none of it is in the download before 3D.
 */

/**
 * The two looks of the body. On the projector (3D-5, WP-17) empty organs fade less (a faded
 * organ on a washed-out projector is invisible), and every organ gets a near-black outline,
 * about 2 px, so neighbours of similar lightness still read as two shapes from the back row.
 * - `fade`: how far an empty organ goes towards FADE_TONE (0…1).
 * - `outlineShade`, `outlineLift`: outline = organ colour × shade + lift, in linear RGB (outlineInk).
 * - `outlineWidth`: the 3D outline's width as a share of the distance to the camera.
 * The flat diagram has its own plain numbers for the same idea (FLAT in flat/FlatBody.tsx).
 */
export const BODY_LOOK = {
  normal: { fade: 0.5, outlineShade: 0.3, outlineLift: [0.012, 0.016, 0.03], outlineWidth: 0.0016 },
  projector: { fade: 0.3, outlineShade: 0.08, outlineLift: [0.003, 0.004, 0.008], outlineWidth: 0.0026 },
} as const
export type BodyLook = keyof typeof BODY_LOOK

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)

/** sRGB hex → linear RGB, 0…1 (what three.js and the shaders work in). */
export const linearRgb = (hex: string): [number, number, number] =>
  [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255)) as [number, number, number]

/** The outline colour of an organ of colour `hex`, as the shader and the flat diagram draw it. */
export function outlineInk(hex: string, look: BodyLook): string {
  const { outlineShade, outlineLift } = BODY_LOOK[look]
  return `#${linearRgb(hex)
    .map((c, i) => Math.round(Math.min(1, toSrgb(c * outlineShade + outlineLift[i]!)) * 255))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`
}
