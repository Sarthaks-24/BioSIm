/**
 * The shape of `hero.json`, the race on Home: what components/HomeRace.tsx reads. Kept apart from
 * `hero.ts`, which runs the model to write it, so Home never imports the model, whatever the bundler keeps.
 */
export const HERO_STEP_MIN = 3
export const HERO_END_MIN = 360

export interface HeroLine {
  /** The foods, for the legend (names come from the food files, in the reader's language). */
  foods: string[]
  /** Share of the meal still in the stomach (0–1) at 0, 3, 6 … 360 min, rounded to 3 decimals. */
  stomach: number[]
}

export interface Hero {
  meal: HeroLine
  kept: HeroLine
}
