import type { SystemDef } from '../registry.ts'

/**
 * Lymph & germ defence (A-11a, U-5; anatomy plan §2.7, model §2.10, §2.11, R3): the `lymph` pack,
 * drawn flat in the `full` framing by its own layer (systems/lymph/LymphLayer.tsx: the lymph map,
 * with fat dots on the lymph route while lymph carries fat). Only what the title, the picker and
 * links need is here, in the first download. Its two graphs (Fat's road, Blood fat), its moment and
 * limits come with the pack (systems/lymph/ui.tsx `DEFS`, merged by systems/load.ts), so no lymph
 * signal ID is in /sim. The germ-defence card (GermCard.tsx) opens from its Now line.
 *
 * v3.0 had it Drawing only (no engine half, empty `slots`, no inputs: the picker's "Drawing only").
 * v3.1 (S-5, U-5): the meal moves it, so the picker shows its first graph's value and "Model
 * estimate" (R3). Its graphs show 0–12 h (`graphWindowMin`, as Kidneys'): an everyday meal's fat
 * has reached the blood and left it by then; the dock says "0–12 h shown · 48 h ›" for a big one.
 *
 * Public since the v3.0 release gate (H-1, R103) as Drawing only; with its graphs since U-5's
 * acceptance (v3.1 is released by the user).
 */
export const LYMPH: SystemDef = {
  id: 'lymph',
  i18nKey: 'systems.lymph',
  lifeProcess: 'transport',
  clock: 'sim',
  camera: { framing: 'full' },
  organs: [],
  slots: [],
  knownLimits: [],
  draw: 'layer',
  pack: 'lymph',
  inputs: ['meal'],
  rhythms: [],
  graphWindowMin: 12 * 60,
  public: true,
}
