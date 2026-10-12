import type { MealItem } from '@lifepeek/engine'

/**
 * Every `/sim?` link v1 ships or tests, copied here (WP-05) as plain text, because WP-19 rewrites
 * e2e/smoke.spec.ts and lib/presets.ts. These links are already shared in classrooms, so they
 * must open the same meals forever. links.test.ts checks every one.
 *
 * Never edit an entry. Add new ones only if a v1 link turns up that is missing here.
 */
export interface V1Link {
  /** Where it comes from. */
  from: 'presets.ts' | 'smoke.spec.ts' | 'ARCHITECTURE.md'
  href: string
  /** What it decoded to before v2 (`decodeShareState` at model version 2). null = no `v`, so the current model. */
  modelVersion: number | null
  a: MealItem[]
  b: MealItem[]
  t: number
  lang?: 'en' | 'hi'
}

const one = (...ids: string[]): MealItem[] => ids.map((foodId) => ({ foodId, servings: 1 }))

export const V1_LINKS: readonly V1Link[] = [
  // presetHref() for the four presets (encodeShareState output, so the meals are URL-encoded).
  {
    from: 'presets.ts',
    href: '/sim?v=2&a=cola%3A1&b=cheeseburger%3A1%2Cfries%3A1',
    modelVersion: 2,
    a: one('cola'),
    b: one('cheeseburger', 'fries'),
    t: 0,
  },
  {
    from: 'presets.ts',
    href: '/sim?v=2&a=roti%3A1%2Cdal%3A1&b=white-rice%3A1',
    modelVersion: 2,
    a: one('roti', 'dal'),
    b: one('white-rice'),
    t: 0,
  },
  { from: 'presets.ts', href: '/sim?v=2&a=apple%3A1&b=orange-juice%3A1', modelVersion: 2, a: one('apple'), b: one('orange-juice'), t: 0 },
  { from: 'presets.ts', href: '/sim?v=2&a=water%3A1&b=milk%3A1', modelVersion: 2, a: one('water'), b: one('milk'), t: 0 },
  // e2e/smoke.spec.ts page.goto() links, as typed there.
  {
    from: 'smoke.spec.ts',
    href: '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1',
    modelVersion: 2,
    a: one('cola'),
    b: one('cheeseburger', 'fries'),
    t: 0,
  },
  { from: 'smoke.spec.ts', href: '/sim?v=2&a=water:1&b=milk:1', modelVersion: 2, a: one('water'), b: one('milk'), t: 0 },
  {
    from: 'smoke.spec.ts',
    href: '/sim?v=2&a=cheeseburger:2,fries:2&b=water:1',
    modelVersion: 2,
    a: [
      { foodId: 'cheeseburger', servings: 2 },
      { foodId: 'fries', servings: 2 },
    ],
    b: one('water'),
    t: 0,
  },
  // A model-v1 link with a food that no longer exists: the engine still decodes it; the page drops `nope` with a note.
  { from: 'smoke.spec.ts', href: '/sim?v=1&a=cola:1,nope:1&b=water:1', modelVersion: 1, a: one('cola', 'nope'), b: one('water'), t: 0 },
  {
    from: 'smoke.spec.ts',
    href: '/sim?v=2&a=roti:1,dal:1&b=white-rice:1',
    modelVersion: 2,
    a: one('roti', 'dal'),
    b: one('white-rice'),
    t: 0,
  },
  { from: 'smoke.spec.ts', href: '/sim', modelVersion: null, a: [], b: [], t: 0 },
  // The format example in docs/ARCHITECTURE.md (the only one with `t` and `lang`).
  {
    from: 'ARCHITECTURE.md',
    href: '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=120&lang=hi',
    modelVersion: 2,
    a: one('cola'),
    b: one('cheeseburger', 'fries'),
    t: 120,
    lang: 'hi',
  },
]
