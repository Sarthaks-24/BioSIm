import type { MealItem } from '@lifepeek/engine'
import type { SystemLesson } from '../registry.ts'

/**
 * The effort pack's lessons (U-1 stubs; ui-ux §8.1, content-i18n §6): roti with a 10-minute run from
 * 0:30, the same roti at rest kept, opened in the run, on muscles' graph and on skin's. Each carries
 * its release (R18, R30); Teach lists them once the rows are public (X-1 builds the lesson bar, the
 * worksheet and the rest). effort.test.ts checks their sentences: in the run the muscles use many
 * times their resting energy and the skin sweats, while the kept, resting line stays flat.
 */

const roti: MealItem[] = [{ foodId: 'roti', servings: 1 }]
const plan = { meal: roti, activity: [{ kind: 'run' as const, startMin: 30, durMin: 10 }], kept: roti, keptActivity: [], t: 38 }

export const MUSCLES_LESSON: SystemLesson = {
  key: 'musclesRun',
  release: 'v3.0',
  layer: 'muscles',
  slot: 'energy',
  ...plan,
  title: 'sys.effort.muscles.lesson.title',
  question: 'sys.effort.muscles.lesson.question',
}

export const SKIN_LESSON: SystemLesson = {
  key: 'sweatRun',
  release: 'v3.0',
  layer: 'skin',
  slot: 'sweat',
  ...plan,
  title: 'sys.effort.skin.lesson.title',
  question: 'sys.effort.skin.lesson.question',
}
