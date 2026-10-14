/**
 * water: the kidneys and the body's water (model §2.4, D17; S-4). After effort in the frozen order
 * (D4): it reads the water the gut absorbs, the sweat effort makes and the energy used, and writes
 * nothing anyone reads, so adding it leaves every other signal as it was (D13 iii).
 *
 * The meal's water sits on a steady background day (D17): on an ordinary day the usual drinks
 * balance the usual 1.5 L of urine, the unnoticed losses (breath, skin) and the resting metabolic
 * water, so all of that is implicit and only the meal's extra water E moves:
 *   dE/dt = A + M − (U − U0) − sweat
 *   - A: water absorbed by the gut (Δ gut.absorbed.waterG, 1 g = 1 mL);
 *   - M: extra metabolic water, 0.12 mL per kcal used above rest (x.energy.total − R; IOM 2005 p85);
 *   - sweat: skin.sweatRate (warm room, S-1); breath water in moving is a stated limit.
 * The kidney follows E through the ADH lag S, dS/dt = (E − S)/τ, and makes urine
 *   U = clamp(U0 + kx·S, Umin, Umax), U0 = 1.5 L a day, Umin 21 mL/h (about 500 mL a day), Umax 750 mL/h.
 * No thirst (D5 C8): when sweat takes more than the meal gives, E goes below 0, urine falls (never
 * below Umin) and the background day's drinks make it up slowly. The bladder starts empty, fills
 * with all the urine and empties at 300 mL. Filtration is a constant 125 mL/min (D15).
 *
 * Index 0 is the start (what is already absorbed or sweated then); step i covers the minute that
 * ends at i, so kidney.urineTotal is 0 at the start and U0·t on a day without a meal.
 */
import type { ModelModule } from '../core/module.ts'
import { ENERGY_TOTAL } from './energy.ts'

/** Below this much absorbed water (mL) a meal has no water to pass, so no "most of it passed" moment. */
const NO_WATER_ML = 1

export const waterModule: ModelModule = {
  id: 'water',
  system: 'kidneys',
  needs: ['gut.absorbed.waterG', 'skin.sweatRate', ENERGY_TOTAL],
  provides: ['kidney.urineRate', 'kidney.urineTotal', 'kidney.bladderMl', 'water.mealExtraMl', 'kidney.filtrationRate'],
  moments: ['event.bladderFirstUrge', 'event.mostMealWaterPassed'],
  run(ctx) {
    const { n, params, profile } = ctx
    const step = ctx.stepMin
    const w = params.water
    const restKcalPerMin = profile.restingKcalPerDay / 1440
    const u0 = w.backgroundUrineMlPerDay / 1440
    const uMin = w.minUrineMlPerH / 60
    const uMax = w.maxUrineMlPerH / 60
    const follow = 1 - Math.exp(-step / w.adhTauMin)
    const absorbed = ctx.get('gut.absorbed.waterG')
    const sweat = ctx.get('skin.sweatRate')
    const total = ctx.get(ENERGY_TOTAL)

    const urineRate = new Float64Array(n)
    const urineTotal = new Float64Array(n)
    const bladder = new Float64Array(n)
    const extra = new Float64Array(n)
    const filtration = new Float64Array(n).fill(w.filtrationMlPerMin)
    const half = absorbed[n - 1]! / 2
    let e = 0
    let s = 0
    let passed = 0 // extra urine (above the background), mL
    let sum = 0
    let b = 0
    let urgeAt: number | null = null
    let passedAt: number | null = null
    for (let i = 0; i < n; i++) {
      const water = absorbed[i]! - (i > 0 ? absorbed[i - 1]! : 0)
      const made = w.metabolicMlPerKcal * (total[i]! - restKcalPerMin) * step
      const lost = (sweat[i]! / 60) * step
      let u = u0
      if (i > 0) {
        s += (e - s) * follow
        u = Math.min(uMax, Math.max(uMin, u0 + w.urinePerExtraMlPerMin * s))
        const out = (u - u0) * step
        passed += out
        sum += u * step
        b += u * step
        if (urgeAt === null && b >= w.bladderUrgeMl - 1e-9) urgeAt = i * step
        if (b >= w.bladderEmptyMl - 1e-9) b = 0
        e -= out
      }
      e += water + made - lost
      urineRate[i] = u * 60
      urineTotal[i] = sum
      bladder[i] = b
      extra[i] = e
      if (passedAt === null && half * 2 >= NO_WATER_ML && passed >= half) passedAt = i * step
    }
    ctx.put('kidney.urineRate', urineRate)
    ctx.put('kidney.urineTotal', urineTotal)
    ctx.put('kidney.bladderMl', bladder)
    ctx.put('water.mealExtraMl', extra)
    ctx.put('kidney.filtrationRate', filtration)
    ctx.putMoment('event.bladderFirstUrge', urgeAt)
    ctx.putMoment('event.mostMealWaterPassed', passedAt)
  },
}

/**
 * Share of the filtrate the kidneys take back (a helper, model D10): 1 − urine ÷ filtration. At the
 * background 62.5 mL/h of 125 mL/min that is 99.2 % ("Ninety-nine percent", OpenStax §25.5).
 */
export const filtrateTakenBack = (urineMlPerH: number, filtrationMlPerMin: number): number => 1 - urineMlPerH / 60 / filtrationMlPerMin

/**
 * Glucose spilled into urine, mg/min (a helper, model D10): what is filtered above the kidney's
 * ceiling, about 375 mg/min in men (OpenStax §25.6, which puts the threshold at "about 200 mg/dL").
 * 125 mL/min of plasma at G mg/dL carries 1.25·G mg/min; the model's glucose stays far below, so 0.
 */
export const glucoseSpilled = (glucoseMgDl: number, filtrationMlPerMin: number, maxMgPerMin = 375): number =>
  Math.max(0, (filtrationMlPerMin / 100) * glucoseMgDl - maxMgPerMin)
