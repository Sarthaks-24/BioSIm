// Writes src/data/hero.json, the picture on Home (src/data/hero.ts). Run by hand after a model or
// food change that moves the cola or burger + fries curves (hero.test.ts says when):
//   npm run hero -w @lifepeek/web
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Food } from '@lifepeek/engine'
import { computeHero } from '../src/data/hero.ts'

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const foodsDir = path.resolve(web, '..', '..', 'content', 'foods')
const foods = new Map<string, Food>()
for (const file of fs.readdirSync(foodsDir).filter((f) => f.endsWith('.json'))) {
  const food = JSON.parse(fs.readFileSync(path.join(foodsDir, file), 'utf8')) as Food
  foods.set(food.id, food)
}

const out = path.join(web, 'src', 'data', 'hero.json')
fs.writeFileSync(out, `${JSON.stringify(computeHero((id) => foods.get(id)))}\n`)
console.log(`Wrote ${path.relative(process.cwd(), out)}`)
