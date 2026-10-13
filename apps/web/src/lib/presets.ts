import { encodeShareState, type MealItem } from '@lifepeek/engine'
import type { SystemId } from '../registry/types.ts'

/**
 * A ready-made link to the stage (WP-19): a meal, optionally a kept meal to compare it with (the
 * dashed ghost line), a lit layer and a start time. The link keeps v1's letters, `a` = the meal
 * and `b` = the kept meal, so the four presets below still make exactly the links v1 shared
 * (lib/v1-links.fixture.ts; links.test.ts checks it).
 */
export interface Preset {
  key: string
  meal: MealItem[]
  kept?: MealItem[]
  layer?: SystemId
  /** Minutes after eating the link opens at (paused). */
  t?: number
}

/** Which graph a lesson or a question is about (the tab shown where graphs show one at a time). */
export type StripSlot = 'gut' | 'blood' | 'energy'

const one = (...ids: string[]): MealItem[] => ids.map((foodId) => ({ foodId, servings: 1 }))

/** The comparisons on Home ("Cola, with burger + fries kept"). Their links are v1's: never change them. */
export const PRESETS = [
  { key: 'colaBurger', meal: one('cola'), kept: one('cheeseburger', 'fries') },
  { key: 'rotiRice', meal: one('roti', 'dal'), kept: one('white-rice') },
  { key: 'appleJuice', meal: one('apple'), kept: one('orange-juice') },
  { key: 'waterMilk', meal: one('water'), kept: one('milk') },
] as const satisfies readonly Preset[]

export const DEFAULT_PRESET: Preset = PRESETS[0]

/**
 * The three ready lessons on the Teach page (council round 2): each opens at its first key
 * moment (`t`, the earliest marker on the timeline of either meal; presets.test.ts recomputes
 * it), on the graph the lesson is about, in projector mode.
 */
export interface Lesson extends Preset {
  key: 'stomachRace' | 'rotiDal' | 'colaFour'
  strip: StripSlot
  t: number
}

export const LESSONS: readonly Lesson[] = [
  { key: 'stomachRace', meal: one('cola'), kept: one('cheeseburger', 'fries'), strip: 'gut', t: 35 },
  { key: 'rotiDal', meal: one('roti', 'dal'), kept: one('white-rice'), strip: 'blood', t: 57 },
  { key: 'colaFour', meal: one('cola'), kept: [{ foodId: 'cola', servings: 4 }], strip: 'blood', t: 35 },
]

/**
 * The four task-test questions (ROADMAP §2e, worded as in the pre-swap student check kit: they
 * name no button), each with the screen a student starts from, at 0 min: finding the moment and
 * the graph is the task. Teach shows them; e2e/teach.spec.ts checks the links.
 */
export interface Task extends Preset {
  key: 'halfLeft' | 'faster' | 'bloodAt1h' | 'energyAt3h'
}

export const TASKS: readonly Task[] = [
  { key: 'halfLeft', meal: one('cola') },
  { key: 'faster', meal: one('cola') },
  { key: 'bloodAt1h', meal: one('cola') },
  { key: 'energyAt3h', meal: one('cola'), kept: one('cheeseburger', 'fries') },
]

export const presetHref = (p: Preset) =>
  `/sim?${encodeShareState({ a: p.meal, b: p.kept ?? [], t: p.t ?? 0, ...(p.layer ? { layer: p.layer } : {}) })}`
