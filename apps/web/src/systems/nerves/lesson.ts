import type { MealItem } from '@lifepeek/engine'
import type { SystemLesson } from '../registry.ts'

/**
 * Brain & nerves' lesson (U-7 stub, v3.1; content-i18n §8 "Reflex add-on", ui-ux §8.1): "Why do you
 * pull your hand back before you feel the pain?" It opens on the nerve demo (its `slot` is the demo:
 * the row has no graphs), with a roti eaten, so the Now line shows the brain's sugar use is the same
 * as on any day. Every lesson carries its release (R18): Teach lists it under "Control and
 * coordination" (v3.1 Teach step, R109), with its worksheet (lib/worksheets.ts) and the demo's
 * "Why different?" card by its book line (NCERT Class 10, Ch 6, p. 102). nerves.test.ts
 * checks its sentence: the reflex is fast, the route through the brain about three times as long.
 */

const roti: MealItem[] = [{ foodId: 'roti', servings: 1 }]

export const NERVES_LESSON: SystemLesson = {
  key: 'reflexHotPan',
  release: 'v3.1',
  layer: 'nerves',
  slot: 'demo',
  meal: roti,
  activity: [],
  kept: [],
  keptActivity: [],
  t: 0,
  title: 'teach.lessons.reflexHotPan',
  question: 'teach.lessonQuestions.reflexHotPan',
}
