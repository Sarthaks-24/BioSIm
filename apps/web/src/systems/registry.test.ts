import { describe, expect, it, vi } from 'vitest'
import { SIGNALS, type ActivityBout } from '@lifepeek/engine'
import { PROVIDES } from '@lifepeek/engine/run'
import en from '../i18n/en.json'
import hi from '../i18n/hi.json'
import { HUMAN_ORGANS } from '../registry/human/organs.ts'
import { UNIT_KEYS } from '../registry/units.ts'
import { PACK_SYSTEMS } from '../../scripts/cache-tiers.mjs'
import { flatProblems, systemProblems, type CheckContext } from './check.ts'
import type { ToneSet } from '../anatomy/tones/base.ts'
import type { Callout } from '../anatomy/callouts.ts'
import { TONES as LYMPH_TONES } from '../anatomy/tones/lymph.ts'
import { PACKS } from './packs.ts'
import {
  PACK_IDS,
  PACK_OF,
  SYSTEMS,
  SYSTEM_IDS,
  defaultSystemFor,
  pickerSystems,
  registerSignals,
  rowsOf,
  signalRow,
  stepSystem,
  systemForLink,
  systemOf,
  type PackId,
  type SystemDef,
} from './registry.ts'
import { DIGESTION } from './digestion/def.ts'
import { LYMPH } from './lymph/def.ts'
import { LABELS as LYMPH_LABELS } from '../anatomy/human/lymph.ts'
import { uiOf } from './ui.ts'

// The stage's English loader is a build-time module (scripts/i18n-sections.mjs); digestion's UI needs only this.
vi.mock('../i18n/index.ts', () => ({
  localized: (text: Record<string, string> | undefined, lang: string) => text?.[lang] ?? text?.en ?? '',
}))

/** The text at a dotted key in a nested JSON object, or undefined. */
const text = (json: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), json)

// Each built pack's rows, registered as the stage registers them when the pack loads, and the rest
// of its systems' rows (their graphs, rhythms and limits: the UI module's DEFS), as loadPack merges them.
for (const [pack, def] of Object.entries(PACKS) as [PackId, NonNullable<(typeof PACKS)[PackId]>][]) {
  registerSignals(pack, (await def.rows()).default)
  for (const [id, parts] of Object.entries((await def.ui?.())?.DEFS ?? {})) Object.assign(systemOf(id)!, parts)
}

const ctx: CheckContext = {
  provides: PROVIDES.human,
  organs: HUMAN_ORGANS.map((o) => o.id),
  packs: Object.keys(PACKS) as PackId[],
  manifestPacks: Object.keys(PACK_SYSTEMS),
  rowsOf,
  row: (id) => signalRow(id as never),
  unitKey: (unit) => UNIT_KEYS[unit],
  en: (key) => text(en, key),
  hi: (key) => text(hi, key),
  // Hindi is paused (R47): only a VITE_HINDI=1 run asks the public rows for their Hindi.
  hindi: process.env.VITE_HINDI === '1',
}

describe('systems registry (architecture §5.2)', () => {
  it.each(SYSTEMS.map((s) => [s.id, s] as const))('%s has every piece', (_id, s) => {
    expect(systemProblems(s, ctx)).toEqual([])
  })

  it('names the missing piece', () => {
    const hormones: SystemDef = {
      ...DIGESTION,
      id: 'hormones',
      i18nKey: 'systems.hormones',
      lifeProcess: 'control',
      pack: 'control',
      public: false,
      slots: [
        { id: 'gut', signals: ['gut.stomach.contentG'], unit: 'g' },
        // S-4's engine signal: the kidneys pack registers its row, not the control pack.
        { id: 'blood', signals: ['kidney.filtrationRate' as never], unit: 'kcal/min', letter: 'b' },
        { id: 'energy', signals: ['energy.inRate'], unit: 'g' },
        // A reserved name: no engine module provides it.
        { id: 'gut', signals: ['liver.glucoseOutput' as never], unit: 'mg/dL' },
        // A pack's graph names its tab from the pack's own words.
        { id: 'insulin', tab: 'sys.control.strips.none', signals: ['gut.stomach.contentG'], unit: 'g' },
      ],
      organs: ['pituitary' as never],
    }
    // The control pack is built (U-7's Brain & nerves), so a hormones row would find its PackDef.
    expect(systemProblems(hormones, ctx)).toEqual([
      "hormones: organ pituitary is not one of the organism's organs",
      'hormones: 5 graph slots: at most 3 (keys 1–3)',
      'hormones: two slots share an id',
      'hormones: slot 2 (blood) has a letter alias: only digestion has them, in v3.0',
      'hormones: slot 2 (blood) unit kcal/min has no text (registry/units.ts)',
      'hormones: slot 2 (blood) signal kidney.filtrationRate has no row registered by its pack',
      "hormones: slot 3 (energy) signal energy.inRate is in kcal/h, not the slot's g",
      'hormones: slot 4 (gut) signal liver.glucoseOutput is not provided by the engine (PROVIDES)',
      'hormones: slot 4 (gut) signal liver.glucoseOutput has no row registered by its pack',
      "hormones: slot 5 (insulin)'s tab has no English text sys.control.strips.none",
    ])
  })

  it('fails a constant or drawing-only signal placed in a slot', () => {
    const real = { ...SIGNALS['blood.glucose'], id: 'blood.glucose', clock: 'real' } as const
    const one: CheckContext = { ...ctx, row: (id) => (id === 'blood.glucose' ? real : ctx.row(id)) }
    expect(systemProblems(DIGESTION, one)).toEqual([
      'digestion: slot 2 (blood) signal blood.glucose is a constant or drawing-only signal, not a graph',
    ])
  })

  it('a public row needs Hindi (Tier 1) when Hindi ships; a drawing-only public row needs its own drawing (R11)', () => {
    const noHindi: CheckContext = { ...ctx, hi: () => undefined, hindi: true }
    expect(systemProblems(DIGESTION, { ...noHindi, hindi: false })).toEqual([])
    expect(systemProblems(DIGESTION, noHindi)).toContain(
      'digestion: its name has no Hindi text systems.digestion.name (public needs Hindi Tier 1)',
    )
    expect(systemProblems({ ...DIGESTION, public: false }, noHindi)).toEqual([])
    expect(systemProblems({ ...DIGESTION, slots: [] }, ctx)).toEqual([
      'digestion: public with no graphs, but has no drawing of its own (a drawing-only row needs a layer, R11)',
    ])
    expect(systemProblems({ ...DIGESTION, slots: [], draw: 'layer' }, ctx)).toEqual([])
  })

  it('keeps the frozen table: 11 systems, 8 packs, every system in its pack (architecture §0)', () => {
    expect(SYSTEM_IDS).toHaveLength(11)
    expect(PACK_IDS).toEqual(['core', 'breathing', 'circulation', 'kidneys', 'effort', 'lymph', 'control', 'reproduction'])
    expect(Object.keys(PACK_SYSTEMS)).toEqual([...PACK_IDS])
    for (const id of SYSTEM_IDS) expect(PACK_SYSTEMS[PACK_OF[id]], id).toContain(id)
    expect(Object.values(PACK_SYSTEMS).flat().sort()).toEqual([...SYSTEM_IDS].sort())
  })

  it('every system is built only once, with its UI (digestion static)', () => {
    expect(new Set(SYSTEMS.map((s) => s.id)).size).toBe(SYSTEMS.length)
    for (const s of SYSTEMS) expect(uiOf(s.id).now, s.id).toBeTypeOf('function')
  })

  it("draws every layer flat (no WebGL needed): its pack's drawing module has it", async () => {
    for (const s of SYSTEMS) {
      if (s.draw === 'body') continue
      const drawing = PACKS[s.pack]?.drawing
      expect(drawing, `${s.id}: pack ${s.pack} has no drawing (PackDef.drawing)`).toBeTypeOf('function')
      expect((await drawing!()).default[s.id], s.id).toBeTypeOf('function')
    }
  })
})

describe('flat registry (A-0; anatomy plan §1, §2.0, §5)', () => {
  it.each(SYSTEMS.map((s) => [s.id, s] as const))('%s has a flat drawing, a VIEW, checked outlines and callouts', async (_id, s) => {
    // Its tones are anatomy/tones/<id>.ts (they load with its pack, never with the first download),
    // and a layer that places its own labels keeps them in anatomy/human/<id>.ts `LABELS` (lymph's).
    const { TONES } = (await import(`../anatomy/tones/${s.id}.ts`)) as { TONES: ToneSet }
    const { LABELS } = (await import(`../anatomy/human/${s.id}.ts`)) as { LABELS?: Record<string, Callout> }
    expect(LABELS ? flatProblems(s, TONES, Object.keys(LABELS), LABELS) : flatProblems(s, TONES)).toEqual([])
  })

  it('names what is wrong with a row', () => {
    const tones = {
      tones: { lungs: '#e8909c', pinkish: '#e8949e', d: '#444444', a: '#111111', b: '#222222', c: '#333333' },
      neighbours: [
        ['lungs', 'pinkish'],
        ['lungs', 'windpipe'],
      ] as const,
    }
    const bad: SystemDef = { ...DIGESTION, id: 'breathing', camera: { framing: 'side' as never } }
    expect(flatProblems(bad, tones, ['mouth', 'kidney'])).toEqual([
      'breathing: framing side has no VIEW (anatomy/human/base.ts FRAMINGS)',
      "breathing: is drawn by the body, but only Digestion is: it needs its own flat layer (draw: 'layer', its pack's drawing)",
      'breathing: 6 tones: at most 5 (anatomy plan §5)',
      'breathing: neighbours lungs/pinkish are too alike: CVD ΔE 0.7, normal ΔE 0.9',
      'breathing: neighbours lungs/windpipe name a tone it does not have',
      'breathing: label mouth is outside its side framing',
      'breathing: label kidney has no callout (anatomy/callouts.ts)',
    ])
  })

  it("lymph's map (A-11a) is a layer in the full framing, its labels inside it, its tones apart; the meal moves it since U-5", () => {
    expect(LYMPH).toMatchObject({ draw: 'layer', camera: { framing: 'full' }, pack: 'lymph', inputs: ['meal'], public: true })
    expect(flatProblems(LYMPH, LYMPH_TONES, Object.keys(LYMPH_LABELS), LYMPH_LABELS)).toEqual([])
    // Without its own table, its labels are not the body's organs.
    expect(flatProblems(LYMPH, LYMPH_TONES, ['spleen'])).toEqual(['lymph: label spleen has no callout (anatomy/callouts.ts)'])
    expect(flatProblems(LYMPH, LYMPH_TONES, [])).toEqual(['lymph: has no labels (systems/check.ts FLAT_CALLOUTS)'])
  })

  it("lymph's pack (U-5) brings its rows and moment, two graphs, the germ-defence card, its drawing and its English", async () => {
    const pack = PACKS.lymph!
    expect((await pack.rows()).default.map((r) => r.id)).toEqual(['lymph.fatFlowRate', 'blood.triglyceride', 'event.triglyceridePeak'])
    const { default: uis, DEFS } = await pack.ui!()
    const ui = uis.lymph!
    expect(ui.card).toBeTypeOf('function')
    expect(ui.note).toBeTypeOf('function')
    expect(DEFS!.lymph!.slots!.map((s) => [s.id, s.signals, s.unit])).toEqual([
      ['road', ['lymph.fatFlowRate'], 'g/min'],
      ['fat', ['blood.triglyceride'], 'mg/dL'],
    ])
    // Blood fat: no band and no threshold line (model §2.10).
    expect(DEFS!.lymph!.slots![1]!.reference).toBeUndefined()
    expect((await pack.drawing!()).default.lymph).toBeTypeOf('function')
    expect(pack.text).toBeTypeOf('function')
  })
})

describe('the effort pack (U-1): muscles, skin and the bones card', () => {
  it('brings its rows, three systems’ UI (a graph each for muscles and skin, a card for bones), three drawings and its English', async () => {
    const pack = PACKS.effort!
    expect((await pack.rows()).default.map((r) => r.id)).toEqual(['muscle.energyRate', 'skin.sweatRate', 'skin.sweatTotal'])
    const { default: uis, DEFS } = await pack.ui!()
    expect(uis.bones!.card).toBeTypeOf('function')
    expect(uis.skin!.note).toBeTypeOf('function')
    expect(DEFS!.muscles!.slots!.map((s) => s.signals)).toEqual([['muscle.energyRate']])
    expect(DEFS!.skin!.slots!.map((s) => [s.signals, s.unit])).toEqual([[['skin.sweatRate'], 'mL/h']])
    const drawings = (await pack.drawing!()).default
    for (const id of ['muscles', 'skin', 'bones'] as const) expect(drawings[id], id).toBeTypeOf('function')
    expect(pack.text).toBeTypeOf('function')
  })

  it('public since H-1; bones is Drawing only (no inputs, no graphs), all three in the full framing', () => {
    for (const id of ['muscles', 'skin', 'bones'] as const)
      expect(systemOf(id), id).toMatchObject({
        public: true,
        pack: 'effort',
        draw: 'layer',
        camera: { framing: 'full' },
        lifeProcess: 'movement',
      })
    expect(systemOf('bones')).toMatchObject({ inputs: [], slots: [] })
    expect(systemForLink('muscles', [], false)).toBe('muscles')
    expect(systemForLink('skin', [], true)).toBe('skin')
  })
})

describe('links and the release gate (architecture §2 and §5.2, R39)', () => {
  const walk: ActivityBout[] = [{ kind: 'walk', startMin: 30, durMin: 20 }]

  it('a public system opens; an unknown or hidden one opens Digestion (the link notes say so)', () => {
    expect(systemForLink('digestion', [], false)).toBe('digestion')
    expect(systemForLink('nonsense', [], false)).toBe('digestion')
    expect(systemForLink(undefined, [], false)).toBe('digestion')
    // A SystemId with no row yet opens Digestion even with ?preview=1.
    expect(systemForLink('reproduction', [], true)).toBe('digestion')
  })

  it('every built row is public since the v3.0 release gate (H-1, R103): a plain link opens it, and the picker offers it', () => {
    expect(SYSTEMS.filter((s) => !s.public).map((s) => s.id)).toEqual([])
    expect(systemForLink('breathing', [], false)).toBe('breathing')
    expect(systemForLink('breathing', [], true)).toBe('breathing')
    expect(pickerSystems(true)).toEqual(pickerSystems(false))
    expect(pickerSystems(false).map((s) => s.id)).toEqual([
      'digestion',
      'breathing',
      'circulation',
      'kidneys',
      'lymph',
      // U-7: the nerve demo, public once its acceptance passed (v3.1, on v3); control before movement, as the picker groups them.
      'nerves',
      'hormones',
      'muscles',
      'bones',
      'skin',
    ])
  })

  it('Home’s systems list says what each row shows (v3.1: lymph’s graphs, the nerve demo, insulin)', () => {
    const items = en.home.systems.items as Record<string, string>
    for (const s of pickerSystems(false)) expect(items[s.id], s.id).toBeTruthy()
    // Lymph has graphs since U-5: no longer "a drawing" (R3).
    expect(items.lymph).not.toMatch(/drawing/i)
    expect(items.lymph).toMatch(/blood fat/)
    expect(items.nerves).toMatch(/reflex/)
    expect(items.hormones).toMatch(/Insulin/)
  })

  it('kidneys & water opens from a plain link, and its graphs show 0–12 h', () => {
    expect(systemForLink('kidneys', [], false)).toBe('kidneys')
    expect(systemForLink('kidneys', [], true)).toBe('kidneys')
    expect(systemOf('kidneys')?.graphWindowMin).toBe(720)
  })

  it('‹ › and [ ] step round the picker’s rows', () => {
    expect(stepSystem('digestion', true, 1)).toBe('breathing')
    expect(stepSystem('breathing', true, 1)).toBe('circulation')
    expect(stepSystem('circulation', true, 1)).toBe('kidneys')
    expect(stepSystem('kidneys', true, 1)).toBe('lymph')
    expect(stepSystem('lymph', true, 1)).toBe('nerves')
    expect(stepSystem('nerves', true, 1)).toBe('hormones')
    expect(stepSystem('hormones', true, 1)).toBe('muscles')
    expect(stepSystem('skin', true, 1)).toBe('digestion')
    expect(stepSystem('digestion', true, -1)).toBe('skin')
    // Every row is public: a session without ?preview=1 steps the same way.
    expect(stepSystem('digestion', false, 1)).toBe('breathing')
    expect(stepSystem('digestion', false, -1)).toBe('skin')
  })

  it('Heart & blood opens from a plain link (public since H-1)', () => {
    expect(systemForLink('circulation', walk, false)).toBe('circulation')
    expect(systemForLink('circulation', [], true)).toBe('circulation')
  })

  it('a link with activity but no layer opens Heart & blood once that row is public, or in a preview (R39)', () => {
    // Public (the flag H-1 flipped): every such link opens Heart & blood; without activity, Digestion.
    expect(defaultSystemFor(walk)).toBe('circulation')
    expect(systemForLink(undefined, walk, false)).toBe('circulation')
    expect(defaultSystemFor([])).toBe('digestion')
    expect(defaultSystemFor(walk, true)).toBe('circulation')
    expect(systemForLink(undefined, [], true)).toBe('digestion')
    // An asked-for layer wins over the default.
    expect(systemForLink('breathing', walk, false)).toBe('breathing')
    // Hidden (as it was before H-1): Digestion, unless a preview session.
    const row = systemOf('circulation')!
    row.public = false
    try {
      expect(defaultSystemFor(walk)).toBe('digestion')
      expect(systemForLink(undefined, walk, false)).toBe('digestion')
      expect(systemForLink(undefined, walk, true)).toBe('circulation')
    } finally {
      row.public = true
    }
  })
})
