/**
 * lymph: the meal's fat on its way to the blood (model §2.10; S-5, sources read in V-5). Last in the
 * frozen order (D4): it reads only the fat the gut absorbs and writes nothing anyone reads, so
 * adding it leaves every other signal, band and moment as it was (D13 iii). Numbers:
 * ctx.params.lymph (packParams.ts, run chunk only).
 *
 * Absorbed fat is packed into chyle and carried by the lacteals and lymph to the blood (OpenStax
 * §21.1, §23.7): a first-order lag, L the fat arriving per minute (lymph.fatFlowRate). In the blood
 * it is cleared with one lumped time constant; P is the meal's fat in the plasma (g):
 *   dL/dt = (fatRate − L)/τ_pack,  dP/dt = L − P/τ_clear,  blood.triglyceride = 80 + P·1000/29 mg/dL.
 * The packing step is a pool Q = τ_pack·L that the absorbed fat fills, so the fat delivered so far is
 * exactly what was absorbed minus Q (never more). Each step is solved exactly for an inflow that is
 * steady within the minute. All fat goes by lymph, liver fat (VLDL) and fuel use are left out, one
 * fasting value, a grown-up (model §2.10 Limits). Nothing feeds back (D5 C10).
 * event.triglyceridePeak: the first minute blood fat is highest, if it rises at least 1 mg/dL.
 */
import type { ModelModule } from '../core/module.ts'

export const lymphModule: ModelModule = {
  id: 'lymph',
  system: 'lymph',
  needs: ['gut.absorbRate.fat'],
  provides: ['lymph.fatFlowRate', 'blood.triglyceride'],
  moments: ['event.triglyceridePeak'],
  run(ctx) {
    const { n } = ctx
    const step = ctx.stepMin
    const l = ctx.params.lymph
    const keepPack = Math.exp(-step / l.packTauMin)
    const keepPlasma = Math.exp(-step / l.clearTauMin)
    const mgDlPerG = 1000 / l.plasmaDl
    const fatRate = ctx.get('gut.absorbRate.fat')

    const flow = new Float64Array(n)
    const tg = new Float64Array(n)
    let pack = 0 // fat being packed and on its way in the lymph, g
    let plasma = 0 // the meal's fat in the plasma, g
    let peakAt = -1
    let peak = 0
    for (let i = 0; i < n; i++) {
      // Index 0 is the start: what is already absorbed then (fatRate[0]·step) enters the pool at once.
      const inflow = fatRate[i]!
      const before = pack
      pack = i > 0 ? pack * keepPack + inflow * l.packTauMin * (1 - keepPack) : inflow * step
      const delivered = i > 0 ? Math.max(0, before + inflow * step - pack) : 0
      const arriving = delivered / step
      plasma = plasma * keepPlasma + arriving * l.clearTauMin * (1 - keepPlasma)
      flow[i] = arriving
      tg[i] = l.fastingMgDl + plasma * mgDlPerG
      if (plasma * mgDlPerG > peak) {
        peak = plasma * mgDlPerG
        peakAt = i
      }
    }
    ctx.put('lymph.fatFlowRate', flow)
    ctx.put('blood.triglyceride', tg)
    ctx.putMoment('event.triglyceridePeak', peak >= l.peakMinRiseMgDl ? peakAt * step : null)
  },
}
