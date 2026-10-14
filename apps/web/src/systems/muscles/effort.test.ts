import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { TFunction } from 'i18next'
import { valueAt, type ActivityBout, type MealItem, type RunResult } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import en from '../../i18n/en.json'
import { lookupFood } from '../../data/foods.ts'
import { FRAMINGS, HEAD as BASE_HEAD } from '../../anatomy/human/base.ts'
import { ACTIVITY_BANDS, type ActivityBand } from '../../anatomy/human/bands.ts'
import { KNEE_U } from '../../anatomy/human/limbs.ts'
import { PELVIS as SKELETON_PELVIS, RIBS as SKELETON_RIBS, SPINE } from '../../anatomy/human/skeleton.ts'
import { PELVIS, RIB_ROWS, SPINE_Y } from '../../anatomy/human/bones.ts'
import { LABELS as MUSCLE_LABELS, TRUNK_MUSCLES, WORKING } from '../../anatomy/human/muscles.ts'
import { DROPS, HEAD, MAX_DROPS } from '../../anatomy/human/skin.ts'
import { CALLOUTS, layoutCallouts, type CalloutInput } from '../../anatomy/callouts.ts'
import { FADE_TONE } from '../../anatomy/tones/base.ts'
import { MUSCLES_TONE } from '../../anatomy/tones/muscles.ts'
import { SKIN_TONE } from '../../anatomy/tones/skin.ts'
import { FLAT_LOOK } from '../../flat/look.ts'
import { loadLimbs } from '../../flat/registry.ts'
import { activityBandAt } from '../../lib/bouts.ts'
import { luminance } from '../../lib/colorCheck.ts'
import { formatSignal } from '../../lib/formatSignal.ts'
import {
  HATCH_BOUNDS,
  doingAt,
  dropCount,
  hatchStep,
  lastKindAt,
  peakOf,
  seriesOf,
  stepOf,
  timesRest,
  valueText,
  vesselsWide,
} from './effort.ts'
import { MUSCLES_LESSON, SKIN_LESSON } from './lesson.ts'
import { effortStripSummary, musclesSummary, skinSummary } from './summary.ts'
import { LOOK, frameOf, lighter, posedLabels, seen, type Posed } from './paint.ts'

// The flat body's frame, without its drawing code's page APIs (FlatBody imports the stage).
vi.mock('../../i18n/index.ts', () => ({ localized: () => '' }))
const { frame } = await import('../../flat/FlatBody.tsx')
const { muscleShapes } = await import('./drawing.tsx')
const { dropPlaces } = await import('../skin/SkinLayer.tsx')

/** English text at a key, filled like i18next ({{x}}). */
const t = ((key: string, vars: Record<string, unknown> = {}) => {
  const text = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)
  return typeof text === 'string' ? text.replace(/{{(\w+)}}/g, (_, v: string) => String(vars[v])) : key
}) as unknown as TFunction

const roti: MealItem[] = [{ foodId: 'roti', servings: 1 }]
const run = (activity: ActivityBout[] = [], items = roti): RunResult => simulate({ items, activity }, { lookup: lookupFood, particles: 0 })
const at = (r: RunResult, id: string, min: number) => valueAt(seriesOf(r, id)!, min, r.stepMin)
const bout = (kind: ActivityBout['kind'], durMin = 20): ActivityBout => ({ kind, startMin: 30, durMin })

/** The band's posed limbs, as the layers get them from the legs' chunk (paint.ts usePosed). */
const limbs = await loadLimbs()
const posedFor = (band: ActivityBand): Posed => ({
  limbs: limbs.posedLimbs(band),
  base: limbs.limbKit(),
  legRadius: limbs.legRadius,
  figure: limbs.figure(band),
  blocker: (f) => limbs.armBlocker(band, f),
})

describe('muscles and skin move only with walking or running (R75)', () => {
  it('a meal alone moves neither: every food at rest gives the same flat lines', () => {
    for (const items of [roti, [{ foodId: 'cola', servings: 1 }], []] as MealItem[][]) {
      const r = run([], items)
      for (const id of ['muscle.energyRate', 'skin.sweatRate']) {
        const s = seriesOf(r, id)!
        expect(Math.max(...s.values) - Math.min(...s.values), id).toBeLessThan(1e-9)
      }
      expect(musclesSummary(r, null, t, 'en')!.headline).toBe(t('sys.effort.muscles.summary.rest'))
      expect(skinSummary(r, null, t, 'en')!.headline).toBe(t('sys.effort.skin.summary.rest'))
    }
    expect(t('sys.effort.moves')).toBe('Moves only with walking or running.')
  })

  it('rest and each kind of bout visibly differ: one hatch step each, more drops, the vessels widen', () => {
    const steps = ['walk', 'walkBrisk', 'run'].map((k) => hatchStep(at(run([bout(k as never)]), 'muscle.energyRate', 45)))
    expect(hatchStep(at(run(), 'muscle.energyRate', 45))).toBe(0)
    expect(steps).toEqual([1, 2, 3])
    const drops = ['walk', 'walkBrisk', 'run'].map((k) => dropCount(at(run([bout(k as never)]), 'skin.sweatRate', 45)))
    expect(dropCount(at(run(), 'skin.sweatRate', 45))).toBe(0)
    expect(drops[0]).toBeGreaterThanOrEqual(3)
    expect(drops[0]).toBeLessThan(drops[1]!)
    expect(drops[2]).toBe(MAX_DROPS)
    expect(vesselsWide(at(run(), 'skin.sweatRate', 45))).toBe(false)
    expect(vesselsWide(at(run([bout('walk')]), 'skin.sweatRate', 45))).toBe(true)
  })
})

describe('data → picture, scrub-safe (anatomy plan §2.4, §2.5, §4)', () => {
  it('a value near a step’s edge never flickers: it must pass the edge by 8 % to change step', () => {
    const b = HATCH_BOUNDS[1]!
    let step = hatchStep(b * 0.9, 1)
    for (const v of [b * 1.01, b * 0.99, b * 1.05, b * 0.95]) step = hatchStep(v, step)
    expect(step).toBe(1)
    expect(hatchStep(b * 1.1, step)).toBe(2)
    expect(hatchStep(b * 0.95, 2)).toBe(2)
    expect(hatchStep(b * 0.9, 2)).toBe(1)
    // A jump far past several edges goes straight there.
    expect(stepOf(1000, HATCH_BOUNDS, 0)).toBe(3)
    expect(stepOf(0, HATCH_BOUNDS, 3)).toBe(0)
  })

  it('drops: at most 12, one per 80 mL an hour, none at rest; a quarter drop of hysteresis', () => {
    expect(dropCount(0)).toBe(0)
    expect(dropCount(5000)).toBe(12)
    expect(dropCount(330)).toBe(4)
    expect(dropCount(370, 4)).toBe(4)
    expect(dropCount(400, 4)).toBe(5)
    expect(dropCount(15, 1)).toBe(0)
    expect(DROPS).toHaveLength(12)
  })

  it('the working muscles’ lightness step is under 10 % relative luminance; nothing changes colour', () => {
    const [a, b] = [luminance(MUSCLES_TONE.muscle), luminance(rgbHex(lighter(MUSCLES_TONE.muscle, 0.03)))]
    expect(b / a - 1).toBeGreaterThan(0)
    expect(b / a - 1).toBeLessThan(0.1)
  })

  it('skin is never red with heat: sweat is blue, and no tone of skin’s depends on sweat but the vessels’ width', () => {
    const red = (hex: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]
      return r > 150 && r > g * 1.6 && r > b * 1.6
    }
    expect(red(SKIN_TONE.sweat)).toBe(false)
    expect(red(SKIN_TONE.rim)).toBe(false)
    // The thermometer card draws in ink and a cool blue (systems/muscles/ui.tsx), never a red tone.
    const ui = readFileSync(new URL('./ui.tsx', import.meta.url), 'utf8')
    const thermometer = ui.slice(ui.indexOf('function Thermometer'), ui.indexOf('function StripNote'))
    for (const hex of thermometer.match(/#[0-9a-f]{6}/gi) ?? []) expect(red(hex), hex).toBe(false)
    expect(thermometer).not.toMatch(/red|danger|warn/i)
  })

  it('what the body is doing and which bout the muscles just worked in', () => {
    const bouts = [bout('walk'), { kind: 'run', startMin: 100, durMin: 10 } as ActivityBout]
    for (const min of [0, 30, 45, 49.9, 50, 101, 200]) expect(doingAt(bouts, min)).toBe(activityBandAt(bouts, min))
    expect(lastKindAt(bouts, 10)).toBeNull()
    expect(lastKindAt(bouts, 55)).toBe('walk')
    expect(lastKindAt(bouts, 120)).toBe('run')
    expect(timesRest(13.5, 13.5)).toBe(1)
    expect(timesRest(580, 13.5)).toBe(43)
  })
})

describe('the pack shares no code with the stage: what it writes out matches the original', () => {
  it('the frame, the outline look, the limbs’ perspective, the head and the bone landmarks', () => {
    for (const [w, h] of <[number, number][]>[
      [360, 170],
      [1280, 600],
    ])
      for (const view of Object.values(FRAMINGS)) {
        const [a, b] = [frameOf(w, h, view), frame(w, h, view)]
        expect([a.scale, a.X(0.4), a.Y(1.2)]).toEqual([b.scale, b.X(0.4), b.Y(1.2)])
      }
    for (const look of ['normal', 'projector'] as const)
      expect({ ink: LOOK[look].ink, line: LOOK[look].line }).toEqual({ ink: FLAT_LOOK[look].ink, line: FLAT_LOOK[look].line })
    expect(LOOK.projector.pale).toBe(3)
    const limbsSource = readFileSync(new URL('../../flat/limbs.ts', import.meta.url), 'utf8')
    expect(limbsSource).toMatch(/const DEPTH = 30\b/)
    expect(limbsSource).toMatch(/const EYE_Y = 1\.0\b/)
    expect(seen({ x: 0.5, y: 2, z: 0 })).toEqual({ x: 0.5, y: 2, s: 1 })
    expect(HEAD).toEqual(BASE_HEAD)
    expect(MUSCLES_TONE.ghost).toBe(FADE_TONE)
    expect(SPINE_Y).toEqual(SPINE.points.map((p) => p.y))
    expect(RIB_ROWS.map(([y]) => y)).toEqual(SKELETON_RIBS.map((c) => c.getPointAt(0).y))
    expect(PELVIS).toEqual(SKELETON_PELVIS)
    expect(readFileSync(new URL('../bones/BonesLayer.tsx', import.meta.url), 'utf8')).toMatch(/const KNEE_U = 2\.15 \/ 4\.45/)
    expect(2.15 / 4.45).toBe(KNEE_U)
  })

  it('numbers with their units, as the stage writes them (kcal/h, mL, mL an hour: R75)', () => {
    const r = run([bout('run', 10)])
    for (const id of ['muscle.energyRate', 'skin.sweatRate', 'skin.sweatTotal']) {
      const s = seriesOf(r, id)!
      for (const v of [s.values[0]!, peakOf(s, r.stepMin).value, 0])
        expect(valueText(v, s.meta, t, 'en')).toBe(formatSignal(v, s.meta, t, 'en'))
    }
    expect(formatSignal(330, seriesOf(r, 'skin.sweatRate')!.meta, t, 'en')).toBe('330 mL an hour')
  })
})

describe('the pictures follow the pose (R32, U-1a)', () => {
  const inFull = ([x, y]: readonly [number, number]) =>
    x >= FRAMINGS.full.minX - 0.3 && x <= FRAMINGS.full.maxX + 0.3 && y >= FRAMINGS.full.minY && y <= FRAMINGS.full.maxY

  it('about twelve muscle groups on both sides in every pose, inside the full framing; the limbs’ move with the band', () => {
    const groups = new Set(muscleShapes(posedFor('rest')).flatMap((s) => (s.kind === 'muscle' ? [s.group] : [])))
    expect(groups.size).toBe(12)
    const thigh = (band: ActivityBand) => muscleShapes(posedFor(band)).filter((s) => s.kind === 'muscle' && s.group === 'thighFront')
    for (const band of ACTIVITY_BANDS) {
      const shapes = muscleShapes(posedFor(band))
      for (const s of shapes) for (const p of s.pts) expect(inFull(p), `${band} ${s.kind}`).toBe(true)
      // An arm in front (a brisk walk, a run) hides what is under it before its own muscles are drawn.
      expect(shapes.filter((s) => s.kind === 'clear')).toHaveLength(posedFor(band).figure.over.length)
      expect(thigh(band)).toHaveLength(2)
    }
    // The run's front thigh is lifted: its muscle's lowest point is well above the standing one's.
    const lifted = (band: ActivityBand) => Math.max(...thigh(band).map((s) => Math.min(...s.pts.map(([, y]) => y))))
    expect(lifted('run')).toBeGreaterThan(lifted('rest') + 0.3)
    // The trunk's groups are the same in every pose.
    expect(TRUNK_MUSCLES.map((m) => m.group)).toEqual(['neck', 'chest', 'belly', 'sideBelly', 'hip'])
  })

  it('the working groups grow with the kind: legs, then arms too, then the belly too', () => {
    expect(WORKING.walk.every((g) => WORKING.walkBrisk.includes(g))).toBe(true)
    expect(WORKING.walkBrisk.every((g) => WORKING.run.includes(g))).toBe(true)
    expect(WORKING.walk).not.toContain('forearm')
    expect(WORKING.run).toContain('belly')
  })

  it('12 drop places, inside the picture; the arms’ drops move with the pose', () => {
    const [rest, runPose] = [dropPlaces(posedFor('rest')), dropPlaces(posedFor('run'))]
    expect(rest).toHaveLength(12)
    for (const p of [...rest, ...runPose]) expect(inFull(p)).toBe(true)
    const moved = rest.filter((p, i) => Math.hypot(p[0] - runPose[i]![0], p[1] - runPose[i]![1]) > 0.05)
    expect(moved.length).toBe(DROPS.filter((d) => 'arm' in d).length)
  })

  it('limb labels follow their limb: the leg muscles’ anchor lifts with the run’s thigh', () => {
    const rest = posedLabels(MUSCLE_LABELS, posedFor('rest'), { legs: { limb: 'leg', side: 1, u: 0.25 } })
    const runL = posedLabels(MUSCLE_LABELS, posedFor('run'), { legs: { limb: 'leg', side: 1, u: 0.25 } })
    expect(rest.legs.anchor.y).toBeCloseTo(MUSCLE_LABELS.legs.anchor.y, 0)
    expect(runL.legs.anchor.y).toBeGreaterThan(rest.legs.anchor.y + 0.2)
    expect(runL.belly).toEqual(MUSCLE_LABELS.belly)
  })
})

describe('labels avoid posed arms (R89)', () => {
  /** Digestion's labels in the torso view on a 1280 × 800 projector's body (≈ 560 px tall), as the flat body places them. */
  function torsoLabels(band: ActivityBand, avoidArms: boolean) {
    const [w, h] = [720, 560]
    const { X, Y } = frame(w, h, FRAMINGS.torso)
    const items: CalloutInput[] = (['esophagus', 'stomach', 'smallIntestine', 'largeIntestine', 'liver', 'pancreas'] as const).map(
      (key, i) => {
        const c = CALLOUTS[key]
        return {
          key,
          ax: X(c.anchor.x),
          ay: Y(c.anchor.y),
          lx: X(c.at.x),
          ly: Y(c.at.y),
          side: c.side,
          w: 70 + 6 * i,
          h: 24,
          priority: key === 'stomach' ? 3 : 2,
        }
      },
    )
    const arms = limbs.figure(band).over.map((pts) => pts.map(([x, y]) => [X(x), Y(y)] as const))
    return { arms, layout: layoutCallouts(items, w, h, avoidArms ? limbs.armBlocker(band, { X, Y }) : undefined) }
  }
  const inside = (px: number, py: number, poly: readonly (readonly [number, number])[]) => {
    let hit = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]!
      const [xj, yj] = poly[j]!
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit
    }
    return hit
  }
  const covered = (b: { x: number; y: number; w: number; h: number }, arms: readonly (readonly (readonly [number, number])[])[]) =>
    arms.some((poly) => {
      for (let x = b.x; x <= b.x + b.w; x += 3) for (let y = b.y; y <= b.y + b.h; y += 3) if (inside(x, y, poly)) return true
      return false
    })

  it('a run’s forward arm sits under a label without it; with it, no label covers the arm and none is lost', () => {
    const before = torsoLabels('run', false)
    expect(before.arms.length).toBeGreaterThan(0)
    expect(before.layout.shown.some((b) => covered(b, before.arms))).toBe(true)
    const after = torsoLabels('run', true)
    expect(after.layout.shown.filter((b) => covered(b, after.arms)).map((b) => b.key)).toEqual([])
    expect(after.layout.hidden).toEqual(before.layout.hidden)
  })

  it('at rest nothing changes (the arms hang beside the body, as they always have)', () => {
    expect(limbs.figure('rest').over).toEqual([])
    expect(torsoLabels('rest', true).layout).toEqual(torsoLabels('rest', false).layout)
  })
})

describe('the sentences are true (ui-ux §6, §7)', () => {
  it('muscles in a run: about 43× their resting energy, most ends up as heat; never kcal', () => {
    const r = run([bout('run', 10)])
    const s = musclesSummary(r, null, t, 'en')!
    const k = Math.round(peakOf(seriesOf(r, 'muscle.energyRate')!, 1).value / at(r, 'muscle.energyRate', 0))
    expect(k).toBeGreaterThan(30)
    expect(s.headline).toBe(`During the run, muscles use about ${k}× their resting energy; most ends up as heat.`)
    expect(s.headline).not.toMatch(/kcal/)
    expect(musclesSummary(r, run(), t, 'en')!.headline).toBe(
      `At the most, muscles use about ${k}× their resting energy with this plan, 1× with the kept one.`,
    )
    expect(musclesSummary(r, r, t, 'en')!.headline).toBe('Muscles work about the same in both plans.')
  })

  it('skin in a walk: about 330 mL an hour, the total, and that sweat is not fat', () => {
    const r = run([bout('walk')])
    const s = skinSummary(r, null, t, 'en')!
    expect(s.headline).toMatch(/^Most sweat during the walk: about 3[0-9]0 mL an hour\.$/)
    expect(s.reason).toMatch(/^About 1[0-9]{2} mL of sweat in all\. Sweat is water and salt, not fat leaving\.$/)
    expect(skinSummary(r, run(), t, 'en')!.headline).toMatch(/^Sweat in all: about \d+ mL with this plan, 0 mL with the kept one\.$/)
  })

  it('each graph’s sentence: flat at rest, or its start, its highest and when', () => {
    expect(effortStripSummary('skin.sweatRate' as never, run(), t, 'en')).toBe(
      'Sweat made: about 0 mL an hour all the way, with no walk or run.',
    )
    expect(effortStripSummary('muscle.energyRate' as never, run([bout('walk')]), t, 'en')).toMatch(
      /^Energy used by muscles: 14 kcal\/h at the start, \d+ kcal\/h at the most, at \d+ min\.$/,
    )
  })

  it('the lesson stubs: a 10-minute run from 0:30, opened in the run, well above the kept, resting line (R18)', () => {
    for (const [l, id] of [
      [MUSCLES_LESSON, 'muscle.energyRate'],
      [SKIN_LESSON, 'skin.sweatRate'],
    ] as const) {
      expect(l.release).toBe('v3.0')
      const [r, k] = [run(l.activity, l.meal), run(l.keptActivity, l.kept)]
      expect(doingAt(l.activity, l.t)).toBe('run')
      expect(at(r, id, l.t)).toBeGreaterThan(at(k, id, l.t) + 100)
      expect(t(l.title)).not.toBe(l.title)
    }
  })
})

/** "rgb(r,g,b)" → "#rrggbb". */
function rgbHex(css: string) {
  return `#${css
    .match(/\d+/g)!
    .map((v) => Number(v).toString(16).padStart(2, '0'))
    .join('')}`
}
