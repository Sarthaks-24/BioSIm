import type { SystemDef } from '../registry.ts'

/**
 * Hormones' row (U-6; architecture §5.1, anatomy plan §2.8): the `control` pack, drawn flat in the
 * `upper` framing by its own layer (systems/hormones/drawing.tsx, lazy): the pancreas with the
 * stomach and liver round it, insulin dots leaving it for the liver, and the glands NCERT names
 * drawn only. Only what the title, the picker and links need is here, in the first download. Its
 * two graphs (blood sugar, insulin as × before eating), its moment and limits come with the pack
 * (systems/hormones/ui.tsx `DEFS`, merged by systems/load.ts), so no control signal ID is in /sim.
 *
 * Insulin is open loop (model E1, R91): it follows the sugar coming in and never pulls blood sugar
 * down, so Blood sugar here is Digestion's own line, unchanged. Its graphs show 0–12 h, as
 * Kidneys & water's: most meals' insulin is back near 1× well before then (a big solid meal's is
 * still raised at 8 h, R91), and the rest of the 48 h is flat.
 *
 * Public on v3 since U-6's acceptance (v3.1; the user releases it).
 */
export const HORMONES: SystemDef = {
  id: 'hormones',
  i18nKey: 'systems.hormones',
  lifeProcess: 'control',
  clock: 'sim',
  camera: { framing: 'upper' },
  organs: [],
  slots: [],
  knownLimits: [],
  draw: 'layer',
  pack: 'control',
  inputs: ['meal'],
  rhythms: [],
  graphWindowMin: 12 * 60,
  public: true,
}
