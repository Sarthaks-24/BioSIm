import type { OrganismId } from '@lifepeek/engine'
import type { OrganismRegistry } from './types.ts'
import { HUMAN } from './human/organism.ts'
import { HUMAN_ORGANS } from './human/organs.ts'
import { SYSTEMS } from '../systems/registry.ts'

/**
 * Every organism's registry. The human is a static import: it is the only one. When a second
 * organism arrives, its entry becomes a loader so it never adds to the human screen's bundle
 * (plan-organisms #16). The human's systems are the systems registry (systems/registry.ts, W-1).
 */
export const ORGANISMS: { readonly [O in OrganismId]: OrganismRegistry } = {
  human: { organism: HUMAN, systems: SYSTEMS, organs: HUMAN_ORGANS },
}
