import type { MealItem } from '@lifepeek/engine'
import type { SystemLesson } from '../registry.ts'

/**
 * Hormones' lesson (U-6; content-i18n §8.1 "Who keeps blood sugar steady?", ui-ux §8.1): a glass of
 * cola, a glass of water kept, opened on the insulin graph at the most insulin after the cola. The
 * insulin lesson is v3.1, with `hormones` (R18). hormones.test.ts checks its sentences: insulin rises
 * after the cola and stays at exactly 1× with water; the brain's sugar is the same in both.
 */

const one = (foodId: string): MealItem[] => [{ foodId, servings: 1 }]

export const HORMONES_LESSON: SystemLesson = {
  key: 'insulinCola',
  release: 'v3.1',
  layer: 'hormones',
  slot: 'insulin',
  meal: one('cola'),
  activity: [],
  kept: one('water'),
  keptActivity: [],
  t: 27,
  title: 'teach.lessons.insulinCola',
  question: 'teach.lessonQuestions.insulinCola',
}
