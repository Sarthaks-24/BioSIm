import type { OrganismId } from '@lifepeek/engine'
import type { OrganismRegistry } from './types.ts'
import { HUMAN } from './human/organism.ts'
import { HUMAN_SYSTEMS } from './human/systems.ts'
import { HUMAN_ORGANS } from './human/organs.ts'

/**
 * Every organism's registry. The human is a static import: it is the only one. When a second
 * organism arrives, its entry becomes a loader so it never adds to the human screen's bundle
 * (plan-organisms #16).
 */
export const ORGANISMS: { readonly [O in OrganismId]: OrganismRegistry } = {
  human: { organism: HUMAN, systems: HUMAN_SYSTEMS, organs: HUMAN_ORGANS },
}
