import type { MealItem } from '@lifepeek/engine'
import type { SystemLesson } from '../registry.ts'

/**
 * Reproduction's lesson (R-1 stub, v3.2; anchored to NCERT Class 10 "How do Organisms Reproduce?",
 * Reprint 2026-27, p. 124: "One egg is produced every month by one of the ovaries"; "Since the
 * ovary releases one egg every month, the uterus also prepares itself every month to receive a
 * fertilised egg"): "Why does the lining of the uterus build up every month?" It opens on the
 * hormone panel (its `slot`: the row has no graphs). As Brain & nerves' stub, Teach lists it with its own Teach step (chapter, worksheet), not before, and only
 * while the teacher switch is on (lib/lessons.ts lists the rows `pickerSystems` offers). The meal
 * is a roti only so the link opens a ready stage; the panels do not follow it.
 * reproduction.test.ts checks its sentence: LH peaks at the egg's day; progesterone rises after it.
 */

const roti: MealItem[] = [{ foodId: 'roti', servings: 1 }]

export const REPRODUCTION_LESSON: SystemLesson = {
  key: 'cycleHormones',
  release: 'v3.2',
  layer: 'reproduction',
  slot: 'cycle',
  meal: roti,
  activity: [],
  kept: [],
  keptActivity: [],
  t: 0,
  title: 'teach.lessons.cycleHormones',
  question: 'teach.lessonQuestions.cycleHormones',
}
