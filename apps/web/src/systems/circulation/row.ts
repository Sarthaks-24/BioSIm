import type { SystemDef } from '../registry.ts'

/**
 * Heart & blood's row (U-3; architecture §5.1, anatomy plan §2.2): the `circulation` pack, drawn
 * flat in the `torso` framing by its own layer (systems/circulation/drawing.tsx, lazy). Only what the
 * title, the picker and links need is here, in the first download. Its three graphs (heart beats a
 * minute, blood pumped a minute, where blood goes), its rhythm and its limits come with the pack
 * (systems/circulation/ui.tsx `DEFS`, merged by systems/load.ts), so no circulation signal ID is in /sim.
 *
 * Hidden until the v3.0 release gate (H-1, architecture §5.2: V-3 closed, the model sealed): it opens
 * only from a `?preview=1` link, which the app never makes. Once public, a link with `act` and no
 * `layer` opens here (R39, systems/registry.ts defaultSystemFor).
 */
export const CIRCULATION: SystemDef = {
  id: 'circulation',
  i18nKey: 'systems.circulation',
  lifeProcess: 'transport',
  // Graphs on the meal clock, the beat drawn at its true speed on the real clock (architecture §1.7).
  clock: 'both',
  camera: { framing: 'torso' },
  organs: [],
  slots: [],
  knownLimits: [],
  draw: 'layer',
  // Its 3D heart and both loops (A-5, v3.1): a lazy chunk, loaded the first time Heart & blood is lit on a device with WebGL.
  layer3d: () => import('../../three/layers/circulation.ts'),
  pack: 'circulation',
  inputs: ['meal', 'activity'],
  rhythms: [],
  graphWindowMin: 2880,
  public: false,
}
