import { buildMeal, simulate, indexAt } from '../src/index.ts'
import { lookup } from '../test/fixtures.ts'

for (const id of ['water-test', 'glucose-50', 'standard-meal', 'bread-50', 'fatty-meal']) {
  const sim = simulate(buildMeal([{ foodId: id, servings: 1 }], lookup))
  const ret = (t: number) => {
    const i = indexAt(sim, t)
    return (((sim.stomachLiquidG[i]! + sim.stomachSolidG[i]!) / sim.meal.total.massG) * 100).toFixed(0)
  }
  const gl = sim.glucose.typical
  console.log(
    id,
    'half',
    sim.curves.liquid.halfTimeMin.toFixed(0),
    sim.curves.solid.halfTimeMin.toFixed(0),
    'ret 1h/2h/4h',
    ret(60),
    ret(120),
    ret(240),
    'events',
    JSON.stringify({
      h: sim.events.stomachHalfEmptyMin,
      m: sim.events.stomachMostlyEmptyMin,
      abs: sim.events.absorptionMostlyDoneMin,
      peak: sim.events.glucosePeak && [sim.events.glucosePeak.timeMin, sim.events.glucosePeak.riseMgDl.typical.toFixed(0)],
    }),
    'glu 30/60/120/180',
    [30, 60, 120, 180].map((t) => gl[indexAt(sim, t)]!.toFixed(0)).join('/'),
    'absorbed carbs',
    sim.absorbedG.carbs[sim.length - 1]!.toFixed(1),
    'particles',
    sim.particles.length,
  )
}

// GI check: 2-hour incremental area under the glucose curve relative to 50 g glucose.
const iauc = (id: string) => {
  const sim = simulate(buildMeal([{ foodId: id, servings: 1 }], lookup))
  let a = 0
  for (let t = 0; t <= 120; t++) a += Math.max(0, sim.glucose.typical[t]! - 90)
  return a
}
const ref = iauc('glucose-50')
console.log('GI ratio bread-50 (target 0.75):', (iauc('bread-50') / ref).toFixed(3))
