import type { MealItem } from '@lifepeek/engine'
import type { SystemLesson } from '../registry.ts'

/**
 * Breathing's lesson (U-2 stub; content-i18n §6 "Why do you breathe faster when you run?", ui-ux
 * §8.1): roti with a 10-minute run from 0:30, the same roti at rest kept, opened in the run on the
 * breaths graph. Every lesson carries its release (R18, R30). Teach lists it once the row is public
 * (X-1 builds the lesson bar, the worksheet and Count yours); breathing.test.ts checks its sentence:
 * breaths in the run are well above the kept, resting line.
 */

const roti: MealItem[] = [{ foodId: 'roti', servings: 1 }]

export const BREATHING_LESSON: SystemLesson = {
  key: 'breathRun',
  release: 'v3.0',
  layer: 'breathing',
  slot: 'breaths',
  meal: roti,
  activity: [{ kind: 'run', startMin: 30, durMin: 10 }],
  kept: roti,
  keptActivity: [],
  t: 38,
  title: 'sys.breathing.lesson.title',
  question: 'sys.breathing.lesson.question',
}
