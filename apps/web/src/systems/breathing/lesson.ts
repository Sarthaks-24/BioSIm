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
  title: 'teach.lessons.breathRun',
  question: 'teach.lessonQuestions.breathRun',
}

/**
 * The Games lesson (v3.2 Teach step, R116, R119): "Football or a walk: what do the heart and lungs
 * do?" One roti with 20 minutes of football (a casual game, 2024 Compendium 15610, 7.0 MET) from
 * 0:30, the same roti with a 20-minute walk at the same time kept (the dashed grey line), opened in
 * the game on the breaths graph. Heart & blood shows the same two plans' hearts. Teach lists it under
 * Respiration, after the run; worksheets.test.ts recomputes its worksheet's numbers from the model
 * (breaths and beats in the game and the walk, air per breath, the oxygen used), whyCards.test.ts
 * its row on Breathing's card. The model draws a steady game; a real one comes in bursts.
 */
export const FOOTBALL_LESSON: SystemLesson = {
  key: 'footballWalk',
  release: 'v3.2',
  layer: 'breathing',
  slot: 'breaths',
  meal: roti,
  activity: [{ kind: 'football', startMin: 30, durMin: 20 }],
  kept: roti,
  keptActivity: [{ kind: 'walk', startMin: 30, durMin: 20 }],
  t: 45,
  title: 'teach.lessons.footballWalk',
  question: 'teach.lessonQuestions.footballWalk',
}
