import type { MealItem } from '@lifepeek/engine'
import type { SystemLesson } from '../registry.ts'

/**
 * Heart & blood's lesson (U-3 stub; content-i18n §6 "Where does the blood go after a meal, and in a
 * walk?", ui-ux §8.1): roti and dal with a 20-minute walk from 1:00, the same meal at rest kept,
 * opened in the walk on "Where blood goes" (muscles against the kept, resting ghost). Every lesson
 * carries its release (R18, R30). Teach lists it once the row is public (X-1 builds the lesson bar,
 * the worksheet and Count yours); circulation.test.ts checks its sentence: in the walk far more blood
 * goes to the muscles than at rest, and after the meal more goes to the gut than before it.
 */

const meal: MealItem[] = [
  { foodId: 'roti', servings: 1 },
  { foodId: 'dal', servings: 1 },
]

export const CIRCULATION_LESSON: SystemLesson = {
  key: 'heartWalk',
  release: 'v3.0',
  layer: 'circulation',
  slot: 'where',
  meal,
  activity: [{ kind: 'walk', startMin: 60, durMin: 20 }],
  kept: meal,
  keptActivity: [],
  t: 70,
  title: 'teach.lessons.heartWalk',
  question: 'teach.lessonQuestions.heartWalk',
}
