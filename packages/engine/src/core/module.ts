/**
 * The module contract (v3 architecture §1.1, model D4). The engine is a fixed, ordered list of
 * modules. Each one runs once over the whole 48 h array: it reads what earlier modules wrote
 * (`ctx.get`) and writes its own signals (`ctx.put`). There is no solver and no feedback between
 * modules; a loop inside one module stays inside it.
 *
 * A module says up front what it reads (`needs`) and writes (`provides`, `internal`, `moments`,
 * `rhythms`). The run holds it to that: `get` of an ID it did not declare, or that no earlier
 * module wrote, throws (in development and tests); `put` of an undeclared ID, or of one ID twice,
 * throws. So PROVIDES is derived from the modules (modules/index.ts), and the order test can check
 * the graph from the declarations alone.
 */
import type { Meal } from '../meal.ts'
import type { Params } from '../params.ts'
import { EVENTS, SIGNALS, type ActiveSignalId, type EventId, type ProducedSignalId, type SignalId, type SignalMeta } from './catalog.ts'
import { PRODUCED_SIGNALS } from './catalog/index.ts'
import type { ActivityBout } from './activity.ts'
import type { ProfileDef } from './profile.ts'
import type { EventPoint, Rhythm } from './signal.ts'

/** The frozen run order (architecture §0, model D4). Modules that do not exist yet keep their slot. */
export const MODULE_ORDER = ['activity', 'gut', 'energy', 'bloodSugar', 'gas', 'effort', 'circulation', 'water', 'lymph'] as const
export type ModuleId = (typeof MODULE_ORDER)[number]

/**
 * The body systems, one per picker row and `layer` link value (architecture §0, frozen). A module
 * names the one that shows it: display only, the run never reads it.
 */
export const SYSTEM_IDS = [
  'digestion',
  'breathing',
  'circulation',
  'kidneys',
  'muscles',
  'skin',
  'bones',
  'lymph',
  'hormones',
  'nerves',
  'reproduction',
] as const
export type SystemId = (typeof SYSTEM_IDS)[number]

/** A module-to-module array that is never public: no link, golden, i18n or signal table row. */
export type InternalId = `x.${string}`
export type ModuleSignalId = ProducedSignalId | InternalId

/** Between-person band edges, for a signal whose catalog row has a `band`. */
export interface Band {
  low: Float64Array
  high: Float64Array
}

/** What a run is about: the meal and the activity bouts (empty = resting all the time; E-3b-eng). */
export interface ModuleInput {
  meal: Meal
  activity: readonly ActivityBout[]
}

/** What a module sees while it runs. */
export interface SimContext<P = Params> {
  readonly input: ModuleInput
  readonly params: Readonly<P>
  readonly profile: ProfileDef
  /** Array length: one value per step, 0 … horizonMin. */
  readonly n: number
  readonly stepMin: number
  /**
   * An array an earlier module wrote, read only: it is the very array that module put. Throws, in
   * development and tests (GUARDS), if `id` is not in this module's `needs` or not written yet.
   */
  get(id: ModuleSignalId): ArrayLike<number>
  /** Writes one of this module's `provides` or `internal` IDs, once. `band` only where the catalog has one. */
  put(id: ModuleSignalId, values: Float64Array, band?: Band): void
  /** Writes one of this module's `moments`, once. atMin null = it does not happen within the run. */
  putMoment(id: EventId, atMin: number | null, range?: { low: number; high: number }): void
  /** Writes one of this module's `rhythms` (a real-clock rate, never an array), once. */
  putRhythm(id: ActiveSignalId, rhythm: Omit<Rhythm, 'meta'>): void
}

export interface ModelModule<P = Params> {
  readonly id: ModuleId
  /** The system whose row shows this module's signals (display only). */
  readonly system: SystemId
  readonly needs: readonly ModuleSignalId[]
  readonly provides: readonly ProducedSignalId[]
  readonly internal?: readonly InternalId[]
  /** Timeline markers it writes with `putMoment` (activity's two). The five meal moments still come from events.ts after the run. */
  readonly moments?: readonly EventId[]
  /** Real-clock rates it writes with `putRhythm` (heart, breathing: S-2, S-3). */
  readonly rhythms?: readonly ActiveSignalId[]
  run(ctx: SimContext<P>): void
}

/** One written array (and its band, if any). */
export interface Written {
  values: Float64Array
  band?: Band
}

/** Everything the modules of one run wrote, by ID. */
export type SignalStore = ReadonlyMap<ModuleSignalId, Written>

/** What runModules returns: the arrays, and the moments and rhythms the modules put. */
export interface ModuleOutput {
  signals: SignalStore
  moments: ReadonlyMap<EventId, EventPoint>
  rhythms: ReadonlyMap<SignalId, Rhythm>
}

/** What every module of one run shares (the module's own declarations are added per module). */
export interface RunSetup<P = Params> {
  input: ModuleInput
  params: Readonly<P>
  profile: ProfileDef
  n: number
  stepMin: number
}

/**
 * The checks on `ctx.get` run in development and tests only. A production build (the bundler sets
 * NODE_ENV to "production") drops them, so the app's run pays nothing for them. The checks on the
 * puts always run: they are cheap and stop a broken module before its numbers show.
 */
const GUARDS = process.env.NODE_ENV !== 'production'

/**
 * Problems with a module list, in words (empty = fine): an ID written by two modules or twice by
 * one, a need that no earlier module writes, or an order that breaks MODULE_ORDER.
 */
export function moduleGraphErrors<P>(modules: readonly ModelModule<P>[]): string[] {
  const errors: string[] = []
  const writer = new Map<string, ModuleId>()
  let slot = -1
  for (const m of modules) {
    const at = MODULE_ORDER.indexOf(m.id)
    if (at <= slot) errors.push(`${m.id}: out of order (frozen order: ${MODULE_ORDER.join(' → ')})`)
    slot = Math.max(slot, at)
    for (const id of m.needs) if (!writer.has(id)) errors.push(`${m.id}: needs ${id}, which no earlier module writes`)
    // A rhythm is keyed apart from the array of the same ID (heart.rate is both, S-3).
    for (const id of [...m.provides, ...(m.internal ?? []), ...(m.moments ?? []), ...(m.rhythms ?? []).map((r) => `rhythm:${r}`)]) {
      const other = writer.get(id)
      if (other) errors.push(`${id}: written by ${other} and ${m.id}`)
      else writer.set(id, m.id)
    }
  }
  return errors
}

/**
 * Runs the modules in list order and returns what they wrote. Throws on any contract breach: a
 * get outside the module's needs or before it was written (GUARDS), a put outside its declared
 * IDs, twice, of the wrong length or with a band the catalog row does not have (or without its
 * band), and a declared ID the module never put. (Messages are short: this code ships in the app.)
 */
export function runModules<P>(modules: readonly ModelModule<P>[], setup: RunSetup<P>): ModuleOutput {
  const store = new Map<ModuleSignalId, Written>()
  const moments = new Map<EventId, EventPoint>()
  const rhythms = new Map<SignalId, Rhythm>()
  const metas: Partial<Record<ModuleSignalId, SignalMeta>> = PRODUCED_SIGNALS
  for (const m of modules) {
    const writes: readonly ModuleSignalId[] = [...m.provides, ...(m.internal ?? [])]
    const fail = (why: string): never => {
      throw new Error(`${m.id}: ${why}`)
    }
    const once = (declared: readonly string[] | undefined, written: ReadonlyMap<string, unknown>, what: string, id: string) => {
      if (!declared?.includes(id)) fail(`${what} ${id}: not declared`)
      if (written.has(id)) fail(`${what} ${id}: twice`)
    }
    m.run({
      ...setup,
      get: GUARDS
        ? (id) => (m.needs.includes(id) ? (store.get(id) ?? fail(`get ${id}: not written yet`)) : fail(`get ${id}: not in needs`)).values
        : (id) => store.get(id)!.values,
      put(id, values, band) {
        if (!writes.includes(id)) fail(`put ${id}: not in provides or internal`)
        if (store.has(id)) fail(`put ${id}: twice`)
        if (values.length !== setup.n) fail(`put ${id}: ${values.length} values, not ${setup.n}`)
        if (!band !== !metas[id]?.band) fail(`put ${id}: band does not match the catalog`)
        store.set(id, band ? { values, band } : { values })
      },
      putMoment(id, atMin, range) {
        once(m.moments, moments, 'putMoment', id)
        moments.set(id, { meta: EVENTS[id], atMin, ...(range && atMin !== null ? { low: range.low, high: range.high } : {}) })
      },
      putRhythm(id, rhythm) {
        once(m.rhythms, rhythms, 'putRhythm', id)
        rhythms.set(id, { ...rhythm, meta: SIGNALS[id] })
      },
    })
    for (const id of writes) if (!store.has(id)) fail(`no put ${id}`)
    for (const id of m.moments ?? []) if (!moments.has(id)) fail(`no putMoment ${id}`)
    for (const id of m.rhythms ?? []) if (!rhythms.has(id)) fail(`no putRhythm ${id}`)
  }
  return { signals: store, moments, rhythms }
}
