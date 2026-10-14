/**
 * The `reproduction` pack as one lazy module (systems/load.ts `onePack`): the Now line, the two
 * panels with their static data (data.ts) and the English, fetched together the first time the row
 * is lit (R71, R74: runtime cache "lp-lazy", never the first download). No catalog rows (not engine
 * output: R114) and no drawing (nothing on the body: anatomy plan D6).
 */
import type { CatalogRow, SystemId } from '../registry.ts'
import type { LayerComponent } from '../../registry/types.ts'
import type { SystemParts } from '../load.ts'

export const ROWS: readonly CatalogRow[] = []
export { default as UIS } from './ui.tsx'
export const DEFS: { readonly [S in SystemId]?: SystemParts } = {}
export { default as TEXT } from './text.ts'
export const DRAWINGS: { readonly [S in SystemId]?: LayerComponent } = {}
/** Its sources, for Science while the row is on (pages/Science.tsx imports this module for them). */
export { REPRO_SOURCES } from './data.ts'
