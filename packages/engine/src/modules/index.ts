/**
 * The human model's modules, in the frozen run order (core/module.ts MODULE_ORDER). Only the
 * modules that exist today; gas, circulation, water and lymph join in v3 (S-2…S-5).
 */
import type { ProducedSignalId } from '../core/catalog.ts'
import type { ModelModule } from '../core/module.ts'
import type { OrganismId } from '../core/organism.ts'
import { activityModule } from './activity.ts'
import { gutModule } from './gut.ts'
import { energyModule } from './energy.ts'
import { bloodSugarModule } from './bloodSugar.ts'
import { effortModule } from './effort.ts'

export { activityModule, gutModule, energyModule, bloodSugarModule, effortModule }

export const HUMAN_MODULES: readonly ModelModule[] = [activityModule, gutModule, energyModule, bloodSugarModule, effortModule]

/** What each organism produces: every signal its modules provide. The contract test requires goldens per organism for these. */
export const PROVIDES: { readonly [O in OrganismId]: readonly ProducedSignalId[] } = {
  human: HUMAN_MODULES.flatMap((m) => m.provides),
}
export const HUMAN_PROVIDES = PROVIDES.human
