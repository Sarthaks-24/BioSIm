import { encodeShareState, type MealItem } from '@lifepeek/engine'

export interface Preset {
  key: 'colaBurger' | 'rotiRice' | 'appleJuice' | 'waterMilk'
  a: MealItem[]
  b: MealItem[]
}

const one = (...ids: string[]): MealItem[] => ids.map((foodId) => ({ foodId, servings: 1 }))

export const PRESETS: Preset[] = [
  { key: 'colaBurger', a: one('cola'), b: one('cheeseburger', 'fries') },
  { key: 'rotiRice', a: one('roti', 'dal'), b: one('white-rice') },
  { key: 'appleJuice', a: one('apple'), b: one('orange-juice') },
  { key: 'waterMilk', a: one('water'), b: one('milk') },
]

export const DEFAULT_PRESET = PRESETS[0]!

export const presetHref = (p: Preset) => `/sim?${encodeShareState({ a: p.a, b: p.b, t: 0 })}`
