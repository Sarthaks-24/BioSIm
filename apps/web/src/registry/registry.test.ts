import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE, ORGANISM_PROFILES, SIGNALS, isActiveSignal, type ActiveSignalId, type OrganismId } from '@lifepeek/engine'
import { PROVIDES } from '@lifepeek/engine/run'
import * as humanAnatomy from '../anatomy/human.ts'
import en from '../i18n/en.json'
import hi from '../i18n/hi.json'
import { ORGANISMS } from './index.ts'
import { registryKeys } from './i18nKeys.ts'
import { UNIT_KEYS } from './units.ts'

/** Each organism's anatomy file. A new organism must add its own here (the type requires it). */
const ANATOMY: { readonly [O in OrganismId]: Record<string, unknown> } = { human: humanAnatomy }

/** The text at a dotted key in a nested JSON object, or undefined. */
function text(json: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), json)
}

const entries = Object.entries(ORGANISMS) as [OrganismId, (typeof ORGANISMS)[OrganismId]][]

describe.each(entries)('registry: %s', (id, { organism, systems, organs }) => {
  const provides: readonly string[] = PROVIDES[id]
  const isProvided = (s: string): s is ActiveSignalId => isActiveSignal(s) && provides.includes(s)
  const organIds = organs.map((o) => o.id)
  const systemIds = systems.map((s) => s.id)

  it('is filed under its own id, with a default system and its default profile first', () => {
    expect(organism.id).toBe(id)
    expect(systemIds).toContain(organism.defaultSystem)
    expect(organism.profiles[0]).toBe(DEFAULT_PROFILE[id])
    for (const p of organism.profiles) expect(ORGANISM_PROFILES[id], p).toContain(p)
  })

  it('has unique system and organ ids', () => {
    expect(new Set(systemIds).size).toBe(systemIds.length)
    expect(new Set(organIds).size).toBe(organIds.length)
  })

  // Each system's organs, graphs, rows and texts: systems/registry.test.ts (W-1).
  it('drives organs only with signals it provides', () => {
    for (const o of organs) for (const sig of Object.values(o.drives ?? {})) expect(isProvided(sig), `${o.id} → ${sig}`).toBe(true)
    for (const sig of Object.keys(organism.signalOverrides)) expect(isProvided(sig), `override ${sig}`).toBe(true)
  })

  it('points every organ at a shape in its anatomy file', () => {
    for (const o of organs) {
      const shape = ANATOMY[id][o.anatomyRef]
      expect(shape, `${o.id} → ${o.anatomyRef}`).toBeTypeOf('object')
    }
  })

  it('names only limits.* texts as known limits', () => {
    for (const k of systems.flatMap((s) => s.knownLimits)) expect(k).toMatch(/^limits\.\w+$/)
  })

  it('has a unit text for every signal it provides', () => {
    for (const sig of PROVIDES[id]) {
      const key = UNIT_KEYS[SIGNALS[sig].unit]
      expect(key, `${sig} (${SIGNALS[sig].unit})`).toBeDefined()
      for (const json of [en, hi]) expect(text(json, key!), key).toMatch(/\{\{n\}\}/)
    }
  })
})

describe('registry i18n', () => {
  it('every registry key is text in English and Hindi', () => {
    const missing = [...registryKeys().required].flatMap((k) =>
      Object.entries({ en, hi })
        .filter(([, json]) => typeof text(json, k) !== 'string')
        .map(([lang]) => `${lang}: ${k}`),
    )
    expect(missing).toEqual([])
  })
})
