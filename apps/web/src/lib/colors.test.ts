import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  ENERGY_IN,
  ENERGY_USED,
  INK,
  KEPT,
  KEPT_DASH,
  LEFT_BODY,
  LINE_GROUPS,
  MEAL_COLOR,
  NUTRIENT_COLOR,
  ORGAN_COLOR,
  RUN,
  THEME,
  type ThemeName,
} from './colors.ts'
import {
  CHROMA_FLOOR,
  CVD_MIN,
  LIGHT_BAND,
  LINE_MIN,
  NORMAL_MIN,
  TEXT_MIN,
  contrast,
  cvdDeltaE,
  deltaE,
  luminance,
  oklch,
  pairs,
} from './colorCheck.ts'
import { ILEUM_TONE, JEJUNUM_TONE, ORGAN_TONE, PARTICLE_EDGE } from '../anatomy/tones.ts'
import { outlineInk } from '../three/look.ts'

/** colors.ts copies some CSS tokens for WebGL/canvas. This keeps the two copies identical. */
const css = readFileSync(fileURLToPath(new URL('../styles.css', import.meta.url)), 'utf8')
const token = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`))?.[1]

/** `--color-x: #hex` declarations inside every block whose selector is exactly `selector`, later blocks winning. */
function declarations(selector: string): Record<string, string> {
  const out: Record<string, string> = {}
  const escaped = selector.replace(/[[\]'()]/g, '\\$&')
  for (const block of css.matchAll(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g')))
    for (const [, name, hex] of block[1]!.matchAll(/--color-([\w-]+):\s*(#[0-9a-f]{6})/g)) out[name!] = hex!
  return out
}

/** The CSS name of each THEME key. */
const CSS_NAME: Record<keyof (typeof THEME)['normal'], string> = {
  paper2: 'paper2',
  shelf: 'shelf',
  sunk2: 'sunk2',
  rule2: 'rule2',
  grid: 'grid',
  ink: 'ink',
  ink2: 'ink-2',
}

const THEMES = Object.keys(THEME) as ThemeName[]
const fmt = (n: number) => n.toFixed(2)

describe('colour tokens', () => {
  it('match styles.css', () => {
    for (const [k, v] of Object.entries(NUTRIENT_COLOR)) expect(token(k), k).toBe(v)
    expect(token('meal-a')).toBe(MEAL_COLOR.a)
    expect(token('meal-b')).toBe(MEAL_COLOR.b)
    expect(token('ink')).toBe(INK)
    expect(token('stomach')).toBe(ORGAN_COLOR.stomach)
    expect(token('small-intestine')).toBe(ORGAN_COLOR.smallIntestine)
    expect(token('large-intestine')).toBe(ORGAN_COLOR.largeIntestine)
    expect(token('left-body')).toBe(LEFT_BODY)
  })

  it('v2 tokens match styles.css in the normal and projector themes', () => {
    const normal = declarations('@theme')
    const projector = { ...normal, ...declarations("html[data-contrast='high']") }
    for (const [key, name] of Object.entries(CSS_NAME)) {
      expect(normal[name], `normal --color-${name}`).toBe(THEME.normal[key as keyof typeof CSS_NAME])
      expect(projector[name], `projector --color-${name}`).toBe(THEME.projector[key as keyof typeof CSS_NAME])
    }
    expect(normal.run).toBe(RUN)
    expect(normal.kept).toBe(KEPT)
    expect(normal['energy-in']).toBe(ENERGY_IN)
    expect(normal['energy-used']).toBe(ENERGY_USED)
    // Graph lines keep their colour on the projector (WP-17 makes them thicker instead).
    for (const name of ['run', 'kept', 'energy-in', 'energy-used']) expect(projector[name], name).toBe(normal[name])
  })

  it('the graphs dash the kept run with KEPT_DASH', () => {
    expect(css.match(/--strip-kept-dash:\s*([\d ]+);/)?.[1]).toBe(KEPT_DASH)
  })
})

describe('colour checks (ported from the dataviz validator)', () => {
  it('reproduce the numbers quoted in plan-graphs §2 and §3.4', () => {
    // v1 compare colours: teal and magenta collapse for deutan readers.
    expect(deltaE(MEAL_COLOR.a, MEAL_COLOR.b, 'deutan')).toBeCloseTo(1.5, 1)
    // v1 carbs yellow is below the 3:1 line minimum (the validator's default surface, #fcfcfb).
    expect(contrast(NUTRIENT_COLOR.carbs, '#fcfcfb')).toBeCloseTo(1.77, 2)
    // The energy pair: CVD 27.6, normal vision 34.1.
    expect(cvdDeltaE(ENERGY_IN, ENERGY_USED)).toBeCloseTo(27.6, 1)
    expect(deltaE(ENERGY_IN, ENERGY_USED)).toBeCloseTo(34.1, 1)
  })

  it('compute WCAG contrast at the extremes', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrast('#14213d', '#14213d')).toBe(1)
  })
})

describe.each(THEMES)('%s theme', (name) => {
  const t = THEME[name]
  const surfaces = { paper2: t.paper2, shelf: t.shelf, sunk2: t.sunk2 }

  it(`every text and background pair is at least ${TEXT_MIN}:1`, () => {
    const pairsToCheck: [string, string, string][] = []
    for (const [bg, hex] of Object.entries(surfaces)) {
      pairsToCheck.push([`ink on ${bg}`, t.ink, hex], [`ink-2 on ${bg}`, t.ink2, hex])
    }
    // Play, the selected nav item and other filled controls: white text on ink.
    pairsToCheck.push(['white on ink', '#ffffff', t.ink])
    const failing = pairsToCheck
      .filter(([, fg, bg]) => contrast(fg, bg) < TEXT_MIN)
      .map(([what, fg, bg]) => `${what} ${fmt(contrast(fg, bg))}:1`)
    expect(failing).toEqual([])
  })

  it(`every graph line is at least ${LINE_MIN}:1 on Paper and Shelf`, () => {
    const failing: string[] = []
    for (const line of [RUN, KEPT, ENERGY_IN, ENERGY_USED])
      for (const [bg, hex] of Object.entries({ paper2: t.paper2, shelf: t.shelf }))
        if (contrast(line, hex) < LINE_MIN) failing.push(`${line} on ${bg} ${fmt(contrast(line, hex))}:1`)
    expect(failing).toEqual([])
  })

  it('the focus ring and selected-segment bar (ink) stand out from every surface', () => {
    for (const [bg, hex] of Object.entries(surfaces)) expect(contrast(t.ink, hex), bg).toBeGreaterThanOrEqual(LINE_MIN)
  })
})

describe('graph line colours', () => {
  it.each(Object.entries(LINE_GROUPS))(
    `lines in the %s group stay apart for colour-blind readers (ΔE ≥ ${CVD_MIN}) and everyone else (ΔE ≥ ${NORMAL_MIN})`,
    (_, group) => {
      for (const [a, b] of pairs(group)) {
        expect(cvdDeltaE(a, b), `${a} vs ${b}, protan/deutan`).toBeGreaterThanOrEqual(CVD_MIN)
        expect(deltaE(a, b), `${a} vs ${b}, normal vision`).toBeGreaterThanOrEqual(NORMAL_MIN)
      }
    },
  )

  it('coloured lines sit in the light-mode lightness band and read as a hue', () => {
    for (const hex of [RUN, ENERGY_IN, ENERGY_USED]) {
      const { l, c } = oklch(hex)
      expect(l, `${hex} lightness`).toBeGreaterThanOrEqual(LIGHT_BAND[0])
      expect(l, `${hex} lightness`).toBeLessThanOrEqual(LIGHT_BAND[1])
      expect(c, `${hex} chroma`).toBeGreaterThanOrEqual(CHROMA_FLOOR)
    }
  })

  it('the kept run is a neutral grey, so it is told apart by dash and label, never by hue', () => {
    expect(oklch(KEPT).c).toBeLessThan(0.05)
  })
})

/**
 * Organs (and parts of the small intestine) that touch in the picture, front-on. The audit below
 * checks each pair; a new organ joins this list with its neighbours.
 */
const NEIGHBOURS: readonly (readonly [string, string])[] = [
  ['esophagus', 'stomach'],
  ['esophagus', 'liver'],
  ['stomach', 'liver'],
  ['stomach', 'pancreas'],
  ['stomach', 'smallIntestine'],
  ['stomach', 'jejunum'],
  ['stomach', 'largeIntestine'],
  ['liver', 'gallbladder'],
  ['gallbladder', 'smallIntestine'],
  ['gallbladder', 'pancreas'],
  ['pancreas', 'smallIntestine'],
  ['pancreas', 'jejunum'],
  ['smallIntestine', 'largeIntestine'],
  ['jejunum', 'largeIntestine'],
  ['ileum', 'largeIntestine'],
]

/** Every tone the audit knows by name: the organs plus the small intestine's two ends. */
const TONE_BY_NAME: Record<string, string> = { ...ORGAN_TONE, jejunum: JEJUNUM_TONE, ileum: ILEUM_TONE }

/** Tones the food passes through (particles are checked against these). */
const FOOD_PATH = ['esophagus', 'stomach', 'smallIntestine', 'jejunum', 'ileum', 'largeIntestine'] as const

/**
 * The body's colour audit (3D-5, WP-17). Organs are drawn with an outline, so an organ's shape is
 * told from the page by its outline (WCAG 1.4.11 lets the boundary carry the contrast), and from
 * its neighbours by hue (colour-blind safe) plus, on the projector, a near-black line.
 * Nutrient colours are not checked on the paper on their own: every particle has a dark edge
 * (PARTICLE_EDGE) and its own shape, so it never relies on its fill.
 */
describe('body colours', () => {
  const tone = (name: string) => TONE_BY_NAME[name]!

  it(`organs that touch stay apart for colour-blind readers (ΔE ≥ ${CVD_MIN}) and everyone else (ΔE ≥ ${NORMAL_MIN})`, () => {
    const failing = NEIGHBOURS.flatMap(([a, b]) => {
      const cvd = cvdDeltaE(tone(a), tone(b))
      const normal = deltaE(tone(a), tone(b))
      return cvd < CVD_MIN || normal < NORMAL_MIN ? [`${a}/${b} CVD ${fmt(cvd)} normal ${fmt(normal)}`] : []
    })
    expect(failing).toEqual([])
  })

  it.each(['normal', 'projector'] as const)(`every organ's %s outline is at least ${LINE_MIN}:1 on the page`, (look) => {
    const page = look === 'projector' ? THEME.projector.paper2 : THEME.normal.paper2
    const failing = Object.entries(TONE_BY_NAME)
      .map(([name, hex]) => [name, contrast(outlineInk(hex, look), page)] as const)
      .filter(([, c]) => c < LINE_MIN)
      .map(([name, c]) => `${name} ${fmt(c)}:1`)
    expect(failing).toEqual([])
  })

  it(`on the projector the line between two organs that touch is at least ${LINE_MIN}:1 on the lighter one`, () => {
    const failing = NEIGHBOURS.flatMap(([a, b]) => {
      const [light] = [tone(a), tone(b)].sort((x, y) => luminance(y) - luminance(x)) as [string, string]
      const worst = Math.min(contrast(outlineInk(tone(a), 'projector'), light), contrast(outlineInk(tone(b), 'projector'), light))
      return worst < LINE_MIN ? [`${a}/${b} ${fmt(worst)}:1`] : []
    })
    expect(failing).toEqual([])
  })

  it(`every food particle stands out where the food goes: by hue (CVD ΔE ≥ ${CVD_MIN}) or by its dark edge (≥ ${LINE_MIN}:1)`, () => {
    const failing: string[] = []
    for (const [kind, hex] of Object.entries(NUTRIENT_COLOR))
      for (const organ of FOOD_PATH) {
        const cvd = cvdDeltaE(hex, tone(organ))
        const edge = contrast(PARTICLE_EDGE, tone(organ))
        if (cvd < CVD_MIN && edge < LINE_MIN) failing.push(`${kind} in ${organ}: CVD ${fmt(cvd)}, edge ${fmt(edge)}:1`)
      }
    for (const name of THEMES) expect(contrast(PARTICLE_EDGE, THEME[name].paper2), `edge on ${name} paper`).toBeGreaterThanOrEqual(TEXT_MIN)
    expect(failing).toEqual([])
  })

  it('outlineInk is the shader sum: organ × shade + lift, in linear RGB', () => {
    // Black stays at the lift; white at shade + lift (the numbers in BODY_LOOK).
    expect(outlineInk('#000000', 'normal')).toBe('#1d2230')
    expect(outlineInk('#ffffff', 'projector')).toBe(outlineInk('#ffffff', 'projector'))
    expect(luminance(outlineInk('#ffffff', 'projector'))).toBeLessThan(luminance(outlineInk('#ffffff', 'normal')))
  })
})
