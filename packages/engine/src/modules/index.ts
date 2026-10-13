/**
 * The human model's modules, in the frozen run order (core/module.ts MODULE_ORDER). Only the
 * modules that exist today; activity, gas, effort, circulation, water and lymph join in v3.
 */
import type { ActiveSignalId } from '../core/catalog.ts'
import type { ModelModule } from '../core/module.ts'
import type { OrganismId } from '../core/organism.ts'
import { gutModule } from './gut.ts'
import { energyModule } from './energy.ts'
import { bloodSugarModule } from './bloodSugar.ts'

export { gutModule, energyModule, bloodSugarModule }

export const HUMAN_MODULES: readonly ModelModule[] = [gutModule, energyModule, bloodSugarModule]

/** What each organism produces: every signal its modules provide. The contract test requires goldens per organism for these. */
export const PROVIDES: { readonly [O in OrganismId]: readonly ActiveSignalId[] } = {
  human: HUMAN_MODULES.flatMap((m) => m.provides),
}
export const HUMAN_PROVIDES = PROVIDES.human
