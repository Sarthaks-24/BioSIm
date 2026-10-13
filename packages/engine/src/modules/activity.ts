/**
 * activity: the MET of each minute from the run's activity bouts (model §2.1, D3, D18), first in
 * the frozen order: it reads only the input. No bout = MET 1 (resting, Compendium 07021), so a run
 * without activity gives exactly the run of a resting person.
 *
 * Index i is the step that ends at minute i·stepMin (as energy.inRate): a bout from minute s for d
 * minutes covers s < t ≤ s + d, so its MET counts for exactly d minutes. It also writes the two
 * timeline moments: the first bout's start and the last bout's end.
 *
 * In v3.0 activity moves only energy (and later breathing, heart, muscles, skin, water). It has no
 * arrow into the gut or blood glucose (model D6, C3): those modules never read x.activity.met.
 */
import type { ModelModule } from '../core/module.ts'

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
    const met = new Float64Array(n).fill(1)
    for (const b of activity) {
      const value = ctx.params.activity.met[b.kind]
      const end = b.startMin + b.durMin
      for (let i = Math.max(0, Math.floor(b.startMin / step) + 1); i < n && i * step <= end; i++) met[i] = value
    }
    ctx.put(ACTIVITY_MET, met)

    const horizon = (n - 1) * step
    const start = activity.length ? Math.min(...activity.map((b) => b.startMin)) : null
    const end = activity.length ? Math.max(...activity.map((b) => b.startMin + b.durMin)) : null
    ctx.putMoment('event.activityStart', start !== null && start <= horizon ? start : null)
    ctx.putMoment('event.activityEnd', end !== null && end <= horizon ? end : null)
  },
}
