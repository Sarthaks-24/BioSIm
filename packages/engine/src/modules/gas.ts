/**
 * gas: oxygen used, carbon dioxide made and the breathing that carries the CO2 away (model §2.2,
 * D1, S-2). Fifth in the frozen order: it reads the energy used (x.energy.total), blood glucose and
 * the MET, and nothing after it, so effort (S-1) can build beside it (R19).
 *
 * Each minute:
 *   - RQ = clamp(max(RQfasting + kRQ·(glucose − fasting), floor), 0.70, 1.00), where the floor
 *     0.80 + 0.0127·MET applies only in a bout (MET > 1): more carbohydrate is burned at higher
 *     effort (a calibration, R51; Bosch 1990 RER 0.91–0.96 is the run's cross-check);
 *   - Weir without protein: VO2 = E ÷ (3.941 + 1.106·RQ), VCO2 = RQ·VO2 (mL/min);
 *   - alveolar air VA = 0.863·VCO2/40 (L/min), alveolar CO2 held at 40 mm Hg (limit C7);
 *   - breaths f = 15·(VA/VA_rest)^(1/3); depth VT = VA/f + 150 mL dead space, at most 2.5 L.
 * VA_rest is the person's resting use at the fasting RQ, so a fasting person at rest breathes
 * exactly 15 times a minute. VE (= f·VT) and VA are helpers, not IDs (D10).
 */
import type { ModelModule } from '../core/module.ts'
import { ACTIVITY_MET } from './activity.ts'
import { ENERGY_TOTAL } from './energy.ts'

export const gasModule: ModelModule = {
  id: 'gas',
  system: 'breathing',
  needs: [ENERGY_TOTAL, 'blood.glucose', ACTIVITY_MET],
  provides: ['gas.o2UseRate', 'gas.co2OutRate', 'gas.exchangeRatio', 'lungs.breathRate', 'lungs.tidalVolume'],
  run(ctx) {
    const { n, profile } = ctx
    const g = ctx.params.gas
    const fasting = ctx.params.glucose.fastingMgDl
    const energy = ctx.get(ENERGY_TOTAL)
    const glucose = ctx.get('blood.glucose')
    const met = ctx.get(ACTIVITY_MET)

    const vaPerCo2 = g.alveolarK / g.alveolarCo2MmHg // L/min of alveolar air per mL/min of CO2
    const restKcalPerMin = profile.restingKcalPerDay / 1440
    const vaRest = vaPerCo2 * ((g.rqFasting * restKcalPerMin * 1000) / (g.weirO2 + g.weirCo2 * g.rqFasting))

    const o2 = new Float64Array(n)
    const co2 = new Float64Array(n)
    const ratio = new Float64Array(n)
    const rate = new Float64Array(n)
    const tidal = new Float64Array(n)
    for (let i = 0; i < n; i++) {
      let rq = g.rqFasting + g.rqPerMgDl * (glucose[i]! - fasting)
      if (met[i]! > 1) rq = Math.max(rq, g.rqFloorBase + g.rqFloorPerMet * met[i]!)
      rq = Math.min(g.rqMax, Math.max(g.rqMin, rq))
      const vo2 = (energy[i]! * 1000) / (g.weirO2 + g.weirCo2 * rq)
      const vco2 = rq * vo2
      const va = vaPerCo2 * vco2
      const f = g.restBreathsPerMin * Math.pow(va / vaRest, g.breathRateExponent)
      o2[i] = vo2
      co2[i] = vco2
      ratio[i] = rq
      rate[i] = f
      tidal[i] = Math.min(g.tidalMaxMl, (va * 1000) / f + g.deadSpaceMl)
    }
    ctx.put('gas.o2UseRate', o2)
    ctx.put('gas.co2OutRate', co2)
    ctx.put('gas.exchangeRatio', ratio)
    ctx.put('lungs.breathRate', rate)
    ctx.put('lungs.tidalVolume', tidal)
  },
}
