/**
 * The human model's modules, in the frozen run order (core/module.ts MODULE_ORDER). Only the
 * modules that exist today, lymph last (S-5, v3.1).
 */
import type { RunSignalId } from '../core/catalog.ts'
import type { ModelModule } from '../core/module.ts'
import type { OrganismId } from '../core/organism.ts'
import { activityModule } from './activity.ts'
import { gutModule } from './gut.ts'
import { energyModule } from './energy.ts'
import { bloodSugarModule } from './bloodSugar.ts'
import { gasModule } from './gas.ts'
import { effortModule } from './effort.ts'
import { circulationModule } from './circulation.ts'
import { waterModule } from './water.ts'
import { lymphModule } from './lymph.ts'

export { activityModule, gutModule, energyModule, bloodSugarModule, gasModule, effortModule, circulationModule, waterModule, lymphModule }

export const HUMAN_MODULES: readonly ModelModule[] = [
  activityModule,
  gutModule,
  energyModule,
  bloodSugarModule,
  gasModule,
  effortModule,
  circulationModule,
  waterModule,
  lymphModule,
]

/** What each organism produces: every signal its modules provide. The contract test requires goldens per organism for these. */
export const PROVIDES: { readonly [O in OrganismId]: readonly RunSignalId[] } = {
  human: HUMAN_MODULES.flatMap((m) => m.provides),
}
export const HUMAN_PROVIDES = PROVIDES.human
