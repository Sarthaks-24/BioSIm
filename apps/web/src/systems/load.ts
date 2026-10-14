import { registerSignals, systemOf, type SystemDef, type SystemId, type SystemUi, type CatalogRow, type PackId } from './registry.ts'
import type { LayerComponent, Loader } from '../registry/types.ts'
import { loadSection } from '../i18n/text.ts'

/** What a pack brings when it loads (architecture §5.2): its catalog rows and its systems' `SystemUi`. */
export interface PackDef {
  /** Its catalog rows (`@lifepeek/engine/catalog/<packId>`), handed to `registerSignals`. */
  rows: Loader<readonly CatalogRow[]>
  /**
   * Its systems' words and moments; none for `core`, whose digestion UI is static (systems/ui.ts).
   * The same module's `DEFS` are the rest of each system's row (its graphs, rhythms and limits),
   * which name the pack's signal IDs and so stay out of the first download (systems/registry.ts SYSTEMS).
   */
  ui?: () => Promise<{ default: { readonly [S in SystemId]?: SystemUi }; DEFS?: { readonly [S in SystemId]?: SystemParts } }>
  /**
   * Its English text, `() => import('virtual:lifepeek-en/sys.<packId>')`: the keys under
   * `sys.<packId>` in en.json (I-1, scripts/i18n-sections.mjs). None for `core`: its text is the
   * core text, with today's unprefixed keys (R26).
   */
  text?: Loader<Record<string, unknown>>
  /**
   * Its systems' flat drawings (A-0 flat registry): one module per pack, its default export each
   * system's flat layer (`draw: 'layer'`). It loads with the rest of the pack, never before the system
   * is lit (R71, R74), so no system's drawing code is in the first download.
   */
  drawing?: Loader<{ readonly [S in SystemId]?: LayerComponent }>
}

/** A pack's parts as one lazy module (systems/<packId>/pack.ts): one file to fetch, one entry in the first download. */
interface PackModule {
  ROWS: readonly CatalogRow[]
  UIS: { readonly [S in SystemId]?: SystemUi }
  DEFS: { readonly [S in SystemId]?: SystemParts }
  TEXT: Record<string, unknown>
  DRAWINGS: { readonly [S in SystemId]?: LayerComponent }
}

/** A PackDef whose loaders each take their part of one module. */
function onePack(load: () => Promise<PackModule>): PackDef {
  return {
    rows: () => load().then((m) => ({ default: m.ROWS })),
    ui: () => load().then((m) => ({ default: m.UIS, DEFS: m.DEFS })),
    text: () => load().then((m) => ({ default: m.TEXT })),
    drawing: () => load().then((m) => ({ default: m.DRAWINGS })),
  }
}

/** The part of a system's row that comes with its pack. */
export type SystemParts = Partial<Pick<SystemDef, 'slots' | 'rhythms' | 'knownLimits' | 'organs'>>
const lymph = () => import('./lymph/pack.ts')
const effort = () => import('./muscles/pack.ts')

/**
 * The packs built so far besides `core` (each U-n adds its own here): `loadPack` loads one when one
 * of its systems is first lit. systems/packs.ts lists them with `core` for the tests and scripts.
 * `core` is not here: the screen never loads its rows (they ride the run chunk), and an `import()`
 * of them in screen code would split the run chunk in two.
 */
export const LAZY_PACKS: { readonly [P in PackId]?: PackDef } = {
  // U-2: its rows, words and moments, its English (with the signal and unit texts its graphs name)
  // and its flat lungs, one lazy module under systems/breathing/ (cache-tiers.mjs: lazy tier).
  breathing: onePack(() => import('./breathing/pack.ts')),
  // U-1: muscles, skin and the bones card: their words, English and flat drawings, one lazy module
  // under systems/muscles/ (cache-tiers.mjs: lazy tier). Their rows come from the run chunk, which
  // the stage has loaded already and which has them (a copy in the pack would split them out of it).
  effort: {
    rows: () => import('@lifepeek/engine/run').then((m) => ({ default: Object.values(m.EFFORT_SIGNALS) })),
    ui: () => effort().then((m) => ({ default: m.UIS, DEFS: m.DEFS })),
    text: () => effort().then((m) => ({ default: m.TEXT })),
    drawing: () => effort().then((m) => ({ default: m.DRAWINGS })),
  },
  // A-11a: Drawing only, no engine half (no rows) until S-5 (v3.1); its UI and map are one chunk.
  lymph: {
    rows: async () => ({ default: [] }),
    ui: () => lymph().then((m) => ({ default: m.ui })),
    text: () => import('virtual:lifepeek-en/sys.lymph'),
    drawing: () => lymph().then((m) => ({ default: m.drawing })),
  },
}

const loading = new Map<PackId, Promise<void>>()
const ready = new Set<PackId>(['core'])
const UIS: { [S in SystemId]?: SystemUi } = {}
const DRAWINGS: { [S in SystemId]?: LayerComponent } = {}

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
    // All or nothing: the rows, UI and drawing are kept only once every part has arrived, so a
    // half-loaded pack never shows its UI without its words (a failed part means Try again).
    p = def
      ? Promise.all([def.rows(), def.ui?.(), def.text && loadSection(`sys.${pack}`, def.text), def.drawing?.()]).then(
          ([rows, ui, , drawing]) => {
            registerSignals(pack, rows.default)
            if (ui) {
              Object.assign(UIS, ui.default)
              for (const [id, parts] of Object.entries(ui.DEFS ?? {})) Object.assign(systemOf(id)!, parts)
            }
            if (drawing) Object.assign(DRAWINGS, drawing.default)
            ready.add(pack)
          },
        )
      : Promise.reject(new Error(`The ${pack} pack is not built`))
    p.catch(() => loading.delete(pack))
    loading.set(pack, p)
  }
  return p
}

/** A system's UI once its pack has loaded. */
export const packUi = (id: SystemId): SystemUi | undefined => UIS[id]

/** A system's flat drawing once its pack has loaded (the flat body draws it over the base). */
export const packDrawing = (id: SystemId): LayerComponent | undefined => DRAWINGS[id]
