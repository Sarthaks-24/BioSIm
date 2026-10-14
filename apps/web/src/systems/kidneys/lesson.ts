import type { MealItem } from '@lifepeek/engine'
import type { SystemLesson } from '../registry.ts'

/**
 * Kidneys & water's lesson (U-4 stub; content-i18n §6 "Where does the water from a drink go?", ui-ux
 * §8.1): four glasses of water, one glass kept, opened at 1 h on the urine graph, near the most urine.
 * Every lesson carries its release (R18, R30). Teach lists it once the row is public (X-1 builds the
 * lesson bar, the worksheet and the "why" card); kidneys.test.ts checks its sentence: more water,
 * more urine an hour, and both well above a steady day's.
 */

const glasses = (servings: number): MealItem[] => [{ foodId: 'water', servings }]

export const KIDNEYS_LESSON: SystemLesson = {
  key: 'drinkWater',
  release: 'v3.0',
  layer: 'kidneys',
  slot: 'urine',
  meal: glasses(4),
  activity: [],
  kept: glasses(1),
  keptActivity: [],
  t: 60,
  title: 'teach.lessons.drinkWater',
  question: 'teach.lessonQuestions.drinkWater',
}
