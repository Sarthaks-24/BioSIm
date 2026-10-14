import type { PackId } from './registry.ts'
import { LAZY_PACKS, type PackDef } from './load.ts'

/**
 * The packs built so far, `core` included: read by the tests and scripts. A system whose pack is
 * missing here fails registry.test by name. `core`'s rows ride the run chunk (the engine imports
 * every row) and no screen code loads them before a run; every other pack is in LAZY_PACKS
 * (systems/load.ts), which the stage loads from when a system is lit.
 */
export const PACKS: { readonly [P in PackId]?: PackDef } = {
  core: { rows: () => import('@lifepeek/engine/catalog/core') },
  ...LAZY_PACKS,
}
