import type { SystemDef } from '../registry.ts'

/**
 * Breathing's row (U-2; architecture §5.1, anatomy plan §2.1): the `breathing` pack, drawn flat in
 * the `chest` framing by its own layer (systems/breathing/drawing.tsx, lazy). Only what the title,
 * the picker and links need is here, in the first download. Its three graphs (breaths a minute, air
 * per breath, oxygen used and carbon dioxide made), its rhythm and its limits come with the pack
 * (systems/breathing/ui.tsx `DEFS`, merged by systems/load.ts), so no breathing signal ID is in /sim.
 *
 * Hidden until the v3.0 release gate (H-1, architecture §5.2: V-2 closed, the model sealed, Hindi Tier
 * 1): it opens only from a `?preview=1` link, which the app never makes (P-0, R8/R19).
 */
export const BREATHING: SystemDef = {
  id: 'breathing',
  i18nKey: 'systems.breathing',
  lifeProcess: 'respiration',
  // Graphs on the meal clock, the breath drawn at its true speed on the real clock (architecture §1.7).
  clock: 'both',
  camera: { framing: 'chest' },
  organs: [],
  slots: [],
  knownLimits: [],
  draw: 'layer',
  // Its 3D lungs (A-3, v3.1): a lazy chunk, loaded the first time Breathing is lit on a device with WebGL.
  layer3d: () => import('../../three/layers/breathing.ts'),
  pack: 'breathing',
  inputs: ['meal', 'activity'],
  rhythms: [],
  graphWindowMin: 2880,
  public: false,
}
