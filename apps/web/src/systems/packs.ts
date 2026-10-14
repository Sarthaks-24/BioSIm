import type { SystemId, SystemUi, CatalogRow, PackId } from './registry.ts'
import type { Loader } from '../registry/types.ts'

/** What a pack brings when it loads (architecture §5.2): its catalog rows and its systems' `SystemUi`. */
export interface PackDef {
  /** Its catalog rows (`@lifepeek/engine/catalog/<packId>`), handed to `registerSignals`. */
  rows: Loader<readonly CatalogRow[]>
  /** Its systems' words and moments; none for `core`, whose digestion UI is static (systems/ui.ts). */
  ui?: Loader<{ readonly [S in SystemId]?: SystemUi }>
}

/**
 * The packs built so far. `core`'s rows ride the run chunk (the engine imports every row) and no
 * screen code loads them before a run, so this list is read by the tests and scripts, and from U-2
 * by the picker, which loads a pack when its row is lit. A system whose pack is missing here fails
 * registry.test by name.
 */
export const PACKS: { readonly [P in PackId]?: PackDef } = {
  core: { rows: () => import('@lifepeek/engine/catalog/core') },
}
