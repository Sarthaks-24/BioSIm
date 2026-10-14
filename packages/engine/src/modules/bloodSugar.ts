/**
 * bloodSugar: blood glucose from the carbohydrate the gut absorbs, weighted by each phase's GI and
 * blunted by the meal's fat and protein (glucose.ts). Moved here unchanged from simulate.ts (E-1).
 * It runs the same small-intestine absorption as the gut's carbs, so the glucose curve and the
 * "absorbed" numbers can never tell different stories.
 *
 * S-6 (model §2.5 E1) adds insulin and the brain's glucose use after the glucose curve, reading it
 * and never writing back into it: blood.glucose is computed exactly as before, so adding them
 * changes no earlier signal (D13 iii). Their rows are lazy, in the control pack
 * (core/catalog/control.ts); their numbers are ctx.params.insulin and .brain (packParams.ts).
 */
import { bluntingFactor, glucoseCurve } from '../glucose.ts'
import { runSegment } from '../transit.ts'
import type { Params } from '../params.ts'
import type { ModelModule, SimContext } from '../core/module.ts'
import { CARBS_OUT } from './gut.ts'

/**
 * The glucose step (E-1, unchanged): puts blood.glucose and returns the typical curve and the
 * glycemic carbohydrate absorbed per step (g/min), which insulin reads as Ra.
 */
export function putGlucose(ctx: SimContext): { glucose: Float64Array; ra: Float64Array } {
  const { params, n } = ctx
  const { meal } = ctx.input
  const step = ctx.stepMin
  const blunt = bluntingFactor(meal, params)

  // Grams of "glycemic" carbohydrate leaving the stomach each minute.
  const glycemicOutflow = new Float64Array(n)
  for (const phase of ['liquid', 'solid'] as const) {
    const totals = meal[phase]
    if (totals.massG <= 0) continue
    // GI already includes a food's own emptying speed; see params.glucose.solidGlycemicCorrection.
    const glycemicWeight = (totals.gi / 100) * blunt * (phase === 'solid' ? params.glucose.solidGlycemicCorrection : 1)
    const carbsOut = ctx.get(CARBS_OUT[phase])
    for (let i = 0; i < n; i++) if (carbsOut[i]! > 0) glycemicOutflow[i]! += carbsOut[i]! * glycemicWeight
  }

  const siT = params.smallIntestine.typicalMin / step
  const glycemic = runSegment(glycemicOutflow, siT, params.absorbedInSmallIntestine.carbs, params.absorptionTauMin.carbs)
  const glycemicRate = new Float64Array(n)
  for (let i = 0; i < n; i++) glycemicRate[i] = glycemic.absorbedCum[i]! - (i > 0 ? glycemic.absorbedCum[i - 1]! : 0)
  const glucose = glucoseCurve(glycemicRate, step, params)
  ctx.put('blood.glucose', glucose.typical, { low: glucose.low, high: glucose.high })
  return { glucose: glucose.typical, ra: glycemicRate }
}

/** Plasma insulin as a multiple of fasting, its band edges, and the secretion behind it (× basal). */
export interface InsulinCurve {
  typical: Float64Array
  low: Float64Array
  high: Float64Array
  secretion: Float64Array
}

/** Insulin secretion as a multiple of basal (internal: the Polonsky 1988 hold-out reads it; never a row). */
export const INSULIN_SECRETION = 'x.insulin.secretion'

/**
 * Insulin, open loop (model §2.5 E1): from glucose G (mg/dL) and the glycemic carbohydrate coming
 * in, Ra (g/min), never fed back. Secretion S = S_b + Y + K·max(0, dG/dt) + c·Ra (pmol/kg/min),
 * dY/dt = −α(Y − β·max(0, G − fasting)); blood insulin follows the steady-state plasma level for S,
 * as a multiple of the basal one, with dI/dt = n(target − I), n = ln 2/half-life (packParams.ts
 * insulin says where each number comes from). Both lags are stepped exactly over each step (no
 * overshoot), so at fasting with nothing coming in insulin stays exactly 1.
 */
export function insulinCurve(glucose: ArrayLike<number>, ra: ArrayLike<number>, stepMin: number, params: Params): InsulinCurve {
  const p = params.insulin
  const fasting = params.glucose.fastingMgDl
  const n = glucose.length
  const typical = new Float64Array(n)
  const low = new Float64Array(n)
  const high = new Float64Array(n)
  const secreted = new Float64Array(n)
  const keepY = Math.exp(-p.alphaPerMin * stepMin)
  const keepI = Math.exp((-Math.LN2 / p.halfLifeMin) * stepMin)
  const basalPlasma = plasmaPerSecretion(p.basalSecretion, p)
  let y = 0
  let insulin = 1
  for (let i = 0; i < n; i++) {
    const g = glucose[i]!
    const rising = i > 0 ? Math.max(0, (g - glucose[i - 1]!) / stepMin) : 0
    const yTarget = p.betaPerMgDl * Math.max(0, g - fasting)
    y = yTarget + (y - yTarget) * keepY
    const secretion = p.basalSecretion + y + p.kDynamic * rising + p.raGainPerGPerMin * Math.max(0, ra[i]!)
    secreted[i] = secretion / p.basalSecretion
    const target = plasmaPerSecretion(secretion, p) / basalPlasma
    insulin = target + (insulin - target) * keepI
    const rise = insulin - 1
    typical[i] = insulin
    low[i] = 1 + rise * p.bandLow
    high[i] = 1 + rise * p.bandHigh
  }
  return { typical, low, high, secretion: secreted }
}

/**
 * Plasma insulin at steady state for a secretion S (pmol/kg/min), from Dalla Man 2007's liver and
 * plasma compartments: the liver takes out a share HE = m6 − m5·S of what passes, less as secretion
 * rises, so I_p = S / ((m2 + m4)/(1 − HE) − m2) (m1 cancels). Only its ratio to the basal value is used.
 */
function plasmaPerSecretion(s: number, p: Params['insulin']): number {
  const he = Math.max(0, p.liverM6 - p.liverM5 * s)
  return s / ((p.liverM2 + p.liverM4) / (1 - he) - p.liverM2)
}

/** First minute of the highest insulin, or null when it never rises by `minRise` (× fasting). */
export function insulinPeakMin(insulin: ArrayLike<number>, stepMin: number, minRise: number): number | null {
  let at = 0
  for (let i = 1; i < insulin.length; i++) if (insulin[i]! > insulin[at]!) at = i
  return insulin[at]! - 1 >= minRise ? at * stepMin : null
}

export const bloodSugarModule: ModelModule = {
  id: 'bloodSugar',
  system: 'digestion',
  needs: [CARBS_OUT.liquid, CARBS_OUT.solid],
  provides: ['blood.glucose', 'blood.insulin', 'brain.glucoseUse'],
  internal: [INSULIN_SECRETION],
  moments: ['event.insulinPeak'],
  run(ctx) {
    const { glucose, ra } = putGlucose(ctx)
    const insulin = insulinCurve(glucose, ra, ctx.stepMin, ctx.params)
    ctx.put('blood.insulin', insulin.typical, { low: insulin.low, high: insulin.high })
    ctx.put(INSULIN_SECRETION, insulin.secretion)
    ctx.putMoment('event.insulinPeak', insulinPeakMin(insulin.typical, ctx.stepMin, ctx.params.insulin.peakMinRise))
    ctx.put('brain.glucoseUse', new Float64Array(ctx.n).fill(ctx.params.brain.glucoseGPerH))
  },
}
