/**
 * The module contract (v3 architecture §1.1, model D4). The engine is a fixed, ordered list of
 * modules. Each one runs once over the whole 48 h array: it reads what earlier modules wrote
 * (`ctx.get`) and writes its own signals (`ctx.put`). There is no solver and no feedback between
 * modules; a loop inside one module stays inside it.
 *
 * A module says up front what it reads (`needs`) and writes (`provides`, `internal`). The run
 * holds it to that: `get` of an ID it did not declare, or that no earlier module wrote, throws;
 * `put` of an undeclared ID, or of one ID twice, throws. So PROVIDES is derived from the modules
 * (modules/index.ts), and the order test can check the graph from the declarations alone.
 */
import type { Meal } from '../meal.ts'
import type { Params } from '../params.ts'
import { SIGNALS, type ActiveSignalId } from './catalog.ts'
import type { ProfileDef } from './profile.ts'

/** The frozen run order (architecture §0, model D4). Modules that do not exist yet keep their slot. */
export const MODULE_ORDER = ['activity', 'gut', 'energy', 'bloodSugar', 'gas', 'effort', 'circulation', 'water', 'lymph'] as const
export type ModuleId = (typeof MODULE_ORDER)[number]

/** A module-to-module array that is never public: no link, golden, i18n or signal table row. */
export type InternalId = `x.${string}`
export type ModuleSignalId = ActiveSignalId | InternalId

/** Between-person band edges, for a signal whose catalog row has a `band`. */
export interface Band {
  low: Float64Array
  high: Float64Array
}

/** What a run is about. Later: the activity bouts (E-3b). */
export interface ModuleInput {
  meal: Meal
}

/** What a module sees while it runs. */
export interface SimContext<P = Params> {
  readonly input: ModuleInput
  readonly params: Readonly<P>
  readonly profile: ProfileDef
  /** Array length: one value per step, 0 … horizonMin. */
  readonly n: number
  readonly stepMin: number
  /** An array an earlier module wrote. Throws if `id` is not in this module's `needs`. Read only. */
  get(id: ModuleSignalId): Float64Array
  /** Writes one of this module's `provides` or `internal` IDs, once. `band` only where the catalog has one. */
  put(id: ModuleSignalId, values: Float64Array, band?: Band): void
}

export interface ModelModule<P = Params> {
  readonly id: ModuleId
  readonly needs: readonly ModuleSignalId[]
  readonly provides: readonly ActiveSignalId[]
  readonly internal?: readonly InternalId[]
  run(ctx: SimContext<P>): void
}

/** One written array (and its band, if any). */
export interface Written {
  values: Float64Array
  band?: Band
}

/** Everything the modules of one run wrote, by ID. */
export type SignalStore = ReadonlyMap<ModuleSignalId, Written>

/** What every module of one run shares (the module's own declarations are added per module). */
export interface RunSetup<P = Params> {
  input: ModuleInput
  params: Readonly<P>
  profile: ProfileDef
  n: number
  stepMin: number
}

/**
 * Problems with a module list, in words (empty = fine): an ID written by two modules or twice by
 * one, a need that no earlier module writes, or an order that breaks MODULE_ORDER.
 */
export function moduleGraphErrors<P>(modules: readonly ModelModule<P>[]): string[] {
  const errors: string[] = []
  const writer = new Map<ModuleSignalId, ModuleId>()
  let slot = -1
  for (const m of modules) {
    const at = MODULE_ORDER.indexOf(m.id)
    if (at <= slot) errors.push(`${m.id}: out of order (frozen order: ${MODULE_ORDER.join(' → ')})`)
    slot = Math.max(slot, at)
    for (const id of m.needs) if (!writer.has(id)) errors.push(`${m.id}: needs ${id}, which no earlier module writes`)
    for (const id of [...m.provides, ...(m.internal ?? [])]) {
      const other = writer.get(id)
      if (other) errors.push(`${id}: written by ${other} and ${m.id}`)
      else writer.set(id, m.id)
    }
  }
  return errors
}

/** Runs the modules in list order and returns what they wrote. Throws on any contract breach. */
export function runModules<P>(modules: readonly ModelModule<P>[], setup: RunSetup<P>): SignalStore {
  const store = new Map<ModuleSignalId, Written>()
  for (const m of modules) {
    const needs = new Set<ModuleSignalId>(m.needs)
    const writes = new Set<ModuleSignalId>([...m.provides, ...(m.internal ?? [])])
    const ctx: SimContext<P> = {
      ...setup,
      get(id) {
        if (!needs.has(id)) throw new Error(`${m.id}: get("${id}") is not in its needs`)
        const w = store.get(id)
        if (!w) throw new Error(`${m.id}: get("${id}") before any module wrote it`)
        return w.values
      },
      put(id, values, band) {
        if (!writes.has(id)) throw new Error(`${m.id}: put("${id}") is not in its provides or internal`)
        if (store.has(id)) throw new Error(`${m.id}: put("${id}") twice`)
        if (values.length !== setup.n) throw new Error(`${m.id}: put("${id}") has ${values.length} values, not ${setup.n}`)
        const meta = id.startsWith('x.') ? undefined : SIGNALS[id as ActiveSignalId]
        if (!band !== !meta?.band) throw new Error(`${m.id}: put("${id}") ${band ? 'has a band the catalog does not' : 'needs its band'}`)
        store.set(id, band ? { values, band } : { values })
      },
    }
    m.run(ctx)
    for (const id of writes) if (!store.has(id)) throw new Error(`${m.id}: did not put "${id}"`)
  }
  return store
}
