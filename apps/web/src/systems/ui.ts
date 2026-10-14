import { useRunStore } from '../state/run.ts'
import { DIGESTION_UI } from './digestion/ui.ts'
import type { SystemId, SystemUi } from './registry.ts'
import { packUi } from './load.ts'

/**
 * Each system's `SystemUi` (architecture §5.2). Digestion's is static: it is the first paint.
 * Another system's comes with its pack (systems/load.ts `loadPack`) when it is lit; until then the
 * stage keeps drawing with digestion's.
 */
export const uiOf = (id: SystemId): SystemUi => packUi(id) ?? DIGESTION_UI

/** The lit system's words and moments. */
export const useSystemUi = (): SystemUi => uiOf(useRunStore((s) => s.layer))
