import type { OrganismDef } from '../types.ts'

/** The human: the only organism in v2.0. Its body is the shared flat and 3D body (components/BodyView.tsx). */
export const HUMAN: OrganismDef = {
  id: 'human',
  i18nKey: 'organisms.human',
  kind: 'animal',
  inputKind: 'meal',
  profiles: ['adult-ref'],
  defaultSystem: 'digestion',
  signalOverrides: {
    // Fixed scales that fit everyday meals, the same for every meal (plan-graphs §3.1). The
    // catalog's ranges left them in the bottom of the graph, a flat line on a projector:
    // - stomach: a cola is 344 g, roti ×2 + dal 294 g, burger + fries 236 g, roti + dal + milk
    //   550 g; 0–1,000 g → 0–600 g. Four colas (1,376 g) stretch the scale once, and it says so.
    // - energy coming in: no meal under the 1,500 kcal cap comes in faster than about 180 kcal/h
    //   (the stomach lets food through slowly); 0–400 → 0–200 kcal/h. Energy used shares the axis.
    'gut.stomach.contentG': { displayRange: [0, 600] },
    'energy.inRate': { displayRange: [0, 200] },
  },
}
