import { buildMeal, type FoodLookup, type Meal } from './meal.ts'
import type { FoodPhase } from './schema.ts'
import { MODEL_VERSION, PARAMS, type Params } from './params.ts'
import { NUTRIENT_KINDS, type NutrientKind, type StageId } from './nutrients.ts'
import { emptyingCurves, stomachShare, type EmptyingCurve } from './stomach.ts'
import type { GlucoseCurve } from './glucose.ts'
import { computeEvents, type SimEvents } from './events.ts'
import { makeParticles, type Particle } from './particles.ts'
import type { SignalTable } from './core/signal.ts'
import { buildMoments, buildSignalTable } from './core/table.ts'
import { runModules } from './core/module.ts'
import { DEFAULT_ORGANISM, DEFAULT_PROFILE, type OrganismId, type OrganismModel, type ProfileId, type SimInput } from './core/organism.ts'
import { PROFILES, isProfileId, type ProfileDef } from './core/profile.ts'
import { ABSORBED_ID, LEFTOVERS_IN_COLON, stomachArrivalMin } from './modules/gut.ts'
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
  params: PARAMS,
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
 * (events.ts) and the particles for the picture (particles.ts).
 *
 * New code reads `signals` (catalog ID → Series) and `moments` (event ID → EventPoint), built by
 * core/table.ts. The raw arrays and `events` below are still read by stomachFraction / mealLocation
 * (core/derive.ts, the Home race in data/hero.ts, the stage's now-line) and by the graph marks and
 * summaries (`events`, for a meal with no nutrients and the first exit); they stay until those move to
 * signals and moments.
 */
export interface Simulation extends SignalTable {
  modelVersion: number
  meal: Meal
  /** The stated person this run is about (energy.usedRate). Run metadata, not a signal. */
  profile: ProfileId
  curves: Record<FoodPhase, EmptyingCurve>
  /** Minute the meal starts arriving in the stomach (end of eating + swallow). */
  stomachArrivalMin: number
  stepMin: number
  length: number
  /**
   * Grams of food (whole servings) in the stomach, per minute.
   * @deprecated Use signals 'gut.stomach.liquidG' / 'gut.stomach.solidG'.
   */
  stomachLiquidG: Float64Array
  /** @deprecated Use signals.get('gut.stomach.solidG'). */
  stomachSolidG: Float64Array
  /**
   * Grams of tracked nutrients (carbs, protein, fat, fibre, water) in each intestine, per minute.
   * @deprecated Use signals 'gut.small.contentG'.
   */
  smallIntestineG: Float64Array
  /** @deprecated Use signals.get('gut.colon.contentG'). */
  colonG: Float64Array
  /**
   * Cumulative grams absorbed into the body, per nutrient.
   * @deprecated Use signals 'gut.absorbed.*G'.
   */
  absorbedG: Record<NutrientKind, Float64Array>
  /**
   * Cumulative grams that have left the body.
   * @deprecated Use signals.get('gut.leftBodyG').
   */
  excretedG: Float64Array
  /**
   * Plasma glucose (mg/dL) — typical and the low/high edges of the between-person band.
   * @deprecated Use signals.get('blood.glucose').
   */
  glucose: GlucoseCurve
  /** @deprecated Use moments (event IDs). eatingEndMin and noNutrients become run metadata. */
  events: SimEvents
  particles: Particle[]
}

const isMeal = (input: SimInput | Meal): input is Meal => 'liquid' in input

/**
 * Two ways in, one model:
 *   - `simulate(meal)`: a built Meal (every v1 caller and test), for the default person;
 *   - `simulate({ organism?, items, profile? }, { lookup })`: the organism-ready input. The foods
 *     are looked up by id with `lookup`, exactly as `buildMeal` does.
 * An unknown organism or profile throws: the UI never passes one (a link's unknown `o` already
 * became human, and an unknown `who` was dropped, in share.ts).
 */
export function simulate(meal: Meal, opts?: SimOptions): Simulation
export function simulate(input: SimInput, opts: SimOptions & { lookup: FoodLookup }): Simulation
export function simulate(input: SimInput | Meal, opts: SimOptions & { lookup?: FoodLookup } = {}): Simulation {
  const organism: string = isMeal(input) ? DEFAULT_ORGANISM : (input.organism ?? DEFAULT_ORGANISM)
  if (!Object.hasOwn(ORGANISM_MODELS, organism)) throw new Error(`simulate: unknown organism "${organism}"`)
  const model = ORGANISM_MODELS[organism as OrganismId]
  let meal: Meal
  if (isMeal(input)) meal = input
  else if (opts.lookup) meal = buildMeal(input.items, opts.lookup)
  else throw new Error('simulate: a SimInput needs opts.lookup to find its foods')
  const profileId: string = isMeal(input) ? DEFAULT_PROFILE[model.id] : (input.profile ?? DEFAULT_PROFILE[model.id])
  if (!isProfileId(profileId) || PROFILES[profileId].organism !== model.id) throw new Error(`simulate: unknown profile "${profileId}"`)
  return simulateHuman(meal, model, PROFILES[profileId], opts.particles ?? 48)
}

function simulateHuman(meal: Meal, model: OrganismModel<Params>, profile: ProfileDef, particleCount: number): Simulation {
  const { params } = model
  const step = params.stepMin
  const n = Math.floor(params.horizonMin / step) + 1
  const store = runModules(model.modules, { input: { meal }, params, profile, n, stepMin: step })
  const get = (id: Parameters<typeof store.get>[0]) => store.get(id)!.values

  // The raw arrays below are the @deprecated Simulation fields: the same arrays the gut and
  // bloodSugar modules wrote, under their old names.
  const curves = emptyingCurves(meal, params)
  const arrival = stomachArrivalMin(meal, params)
  const stomachLiquidG = get('gut.stomach.liquidG')
  const stomachSolidG = get('gut.stomach.solidG')
  const absorbedG = Object.fromEntries(NUTRIENT_KINDS.map((k) => [k, get(ABSORBED_ID[k])])) as Record<NutrientKind, Float64Array>
  const g = store.get('blood.glucose')!
  const glucose: GlucoseCurve = { low: g.band!.low, typical: g.values, high: g.band!.high }

  const events = computeEvents(
    meal,
    {
      arrival,
      stomachLiquidG,
      stomachSolidG,
      absorbedG,
      leftoversInColonCum: get(LEFTOVERS_IN_COLON),
      glucoseTypical: glucose.typical,
      step,
      n,
    },
    params,
  )
  const particles = makeParticles(meal, curves, arrival, particleCount, params)

  return {
    modelVersion: model.modelVersion,
    meal,
    profile: profile.id,
    curves,
    stomachArrivalMin: arrival,
    stepMin: step,
    length: n,
    stomachLiquidG,
    stomachSolidG,
    smallIntestineG: get('gut.small.contentG'),
    colonG: get('gut.colon.contentG'),
    absorbedG,
    excretedG: get('gut.leftBodyG'),
    glucose,
    events,
    particles,
    signals: buildSignalTable(meal, store),
    moments: buildMoments(events),
    rhythms: new Map(),
    horizonMin: params.horizonMin,
  }
}

/** Index into the per-minute arrays for a time in minutes (clamped). */
export function indexAt(sim: Simulation, tMin: number): number {
  return Math.min(sim.length - 1, Math.max(0, Math.round(tMin / sim.stepMin)))
}

/**
 * Share (0–1) of the meal still in the stomach at minute index i (by food energy; by weight for water). Home's race and core/derive.ts use this.
 * @deprecated New code uses `shareOfMealInStomach` (core/derive.ts), which takes minutes.
 */
export function stomachFraction(sim: Simulation, i: number): number {
  return stomachShare(sim.meal, sim.stomachLiquidG[i]!, sim.stomachSolidG[i]!)
}

export interface MealLocation {
  stomach: number
  smallIntestine: number
  largeIntestine: number
  absorbed: number
  leftBody: number
  /** Everything above adds up to this (grams of tracked nutrients). */
  total: number
}

/**
 * Where every gram of tracked nutrients is at minute index i. Sums to the meal's total.
 * @deprecated New code uses `mealLocationAt` (core/derive.ts), which takes minutes.
 */
export function mealLocation(sim: Simulation, i: number): MealLocation {
  const tracked = (p: Meal['total']) => p.carbsG + p.proteinG + p.fatG + p.fiberG + p.waterG
  const m = sim.meal
  const phaseShare = (stored: Float64Array, p: Meal['total']) => (p.massG > 0 ? (stored[i]! / p.massG) * tracked(p) : 0)
  return {
    stomach: phaseShare(sim.stomachLiquidG, m.liquid) + phaseShare(sim.stomachSolidG, m.solid),
    smallIntestine: sim.smallIntestineG[i]!,
    largeIntestine: sim.colonG[i]!,
    absorbed: NUTRIENT_KINDS.reduce((a, k) => a + sim.absorbedG[k][i]!, 0),
    leftBody: sim.excretedG[i]!,
    total: tracked(m.total),
  }
}

/**
 * Below this share of the meal still in the stomach and intestines, the gut has finished with it
 * (the rest is rounding dust or a last gram of leftovers): the UI's "done" state starts here.
 */
export const GUT_DONE_SHARE = 0.01

/** True once (nearly) all of the meal has been taken into the body or has left it. */
export function gutIsDone(loc: MealLocation): boolean {
  const inGut = loc.stomach + loc.smallIntestine + loc.largeIntestine
  return loc.total > 0 && inGut < GUT_DONE_SHARE * loc.total && loc.absorbed + loc.leftBody > inGut
}

/** Where most of the meal is at time t — drives the "what's happening now" panel. */
export function activeStage(sim: Simulation, tMin: number): StageId {
  if (sim.meal.items.length === 0) return 'mouth'
  if (tMin < sim.meal.eatingMin) return 'mouth'
  if (tMin < sim.stomachArrivalMin) return 'esophagus'
  const loc = mealLocation(sim, indexAt(sim, tMin))
  // Once the gut has (all but) finished with the meal, the three are zeros and rounding dust: keep
  // the last organ that held it (the large intestine if any leftovers left the body), never fall
  // back to the stomach (review 14-17, HIGH 1: a cheeseburger "in the stomach" from 30 h on).
  if (gutIsDone(loc)) {
    return sim.excretedG[sim.length - 1]! > 0 || loc.largeIntestine > 0 ? 'largeIntestine' : 'smallIntestine'
  }
  if (loc.stomach >= loc.smallIntestine && loc.stomach >= loc.largeIntestine) return 'stomach'
  if (loc.smallIntestine >= loc.largeIntestine) return 'smallIntestine'
  return 'largeIntestine'
}
