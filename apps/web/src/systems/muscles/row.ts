import type { SystemDef, SystemId } from '../registry.ts'

/**
 * The `effort` pack's rows (U-1; architecture §5.1, anatomy plan §2.4–2.6): Muscles, Skin &
 * temperature and the Bones card, each drawn flat in the `full` framing by its own layer (systems/
 * muscles/drawing.tsx, systems/skin/SkinLayer.tsx, systems/bones/BonesLayer.tsx: one lazy chunk).
 * Only what the title, the picker and links need is here, in the first download (one shape, so the
 * three cost little); each graph (energy used by muscles, sweat made) and its limits come with the
 * pack (systems/muscles/ui.tsx `DEFS`, merged by systems/load.ts), so no effort signal ID is in /sim.
 *
 * Bones has no signal and no graph (model §2.8; R2, R11): a Drawing-only card, so no inputs, and the
 * picker says "Drawing only" for it. Muscles and skin move only with walking or running (R75).
 *
 * Hidden until the v3.0 release gate (H-1): muscles and skin go public on V-1 alone, with no Hindi
 * gate (R47), Bones as Drawing only; meanwhile only a `?preview=1` link opens them, which the app never makes.
 */
const row = (id: SystemId, inputs: SystemDef['inputs']): SystemDef => ({
  id,
  i18nKey: `systems.${id}`,
  lifeProcess: 'movement',
  clock: 'sim',
  camera: { framing: 'full' },
  organs: [],
  slots: [],
  knownLimits: [],
  draw: 'layer',
  pack: 'effort',
  inputs,
  rhythms: [],
  graphWindowMin: 2880,
  public: false,
})

export const MUSCLES = row('muscles', ['meal', 'activity'])
export const BONES = row('bones', [])
export const SKIN = row('skin', ['meal', 'activity'])
