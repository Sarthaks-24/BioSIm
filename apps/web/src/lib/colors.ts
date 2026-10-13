import type { NutrientKind, StageId } from '@lifepeek/engine'

/**
 * Mirrors the tokens in styles.css for places CSS can't reach (WebGL, canvas, SVG fills).
 * colors.test.ts fails if the two drift apart.
 *
 * Nutrient colours are deliberately outside the pink/peach tissue range so particles stay
 * visible inside organs; every nutrient also has its own shape.
 */
export const NUTRIENT_COLOR: Record<NutrientKind, string> = {
  carbs: '#f2b705',
  protein: '#6a3fd6',
  fat: '#00a3a3',
  fiber: '#3d8b1f',
  water: '#1f7ae0',
}

/**
 * Organ colours, used by the 3D body, the flat diagram and the charts. Stomach and small intestine
 * differ in lightness too, for projectors. The large intestine is a muted violet since the WP-17
 * colour audit: the old brown (#9c6b57) was the stomach's twin for red–green colour-blind readers
 * (ΔE 0.7), and the two touch. colors.test.ts checks every pair of organs that touch.
 */
export const ORGAN_COLOR: Record<StageId, string> = {
  mouth: '#d9536a',
  esophagus: '#d98b8b',
  stomach: '#c8405f',
  smallIntestine: '#f0a868',
  largeIntestine: '#7870a8',
}

export const INK = '#14213d'

/**
 * v2 surface and text tokens per theme (plan-ui-ux §3.2), mirroring styles.css: `normal` is the
 * @theme block, `projector` is what html[data-contrast='high'] ends up with. `ink` and `ink2` are
 * the names every page shares (--color-ink, --color-ink-2); the rest are the new v2 names.
 */
export const THEME = {
  normal: {
    paper2: '#eef3f1',
    shelf: '#f8fbfa',
    sunk2: '#e1e9e6',
    rule2: '#c3d0cc',
    grid: '#dce6e2',
    ink: '#14213d',
    ink2: '#46536e',
  },
  projector: {
    paper2: '#ffffff',
    shelf: '#ffffff',
    sunk2: '#e6e6e6',
    rule2: '#4f5d6b',
    grid: '#b8c2cc',
    ink: '#000000',
    ink2: '#1d2433',
  },
} as const satisfies Record<string, Record<string, string>>

export type ThemeName = keyof typeof THEME

/** This run's line: solid blue. Same in every theme. */
export const RUN = '#2156c9'
/** The kept run: neutral grey, always dashed (KEPT_DASH) and labelled at its end, so it never relies on hue. */
export const KEPT = '#5b6478'
/** SVG stroke-dasharray for the kept run, in CSS px. */
export const KEPT_DASH = '6 4'
/** Energy strip: what comes in (blue) and what the body uses (orange). */
export const ENERGY_IN = '#2156c9'
export const ENERGY_USED = '#c2410c'

/**
 * Lines that can sit together in one graph. colors.test.ts checks every pair inside a group for
 * colour-blind and normal-vision separation, so a new series must join a group here.
 */
export const LINE_GROUPS: Record<string, readonly string[]> = {
  /** Blood sugar, stomach grams: this run and the kept run. */
  oneSignal: [RUN, KEPT],
  /** Energy in vs used, with the kept run's "in" line (used gets no ghost: same person). */
  energy: [ENERGY_IN, ENERGY_USED, KEPT],
}
