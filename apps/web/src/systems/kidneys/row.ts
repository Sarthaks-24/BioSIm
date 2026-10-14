import type { SystemDef } from '../registry.ts'

/**
 * Kidneys & water's row (U-4; architecture §5.1, anatomy plan §2.3): the `kidneys` pack, drawn flat
 * in the `torso` framing by its own layer (systems/kidneys/drawing.tsx, lazy). Only what the title,
 * the picker and links need is here, in the first download. Its two graphs (urine made per hour with
 * the background line, water in the body above normal), its moments and limits come with the pack
 * (systems/kidneys/ui.tsx `DEFS`, merged by systems/load.ts), so no kidney signal ID is in /sim.
 *
 * Its graphs show 0–12 h (`graphWindowMin`, ui-ux §4, model D17): a drink's water has left by then,
 * and the rest of the 48 h is the steady background day. The dock says "0–12 h shown · 48 h ›".
 *
 * Public since the v3.0 release gate (H-1, R103; architecture §5.2).
 */
export const KIDNEYS: SystemDef = {
  id: 'kidneys',
  i18nKey: 'systems.kidneys',
  lifeProcess: 'excretion',
  clock: 'sim',
  camera: { framing: 'torso' },
  organs: [],
  slots: [],
  knownLimits: [],
  draw: 'layer',
  pack: 'kidneys',
  inputs: ['meal', 'activity'],
  rhythms: [],
  graphWindowMin: 12 * 60,
  public: true,
}
