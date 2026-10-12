import type { OrganismDef } from '../types.ts'

/** The human: the only organism in v2.0. Its body is today's flat and 3D bodies. */
export const HUMAN: OrganismDef = {
  id: 'human',
  i18nKey: 'organisms.human',
  kind: 'animal',
  inputKind: 'meal',
  profiles: ['adult-ref'],
  defaultSystem: 'digestion',
  bodyFlat: () => import('../../flat/FlatBody.tsx'),
  body3d: () => import('../../three/BodyCanvas.tsx'),
  signalOverrides: {},
}
