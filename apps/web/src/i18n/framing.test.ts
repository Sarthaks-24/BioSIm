import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import en from './en.json'
import hi from './hi.json'

/**
 * The framing lint (G10, plan-graphs §3.8): no screen text may score a food or a body. Blood
 * sugar is "highest" and "back near the before-meal level", never a spike or a crash; energy is
 * described ("When more comes in than is used, the body stores the extra for later"), never
 * something to burn off; no food is bad, junk or dangerous. A 13-year-old reads a label as a
 * verdict on what they ate, so these words are banned outright, not left to review.
 *
 * Matching is whole-word and case-insensitive, over every string in en.json, hi.json and the
 * food files (content/foods/*.json, both languages). A `stem*` entry matches every word that starts
 * with the stem ("dehydrat*": dehydrated, dehydration). I-1 (content-i18n §6) adds the v3 words,
 * stems, the activity rule and the scoped words (English; the Hindi list waits for the reviewer, R47).
 */

/** English: the plan's list, with the inflections a translator would reach for. */
const BANNED_EN = [
  'spike',
  'spikes',
  'spiked',
  'spiking',
  'crash',
  'crashes',
  'crashed',
  'crashing',
  'sugar rush',
  'sugar high',
  'bad',
  'unhealthy',
  'danger',
  'dangers',
  'dangerous',
  'junk',
  'junk food',
  'burn off',
  'burns off',
  'burned off',
  'burnt off',
  'burning off',
  'burn it',
  'burn it off',
  'burn them off',
  'work it off',
  // Activity (model §2.1 lint, E-3b-eng): moving is described ("energy used by moving"), never
  // something food is "burned" by, "worked off" or "earned" with.
  'burn',
  'burns',
  'burned',
  'burnt',
  'burning',
  'calories burned',
  'calories burnt',
  'work off',
  'works off',
  'worked off',
  'working off',
  'earn',
  'earns',
  'earned',
  'earning',
  'fat-burning',
  'fat burning',
  // v3 systems (content-i18n §6, I-1): no weight-loss, detox, hydration or immunity claims, no
  // diagnosis words, and nothing that reads a number as "your" body's.
  'burn calories',
  'fat burning zone',
  'fat loss',
  'lose weight',
  'weight loss',
  'belly fat',
  'flush out',
  'detox*',
  'cleanse',
  'cleanses',
  'cleansing',
  'toxin',
  'toxins',
  'hydrating',
  'stay hydrated',
  'you should drink',
  'immunity booster',
  'boost immunity',
  'boosts immunity',
  // Germ defence (model §2.11, A-11a): the card says what white cells do, never that a food or a
  // drink "boosts" them (a common claim in India); no immunity score either.
  'immunity boost*',
  'immune boost*',
  'immunity-boost*',
  'immune-boost*',
  'boost your immunity',
  'boosts your immunity',
  'boosting immunity',
  'boost the immune system',
  'boosts the immune system',
  'superfood*',
  'brain food',
  'sugar for the brain',
  'glucose spike',
  'insulin spike',
  'fat-storing hormone',
  'insulin resistance',
  'pre-diabetic',
  'prediabet*',
  'reverse diabetes',
  'abnormal',
  'dirty',
  'impure',
  'unclean',
  'pee',
  'normal for you',
  'your heart rate is',
  // Reproduction (R-1, model §2.12, content-i18n §6): the panels show the books' typical cycle, never
  // a tracker, a fertile window, a prediction or anyone's own cycle, and no shame words (above).
  'fertile window',
  'fertile days',
  'fertility window',
  'fertility awareness',
  'period tracker',
  'cycle tracker',
  'period app',
  'track your period',
  'track your cycle',
  'safe days',
  'safe period',
  'unsafe days',
  'ovulation calculator',
  'ovulation predictor',
  'period calculator',
  'due date',
  'your cycle',
  'your period',
  'your next period',
  'your periods',
  'your ovulation',
  'next period',
]

/**
 * Words allowed only in some places (content-i18n §6): "dehydrated" only in the Science page's
 * text and the known limits ("*.limits.*"), never as a screen label; bare "flush" never in the
 * kidneys' words ("flush out" is banned everywhere, above).
 */
const SCOPED: readonly { phrase: string; allowed: (path: string) => boolean }[] = [
  { phrase: 'dehydrat*', allowed: (path) => path.startsWith('science.') || /(^|\.)limits\./.test(path) },
  // U-4: the kidneys' graph and moment texts too (their keys are fixed by the engine's catalog).
  { phrase: 'flush', allowed: (path) => !/^(sys\.kidneys|signals\.kidney|signals\.water)\./.test(path) },
  // R-1: in Reproduction's words (its pack and its lesson), nothing that tracks, predicts or dates a
  // cycle, and no fertility at all ("tracker" stays allowed in the privacy page's "any other tracker").
  ...['fertil*', 'track*', 'predict*', 'calculat*', 'calendar*', 'date', 'dates', 'safe', 'unsafe', 'remind*'].map((phrase) => ({
    phrase,
    allowed: (path: string) => !/^(sys\.reproduction\.|teach\.(lessons|lessonQuestions)\.cycleHormones$|keys\.growingUp)/.test(path),
  })),
]

/**
 * The activity rule (content-i18n §6): moving is described in time and effort, never as food energy
 * to pay back, so no activity text (an `activity.*` key, or a text with an `{{activity}}`) names kcal.
 */
const ACTIVITY_KCAL = /kcal|किलो कैलोरी|कैलोरी/i
const isActivityText = (path: string, text: string) => /(^|\.)activity\./.test(path) || /\{\{\s*activity\w*\s*\}\}/.test(text)
const activityKcal = (file: string, entries: [string, string][]) =>
  entries.filter(([path, text]) => isActivityText(path, text) && ACTIVITY_KCAL.test(text)).map(([path]) => `${file} › ${path}`)

/** "file › path: phrase" for every scoped word found outside its place. */
const findScoped = (file: string, entries: [string, string][]) =>
  SCOPED.flatMap(({ phrase, allowed }) =>
    findBanned(
      file,
      entries.filter(([path]) => !allowed(path)),
      [phrase],
    ),
  )

/**
 * Hindi: bad, harmful, dangerous (with and without the nukta) and "burn", until the Hindi reviewer
 * adds the rest of the list (03 WP-13; i18n/REVIEW.md asks for it).
 */
const BANNED_HI = [
  'खराब',
  'ख़राब',
  'हानिकारक',
  'खतरनाक',
  'ख़तरनाक',
  // "burn" (calories): जलाना and its forms (model §2.1 lint "also Hindi"; for the reviewer to extend).
  'जलाना',
  'जलाने',
  'जलाता',
  'जलाती',
  'जलाते',
  'जलाएँ',
  'जलाओ',
  'जलाई',
  // Germ defence (model §2.11, council lymph-immune-repro): no "immunity-raising" drinks or foods.
  'काढ़ा',
  'काढ़े',
  'इम्यूनिटी बढ़ा*',
  'इम्युनिटी बढ़ा*',
  'रोग प्रतिरोधक क्षमता बढ़ा*',
]

/**
 * A word or phrase as a whole-word, case-insensitive pattern. `\b` only knows ASCII letters, so
 * the edges are "no letter, mark or digit on either side" in Unicode terms: Devanagari vowel
 * signs are marks, so "खराबी" does not hide a "खराब" and "badge" never matches "bad".
 */
function bannedPattern(phrase: string): RegExp {
  const stem = phrase.endsWith('*')
  const body = (stem ? phrase.slice(0, -1) : phrase)
    .normalize('NFC')
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  // A stem may go on with any letters; a word or phrase ends where the letters do.
  const end = stem ? '' : '(?![\\p{L}\\p{M}\\p{N}])'
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${body}${end}`, 'iu')
}

/** Every string in a JSON value, with its path ("graph.highest", "name.hi"). */
function strings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`))
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => strings(v, path ? `${path}.${k}` : k))
  return []
}

/** "file › path: phrase" for every banned phrase found in the strings. */
function findBanned(file: string, entries: [string, string][], phrases: readonly string[]): string[] {
  const patterns = phrases.map((p) => [p, bannedPattern(p)] as const)
  const hits: string[] = []
  for (const [path, text] of entries) {
    const t = text.normalize('NFC')
    for (const [phrase, re] of patterns) if (re.test(t)) hits.push(`${file} › ${path}: "${phrase}"`)
  }
  return hits
}

const ALL = [...BANNED_EN, ...BANNED_HI]
const foodsDir = fileURLToPath(new URL('../../../../content/foods/', import.meta.url))
const foodFiles = readdirSync(foodsDir).filter((f) => f.endsWith('.json'))

describe('framing lint: no banned words on screen', () => {
  it('matches whole words only, ignoring case, in both scripts', () => {
    expect(bannedPattern('bad').test('A Bad meal')).toBe(true)
    expect(bannedPattern('bad').test('badge, Baden')).toBe(false)
    expect(bannedPattern('burn off').test('to burn  it off')).toBe(false)
    expect(bannedPattern('burn it off').test('Burn it off!')).toBe(true)
    expect(bannedPattern('sugar rush').test('a sugar\nrush')).toBe(true)
    expect(bannedPattern('खराब').test('यह खराब है')).toBe(true)
    expect(bannedPattern('खराब').test('खराबी')).toBe(false)
    // The nukta written as one letter or as two (NFC keeps it as two).
    expect(bannedPattern('ख़राब').test('ख़राब')).toBe(true)
  })

  it('en.json has none', () => {
    expect(findBanned('en.json', strings(en), ALL)).toEqual([])
  })

  it('hi.json has none (Hindi and any English left in it)', () => {
    expect(findBanned('hi.json', strings(hi), ALL)).toEqual([])
  })

  it('the food files have none', () => {
    expect(foodFiles.length).toBeGreaterThan(0)
    const hits = foodFiles.flatMap((f) => findBanned(f, strings(JSON.parse(readFileSync(foodsDir + f, 'utf8'))), ALL))
    expect(hits).toEqual([])
  })

  it('would catch a banned word slipped into a string', () => {
    const planted: [string, string][] = [
      ['a', 'Cola gives a sugar spike'],
      ['b', 'Walk to burn it off'],
      ['c', 'यह भोजन हानिकारक है'],
    ]
    const caught = new Set(findBanned('test', planted, ALL).map((hit) => hit.split(':')[0]))
    expect([...caught]).toEqual(['test › a', 'test › b', 'test › c'])
  })
})

describe('framing lint: stems, scoped words and the activity rule (content-i18n §6, I-1)', () => {
  const sources: [string, [string, string][]][] = [
    ['en.json', strings(en)],
    ['hi.json', strings(hi)],
    ...foodFiles.map((f) => [f, strings(JSON.parse(readFileSync(foodsDir + f, 'utf8')))] as [string, [string, string][]]),
  ]

  it('a stem matches every word that starts with it, and only at a word start', () => {
    expect(bannedPattern('dehydrat*').test('Dehydration')).toBe(true)
    expect(bannedPattern('dehydrat*').test('feeling dehydrated')).toBe(true)
    expect(bannedPattern('dehydrat*').test('rehydrate')).toBe(false)
    expect(bannedPattern('detox*').test('a detoxing drink')).toBe(true)
  })

  it('scoped words appear only where they may', () => {
    expect(sources.flatMap(([file, entries]) => findScoped(file, entries))).toEqual([])
  })

  it('no activity text names kcal', () => {
    expect(sources.flatMap(([file, entries]) => activityKcal(file, entries))).toEqual([])
  })

  it('would catch a v3 word, a scoped word out of place and an activity text in kcal', () => {
    const planted: [string, string][] = [
      ['a', 'Sweating helps you lose weight'],
      ['b', 'Normal for you is 70'],
      ['science.water', 'If you are dehydrated, the kidneys keep water'],
      ['sys.kidneys.now.idle', 'You are dehydrated'],
      ['sys.kidneys.now.busy', 'The kidneys flush the blood'],
      ['sys.circulation.now', 'The heart can flush blood fast'],
      ['activity.sheet.walk', 'A walk uses 120 kcal'],
      ['sys.effort.now', '{{activity}} for 20 min: about 90 kcal'],
      ['energy.activityRate', 'Energy used by moving, in kcal/h'],
    ]
    expect(findBanned('test', planted, ALL).map((hit) => hit.split(':')[0])).toEqual(['test › a', 'test › b'])
    // The germ-defence words (model §2.11), in both languages; the card's own lines pass.
    const immunity: [string, string][] = [
      ['a', 'Haldi milk is an immunity booster'],
      ['b', 'Amla boosts immunity'],
      ['c', 'An immune-boosting drink'],
      ['d', 'रोज़ काढ़ा पिएँ'],
      ['e', 'यह इम्यूनिटी बढ़ाए'],
      ['f', 'रोग प्रतिरोधक क्षमता बढ़ाने वाला खाना'],
      ['sys.lymph.card.barrier.text', en.sys.lymph.card.barrier.text],
      ['sys.lymph.card.memory.text', en.sys.lymph.card.memory.text],
    ]
    expect([...new Set(findBanned('test', immunity, ALL).map((hit) => hit.split(':')[0]))]).toEqual([
      'test › a',
      'test › b',
      'test › c',
      'test › d',
      'test › e',
      'test › f',
    ])
    expect(findScoped('test', planted).map((hit) => hit.split(':')[0])).toEqual([
      'test › sys.kidneys.now.idle',
      'test › sys.kidneys.now.busy',
    ])
    expect(activityKcal('test', planted)).toEqual(['test › activity.sheet.walk', 'test › sys.effort.now'])
  })

  it('would catch the insulin and brain words (content-i18n §6, U-6); the hormones pack’s own lines pass', () => {
    const planted: [string, string][] = [
      ['a', 'Cola gives an insulin spike'],
      ['b', 'Then comes the sugar crash'],
      ['c', 'Insulin is the fat-storing hormone'],
      ['d', 'This shows insulin resistance'],
      ['e', 'Cola is sugar for the brain'],
      ['sys.control.notGuide', en.sys.control.notGuide],
      ['sys.control.summary.peak', en.sys.control.summary.peak],
      ['sys.control.brain.value', en.sys.control.brain.value],
      ['limits.insulinHealthy', en.limits.insulinHealthy],
    ]
    expect([...new Set(findBanned('test', planted, ALL).map((hit) => hit.split(':')[0]))]).toEqual([
      'test › a',
      'test › b',
      'test › c',
      'test › d',
      'test › e',
    ])
  })

  it('would catch a tracker, fertility or own-cycle word (R-1, model §2.12); the reproduction pack’s own lines pass', () => {
    const planted: [string, string][] = [
      ['a', 'Know your fertile window'],
      ['b', 'Use a period tracker'],
      ['c', 'Your next period comes on day 28'],
      ['d', 'These are the safe days'],
      ['sys.reproduction.x', 'Track the days'],
      ['sys.reproduction.y', 'We predict the day'],
      ['sys.reproduction.z', 'Fertility is highest here'],
      ['privacy.analytics', 'We do not use any other tracker.'],
      ...Object.entries(en.sys.reproduction.cycle)
        .filter((e): e is [string, string] => typeof e[1] === 'string')
        .map(([k, v]) => [`sys.reproduction.cycle.${k}`, v] as [string, string]),
      ['sys.reproduction.height.example', en.sys.reproduction.height.example],
    ]
    expect([...new Set(findBanned('test', planted, ALL).map((hit) => hit.split(':')[0]))]).toEqual([
      'test › a',
      'test › b',
      'test › c',
      'test › d',
    ])
    expect([...new Set(findScoped('test', planted).map((hit) => hit.split(':')[0]))].sort()).toEqual([
      'test › sys.reproduction.x',
      'test › sys.reproduction.y',
      'test › sys.reproduction.z',
    ])
  })
})
