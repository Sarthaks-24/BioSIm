import { useRunStore } from '../state/run.ts'
import { DIGESTION_UI } from './digestion/ui.ts'
import type { SystemId, SystemUi } from './registry.ts'

/**
 * Each system's `SystemUi` (architecture §5.2). Digestion's is static: it is the first paint.
 * Another system's comes with its pack (systems/packs.ts) when the picker lights it (U-2), which
 * adds it here; until then the stage keeps drawing with digestion's.
 */
const UI: { [S in SystemId]?: SystemUi } = { digestion: DIGESTION_UI }

export const uiOf = (id: SystemId): SystemUi => UI[id] ?? DIGESTION_UI

/** The lit system's words and moments. */
export const useSystemUi = (): SystemUi => uiOf(useRunStore((s) => s.layer))
