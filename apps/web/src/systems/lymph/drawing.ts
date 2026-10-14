import type { LayerComponent } from '../../registry/types.ts'
import type { SystemId } from '../registry.ts'
import LymphLayer from './LymphLayer.tsx'

/** The lymph pack's flat drawing (systems/load.ts `drawing`): the lymph map with its fat dots. */
const DRAWINGS: { readonly [S in SystemId]?: LayerComponent } = { lymph: LymphLayer }
export default DRAWINGS
