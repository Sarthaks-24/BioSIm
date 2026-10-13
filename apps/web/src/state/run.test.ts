import { beforeEach, describe, expect, it } from 'vitest'
import { MODEL_VERSION, PARAMS, mealKcal, type MealItem } from '@lifepeek/engine'
import { V1_LINKS } from '../lib/v1-links.fixture.ts'
import { lookupFood } from '../data/foods.ts'
import { DEFAULT_LAYER, DEFAULT_MEAL, DEFAULT_RUN_PROFILE, INITIAL_RUN, linkQuery, useRunStore } from './run.ts'
import { useClock } from './clock.ts'
import * as engine from '@lifepeek/engine/run'
import { computeRun, runKey } from '../hooks/useRun.ts'

const run = () => useRunStore.getState()
const search = (href: string) => href.split('?')[1] ?? ''
const one = (...ids: string[]): MealItem[] => ids.map((foodId) => ({ foodId, servings: 1 }))
/** The query the page would write now (what useLinkSync puts in the address bar). */
const written = (lang?: string) => linkQuery(run(), useClock.getState().simMin, lang)

beforeEach(() => {
  useRunStore.setState({ ...INITIAL_RUN })
  useClock.setState({ simMin: 0, playing: false })
})

describe('opening links', () => {
  it.each(V1_LINKS.map((l) => [l.href, l] as const))('%s opens as meal = a, kept = b', (href, link) => {
    useClock.setState({ simMin: 500, playing: true })
    const lang = run().loadLink(search(href))
    // Foods that no longer exist are dropped and counted.
    const known = (items: MealItem[]) => items.filter((i) => lookupFood(i.foodId))
    const meal = known(link.a)
    const kept = known(link.b)
    expect(run().meal).toEqual(meal)
    expect(run().kept).toEqual(kept.length ? { items: kept, profile: DEFAULT_RUN_PROFILE } : null)
    expect(run().droppedFoods).toBe(link.a.length + link.b.length - meal.length - kept.length)
    expect(run().linkModelVersion).toBe(link.modelVersion)
    expect(run().unknownOrganism).toBeNull()
    expect(run().profile).toBe(DEFAULT_RUN_PROFILE)
    expect(run().layer).toBe(DEFAULT_LAYER)
    expect(lang).toBe(link.lang)
    // A link opens paused at its time.
    expect(useClock.getState()).toMatchObject({ simMin: link.t, playing: false })
  })

  it('Step 0d: ?v=2&a=cola:1&b=cheeseburger:1,fries:1 is cola, with cheeseburger + fries kept', () => {
    run().loadLink('v=2&a=cola:1&b=cheeseburger:1,fries:1')
    expect(run().meal).toEqual(one('cola'))
    expect(run().kept?.items).toEqual(one('cheeseburger', 'fries'))
  })

  it('counts dropped foods in both the meal and the kept run', () => {
    run().loadLink('v=1&a=cola:1,nope:1&b=water:1,gone:2')
    expect(run().meal).toEqual(one('cola'))
    expect(run().kept?.items).toEqual(one('water'))
    expect(run().droppedFoods).toBe(2)
  })

  it('a kept run whose foods are all gone is no kept run', () => {
    run().loadLink('v=2&a=cola:1&b=nope:1')
    expect(run().kept).toBeNull()
    expect(run().droppedFoods).toBe(1)
  })

  it('an unknown organism opens as human and is exposed for the "newer version" note', () => {
    for (const link of V1_LINKS) {
      useRunStore.setState({ ...INITIAL_RUN })
      const q = search(link.href)
      run().loadLink(q ? `${q}&o=frog` : 'o=frog')
      expect(run().unknownOrganism, link.href).toBe('frog')
      expect(run().meal.length + (run().kept?.items.length ?? 0), link.href).toBe(link.a.length + link.b.length - run().droppedFoods)
    }
    // The next link without `o` clears it.
    run().loadLink('v=2&a=cola:1')
    expect(run().unknownOrganism).toBeNull()
  })

  it('reads layer and who only when they exist; bad values fall back to the default', () => {
    run().loadLink('v=2&a=cola:1&layer=digestion&who=adult-ref')
    expect(run()).toMatchObject({ layer: 'digestion', profile: 'adult-ref' })
    run().loadLink('v=2&a=cola:1&layer=kidneys&who=teen-ref')
    expect(run()).toMatchObject({ layer: DEFAULT_LAYER, profile: DEFAULT_RUN_PROFILE })
  })

  it('a link with no v has no link model version (it uses the current model)', () => {
    run().loadLink('a=cola:1')
    expect(run().linkModelVersion).toBeNull()
    run().loadLink('v=1&a=cola:1')
    expect(run().linkModelVersion).toBe(1)
  })
})

describe('writing links', () => {
  it('every v2 fixture link, opened and written again, comes out with the same parameters (v becomes the current version)', () => {
    const v2 = V1_LINKS.filter((l) => l.modelVersion === 2)
    expect(v2.length).toBeGreaterThan(0)
    for (const link of v2) {
      useRunStore.setState({ ...INITIAL_RUN })
      const lang = run().loadLink(search(link.href))
      const expected = new URLSearchParams(search(link.href))
      expected.set('v', String(MODEL_VERSION))
      expect([...new URLSearchParams(written(lang))], link.href).toEqual([...expected])
    }
  })

  it('writes who and layer only when they are not the default, and an emptied run as just v', () => {
    run().loadLink('v=2&a=cola:1&layer=digestion&who=adult-ref&t=90')
    expect(written('en')).toBe(`v=${MODEL_VERSION}&a=cola%3A1&t=90&lang=en`)
    run().removeFood('cola')
    expect(written()).toBe(`v=${MODEL_VERSION}&t=90`)
  })

  it('never writes the organism, even for a link that had an unknown one', () => {
    run().loadLink('v=2&o=frog&a=cola:1')
    expect(new URLSearchParams(written()).has('o')).toBe(false)
  })
})

describe('keep, unkeep, swap', () => {
  it('Keep then Unkeep round-trips', () => {
    run().loadLink('v=2&a=cola:1')
    const before = written()
    run().keep()
    expect(run().kept).toEqual({ items: one('cola'), profile: DEFAULT_RUN_PROFILE })
    // Keeping copies: the meal stays, and changing it later leaves the kept run alone.
    expect(run().meal).toEqual(one('cola'))
    expect(written()).toBe(`v=${MODEL_VERSION}&a=cola%3A1&b=cola%3A1`)
    run().addFood('fries')
    expect(run().kept?.items).toEqual(one('cola'))
    run().removeFood('fries')
    run().unkeep()
    expect(run().kept).toBeNull()
    expect(written()).toBe(before)
  })

  it('the kept run survives a reload through its link', () => {
    run().loadLink('v=2&a=cola:1')
    run().keep()
    run().setServings('cola', 2)
    const q = written()
    useRunStore.setState({ ...INITIAL_RUN })
    run().loadLink(q)
    expect(run().meal).toEqual([{ foodId: 'cola', servings: 2 }])
    expect(run().kept?.items).toEqual(one('cola'))
  })

  it('an empty meal is not kept', () => {
    run().keep()
    expect(run().kept).toBeNull()
  })

  it('swap exchanges the meal and the kept run; twice is back where it started', () => {
    run().loadLink('v=2&a=cola:1&b=cheeseburger:1,fries:1')
    run().swapKept()
    expect(run().meal).toEqual(one('cheeseburger', 'fries'))
    expect(run().kept?.items).toEqual(one('cola'))
    run().swapKept()
    expect(run().meal).toEqual(one('cola'))
    expect(run().kept?.items).toEqual(one('cheeseburger', 'fries'))
  })

  it('swap with an empty meal leaves nothing kept; swap with nothing kept does nothing', () => {
    run().loadLink('v=2&b=water:1')
    run().swapKept()
    expect(run().meal).toEqual(one('water'))
    expect(run().kept).toBeNull()
    run().swapKept()
    expect(run().meal).toEqual(one('water'))
  })
})

describe('meal cap (same rules as v1)', () => {
  // cheeseburger 313 kcal, fries 378, cola 144: 2 + 2 = 1382 kcal; + cola = 1526 > 1500.
  const nearCap = () => run().loadLink('v=2&a=cheeseburger:2,fries:2')

  it('the cap blocks adding a food that would go over it', () => {
    nearCap()
    expect(mealKcal(run().meal, lookupFood)).toBeLessThanOrEqual(PARAMS.maxMealKcal)
    expect(run().addFood('cola')).toBe(false)
    expect(run().capBlocked).toBe(true)
    expect(run().meal.map((i) => i.foodId)).toEqual(['cheeseburger', 'fries'])
    // A food that fits is still allowed, and clears the flag.
    expect(run().addFood('water')).toBe(true)
    expect(run().capBlocked).toBe(false)
  })

  it('blocks a food already in the meal, and a seventh food', () => {
    run().loadLink('v=2&a=water:1,apple:1,banana:1,boiled-egg:1,green-salad:1,dal:1')
    expect(run().addFood('water')).toBe(false)
    expect(run().addFood('idli')).toBe(false)
    expect(run().meal).toHaveLength(6)
  })

  it('blocks growing servings past the cap, but always allows shrinking', () => {
    nearCap()
    expect(run().setServings('fries', 3)).toBe(false)
    expect(run().capBlocked).toBe(true)
    expect(run().setServings('fries', 1)).toBe(true)
    expect(run().capBlocked).toBe(false)
  })

  it('a meal over the cap from an old link opens, and can be made smaller', () => {
    run().loadLink('v=2&a=cheeseburger:5')
    expect(mealKcal(run().meal, lookupFood)).toBeGreaterThan(PARAMS.maxMealKcal)
    expect(run().setServings('cheeseburger', 4)).toBe(true)
    expect(run().setServings('cheeseburger', 5)).toBe(false)
  })

  it('the cap only guards the meal: keeping or swapping is never blocked', () => {
    nearCap()
    run().keep()
    run().removeFood('fries')
    run().swapKept()
    expect(run().meal).toEqual([
      { foodId: 'cheeseburger', servings: 2 },
      { foodId: 'fries', servings: 2 },
    ])
  })
})

describe('bare page', () => {
  it('opens the default meal when nothing is open, at time 0', () => {
    useClock.setState({ simMin: 300 })
    run().openDefault()
    expect(run().meal).toEqual(DEFAULT_MEAL)
    expect(run().kept).toBeNull()
    expect(useClock.getState().simMin).toBe(0)
  })

  it('keeps an open meal or kept run', () => {
    run().loadLink('v=2&a=roti:1')
    run().openDefault()
    expect(run().meal).toEqual(one('roti'))
    run().loadLink('v=2&b=milk:1')
    run().openDefault()
    expect(run().meal).toEqual([])
    expect(run().kept?.items).toEqual(one('milk'))
  })
})

describe('runs (hooks/useRun.ts)', () => {
  it('recomputes from inputs: the kept run has signals and moments but no dots', () => {
    const current = computeRun(engine, one('cola'), DEFAULT_RUN_PROFILE, 'current')
    const kept = computeRun(engine, one('cola'), DEFAULT_RUN_PROFILE, 'kept')
    expect(current.particles.length).toBeGreaterThan(0)
    expect(kept.particles).toHaveLength(0)
    expect(kept.signals.get('blood.glucose')).toBeDefined()
    expect(kept.moments.size).toBe(current.moments.size)
    expect([...kept.signals.get('blood.glucose')!.values]).toEqual([...current.signals.get('blood.glucose')!.values])
  })

  it('keys on contents and person, not on array identity', () => {
    expect(runKey(one('cola'), 'adult-ref')).toBe(runKey(one('cola'), 'adult-ref'))
    expect(runKey(one('cola'), 'adult-ref')).not.toBe(runKey([{ foodId: 'cola', servings: 2 }], 'adult-ref'))
  })
})
