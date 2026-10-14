import type { SlotId, SystemId } from '../systems/registry.ts'

/**
 * The flagship lesson's pauses (X-1; ui-ux §8.1, content-i18n §8.2): at most five (one 40-minute
 * class, R38), each on a different v3.0 system (R30), in clock order. A pause lights its system, sets
 * the meal clock (paused) and brings its graph to the front; the lesson bar shows its question, the
 * book's line first and the one sentence the model backs. Its words are `flagship.pauses.<key>` (the
 * bar's own text section). presets.test.ts recomputes every time and every number in those words.
 *
 * Times come from the model (content-i18n's are illustrative): the heart's pause is at the most blood
 * to the gut (`gutFlowPeak`, 51 min), the kidneys' when half the meal's water has left as urine
 * (`halfMealWaterPassed`, 1 h 51 min); breathing and skin are in the walk (1:00–1:20).
 *
 * Pause 4 is Skin & temperature (R34). While skin is not public (the `effort` pack, R36) it falls back
 * to Heart & blood's beats a minute in the walk (content-i18n §8.2). In v3.1 a blood-fat / insulin
 * pause replaces the Digestion one, never a sixth (R38): once Hormones may be lit (public, or a
 * preview), the lesson stops on its insulin graph at the most insulin after the roti
 * (`insulinPeak`, 1 h 26 min) in place of the stomach at 0:30, so the pauses stay in clock order.
 */
export interface Pause {
  key: 'stomach' | 'blood' | 'breaths' | 'sweat' | 'heart' | 'water' | 'insulin'
  system: SystemId
  slot: SlotId
  /** Minutes on the meal clock. */
  t: number
}

export const PAUSES: readonly Pause[] = [
  { key: 'stomach', system: 'digestion', slot: 'gut', t: 30 },
  { key: 'blood', system: 'circulation', slot: 'where', t: 51 },
  { key: 'breaths', system: 'breathing', slot: 'breaths', t: 70 },
  { key: 'sweat', system: 'skin', slot: 'sweat', t: 75 },
  { key: 'water', system: 'kidneys', slot: 'urine', t: 111 },
]

/** Pause 4 while skin is hidden (R34): the heart in the walk. */
export const HEART_PAUSE: Pause = { key: 'heart', system: 'circulation', slot: 'beats', t: 75 }

/** v3.1 (R38, U-6): Hormones at the most insulin after the roti, in place of the Digestion pause. */
export const INSULIN_PAUSE: Pause = { key: 'insulin', system: 'hormones', slot: 'insulin', t: 86 }

/**
 * The pauses this session can show: skin's when it may be lit (public, or a preview), else the
 * heart's; the insulin pause in place of the stomach's when Hormones may be lit, in clock order.
 */
export function pausesFor(skin: boolean, hormones = false): readonly Pause[] {
  const pauses = skin ? PAUSES : PAUSES.map((p) => (p.key === 'sweat' ? HEART_PAUSE : p))
  return hormones ? [...pauses.filter((p) => p.key !== 'stomach'), INSULIN_PAUSE].sort((a, b) => a.t - b.t) : pauses
}
