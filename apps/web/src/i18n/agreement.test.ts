import { describe, expect, it, vi } from 'vitest'
import i18n from 'i18next'
import { buildMeal, decodeMeal, simulate, type Simulation } from '@lifepeek/engine'
import hi from './hi.json'
import { FOODS, lookupFood } from '../data/foods.ts'
import { shortFoodName, shortMealNames } from '../components/stage/mealText.ts'
import { compareSummary, singleSummary } from '../lib/summary.ts'

/**
 * Hindi agreement with food names (FIX-F). Food names fill the meal placeholders, and Hindi verbs,
 * participles and many adjectives agree with their subject: "इडली … निकलती है" but "केला … निकलता
 * है", and "रोटी + दाल" is two foods. One fixed form is wrong for half the foods, so the sentences
 * are worded so that nothing agrees with the name: the name is a subject only of a predicate that
 * does not change (तेज़ है), or stands before a postposition (की तुलना में, को, में), or after a
 * label that ends in a noun (रखा गया भोजन: इडली). This file renders every such sentence with every
 * food and a few meals, and checks it.
 */

// The app's i18n setup needs a browser; the food names only need `localized`.
vi.mock('./index.ts', () => ({
  localized: (text: Record<string, string> | undefined, lang: string) => text?.[lang] ?? text?.en ?? '',
}))

const inst = i18n.createInstance()
await inst.init({ lng: 'hi', resources: { hi: { translation: hi } }, interpolation: { escapeValue: false } })
const t = inst.getFixedT('hi')

/** Words that agree with a subject: "-ता है", participles, "-ा/-ी" adjectives this app uses. */
const AGREEING = [
  /(ता|ती|ते)\s+(है|हैं|था|थी|थे)(?=[\s,।:)]|$)/,
  /(^|\s)(गया|गई|गए|चुका|चुकी|चुके|रहा|रही|रहे|हुआ|हुई|हुए|निकला|निकली|निकले|बड़ा|बड़ी|बड़े|धीमा|धीमी|धीमे)(?=[\s,।:)]|$)/,
]
/** After these the name is not the subject, so nothing agrees with it. */
const POSTPOSITION = /^\s*(का|की|के|को|में|से|पर|तक|और|द्वारा)(?=[\s,।:)]|$)/
/** A label that ends in a participle ("रखा गया: इडली", "इडली (रखा गया)") reads as agreeing with the name. */
const PARTICIPLE_LABEL = /(^|\s)(गया|गई|गए|हुआ|हुई|हुए|रखा|रखी|रखे|किया)\s*$/

/**
 * What is wrong in `text` around each place `name` stands. `others` are the other names in the
 * sentence: they are blanked out before a clause is read, so a word inside them ("पका हुआ") is not
 * taken for the sentence's own, and `name` inside a longer one ("चीज़बर्गर" in "चीज़बर्गर + फ़्रेंच
 * फ़्राइज़") is that one's business.
 */
function agreementProblems(text: string, name: string, others: readonly string[] = []): string[] {
  const problems: string[] = []
  const blank = (s: string) => others.reduce((acc, o) => (o && o !== name ? acc.split(o).join('X') : acc), s)
  const inside: [number, number][] = []
  for (const o of others)
    if (o.length > name.length && o.includes(name))
      for (let i = text.indexOf(o); i >= 0; i = text.indexOf(o, i + 1)) inside.push([i, i + o.length])
  for (let at = text.indexOf(name); at >= 0; at = text.indexOf(name, at + name.length)) {
    if (inside.some(([from, to]) => at >= from && at < to)) continue
    const before = text.slice(0, at).trimEnd()
    let after = text.slice(at + name.length)
    if (/[:(]$/.test(before) && PARTICIPLE_LABEL.test(blank(before.slice(0, -1))))
      problems.push(`label before "${name}" ends in a participle`)
    const paren = /^\s*\(([^)]*)\)/.exec(after)
    if (paren) {
      if (PARTICIPLE_LABEL.test(paren[1]!)) problems.push(`label after "${name}" ends in a participle`)
      after = after.slice(paren[0].length)
    }
    if (POSTPOSITION.test(after) || /^\s*([:)।]|$)/.test(after)) continue
    // The name is a subject: nothing in its clause may agree with it.
    const clause = blank(after).split(/[।:;]/)[0]!
    for (const re of AGREEING) {
      const m = re.exec(clause)
      if (m) problems.push(`"${name}" is the subject of "${m[0].trim()}"`)
    }
  }
  return problems
}

/** Short names (as the summary, legend and now line use them), full names and some meals. */
const FOOD_NAMES = FOODS.map((f) => f.name.hi ?? f.name.en)
const SHORT = FOOD_NAMES.map(shortFoodName)
const MEALS = ['रोटी ×2 + दाल', 'इडली + दाल', 'रोटी + दाल (मसूर)', 'कोला + चीज़बर्गर', 'चीज़बर्गर + फ़्रेंच फ़्राइज़ + …', 'इडली ×2']
const ALL = [...new Set([...SHORT, ...FOOD_NAMES, ...MEALS])]
const FEMININE = ['इडली', 'दाल', 'रोटी']

/**
 * Every Hindi template that is given a food or meal name, and its placeholders that take one.
 * Left out on purpose: `sim.overCap` gets only "यह भोजन" (its "बड़ा है" agrees with भोजन);
 * `dock.keptMarker` gets a moment's name.
 */
const TEMPLATES: Record<string, readonly string[]> = {
  'summary.single': ['meal'],
  'summary.singleWater': ['meal'],
  'summary.singleMore': ['meal'],
  'summary.singleWaterMore': ['meal'],
  'summary.similar': ['a', 'b'],
  'summary.faster': ['fast', 'slow'],
  'summary.fasterMore': ['fast', 'slow'],
  'summary.reasonDrink': ['fast'],
  'summary.reasonCalories': ['slow'],
  // The same food in two amounts (council round 3): the amount phrase, and the blood sugar sentence.
  'sameFood.amount': ['food'],
  'sameFood.oblique.amount': ['food'],
  'sameFood.bloodLonger': ['more', 'less'],
  'keep.tag': ['meal'],
  'keep.remove': ['meal'],
  'now.kept': ['meal'],
  'stage.bodyLabel': ['meal'],
  'table.thisMeal': ['meal'],
  'graph.halfEnergyLeftOf': ['meal'],
  'graph.halfLeftOf': ['meal'],
  'graph.highestOf': ['meal'],
}
const FIXED = { time: '2 घंटे', x: '3 गुना', kcalSlow: 900, kcalFast: 140, value: '140 mg/dL', count: 4 }

describe('Hindi agreement with food names (FIX-F)', () => {
  it('the checker catches the old wording with a feminine food', () => {
    const old = {
      faster: '{{fast}}, {{slow}} की तुलना में लगभग {{x}} तेज़ी से आमाशय से निकलता है।',
      similar: '{{a}} और {{b}} लगभग एक ही गति से आमाशय से निकलते हैं।',
      kept: '{{meal}} (रखा गया):',
      tag: 'रखा गया: {{meal}}',
    }
    const render = (s: string, v: Record<string, string>) =>
      s.replace(/{{(\w+)}}/g, (_, k: string) => v[k] ?? FIXED[k as keyof typeof FIXED].toString())
    for (const food of FEMININE) {
      expect(agreementProblems(render(old.faster, { fast: food, slow: 'चीज़बर्गर' }), food)).not.toEqual([])
      expect(agreementProblems(render(old.similar, { a: 'रोटी', b: food }), food)).not.toEqual([])
      expect(agreementProblems(render(old.kept, { meal: food }), food)).not.toEqual([])
      expect(agreementProblems(render(old.tag, { meal: food }), food)).not.toEqual([])
    }
  })

  it('every template, with every food and a few meals in each of its places, agrees', () => {
    const problems: string[] = []
    for (const [key, slots] of Object.entries(TEMPLATES)) {
      for (const slot of slots) {
        for (const name of ALL) {
          // The other places get a masculine food, so only `name` can be wrong.
          const values: Record<string, string> = Object.fromEntries(slots.map((s) => [s, s === slot ? name : 'चीज़बर्गर']))
          const text = t(key, { ...FIXED, ...values })
          if (!text.includes(name)) problems.push(`${key}: {{${slot}}} = "${name}" does not appear in "${text}"`)
          for (const p of agreementProblems(text, name, Object.values(values))) problems.push(`${key}: ${p} in "${text}"`)
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('the kept meal on the now line, followed by where it is, agrees for every food', () => {
    const where = ['now.in.mouth', 'now.in.mouthDrink', 'now.in.esophagus', 'now.in.done', 'now.in.stomach']
    for (const name of ALL)
      for (const w of where) {
        const text = `${t('now.kept', { meal: name })} ${t(w, { amount: t('now.amount.half') })}`
        expect(agreementProblems(text, name), text).toEqual([])
      }
  })
})

describe('the summary sentence in Hindi (FIX-F)', () => {
  const sims = new Map<string, Simulation>()
  const sim = (meal: string) => {
    if (!sims.has(meal)) sims.set(meal, simulate(buildMeal(decodeMeal(meal), lookupFood), { particles: 0 }))
    return sims.get(meal)!
  }
  const OTHERS = ['cheeseburger:1,fries:1', 'cola:1', 'roti:2,dal:1', 'idli:1,dal:1,milk:1']
  const texts = (s: { headline: string; reason?: string } | null) => (s ? [s.headline, s.reason ?? ''] : [])
  /** The meal as the sentence names it ("रोटी ×2 + दाल"); a meal of three foods is "this meal" instead. */
  const nameOf = (meal: string) => shortMealNames(decodeMeal(meal), 'hi')

  it('a meal name never has a verb or adjective agreeing with it, whether it is the faster or the slower meal', () => {
    const problems: string[] = []
    const check = (texts: string[], name: string, other = '') => {
      for (const text of texts) for (const p of agreementProblems(text, name, [other])) problems.push(`${p}: "${text}"`)
    }
    for (const food of FOODS) {
      const meal = `${food.id}:1`
      check(texts(singleSummary(sim(meal), t, 'hi')), nameOf(meal))
      // The same food in another amount: named by amount ("कोला के 4 हिस्से"), either way round.
      const short = shortFoodName(food.name.hi ?? food.name.en)
      check(texts(compareSummary(sim(meal), sim(`${food.id}:4`), t, 'hi')), short)
      check(texts(compareSummary(sim(`${food.id}:4`), sim(meal), t, 'hi')), short)
      for (const other of OTHERS) {
        for (const [run, kept] of [
          [meal, other],
          [other, meal],
        ]) {
          const words = texts(compareSummary(sim(run!), sim(kept!), t, 'hi'))
          check(words, nameOf(meal), nameOf(other))
          check(words, nameOf(other), nameOf(meal))
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('"this meal" and "the kept meal" take their oblique form before a postposition, and only there', () => {
    const direct = /(यह|रखा गया) भोजन\s*(का|की|के|को|में|से|और)(?=[\s,।]|$)/
    const oblique = /(इस|रखे गए) भोजन(?!\s*(का|की|के|को|में|से|और)(?=[\s,।]|$))/
    // Three foods, or the same foods in both: the sentence says "this meal" and "the kept meal".
    const pairs = [
      ['idli:1,dal:1,milk:1', 'cola:1'],
      ['cola:1', 'idli:1,dal:1,milk:1'],
      ['cola:1', 'cola:1'],
      ['roti:2,dal:1,milk:1', 'cheeseburger:1,fries:1,cola:1'],
      ['cheeseburger:1,fries:1,cola:1', 'water:1'],
      ['water:1', 'cheeseburger:1,fries:1,cola:1'],
    ]
    const seen: string[] = []
    for (const [run, kept] of pairs) {
      for (const text of [...texts(compareSummary(sim(run!), sim(kept!), t, 'hi')), ...texts(singleSummary(sim(run!), t, 'hi'))]) {
        if (!text) continue
        seen.push(text)
        expect(text, text).not.toMatch(direct)
        expect(text, text).not.toMatch(oblique)
      }
    }
    // The cases above really use both names, in both forms.
    expect(seen.some((s) => s.includes('इस भोजन'))).toBe(true)
    expect(seen.some((s) => s.includes('रखे गए भोजन'))).toBe(true)
    expect(seen.some((s) => s.startsWith('यह भोजन') || s.startsWith('रखा गया भोजन'))).toBe(true)
  })
})
