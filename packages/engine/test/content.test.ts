import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildMeal, decodeMeal, parseFood, simulate } from '../src/index.ts'

/** The claims the app makes on its home page and lesson plan must hold for the real food data. */

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../content/foods')
const foods = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => parseFood(JSON.parse(readFileSync(join(dir, f), 'utf8'))))
const lookup = (id: string) => foods.find((f) => f.id === id)
const run = (meal: string) => simulate(buildMeal(decodeMeal(meal), lookup))

describe('real foods', () => {
  it('all shipped foods simulate without NaN', () => {
    for (const f of foods) {
      const sim = run(`${f.id}:1`)
      expect(sim.meal.items).toHaveLength(1)
      for (const arr of [sim.stomachSolidG, sim.stomachLiquidG, sim.glucose.typical, sim.colonG]) {
        expect(arr.every(Number.isFinite)).toBe(true)
      }
    }
  })

  it('home page claim: cola is half out of the stomach in about half an hour; burger + fries takes hours', () => {
    const cola = run('cola:1').events.stomachHalfEmptyMin!
    const burger = run('cheeseburger:1,fries:1')
    expect(cola).toBeGreaterThanOrEqual(20)
    expect(cola).toBeLessThanOrEqual(45)
    expect(burger.events.stomachHalfEmptyMin!).toBeGreaterThan(150)
    expect(burger.events.stomachMostlyEmptyMin!).toBeGreaterThan(4 * 60)
  })

  it('lesson claim: roti + dal gives a gentler blood sugar curve than white rice', () => {
    const rotiDal = run('roti:1,dal:1').events.glucosePeak!
    const rice = run('white-rice:1').events.glucosePeak!
    expect(rotiDal.riseMgDl.typical).toBeLessThan(rice.riseMgDl.typical)
  })

  it('juice raises blood sugar faster than the whole fruit', () => {
    const apple = run('apple:1').events.glucosePeak!
    const juice = run('orange-juice:1').events.glucosePeak!
    expect(juice.timeMin).toBeLessThan(apple.timeMin)
    expect(juice.riseMgDl.typical).toBeGreaterThan(apple.riseMgDl.typical)
  })

  it('water leaves faster than milk', () => {
    expect(run('water:1').events.stomachHalfEmptyMin!).toBeLessThan(run('milk:1').events.stomachHalfEmptyMin!)
  })

  it('egg and salad barely move blood sugar', () => {
    const egg = run('boiled-egg:1').events.glucosePeak
    const salad = run('green-salad:1').events.glucosePeak
    expect(egg?.riseMgDl.typical ?? 0).toBeLessThan(3)
    expect(salad?.riseMgDl.typical ?? 0).toBeLessThan(6)
  })
})
