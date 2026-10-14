import { registerSignals, type SystemId, type SystemUi, type CatalogRow, type PackId } from './registry.ts'
import type { Loader } from '../registry/types.ts'
import { loadSection } from '../i18n/text.ts'

/** What a pack brings when it loads (architecture §5.2): its catalog rows and its systems' `SystemUi`. */
export interface PackDef {
  /** Its catalog rows (`@lifepeek/engine/catalog/<packId>`), handed to `registerSignals`. */
  rows: Loader<readonly CatalogRow[]>
  /** Its systems' words and moments; none for `core`, whose digestion UI is static (systems/ui.ts). */
  ui?: Loader<{ readonly [S in SystemId]?: SystemUi }>
  /**
   * Its English text, `() => import('virtual:lifepeek-en/sys.<packId>')`: the keys under
   * `sys.<packId>` in en.json (I-1, scripts/i18n-sections.mjs). None for `core`: its text is the
   * core text, with today's unprefixed keys (R26).
   */
  text?: Loader<Record<string, unknown>>
}

/**
 * The packs built so far besides `core` (each U-n adds its own here): `loadPack` loads one when one
 * of its systems is first lit. systems/packs.ts lists them with `core` for the tests and scripts.
 * `core` is not here: the screen never loads its rows (they ride the run chunk), and an `import()`
 * of them in screen code would split the run chunk in two.
 */
export const LAZY_PACKS: { readonly [P in PackId]?: PackDef } = {}

const loading = new Map<PackId, Promise<void>>()
const ready = new Set<PackId>(['core'])
const UIS: { [S in SystemId]?: SystemUi } = {}

/**
 * Loads a pack the first time one of its systems is lit (state/run.ts `setLayer`, R71/R74): its
 * catalog rows, its systems' UI and its English text (`loadSection`), together. Null when the pack
 * is ready: `core` always is (first paint). A failed load is forgotten, so trying again loads it again.
 */
export function loadPack(pack: PackId): Promise<void> | null {
  if (ready.has(pack)) return null
  let p = loading.get(pack)
  if (!p) {
    const def = LAZY_PACKS[pack]
    p = def
      ? Promise.all([
          def.rows().then((m) => registerSignals(pack, m.default)),
          def.ui?.().then((m) => Object.assign(UIS, m.default)),
          def.text && loadSection(`sys.${pack}`, def.text),
        ]).then(() => void ready.add(pack))
      : Promise.reject(new Error(`The ${pack} pack is not built`))
    p.catch(() => loading.delete(pack))
    loading.set(pack, p)
  }
  return p
}

/** A system's UI once its pack has loaded. */
export const packUi = (id: SystemId): SystemUi | undefined => UIS[id]
