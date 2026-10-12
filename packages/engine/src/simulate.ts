import { buildMeal, type FoodLookup, type Meal } from './meal.ts'
import type { FoodPhase } from './schema.ts'
import { MODEL_VERSION, PARAMS, type Params } from './params.ts'
import { GRAMS_KEY, NUTRIENT_KINDS, type NutrientKind, type StageId } from './nutrients.ts'
import { emptyingCurves, retention, stomachShare, type EmptyingCurve } from './stomach.ts'
import { runSegment } from './transit.ts'
import { bluntingFactor, glucoseCurve, type GlucoseCurve } from './glucose.ts'
import { computeEvents, type SimEvents } from './events.ts'
import { makeParticles, type Particle } from './particles.ts'
import type { SignalTable } from './core/signal.ts'
import { buildMoments, buildSignalTable } from './core/table.ts'
import { PROVIDES } from './core/catalog.ts'
import { DEFAULT_ORGANISM, DEFAULT_PROFILE, type OrganismId, type OrganismModel, type ProfileId, type SimInput } from './core/organism.ts'
import { PROFILES, isProfileId, type ProfileDef } from './core/profile.ts'
import { energySignals } from './energy/energyBalance.ts'

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
  provides: PROVIDES.human,
}

/** Every organism the engine can run. Later organisms are loaded lazily (plan-organisms item 16). */
export const ORGANISM_MODELS: { readonly [O in OrganismId]: OrganismModel<Params> } = { human: HUMAN_MODEL }

/** What every module of one run reads: the organism's model, its parameters and the stated person. */
interface SimContext {
  model: OrganismModel<Params>
  params: Params
  profile: ProfileDef
}

export interface SimOptions {
  /** Dots for the picture (default 48). 0 = none (tests, summaries). */
  particles?: number
}

/**
 * Runs the whole model for one meal, minute by minute for 48 h:
 *   stomach (stomach.ts) → small intestine → large intestine (transit.ts) → blood glucose (glucose.ts)
 * then derives key moments (events.ts) and the particles for the picture (particles.ts).
 *
 * New code reads `signals` (catalog ID → Series) and `moments` (event ID → EventPoint), built by
 * core/table.ts. The raw arrays and `events` below stay for v1 and are removed in bundle B.
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

const zeros = (n: number) => new Float64Array(n)

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
  return simulateHuman(meal, { model, params: model.params, profile: PROFILES[profileId] }, opts.particles ?? 48)
}

function simulateHuman(meal: Meal, ctx: SimContext, particleCount: number): Simulation {
  const { params } = ctx
  const step = params.stepMin
  const n = Math.floor(params.horizonMin / step) + 1
  const curves = emptyingCurves(meal, params)
  const eatingMin = meal.eatingMin
  const arrival = eatingMin + params.esophagus.transitMin

  // --- Stomach: what's inside and what leaves each minute -------------------------------------
  const stomachLiquidG = zeros(n)
  const stomachSolidG = zeros(n)
  const outflow = Object.fromEntries(NUTRIENT_KINDS.map((k) => [k, zeros(n)])) as Record<NutrientKind, Float64Array>
  const glycemicOutflow = zeros(n)
  const blunt = bluntingFactor(meal, params)

  for (const phase of ['liquid', 'solid'] as const) {
    const totals = meal[phase]
    if (totals.massG <= 0) continue
    const curve = curves[phase]
    const store = phase === 'liquid' ? stomachLiquidG : stomachSolidG
    // GI already includes a food's own emptying speed; see params.glucose.solidGlycemicCorrection.
    const glycemicWeight = (totals.gi / 100) * blunt * (phase === 'solid' ? params.glucose.solidGlycemicCorrection : 1)
    let prev = 1
    for (let i = 0; i < n; i++) {
      const t = i * step
      if (t < arrival) {
        store[i] = totals.massG * (eatingMin > 0 ? Math.min(1, t / eatingMin) : 1)
        continue
      }
      const frac = retention(curve, t - arrival)
      store[i] = totals.massG * frac
      const left = Math.max(0, prev - frac)
      prev = frac
      if (left <= 0) continue
      for (const k of NUTRIENT_KINDS) outflow[k][i]! += totals[GRAMS_KEY[k]] * left
      glycemicOutflow[i]! += totals.carbsG * left * glycemicWeight
    }
  }

  // --- Intestines -----------------------------------------------------------------------------
  const siT = params.smallIntestine.typicalMin / step
  const coT = params.colon.typicalMin / step
  const smallIntestineG = zeros(n)
  const colonG = zeros(n)
  const excretedG = zeros(n)
  const leftoversInColonCum = zeros(n)
  const absorbedG = {} as Record<NutrientKind, Float64Array>
  for (const k of NUTRIENT_KINDS) {
    const small = runSegment(outflow[k], siT, params.absorbedInSmallIntestine[k], params.absorptionTauMin[k])
    const large =
      k === 'water'
        ? runSegment(small.outflow, coT, params.colonWaterAbsorbed, params.colonWaterTauMin)
        : runSegment(small.outflow, coT, 0, 1)
    const abs = zeros(n)
    let inColon = 0
    let out = 0
    for (let i = 0; i < n; i++) {
      smallIntestineG[i]! += small.content[i]!
      colonG[i]! += large.content[i]!
      abs[i] = small.absorbedCum[i]! + large.absorbedCum[i]!
      out += large.outflow[i]!
      excretedG[i]! += out
      // Leftovers = fibre, the part the body cannot digest. Small unabsorbed amounts of sugar,
      // protein or fat are fermented by gut bacteria and don't count as "left over".
      if (k === 'fiber') {
        inColon += small.outflow[i]!
        leftoversInColonCum[i]! += inColon
      }
    }
    absorbedG[k] = abs
  }

  // --- Blood glucose: driven by the same carb absorption, weighted by GI ------------------------
  const glycemic = runSegment(glycemicOutflow, siT, params.absorbedInSmallIntestine.carbs, params.absorptionTauMin.carbs)
  const glycemicRate = zeros(n)
  for (let i = 0; i < n; i++) glycemicRate[i] = glycemic.absorbedCum[i]! - (i > 0 ? glycemic.absorbedCum[i - 1]! : 0)
  const glucose = glucoseCurve(glycemicRate, step, params)

  const events = computeEvents(
    meal,
    {
      arrival,
      stomachLiquidG,
      stomachSolidG,
      absorbedG,
      leftoversInColonCum,
      glucoseTypical: glucose.typical,
      step,
      n,
    },
    params,
  )
  const particles = makeParticles(meal, curves, arrival, particleCount, params)

  // --- Energy in vs used: Atwater kcal of the absorbed grams, and the person's resting use -------
  const energy = energySignals(absorbedG, ctx.profile, step, params)

  const run = {
    modelVersion: ctx.model.modelVersion,
    meal,
    profile: ctx.profile.id,
    curves,
    stomachArrivalMin: arrival,
    stepMin: step,
    length: n,
    stomachLiquidG,
    stomachSolidG,
    smallIntestineG,
    colonG,
    absorbedG,
    excretedG,
    glucose,
    events,
    particles,
  }
  return {
    ...run,
    signals: buildSignalTable(run, energy),
    moments: buildMoments(run),
    rhythms: new Map(),
    horizonMin: params.horizonMin,
  }
}

/** Index into the per-minute arrays for a time in minutes (clamped). */
export function indexAt(sim: Simulation, tMin: number): number {
  return Math.min(sim.length - 1, Math.max(0, Math.round(tMin / sim.stepMin)))
}

/**
 * Share (0–1) of the meal still in the stomach at minute index i (by food energy; by weight for water). Every chart and the verdict use this.
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

/** Where most of the meal is at time t — drives the "what's happening now" panel. */
export function activeStage(sim: Simulation, tMin: number): StageId {
  if (sim.meal.items.length === 0) return 'mouth'
  if (tMin < sim.meal.eatingMin) return 'mouth'
  if (tMin < sim.stomachArrivalMin) return 'esophagus'
  const loc = mealLocation(sim, indexAt(sim, tMin))
  if (loc.stomach >= loc.smallIntestine && loc.stomach >= loc.largeIntestine) return 'stomach'
  if (loc.smallIntestine >= loc.largeIntestine) return 'smallIntestine'
  return 'largeIntestine'
}

/** When each stage is busy with this meal (minutes), for the step-by-step text. Null = not reached. */
export function stageWindow(sim: Simulation, stage: StageId): { start: number; end: number } | null {
  const e = sim.events
  const siTypicalMin = HUMAN_MODEL.params.smallIntestine.typicalMin
  if (sim.meal.items.length === 0) return null
  switch (stage) {
    case 'mouth':
      return { start: 0, end: e.eatingEndMin }
    case 'esophagus':
      return { start: e.eatingEndMin, end: sim.stomachArrivalMin }
    case 'stomach':
      return { start: sim.stomachArrivalMin, end: e.stomach90EmptyMin ?? sim.horizonMin }
    case 'smallIntestine':
      return {
        start: sim.stomachArrivalMin,
        end: Math.max(e.absorptionMostlyDoneMin ?? 0, (e.stomach90EmptyMin ?? 0) + siTypicalMin),
      }
    case 'largeIntestine':
      return e.halfLeftoversInColon ? { start: e.halfLeftoversInColon.typical, end: e.firstExit?.typical ?? sim.horizonMin } : null
  }
}
