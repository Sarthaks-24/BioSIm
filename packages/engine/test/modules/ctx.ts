import {
  PARAMS,
  PROFILES,
  runModules,
  type ModelModule,
  type ModuleSignalId,
  type Params,
  type SignalStore,
  type Meal,
  type Written,
} from '../../src/index.ts'

/** The human run length (48 h at 1-min steps). */
export const N = Math.floor(PARAMS.horizonMin / PARAMS.stepMin) + 1

/**
 * Runs one module on a synthetic context: `upstream` stands in for what earlier modules wrote
 * (fixed arrays), so a module is tested alone (architecture §1.5 "Unit").
 */
export function runAlone(
  module: ModelModule,
  meal: Meal,
  upstream: Partial<Record<ModuleSignalId, Written>> = {},
  params: Params = PARAMS,
): SignalStore {
  const ids = Object.keys(upstream) as ModuleSignalId[]
  const source: ModelModule = {
    id: 'activity',
    needs: [],
    provides: ids.filter((id) => !id.startsWith('x.')) as ModelModule['provides'][number][],
    internal: ids.filter((id) => id.startsWith('x.')) as `x.${string}`[],
    run(ctx) {
      for (const id of ids) ctx.put(id, upstream[id]!.values, upstream[id]!.band)
    },
  }
  return runModules([source, module], { input: { meal }, params, profile: PROFILES['adult-ref'], n: N, stepMin: PARAMS.stepMin })
}

/** A deep copy of PARAMS with one number changed. */
export function paramsWith(path: string, value: number): Params {
  const copy = structuredClone(PARAMS) as unknown as Record<string, unknown>
  const keys = path.split('.')
  let o = copy
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>
  o[keys.at(-1)!] = value
  return copy as unknown as Params
}
