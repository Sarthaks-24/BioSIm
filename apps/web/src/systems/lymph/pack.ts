import type { LayerComponent } from '../../registry/types.ts'
import type { SystemId, SystemUi } from '../registry.ts'
import LymphLayer from './LymphLayer.tsx'
import { LYMPH_UI } from './ui.tsx'

/**
 * The `lymph` pack's code (A-11a), one lazy chunk: its UI (the Now line and the germ-defence card)
 * and its flat drawing (the static lymph map). systems/load.ts takes `ui` and `drawing` from it.
 * One chunk, not two: each lazy file costs /sim its name in the loader's list (R71, R74).
 */
export const ui: { readonly [S in SystemId]?: SystemUi } = { lymph: LYMPH_UI }
export const drawing: { readonly [S in SystemId]?: LayerComponent } = { lymph: LymphLayer }
