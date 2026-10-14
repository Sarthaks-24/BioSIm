import type { Meal } from './meal.ts'
import type { FoodPhase } from './schema.ts'
import { GRAMS_KEY, NUTRIENT_KINDS, type NutrientKind } from './nutrients.ts'
import type { CoreParams } from './params.ts'
import { emptiedAt, type EmptyingCurve } from './stomach.ts'

/**
 * Particles are only for the picture: a few dozen dots whose timings follow the same curves as
 * the numbers. Each particle leaves the stomach at its own quantile of the emptying curve and is
 * absorbed with the same first-order timing the engine uses.
 */
export interface Particle {
  kind: NutrientKind
  phase: FoodPhase
  /** Minute this particle reaches the stomach. */
  stomachIn: number
  stomachOut: number
  /** Minute it is absorbed into blood/lymph, or null if it ends up leaving the body. */
  absorbedAt: number | null
  colonIn: number
  colonOut: number
  /** Stable 0–1 values for visual jitter. */
  seed: [number, number, number]
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

/** Time to absorption inside a segment of length T, drawn from the truncated first-order curve. */
function absorptionDelay(u: number, tau: number, T: number): number {
  return -tau * Math.log(1 - u * (1 - Math.exp(-T / tau)))
}

/** Water is so heavy it would drown out everything else visually; count it at a quarter weight. */
const VISUAL_WEIGHT: Record<NutrientKind, number> = { carbs: 1, protein: 1, fat: 1, fiber: 1, water: 0.25 }

export function makeParticles(
  meal: Meal,
  curves: Record<FoodPhase, EmptyingCurve>,
  arrival: number,
  count: number,
  params: CoreParams,
): Particle[] {
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

  const si = params.smallIntestine.typicalMin
  const co = params.colon.typicalMin
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
      if (rand() < params.absorbedInSmallIntestine[b.kind]) {
        absorbedAt = stomachOut + absorptionDelay(rand(), params.absorptionTauMin[b.kind], si)
      } else if (b.kind === 'water' && rand() < params.colonWaterAbsorbed) {
        absorbedAt = colonIn + absorptionDelay(rand(), params.colonWaterTauMin, co)
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
