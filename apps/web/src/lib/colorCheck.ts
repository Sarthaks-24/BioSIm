/**
 * Colour checks used by colors.test.ts (no dependency). Ported from the dataviz skill's
 * `validate_palette.js`, so the numbers here match the ones quoted in the v2 plans.
 *
 * - Contrast is the WCAG 2.2 ratio (1.4.3 text ≥ 4.5:1, 1.4.11 graphics ≥ 3:1).
 * - ΔE is the Euclidean distance in OKLab ×100. Colour blindness is simulated with Machado,
 *   Oliveira & Fernandes (2009) at full severity; the thresholds below are calibrated to that model.
 */

/** WCAG 1.4.3: normal-size text. */
export const TEXT_MIN = 4.5
/** WCAG 1.4.11: lines, marks and other graphics. */
export const LINE_MIN = 3
/** Two lines in one graph stay apart for red–green colour-blind readers (protan and deutan). */
export const CVD_MIN = 8
/** …and for everyone else. */
export const NORMAL_MIN = 15
/** OKLCH lightness band for a series on a light surface, and the chroma below which a hue reads as grey. */
export const LIGHT_BAND = [0.43, 0.77] as const
export const CHROMA_FLOOR = 0.1

type Rgb = readonly [number, number, number]
export type Deficiency = 'protan' | 'deutan' | 'tritan'

function srgb(hex: string): Rgb {
  const h = hex.replace(/^#/, '')
  if (!/^[0-9a-f]{6}$/i.test(h)) throw new Error(`not a #rrggbb colour: ${hex}`)
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as unknown as Rgb
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const linear = (hex: string) => srgb(hex).map(toLinear) as unknown as Rgb

/** WCAG relative luminance. */
export function luminance(hex: string): number {
  const [r, g, b] = linear(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

function oklabFromLinear([r, g, b]: Rgb): Rgb {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLCH lightness (0–1) and chroma. */
export function oklch(hex: string): { l: number; c: number } {
  const [l, a, b] = oklabFromLinear(linear(hex))
  return { l, c: Math.hypot(a, b) }
}

// Machado, Oliveira & Fernandes (2009), severity 1.0, applied to linear RGB.
const MACHADO: Record<Deficiency, readonly Rgb[]> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

function simulate(hex: string, kind: Deficiency): Rgb {
  const [r, g, b] = linear(hex)
  const clamp = (c: number) => Math.min(1, Math.max(0, c))
  return MACHADO[kind].map(([x, y, z]) => clamp(x * r + y * g + z * b)) as unknown as Rgb
}

/** OKLab ΔE ×100 between two colours, as seen with normal vision or with one colour-vision deficiency. */
export function deltaE(a: string, b: string, kind?: Deficiency): number {
  const pa = oklabFromLinear(kind ? simulate(a, kind) : linear(a))
  const pb = oklabFromLinear(kind ? simulate(b, kind) : linear(b))
  return 100 * Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2])
}

/** The worse of protan and deutan ΔE: what the validator calls "CVD separation". */
export function cvdDeltaE(a: string, b: string): number {
  return Math.min(deltaE(a, b, 'protan'), deltaE(a, b, 'deutan'))
}

/** Every unordered pair of a list. */
export function pairs<T>(list: readonly T[]): [T, T][] {
  return list.flatMap((a, i) => list.slice(i + 1).map((b) => [a, b] as [T, T]))
}
