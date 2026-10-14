import type { MealItem } from '@lifepeek/engine'
import type { SystemLesson } from '../registry.ts'

/**
 * Lymph's lesson (U-5; content-i18n §8.1 "How does fat reach the blood?", NCERT Class 10, ui-ux
 * §8.1): a cheeseburger with fries, two rotis kept, opened at 4 h on Fat's road, while lymph carries
 * the burger's fat and the map's fat dots run up the main duct. Release v3.1 (R18): Teach lists it
 * once the row is public with its graphs. lymph.test.ts checks its sentence and the worksheet's
 * numbers are the model's: the burger's fat stays up for hours, the rotis' barely moves.
 */

const burger: MealItem[] = [
  { foodId: 'cheeseburger', servings: 1 },
  { foodId: 'fries', servings: 1 },
]

export const LYMPH_LESSON: SystemLesson = {
  key: 'fatRoad',
  release: 'v3.1',
  layer: 'lymph',
  slot: 'road',
  meal: burger,
  activity: [],
  kept: [{ foodId: 'roti', servings: 1 }],
  keptActivity: [],
  t: 240,
  title: 'teach.lessons.fatRoad',
  question: 'teach.lessonQuestions.fatRoad',
}
