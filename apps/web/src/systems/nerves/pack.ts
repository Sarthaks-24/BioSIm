/**
 * The `control` pack as one lazy module (systems/load.ts `onePack`): Brain & nerves' words, demo,
 * English and flat brain (U-7), and Hormones' words and graphs, English and flat pancreas (U-6),
 * fetched together the first time either row is lit (R71, R74: runtime cache "lp-lazy", never the
 * first download). Each row's code stays in its own folder; this file only gathers them, one entry
 * per row in each export. The demo's numbers (@lifepeek/engine/demo) ride in it too: no other chunk
 * has them, and none of them is in /sim (check-budget's `nmjDelayMs` guard). Its catalog rows
 * (insulin, the brain's sugar and the most-insulin moment) come from the engine's chunk, which has
 * them already.
 */
import type { CatalogRow, SystemId, SystemUi } from '../registry.ts'
import type { LayerComponent } from '../../registry/types.ts'
import type { SystemParts } from '../load.ts'
import { NERVES_UI } from './ui.tsx'
import NERVES_TEXT from './text.ts'
import NERVES_DRAWINGS from './drawing.tsx'
import HORMONES_UIS, { DEFS as HORMONES_DEFS } from '../hormones/ui.tsx'
import HORMONES_TEXT from '../hormones/text.ts'
import HORMONES_DRAWINGS from '../hormones/drawing.tsx'

/** Its rows and its moment, from the engine's chunk (systems/load.ts PackModule.ROWS). */
export const ROWS = (): Promise<readonly CatalogRow[]> =>
  import('@lifepeek/engine/run').then((m) => [...Object.values(m.CONTROL_SIGNALS), ...Object.values(m.CONTROL_EVENTS)])
export const UIS: { readonly [S in SystemId]?: SystemUi } = { nerves: NERVES_UI, ...HORMONES_UIS }
/** Hormones' graphs and limits; Brain & nerves' row has no graphs, rhythms or limits of its own (row.ts). */
export const DEFS: { readonly [S in SystemId]?: SystemParts } = { ...HORMONES_DEFS }
/** Both rows' English: `sys.control` (nerves.* and Hormones' keys), with the signal and unit texts Hormones' graphs name. */
export const TEXT: Record<string, unknown> = { ...NERVES_TEXT, ...HORMONES_TEXT }
export const DRAWINGS: { readonly [S in SystemId]?: LayerComponent } = { ...NERVES_DRAWINGS, ...HORMONES_DRAWINGS }
