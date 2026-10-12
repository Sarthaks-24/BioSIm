import type { Meal } from './meal.ts'
import type { FoodPhase } from './schema.ts'
import { MODEL_VERSION, PARAMS } from './params.ts'
import { emptiedAt, emptyingCurves, retention, type EmptyingCurve } from './stomach.ts'
import { runSegment } from './transit.ts'

export type StageId = 'mouth' | 'esophagus' | 'stomach' | 'smallIntestine' | 'largeIntestine'
export const STAGES: StageId[] = ['mouth', 'esophagus', 'stomach', 'smallIntestine', 'largeIntestine']

export type NutrientKind = 'carbs' | 'protein' | 'fat' | 'fiber' | 'water'
export const NUTRIENT_KINDS: NutrientKind[] = ['carbs', 'protein', 'fat', 'fiber', 'water']

const GRAMS_KEY: Record<NutrientKind, 'carbsG' | 'proteinG' | 'fatG' | 'fiberG' | 'waterG'> = {
  carbs: 'carbsG',
  protein: 'proteinG',
  fat: 'fatG',
  fiber: 'fiberG',
  water: 'waterG',
}

/** A value with the spread we expect between healthy people. */
export interface Range {
  low: number
  typical: number
  high: number
}

export interface SimEvents {
  eatingEndMin: number
  /** Half of what was eaten/drunk (by mass) has left the stomach. */
  stomachHalfEmptyMin: number | null
  /** 90 % has left the stomach. */
  stomachMostlyEmptyMin: number | null
  /** First of the meal reaches the large intestine. */
  firstReachesColon: Range
  /** 90 % of the eventually-absorbed carbs, protein and fat are in the blood. */
  absorptionMostlyDoneMin: number | null
  /** First remains could leave the body. */
  firstExit: Range
  glucosePeak: { timeMin: number; riseMgDl: Range } | null
}

export interface Particle {
  kind: NutrientKind
  phase: FoodPhase
  /** Minute this particle reaches the stomach. */
  stomachIn: number
  stomachOut: number
  /** Minute it is absorbed into blood/lymph (in the small or large intestine), or null if it is excreted. */
  absorbedAt: number | null
  colonIn: number
  colonOut: number
  /** Stable 0–1 values for visual jitter. */
  seed: [number, number, number]
}

export interface Simulation {
  modelVersion: number
  meal: Meal
  curves: Record<FoodPhase, EmptyingCurve>
  /** Minute the meal starts arriving in the stomach (end of eating + swallow). */
  stomachArrivalMin: number
  stepMin: number
  length: number
  /** Grams in each place, per minute. */
  stomachLiquidG: Float64Array
  stomachSolidG: Float64Array
  smallIntestineG: Float64Array
  colonG: Float64Array
  /** Cumulative grams absorbed into the body, per nutrient. */
  absorbedG: Record<NutrientKind, Float64Array>
  /** Plasma glucose (mg/dL) — typical and the low/high edges of the between-person band. */
  glucose: { low: Float64Array; typical: Float64Array; high: Float64Array }
  events: SimEvents
  particles: Particle[]
}

export function simulate(meal: Meal, opts: { particles?: number } = {}): Simulation {
  const step = PARAMS.stepMin
  const n = Math.floor(PARAMS.horizonMin / step) + 1
  const curves = emptyingCurves(meal)
  const eatingMin = meal.eatingMin
  const arrival = eatingMin + PARAMS.esophagus.transitMin

  // --- Stomach -----------------------------------------------------------------------------
  const fractionIn = (curve: EmptyingCurve, t: number) => {
    if (t < arrival) return eatingMin > 0 ? Math.min(1, t / eatingMin) : 1
    return retention(curve, t - arrival)
  }
  const stomachLiquidG = new Float64Array(n)
  const stomachSolidG = new Float64Array(n)
  const outflow: Record<NutrientKind, Float64Array> = {
    carbs: new Float64Array(n),
    protein: new Float64Array(n),
    fat: new Float64Array(n),
    fiber: new Float64Array(n),
    water: new Float64Array(n),
  }
  const glycemicOutflow = new Float64Array(n)

  for (const phase of ['liquid', 'solid'] as const) {
    const totals = meal[phase]
    if (totals.massG <= 0) continue
    const curve = curves[phase]
    const store = phase === 'liquid' ? stomachLiquidG : stomachSolidG
    let prev = 1
    for (let i = 0; i < n; i++) {
      const t = i * step
      const frac = fractionIn(curve, t)
      store[i] = totals.massG * frac
      const left = t < arrival ? 0 : Math.max(0, prev - frac)
      if (t >= arrival) prev = frac
      if (left <= 0) continue
      for (const k of NUTRIENT_KINDS) outflow[k][i]! += totals[GRAMS_KEY[k]] * left
      const correction = phase === 'solid' ? PARAMS.glucose.solidGlycemicCorrection : 1
      glycemicOutflow[i]! += totals.carbsG * left * (totals.gi / 100) * correction
    }
  }

  // --- Intestines ------------------------------------------------------------------------
  const si = PARAMS.smallIntestine
  const co = PARAMS.colon
  const smallIntestineG = new Float64Array(n)
  const colonG = new Float64Array(n)
  const absorbedG = {} as Record<NutrientKind, Float64Array>
  for (const k of NUTRIENT_KINDS) {
    const small = runSegment(outflow[k], si.typicalMin / step, PARAMS.absorbedInSmallIntestine[k])
    const colonAbsorb = k === 'water' ? PARAMS.colonWaterAbsorbed : 0
    const large = runSegment(small.outflow, co.typicalMin / step, colonAbsorb)
    const abs = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      smallIntestineG[i]! += small.content[i]!
      colonG[i]! += large.content[i]!
      abs[i] = small.absorbedCum[i]! + large.absorbedCum[i]!
    }
    absorbedG[k] = abs
  }

  // --- Glucose -----------------------------------------------------------------------------
  const g = PARAMS.glucose
  const c = meal.total
  const blunt = c.carbsG > 0 ? Math.max(g.bluntingFloor, 1 / (1 + (g.bluntingK * (2 * c.proteinG + c.fatG)) / c.carbsG)) : 1
  const typical = new Float64Array(n)
  const low = new Float64Array(n)
  const high = new Float64Array(n)
  let gut = 0 // glycemic grams waiting to be absorbed
  let rise = 0 // mg/dL above fasting
  let insulin = 0 // remote insulin action (1/min)
  for (let i = 0; i < n; i++) {
    gut += glycemicOutflow[i]! * blunt
    const absorbed = (gut * step) / g.absorptionTauMin
    gut -= absorbed
    insulin += (g.insulinGain * Math.max(0, rise) - insulin / g.insulinTauMin) * step
    rise += g.gainMgDlPerG * absorbed - (rise / g.clearanceTauMin + insulin * rise) * step
    typical[i] = g.fastingMgDl + rise
    low[i] = g.fastingMgDl + rise * g.bandLow
    high[i] = g.fastingMgDl + rise * g.bandHigh
  }

  const events = computeEvents(meal, { arrival, stomachLiquidG, stomachSolidG, absorbedG, typical, step, n })
  const particles = makeParticles(meal, curves, arrival, opts.particles ?? 48)

  return {
    modelVersion: MODEL_VERSION,
    meal,
    curves,
    stomachArrivalMin: arrival,
    stepMin: step,
    length: n,
    stomachLiquidG,
    stomachSolidG,
    smallIntestineG,
    colonG,
    absorbedG,
    glucose: { low, typical, high },
    events,
    particles,
  }
}

function computeEvents(
  meal: Meal,
  s: {
    arrival: number
    stomachLiquidG: Float64Array
    stomachSolidG: Float64Array
    absorbedG: Record<NutrientKind, Float64Array>
    typical: Float64Array
    step: number
    n: number
  },
): SimEvents {
  const total = meal.total.massG
  const firstBelow = (frac: number): number | null => {
    if (total <= 0) return null
    for (let i = 0; i < s.n; i++) {
      const t = i * s.step
      if (t >= s.arrival && s.stomachLiquidG[i]! + s.stomachSolidG[i]! <= total * frac) return t
    }
    return null
  }

  const energyKinds: NutrientKind[] = ['carbs', 'protein', 'fat']
  const finalAbsorbed = energyKinds.reduce((sum, k) => sum + s.absorbedG[k][s.n - 1]!, 0)
  let absorptionMostlyDoneMin: number | null = null
  if (finalAbsorbed > 0.5) {
    for (let i = 0; i < s.n; i++) {
      const sum = energyKinds.reduce((acc, k) => acc + s.absorbedG[k][i]!, 0)
      if (sum >= finalAbsorbed * 0.9) {
        absorptionMostlyDoneMin = i * s.step
        break
      }
    }
  }

  let peakIdx = 0
  for (let i = 1; i < s.n; i++) if (s.typical[i]! > s.typical[peakIdx]!) peakIdx = i
  const fasting = PARAMS.glucose.fastingMgDl
  const peakRise = s.typical[peakIdx]! - fasting
  const g = PARAMS.glucose

  const si = PARAMS.smallIntestine
  const co = PARAMS.colon
  const hasFood = meal.items.length > 0
  const range = (base: number, add: (k: 'lowMin' | 'typicalMin' | 'highMin') => number): Range => ({
    low: base + add('lowMin'),
    typical: base + add('typicalMin'),
    high: base + add('highMin'),
  })

  return {
    eatingEndMin: meal.eatingMin,
    stomachHalfEmptyMin: firstBelow(0.5),
    stomachMostlyEmptyMin: firstBelow(0.1),
    firstReachesColon: hasFood ? range(s.arrival, (k) => si[k]) : { low: 0, typical: 0, high: 0 },
    absorptionMostlyDoneMin,
    firstExit: hasFood ? range(s.arrival, (k) => si[k] + co[k]) : { low: 0, typical: 0, high: 0 },
    glucosePeak:
      peakRise >= 1
        ? {
            timeMin: peakIdx * s.step,
            riseMgDl: { low: peakRise * g.bandLow, typical: peakRise, high: peakRise * g.bandHigh },
          }
        : null,
  }
}

/** Small deterministic PRNG so the same meal always animates the same way. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Water is so heavy it would drown out everything else visually; count it at a quarter weight. */
const VISUAL_WEIGHT: Record<NutrientKind, number> = { carbs: 1, protein: 1, fat: 1, fiber: 1, water: 0.25 }

function makeParticles(meal: Meal, curves: Record<FoodPhase, EmptyingCurve>, arrival: number, count: number): Particle[] {
  if (meal.items.length === 0 || count <= 0) return []
  const rand = mulberry32(hashString(meal.items.map((i) => `${i.food.id}:${i.servings}`).join(',')))

  // Split the particle budget across (phase, nutrient) buckets by visual weight.
  const buckets: { phase: FoodPhase; kind: NutrientKind; weight: number }[] = []
  for (const phase of ['liquid', 'solid'] as const) {
    for (const kind of NUTRIENT_KINDS) {
      const grams = meal[phase][GRAMS_KEY[kind]]
      if (grams > 0.5) buckets.push({ phase, kind, weight: grams * VISUAL_WEIGHT[kind] })
    }
  }
  const totalWeight = buckets.reduce((a, b) => a + b.weight, 0)
  if (totalWeight <= 0) return []

  const si = PARAMS.smallIntestine.typicalMin
  const co = PARAMS.colon.typicalMin
  const particles: Particle[] = []
  for (const b of buckets) {
    const k = Math.max(1, Math.round((b.weight / totalWeight) * count))
    for (let j = 0; j < k; j++) {
      // Stratified quantiles so particles leave the stomach exactly as the emptying curve says.
      const q = (j + rand()) / k
      const stomachOut = arrival + emptiedAt(curves[b.phase], q)
      const colonIn = stomachOut + si
      const colonOut = colonIn + co
      let absorbedAt: number | null = null
      if (rand() < PARAMS.absorbedInSmallIntestine[b.kind]) {
        absorbedAt = stomachOut + si * (0.15 + 0.85 * rand())
      } else if (b.kind === 'water' && rand() < PARAMS.colonWaterAbsorbed) {
        absorbedAt = colonIn + co * rand()
      }
      particles.push({
        kind: b.kind,
        phase: b.phase,
        stomachIn: rand() * arrival,
        stomachOut,
        absorbedAt,
        colonIn,
        colonOut,
        seed: [rand(), rand(), rand()],
      })
    }
  }
  return particles
}

/** Index into the per-minute arrays for a time in minutes (clamped). */
export function indexAt(sim: Simulation, tMin: number): number {
  return Math.min(sim.length - 1, Math.max(0, Math.round(tMin / sim.stepMin)))
}

/** Where most of the meal is at time t — drives the "what's happening now" panel. */
export function activeStage(sim: Simulation, tMin: number): StageId {
  if (sim.meal.items.length === 0) return 'mouth'
  if (tMin < sim.meal.eatingMin) return 'mouth'
  if (tMin < sim.stomachArrivalMin) return 'esophagus'
  const i = indexAt(sim, tMin)
  const stomach = sim.stomachLiquidG[i]! + sim.stomachSolidG[i]!
  const small = sim.smallIntestineG[i]!
  const large = sim.colonG[i]!
  if (stomach >= small && stomach >= large) return 'stomach'
  if (small >= large) return 'smallIntestine'
  return 'largeIntestine'
}
