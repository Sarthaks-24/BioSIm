import { ORGAN_COLOR } from '../lib/colors.ts'

/**
 * Colours of the lit organs, shared by the 3D body and the flat diagram (sRGB hex). The gut
 * stages use the app's organ tokens (lib/colors.ts); the rest are picked to sit in the same
 * family: liver dark red-brown, gallbladder green, pancreas pale cream.
 * colors.test.ts audits them (3D-5): organs that touch stay apart for colour-blind readers, and
 * every organ's outline stands out from the page.
 */
export const LIT_ORGANS = ['esophagus', 'stomach', 'smallIntestine', 'largeIntestine', 'liver', 'gallbladder', 'pancreas'] as const
export type LitOrgan = (typeof LIT_ORGANS)[number]

export const ORGAN_TONE: Record<LitOrgan, string> = {
  esophagus: ORGAN_COLOR.esophagus,
  stomach: ORGAN_COLOR.stomach,
  smallIntestine: ORGAN_COLOR.smallIntestine,
  largeIntestine: ORGAN_COLOR.largeIntestine,
  // WP-17 colour audit: liver one step deeper (it was ΔE 14 from the stomach it touches), pancreas
  // pale cream (pale yellow #e2b45f was the same colour as the small intestine round it, ΔE 4).
  liver: '#80302c',
  gallbladder: '#5f8a3c',
  pancreas: '#f2e6bd',
}

/** Organs with no food in them fade towards this pale, cool grey: still there, clearly not where the meal is. */
export const FADE_TONE = '#dfe6e4'

/** The jejunum (first part of the small intestine) is slightly redder, the ileum (last part) paler. */
export const JEJUNUM_TONE = '#e8866a'
export const ILEUM_TONE = '#f6cd9c'
/** The muscular ring at the stomach's exit, and the antrum next to it. */
export const PYLORUS_TONE = '#a63a52'

/**
 * Organs (and parts of the small intestine) that touch in the picture, front-on. The colour audit
 * checks each pair; a new organ joins this list with its neighbours.
 */
export const NEIGHBOURS: readonly (readonly [string, string])[] = [
  ['esophagus', 'stomach'],
  ['esophagus', 'liver'],
  ['stomach', 'liver'],
  ['stomach', 'pancreas'],
  ['stomach', 'smallIntestine'],
  ['stomach', 'jejunum'],
  ['stomach', 'largeIntestine'],
  ['liver', 'gallbladder'],
  ['gallbladder', 'smallIntestine'],
  ['gallbladder', 'pancreas'],
  ['pancreas', 'smallIntestine'],
  ['pancreas', 'jejunum'],
  ['smallIntestine', 'largeIntestine'],
  ['jejunum', 'largeIntestine'],
  ['ileum', 'largeIntestine'],
]

/** Every tone the audit knows by name: the organs plus the small intestine's two ends. */
export const TONE_BY_NAME: Record<string, string> = { ...ORGAN_TONE, jejunum: JEJUNUM_TONE, ileum: ILEUM_TONE }

/** Tones the food passes through (particles are checked against these). */
export const FOOD_PATH = ['esophagus', 'stomach', 'smallIntestine', 'jejunum', 'ileum', 'largeIntestine'] as const

/**
 * The two looks of the body. On the projector (3D-5, WP-17) empty organs fade less (a faded
 * organ on a washed-out projector is invisible), and every organ gets a near-black outline,
 * about 2 px, so neighbours of similar lightness still read as two shapes from the back row.
 * - `fade`: how far an empty organ goes towards FADE_TONE (0…1).
 * - `outlineShade`, `outlineLift`: outline = organ colour × shade + lift, in linear RGB (outlineInk).
 * - `outlineWidth`: the 3D outline's width as a share of the distance to the camera.
 * - `flatLine`: the flat diagram's outline width in CSS px (the active organ gets 0.75 px more).
 */
export const BODY_LOOK = {
  normal: { fade: 0.5, outlineShade: 0.3, outlineLift: [0.012, 0.016, 0.03], outlineWidth: 0.0016, flatLine: 1.25 },
  projector: { fade: 0.3, outlineShade: 0.08, outlineLift: [0.003, 0.004, 0.008], outlineWidth: 0.0026, flatLine: 2 },
} as const
export type BodyLook = keyof typeof BODY_LOOK

/** The dark edge round every food particle (3D and flat): it carries the shape on any tissue and on the paper. */
export const PARTICLE_EDGE = '#141a2e'

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
