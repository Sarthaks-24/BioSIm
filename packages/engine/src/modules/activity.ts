/**
 * activity: the MET of each minute from the run's activity bouts (model §2.1, D3, D18), first in
 * the frozen order: it reads only the input. No bout = MET 1 (resting, Compendium 07021), so a run
 * without activity gives exactly the run of a resting person.
 *
 * Index i is the step that ends at minute i·stepMin (as energy.inRate): a bout from minute s for d
 * minutes covers s < t ≤ s + d. The body does not jump to the bout's MET: it follows it with
 * first-order on/off kinetics (R82, params.kinetics: τ_on 35 s, τ_off 50 s, Rossiter 2002), so a
 * bout's extra MET-minutes are d·(MET − 1) plus (τ_off − τ_on)·(MET − 1) paid back after it ends
 * (the fast part of the oxygen debt; no slow EPOC). It also writes the two timeline moments: the
 * first bout's start and the last bout's end.
 *
 * In v3.0 activity moves only energy (and later breathing, heart, muscles, skin, water). It has no
 * arrow into the gut or blood glucose (model D6, C3): those modules never read x.activity.met.
 */
import type { ModelModule } from '../core/module.ts'
import { ACTIVITY_LIMITS, boutInLimits, sortBouts, type ActivityBout, type ActivityKind } from '../core/activity.ts'

/**
 * The 2024 Adult Compendium row of each kind (pacompendium.com; V-0 items 1 and 9, V-0b item 1).
 * Its MET is in params.ts (activity.met). `football` is soccer (15610), not American football (15210).
 */
export const ACTIVITY_CODES: { readonly [K in ActivityKind]: string } = {
  walk: '17190', // walking, 2.8–3.4 mph, level, moderate pace
  walkBrisk: '17200', // walking, 3.5–3.9 mph, level, brisk
  run: '12050', // running, 6–6.3 mph (10 min/mile)
  sitClass: '09065', // sitting in class, general
  football: '15610', // soccer, casual, general
  cricket: '15150', // cricket, batting, bowling, fielding
  badminton: '15030', // badminton, social singles and doubles
}

/**
 * What is wrong with a list of bouts, in words (empty = a valid plan): too many, a bout outside the
 * limits, or two bouts that overlap (one may start the minute the other ends).
 */
export function activityProblems(bouts: readonly ActivityBout[]): string[] {
  const problems: string[] = []
  if (bouts.length > ACTIVITY_LIMITS.maxBouts) problems.push(`more than ${ACTIVITY_LIMITS.maxBouts} bouts`)
  for (const b of bouts) if (!boutInLimits(b)) problems.push(`bout ${b.kind}.${b.startMin}.${b.durMin} is outside the limits`)
  const sorted = sortBouts(bouts)
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1]!
    const b = sorted[i]!
    if (b.startMin < a.startMin + a.durMin)
      problems.push(`bouts ${a.kind}.${a.startMin}.${a.durMin} and ${b.kind}.${b.startMin}.${b.durMin} overlap`)
  }
  return problems
}

/** MET of each step (internal): 1 at rest. */
export const ACTIVITY_MET = 'x.activity.met'

export const activityModule: ModelModule = {
  id: 'activity',
  system: 'digestion',
  needs: [],
  provides: [],
  internal: [ACTIVITY_MET],
  moments: ['event.activityStart', 'event.activityEnd'],
  run(ctx) {
    const { n, stepMin: step } = ctx
    const { activity } = ctx.input
    const target = new Float64Array(n).fill(1)
    for (const b of activity) {
      const value = ctx.params.activity.met[b.kind]
      const end = b.startMin + b.durMin
      for (let i = Math.max(0, Math.floor(b.startMin / step) + 1); i < n && i * step <= end; i++) target[i] = value
    }
    // On/off kinetics (R82): the MET above 1 follows the bouts' MET as a first-order lag, τ_on going
    // up and τ_off going down. Each step holds the exact mean of the lag over that step, so every
    // module that turns MET into energy, oxygen, heat or sweat integrates the same curve. Within
    // 1e-12 MET of the target the lag is snapped to it, so a rest after a bout is exactly MET 1.
    const { metTauOnS, metTauOffS } = ctx.params.kinetics
    const met = new Float64Array(n)
    let x = 0
    for (let i = 0; i < n; i++) {
      const goal = target[i]! - 1
      let mean = goal
      if (x !== goal) {
        const tau = (goal > x ? metTauOnS : metTauOffS) / 60
        const keep = Math.exp(-step / tau)
        mean = goal + ((x - goal) * tau * (1 - keep)) / step
        x = goal + (x - goal) * keep
        if (Math.abs(x - goal) < 1e-12) x = goal
      }
      met[i] = 1 + mean
    }
    ctx.put(ACTIVITY_MET, met)

    const horizon = (n - 1) * step
    const start = activity.length ? Math.min(...activity.map((b) => b.startMin)) : null
    const end = activity.length ? Math.max(...activity.map((b) => b.startMin + b.durMin)) : null
    ctx.putMoment('event.activityStart', start !== null && start <= horizon ? start : null)
    ctx.putMoment('event.activityEnd', end !== null && end <= horizon ? end : null)
  },
}
