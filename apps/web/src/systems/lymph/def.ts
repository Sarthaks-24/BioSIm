import type { SystemDef } from '../registry.ts'

/**
 * Lymph & germ defence (A-11a; anatomy plan §2.7, model §2.11, R3/R11): a Drawing-only row with no
 * engine half in v3.0. Its picture is the static lymph map (systems/lymph/LymphLayer.tsx) and, in
 * the graph column's place, the germ-defence card (GermCard.tsx); both load with the `lymph` pack.
 * No graphs (empty `slots`), so the picker shows "Drawing only" for it. S-5 adds the lymph-fat and
 * blood-fat graphs in v3.1, and the row's tag changes then.
 *
 * Hidden until the v3.0 release gate (H-1) opens it: `?layer=lymph&preview=1` shows it meanwhile.
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
  inputs: [],
  rhythms: [],
  graphWindowMin: 2880,
  public: false,
}
