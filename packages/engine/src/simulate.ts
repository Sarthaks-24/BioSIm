import { buildMeal, type FoodLookup, type Meal } from './meal.ts'
import { MODEL_VERSION, ORGANISM_PARAMS, PARAMS, type Params } from './params.ts'
import { ABSORBED_ID, NUTRIENT_KINDS, type NutrientKind } from './nutrients.ts'
import { emptyingCurves } from './stomach.ts'
import { computeEvents } from './events.ts'
import { makeParticles } from './particles.ts'
import { buildMoments, buildSignalTable } from './core/table.ts'
import { runModules } from './core/module.ts'
import { DEFAULT_ORGANISM, DEFAULT_PROFILE, type OrganismId, type OrganismModel } from './core/organism.ts'
import { PROFILES, isProfileId, type ProfileDef } from './core/profile.ts'
import type { RunInput, RunResult } from './result.ts'
import { LEFTOVERS_IN_COLON, stomachArrivalMin } from './modules/gut.ts'
import { HUMAN_MODULES, PROVIDES } from './modules/index.ts'

/**
 * The human model: MODEL_VERSION, the 48 h clock and the PARAMS set. This is the one place the
 * engine hands PARAMS to the model; modules get it from the run's context (`ctx.params`).
 */
export const HUMAN_MODEL: OrganismModel<Params> = {
  id: 'human',
  modelVersion: MODEL_VERSION,
  horizonMin: PARAMS.horizonMin,
  stepMin: PARAMS.stepMin,
  params: ORGANISM_PARAMS.human,
  modules: HUMAN_MODULES,
  provides: PROVIDES.human,
}

/** Every organism the engine can run. Later organisms are loaded lazily (plan-organisms item 16). */
export const ORGANISM_MODELS: { readonly [O in OrganismId]: OrganismModel<Params> } = { human: HUMAN_MODEL }

export interface SimOptions {
  /** Dots for the picture (default 48). 0 = none (tests, summaries). */
  particles?: number
}

/**
 * Runs the whole model for one meal, minute by minute for 48 h: the organism's modules in their
 * frozen order (modules/: gut → energy → bloodSugar; core/module.ts), then the key moments
 * (events.ts) and the particles for the picture (particles.ts). The result (result.ts) is the
 * signal table plus the few things that are not signals; the view helpers (view.ts) read it.
 */
const isMeal = (input: RunInput | Meal): input is Meal => 'liquid' in input

/**
 * Two ways in, one model:
 *   - `simulate(input: RunInput, { lookup })`: what the app runs (useRun). The foods are looked up
 *     by id with `lookup`, exactly as `buildMeal` does;
 *   - `simulate(meal)`: a built Meal, for the default person (a wrapper the tests use).
 * An unknown organism or profile throws: the UI never passes one (a link's unknown `o` already
 * became human, and an unknown `who` was dropped, in share.ts).
 */
export function simulate(meal: Meal, opts?: SimOptions): RunResult
export function simulate(input: RunInput, opts: SimOptions & { lookup: FoodLookup }): RunResult
export function simulate(input: RunInput | Meal, opts: SimOptions & { lookup?: FoodLookup } = {}): RunResult {
  const organism: string = isMeal(input) ? DEFAULT_ORGANISM : (input.organism ?? DEFAULT_ORGANISM)
  if (!Object.hasOwn(ORGANISM_MODELS, organism)) throw new Error(`simulate: unknown organism "${organism}"`)
  const model = ORGANISM_MODELS[organism as OrganismId]
  let meal: Meal
  if (isMeal(input)) meal = input
  else if (opts.lookup) meal = buildMeal(input.items, opts.lookup)
  else throw new Error('simulate: a RunInput needs opts.lookup to find its foods')
  const profileId: string = isMeal(input) ? DEFAULT_PROFILE[model.id] : (input.profile ?? DEFAULT_PROFILE[model.id])
  if (!isProfileId(profileId) || PROFILES[profileId].organism !== model.id) throw new Error(`simulate: unknown profile "${profileId}"`)
  return simulateHuman(meal, model, PROFILES[profileId], opts.particles ?? 48)
}

function simulateHuman(meal: Meal, model: OrganismModel<Params>, profile: ProfileDef, particleCount: number): RunResult {
  const { params } = model
  const step = params.stepMin
  const n = Math.floor(params.horizonMin / step) + 1
  const out = runModules(model.modules, { input: { meal }, params, profile, n, stepMin: step })
  const get = (id: Parameters<typeof out.signals.get>[0]) => out.signals.get(id)!.values

  // The key moments, from what the gut and bloodSugar modules wrote (E-3b-eng moves them into the
  // modules, through ctx.putMoment).
  const curves = emptyingCurves(meal, params)
  const arrival = stomachArrivalMin(meal, params)
  const events = computeEvents(
    meal,
    {
      arrival,
      stomachLiquidG: get('gut.stomach.liquidG'),
      stomachSolidG: get('gut.stomach.solidG'),
      absorbedG: Object.fromEntries(NUTRIENT_KINDS.map((k) => [k, get(ABSORBED_ID[k])])) as Record<NutrientKind, Float64Array>,
      leftoversInColonCum: get(LEFTOVERS_IN_COLON),
      glucoseTypical: get('blood.glucose'),
      step,
      n,
    },
    params,
  )

  return {
    modelVersion: model.modelVersion,
    meal,
    profile: profile.id,
    curves,
    stomachArrivalMin: arrival,
    stepMin: step,
    length: n,
    events,
    particles: makeParticles(meal, curves, arrival, particleCount, params),
    signals: buildSignalTable(meal, out.signals),
    moments: new Map([...buildMoments(events), ...out.moments]),
    rhythms: out.rhythms,
    horizonMin: params.horizonMin,
  }
}
