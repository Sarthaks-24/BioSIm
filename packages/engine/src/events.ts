import type { Meal } from './meal.ts'
import type { NutrientKind, Range } from './nutrients.ts'
import { PARAMS } from './params.ts'

export interface SimEvents {
  eatingEndMin: number
  /** Half of what was eaten/drunk (by mass) has left the stomach. */
  stomachHalfEmptyMin: number | null
  /** 90 % has left the stomach. */
  stomach90EmptyMin: number | null
  /** 90 % of the eventually-absorbed carbs, protein and fat are in the blood. Null if the meal has none. */
  absorptionMostlyDoneMin: number | null
  /** Half of the leftovers (fibre and anything not absorbed, excluding water) have reached the large intestine. Null if there are almost none. */
  halfLeftoversInColon: Range | null
  /** Leftovers start leaving the body. Depends mostly on the person. Null if there is almost nothing left over. */
  firstExit: Range | null
  glucosePeak: { timeMin: number; riseMgDl: Range } | null
  /** The meal has almost no energy, so there is nothing to absorb (e.g. water). */
  noNutrients: boolean
}

interface EventInput {
  arrival: number
  stomachLiquidG: Float64Array
  stomachSolidG: Float64Array
  absorbedG: Record<NutrientKind, Float64Array>
  /** Cumulative grams (excluding water) that have entered the large intestine. */
  leftoversInColonCum: Float64Array
  glucoseTypical: Float64Array
  step: number
  n: number
}

export function computeEvents(meal: Meal, s: EventInput): SimEvents {
  const firstIndex = (test: (i: number) => boolean): number | null => {
    for (let i = 0; i < s.n; i++) if (test(i)) return i * s.step
    return null
  }

  const total = meal.total.massG
  const stomachBelow = (frac: number) =>
    total <= 0 ? null : firstIndex((i) => i * s.step >= s.arrival && s.stomachLiquidG[i]! + s.stomachSolidG[i]! <= total * frac)

  const energyKinds: NutrientKind[] = ['carbs', 'protein', 'fat']
  const absorbedEnergyG = (i: number) => energyKinds.reduce((sum, k) => sum + s.absorbedG[k][i]!, 0)
  const finalAbsorbed = absorbedEnergyG(s.n - 1)
  const absorptionMostlyDoneMin = finalAbsorbed > 0.5 ? firstIndex((i) => absorbedEnergyG(i) >= finalAbsorbed * 0.9) : null

  const si = PARAMS.smallIntestine
  const co = PARAMS.colon
  const leftovers = s.leftoversInColonCum[s.n - 1]!
  const hasLeftovers = leftovers >= PARAMS.residueThresholdG
  const halfIn = hasLeftovers ? firstIndex((i) => s.leftoversInColonCum[i]! >= leftovers * 0.5) : null
  const firstIn = hasLeftovers ? firstIndex((i) => s.leftoversInColonCum[i]! >= leftovers * 0.05) : null
  // Spread between people comes from transit times, which don't depend on the meal.
  const siEarlier = si.typicalMin - si.lowMin
  const siLater = si.highMin - si.typicalMin

  let peakIdx = 0
  for (let i = 1; i < s.n; i++) if (s.glucoseTypical[i]! > s.glucoseTypical[peakIdx]!) peakIdx = i
  const g = PARAMS.glucose
  const peakRise = s.glucoseTypical[peakIdx]! - g.fastingMgDl

  return {
    eatingEndMin: meal.eatingMin,
    stomachHalfEmptyMin: stomachBelow(0.5),
    stomach90EmptyMin: stomachBelow(0.1),
    absorptionMostlyDoneMin,
    halfLeftoversInColon: halfIn === null ? null : { low: halfIn - siEarlier, typical: halfIn, high: halfIn + siLater },
    firstExit:
      firstIn === null
        ? null
        : {
            low: firstIn - siEarlier + co.lowMin,
            typical: firstIn + co.typicalMin,
            high: firstIn + siLater + co.highMin,
          },
    glucosePeak:
      peakRise >= 1
        ? { timeMin: peakIdx * s.step, riseMgDl: { low: peakRise * g.bandLow, typical: peakRise, high: peakRise * g.bandHigh } }
        : null,
    noNutrients: meal.total.energyKcal < 1,
  }
}
