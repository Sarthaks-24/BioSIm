import { describe, expect, it, vi } from 'vitest'
import { SIGNALS, type ActivityBout } from '@lifepeek/engine'
import { PROVIDES } from '@lifepeek/engine/run'
import en from '../i18n/en.json'
import hi from '../i18n/hi.json'
import { HUMAN_ORGANS } from '../registry/human/organs.ts'
import { UNIT_KEYS } from '../registry/units.ts'
import { PACK_SYSTEMS } from '../../scripts/cache-tiers.mjs'
import { FLAT_CALLOUTS, flatProblems, systemProblems, type CheckContext } from './check.ts'
import type { ToneSet } from '../anatomy/tones/base.ts'
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
  systemForLink,
  type PackId,
  type SystemDef,
} from './registry.ts'
import { DIGESTION } from './digestion/def.ts'
import { uiOf } from './ui.ts'

// The stage's English loader is a build-time module (scripts/i18n-sections.mjs); digestion's UI needs only this.
vi.mock('../i18n/index.ts', () => ({
  localized: (text: Record<string, string> | undefined, lang: string) => text?.[lang] ?? text?.en ?? '',
}))

/** The text at a dotted key in a nested JSON object, or undefined. */
const text = (json: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), json)

// Each built pack's rows, registered as the stage registers them when the pack loads.
for (const [pack, def] of Object.entries(PACKS) as [PackId, NonNullable<(typeof PACKS)[PackId]>][]) {
  registerSignals(pack, (await def.rows()).default)
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
}

describe('systems registry (architecture §5.2)', () => {
  it.each(SYSTEMS.map((s) => [s.id, s] as const))('%s has every piece', (_id, s) => {
    expect(systemProblems(s, ctx)).toEqual([])
  })

  it('names the missing piece', () => {
    const breathing: SystemDef = {
      ...DIGESTION,
      id: 'breathing',
      i18nKey: 'systems.breathing',
      lifeProcess: 'respiration',
      pack: 'breathing',
      public: false,
      slots: [
        { id: 'gut', signals: ['gut.stomach.contentG'], unit: 'g' },
        // S-2's engine signal, but no pack has registered its row yet (the breathing pack is U-2's).
        { id: 'blood', signals: ['lungs.tidalVolume' as never], unit: 'mL/min', letter: 'b' },
        { id: 'energy', signals: ['energy.inRate'], unit: 'g' },
        // A reserved name: no engine module provides it.
        { id: 'gut', signals: ['liver.glucoseOutput' as never], unit: 'mg/dL' },
      ],
      organs: ['lungs' as never],
    }
    expect(systemProblems(breathing, ctx)).toEqual([
      'breathing: pack breathing has no PackDef (systems/packs.ts)',
      'breathing: its name has no English text systems.breathing.name',
      "breathing: organ lungs is not one of the organism's organs",
      'breathing: 4 graph slots: at most 3 (keys 1–3)',
      'breathing: two slots share an id',
      'breathing: slot 2 (blood) has a letter alias: only digestion has them, in v3.0',
      'breathing: slot 2 (blood) unit mL/min has no text (registry/units.ts)',
      'breathing: slot 2 (blood) signal lungs.tidalVolume has no row registered by its pack',
      "breathing: slot 3 (energy) signal energy.inRate is in kcal/h, not the slot's g",
      'breathing: slot 4 (gut) signal liver.glucoseOutput is not provided by the engine (PROVIDES)',
      'breathing: slot 4 (gut) signal liver.glucoseOutput has no row registered by its pack',
    ])
  })

  it('fails a constant or drawing-only signal placed in a slot', () => {
    const real = { ...SIGNALS['blood.glucose'], id: 'blood.glucose', clock: 'real' } as const
    const one: CheckContext = { ...ctx, row: (id) => (id === 'blood.glucose' ? real : ctx.row(id)) }
    expect(systemProblems(DIGESTION, one)).toEqual([
      'digestion: slot 2 (blood) signal blood.glucose is a constant or drawing-only signal, not a graph',
    ])
  })

  it('a public row needs Hindi (Tier 1); a drawing-only public row needs its own drawing (R11)', () => {
    const noHindi: CheckContext = { ...ctx, hi: () => undefined }
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
    // Its tones are anatomy/tones/<id>.ts (they load with its pack, never with the first download).
    const { TONES } = (await import(`../anatomy/tones/${s.id}.ts`)) as { TONES: ToneSet }
    expect(flatProblems(s, TONES)).toEqual([])
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

  it("the lymph tones (A-11a's, with the spleen) pass the same checks", () => {
    const lymph: SystemDef = {
      ...DIGESTION,
      id: 'lymph',
      pack: 'lymph',
      camera: { framing: 'full' },
      draw: 'layer',
    }
    expect(flatProblems(lymph, LYMPH_TONES, FLAT_CALLOUTS.digestion)).toEqual([])
    expect(flatProblems(lymph, LYMPH_TONES)).toEqual(['lymph: has no labels (systems/check.ts FLAT_CALLOUTS)'])
  })
})

describe('links and the release gate (architecture §2 and §5.2, R39)', () => {
  const walk: ActivityBout[] = [{ kind: 'walk', startMin: 30, durMin: 20 }]
  const hidden: SystemDef = { ...DIGESTION, id: 'breathing', i18nKey: 'systems.breathing', pack: 'breathing', public: false }

  it('a public system opens; an unknown or hidden one opens Digestion (the link notes say so)', () => {
    expect(systemForLink('digestion', [], false)).toBe('digestion')
    expect(systemForLink('nonsense', [], false)).toBe('digestion')
    expect(systemForLink(undefined, [], false)).toBe('digestion')
    // No hidden row is built yet: a SystemId with no row opens Digestion even with ?preview=1.
    expect(systemForLink('breathing', [], true)).toBe('digestion')
  })

  it('a hidden row opens only with ?preview=1, and the layer switch shows it only then', () => {
    withSystem(hidden, () => {
      expect(systemForLink('breathing', [], false)).toBe('digestion')
      expect(systemForLink('breathing', [], true)).toBe('breathing')
      expect(pickerSystems('digestion').map((s) => s.id)).toEqual(['digestion'])
      expect(pickerSystems('breathing').map((s) => s.id)).toEqual(['digestion', 'breathing'])
    })
  })

  it('a link with activity but no layer opens Heart & blood only once that row is public (R39)', () => {
    expect(defaultSystemFor(walk)).toBe('digestion')
    withSystem({ ...hidden, id: 'circulation', pack: 'circulation' }, () => expect(defaultSystemFor(walk)).toBe('digestion'))
    withSystem({ ...hidden, id: 'circulation', pack: 'circulation', public: true }, () => {
      expect(defaultSystemFor(walk)).toBe('circulation')
      expect(defaultSystemFor([])).toBe('digestion')
    })
  })
})

/** Runs `fn` with `extra` added to the registry's systems (a made-up row; the registry is a list). */
function withSystem(extra: SystemDef, fn: () => void) {
  const list = SYSTEMS as SystemDef[]
  list.push(extra)
  try {
    fn()
  } finally {
    list.pop()
  }
}
