/**
 * Prints the model's key outputs next to the published targets they are calibrated against.
 * Run after changing params.ts:  npm run calibrate -w @lifepeek/engine
 */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMeal, decodeMeal, indexAt, parseFood, simulate, stomachFraction, type Simulation } from '../src/index.ts'
import { lookup as fixtureLookup } from '../test/fixtures.ts'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir).map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => fixtureLookup(id) ?? foods.find((f) => f.id === id)
const run = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookup))

const pct = (sim: Simulation, t: number) => (stomachFraction(sim, indexAt(sim, t + sim.meal.eatingMin)) * 100).toFixed(0)
const iauc = (sim: Simulation) => {
  let a = 0
  for (let t = 0; t <= 120; t++) a += Math.max(0, sim.glucose.typical[t]! - 90)
  return a
}

const rows = [
  ['water-test:1', 'water t½ ~16 min (Ziessman 2009)'],
  ['glucose-50:1', '50 g glucose: peak +30–60 at 30–60 min; 2 h near baseline'],
  ['standard-meal:1', 'Abell 2008: 1 h 37–90 %, 2 h 30–60 %, 4 h ≤10 %'],
  ['bread-50:1', 'GI 75 → iAUC ratio 0.75'],
  ['fatty-meal:1', 'high-fat meal: stomach ≥6 h (OpenStax §23.4)'],
  ['cola:1', 'home page: cola ~half out in ~30 min'],
  ['cheeseburger:1,fries:1', 'home page: burger + fries takes hours'],
  ['cheeseburger:2,fries:2', 'near the 1500 kcal cap'],
]
const ref = iauc(run('glucose-50:1'))
for (const [meal, target] of rows) {
  const sim = run(meal!)
  const e = sim.events
  console.log(
    meal!.padEnd(24),
    `kcal ${sim.meal.total.energyKcal.toFixed(0).padStart(4)}`,
    `t50 ${e.stomachHalfEmptyMin} t90 ${e.stomach90EmptyMin}`,
    `ret 1/2/4h ${pct(sim, 60)}/${pct(sim, 120)}/${pct(sim, 240)}%`,
    `peak ${e.glucosePeak ? `+${e.glucosePeak.riseMgDl.typical.toFixed(0)}@${e.glucosePeak.timeMin}` : '-'}`,
    `abs90 ${e.absorptionMostlyDoneMin}`,
    `iAUC ${(iauc(sim) / ref).toFixed(2)}`,
    `| ${target}`,
  )
}
