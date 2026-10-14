import type { SystemDef } from '../registry.ts'

/**
 * Reproduction's row (R-1, v3.2; model §2.12, ui-ux §10, anatomy plan D6 and A-11b): the
 * `reproduction` pack, behind the teacher switch "Growing up" (off by default; systems/registry.ts
 * `growingUpOn`). Static data, not engine output: no signal, no graph slot, no input. Two panels
 * stand in the graph column's place (systems/reproduction/Panels.tsx), and nothing is drawn on the
 * body (`draw: 'panels'`: the plain body in the `full` framing, no layer, no 3D). Its tag is "Model
 * estimate": the hormone curves are study medians moved onto the book's 28-day cycle with a drawn
 * line between them (data.ts says why).
 *
 * Hidden (`public: false`) until the user flips it (🛑, the card's acceptance): until then only a
 * `?preview=1` session with the switch on offers it. Only what the title, the picker and links need
 * is here, in the first download; its words and panels come with its pack.
 */
export const REPRODUCTION: SystemDef = {
  id: 'reproduction',
  i18nKey: 'systems.reproduction',
  lifeProcess: 'reproduction',
  clock: 'sim',
  camera: { framing: 'full' },
  organs: [],
  slots: [],
  knownLimits: [],
  draw: 'panels',
  pack: 'reproduction',
  inputs: [],
  rhythms: [],
  graphWindowMin: 2880,
  tag: 'assumption',
  teacherSwitch: true,
  public: false,
}
