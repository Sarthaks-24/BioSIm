/** Quick look at glucose shapes for a few meals: rise above fasting at 30 min … 6 h. */
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildMeal, decodeMeal, parseFood, simulate } from '../src/index.ts'
import { lookup as fixtureLookup } from '../test/fixtures.ts'

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir).map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => fixtureLookup(id) ?? foods.find((f) => f.id === id)
for (const meal of ['glucose-50:1', 'bread-50:1', 'cola:1', 'cheeseburger:1,fries:1', 'white-rice:1', 'roti:1,dal:1']) {
  const sim = simulate(buildMeal(decodeMeal(meal), lookup))
  const at = [30, 60, 90, 120, 180, 240, 300, 360].map((t) => (sim.glucose.typical[t]! - 90).toFixed(0).padStart(4))
  console.log(meal.padEnd(24), at.join(''), ' peak', sim.events.glucosePeak?.timeMin)
}
