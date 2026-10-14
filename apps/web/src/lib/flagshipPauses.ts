import type { SlotId, SystemId } from '../systems/registry.ts'

/**
 * The flagship lesson's pauses (X-1; ui-ux §8.1, content-i18n §8.2): at most five (one 40-minute
 * class, R38), each on a different system (R30: v3.0's, and since v3.1 lymph's), in clock order. A pause lights its system, sets
 * the meal clock (paused) and brings its graph to the front; the lesson bar shows its question, the
 * book's line first and the one sentence the model backs. Its words are `flagship.pauses.<key>` (the
 * bar's own text section). presets.test.ts recomputes every time and every number in those words.
 *
 * Times come from the model (content-i18n's are illustrative): the heart's pause is at the most blood
 * to the gut (`gutFlowPeak`, 51 min), the kidneys' when half the meal's water has left as urine
 * (`halfMealWaterPassed`, 1 h 51 min); breathing and skin are in the walk (1:00–1:20).
 *
 * Pause 4 is Skin & temperature (R34). While skin is not public (the `effort` pack, R36) it falls back
 * to Heart & blood's beats a minute in the walk (content-i18n §8.2).
 *
 * v3.1 (U-5, R38): a blood-fat pause replaces the Digestion one, never a sixth: Lymph's blood fat at
 * its highest (`triglyceridePeak`, 2 h 27 min, ui-ux §8.1), so it comes last in clock order and the
 * lesson opens on Heart & blood. With U-6 it is the blood-fat/insulin pause: once Hormones may be
 * lit, the bar adds one sentence on insulin to the blood-fat words (`flagship.pauses.fat.insulin`
 * after `flagship.pauses.fat.model`, components/LessonBar.tsx), still five pauses.
 */
export interface Pause {
  key: 'blood' | 'breaths' | 'sweat' | 'heart' | 'water' | 'fat'
  system: SystemId
  slot: SlotId
  /** Minutes on the meal clock. */
  t: number
}

export const PAUSES: readonly Pause[] = [
  { key: 'blood', system: 'circulation', slot: 'where', t: 51 },
  { key: 'breaths', system: 'breathing', slot: 'breaths', t: 70 },
  { key: 'sweat', system: 'skin', slot: 'sweat', t: 75 },
  { key: 'water', system: 'kidneys', slot: 'urine', t: 111 },
  { key: 'fat', system: 'lymph', slot: 'fat', t: 147 },
]

/** Pause 4 while skin is hidden (R34): the heart in the walk. */
export const HEART_PAUSE: Pause = { key: 'heart', system: 'circulation', slot: 'beats', t: 75 }

/** The pauses this session can show: skin's when it may be lit (public, or a preview), else the heart's. */
export const pausesFor = (skin: boolean): readonly Pause[] => (skin ? PAUSES : PAUSES.map((p) => (p.key === 'sweat' ? HEART_PAUSE : p)))
