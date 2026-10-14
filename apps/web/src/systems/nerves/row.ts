import type { SystemDef } from '../registry.ts'

/**
 * Brain & nerves' row (U-7; architecture §5.1, model §2.6 and D16, anatomy plan §2.8): the `control`
 * pack, drawn flat in the `upper` framing by its own layer (systems/nerves/drawing.tsx, lazy). Not a
 * time-series system: no graphs (empty `slots`) and no catalog IDs of its own. In the graph
 * column's place it shows the nerve demo (systems/nerves/NerveDemo.tsx): the hot-pan reflex against
 * the route through the brain, slowed down, with real-millisecond counters from the engine's pure
 * `reflexTime` (@lifepeek/engine/demo). Its tag is "Model estimate" (a formula with chosen values
 * from read ranges, V-7), so the picker shows that tag, not "Drawing only" (`tag`).
 *
 * Only what the title, the picker and links need is here, in the first download; its words, demo
 * and drawing come with the pack (systems/load.ts).
 */
export const NERVES: SystemDef = {
  id: 'nerves',
  i18nKey: 'systems.nerves',
  lifeProcess: 'control',
  clock: 'sim',
  camera: { framing: 'upper' },
  organs: [],
  slots: [],
  knownLimits: [],
  draw: 'layer',
  pack: 'control',
  inputs: [],
  rhythms: [],
  graphWindowMin: 2880,
  tag: 'assumption',
  // U-7's acceptance passed (counter = reflexTime ± 1 ms, brain route ≥ 3×, R92): public on v3 (v3.1 ships when the user releases it).
  public: true,
}
