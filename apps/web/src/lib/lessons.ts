import { encodeShareState } from '@lifepeek/engine'
import { pickerSystems, type SlotId, type SystemId, type SystemLesson } from '../systems/registry.ts'
import { BREATHING_LESSON } from '../systems/breathing/lesson.ts'
import { CIRCULATION_LESSON } from '../systems/circulation/lesson.ts'
import { KIDNEYS_LESSON } from '../systems/kidneys/lesson.ts'
import { LYMPH_LESSON } from '../systems/lymph/lesson.ts'
import { HORMONES_LESSON } from '../systems/hormones/lesson.ts'
import { MUSCLES_LESSON, SKIN_LESSON } from '../systems/muscles/lesson.ts'
import { LESSONS, presetHref, type Lesson } from './presets.ts'
import { LESSON_PACKS } from './offlineSave.ts'

/**
 * Teach's lessons by NCERT chapter (X-1, R15): Class 10's Life Processes in its order (nutrition,
 * respiration, transportation, excretion), then Class 10's Control and coordination (U-6: the insulin
 * lesson, v3.1, R18), then moving and body heat (Classes 6 and 9). Each row is a
 * ready lesson with its classes (content-i18n §8.1) and its release (R18). A system's lessons show
 * once the system is public, or in a `?preview=1` session (R30): a lesson for a hidden system is
 * never listed, and needs no change to appear when the gate (H-1) makes its system public.
 * Only Teach imports this (the system lesson files ride in Teach's chunk, not their packs').
 */
export interface TeachLesson {
  key: string
  /** The system it is about (and opens on). */
  system: SystemId
  slot: SlotId
  t: number
  /** NCERT classes it fits (content-i18n §8.1). */
  classes: readonly number[]
  release: 'v2' | SystemLesson['release']
  /** Its lazy files for "Save for class offline" (pack-manifest entries). */
  packs: readonly string[]
  href: (preview: boolean) => string
  /** A digestion lesson from v2 (lib/presets.ts): its meals are named in the row. */
  preset?: Lesson
}

export interface Chapter {
  key: 'nutrition' | 'respiration' | 'transport' | 'excretion' | 'control' | 'movement'
  /** Part of Class 10's Life Processes. */
  c10: boolean
  lessons: readonly TeachLesson[]
}

const withPreview = (href: string, preview: boolean) => (preview ? `${href}&preview=1` : href)

const fromPreset = (l: Lesson): TeachLesson => ({
  key: l.key,
  system: 'digestion',
  slot: l.slot,
  t: l.t,
  classes: [7, 10],
  release: 'v2',
  packs: LESSON_PACKS,
  href: () => presetHref(l),
  preset: l,
})

/** A system's lesson stub (systems/<id>/lesson.ts) as a Teach row: its own link, with its pack to save. */
const fromSystem = (l: SystemLesson, classes: readonly number[], pack: string): TeachLesson => ({
  key: l.key,
  system: l.layer as SystemId,
  slot: l.slot,
  t: l.t,
  classes,
  release: l.release,
  packs: [...LESSON_PACKS, pack],
  href: (preview) =>
    withPreview(
      `/sim?${encodeShareState({ a: l.meal, b: l.kept, t: l.t, layer: l.layer, act: l.activity, bact: l.keptActivity })}`,
      preview,
    ),
})

export const CHAPTERS: readonly Chapter[] = [
  { key: 'nutrition', c10: true, lessons: LESSONS.map(fromPreset) },
  { key: 'respiration', c10: true, lessons: [fromSystem(BREATHING_LESSON, [6, 7, 10], 'breathing')] },
  {
    key: 'transport',
    c10: true,
    // U-5 (v3.1): lymph's lesson, after the heart's (NCERT Class 10's order: blood, then lymph).
    lessons: [fromSystem(CIRCULATION_LESSON, [7, 10], 'circulation'), fromSystem(LYMPH_LESSON, [10], 'lymph')],
  },
  { key: 'excretion', c10: true, lessons: [fromSystem(KIDNEYS_LESSON, [10], 'kidneys')] },
  { key: 'control', c10: false, lessons: [fromSystem(HORMONES_LESSON, [10], 'control')] },
  {
    key: 'movement',
    c10: false,
    lessons: [fromSystem(MUSCLES_LESSON, [6, 9, 10], 'effort'), fromSystem(SKIN_LESSON, [6, 9, 10], 'effort')],
  },
]

/** The chapters with the lessons this session may show (public systems, or every built one in a preview); empty chapters left out. */
export function shownChapters(preview: boolean): Chapter[] {
  const shown = new Set<SystemId>(pickerSystems(preview).map((s) => s.id))
  return CHAPTERS.map((c) => ({ ...c, lessons: c.lessons.filter((l) => shown.has(l.system)) })).filter((c) => c.lessons.length)
}
