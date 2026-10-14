import { describe, expect, it } from 'vitest'
import { decodeShareState } from '@lifepeek/engine'
import * as run from '@lifepeek/engine/run'
import en from '../i18n/en.json'
import { systemOf } from '../systems/registry.ts'
import { CHAPTERS, shownChapters } from './lessons.ts'
import { LESSONS } from './presets.ts'
import { SYSTEM_SOURCES } from './systemSources.ts'
import { REFERENCES } from './references.ts'

describe('Teach by NCERT chapter (X-1, R15)', () => {
  it('Class 10’s Life Processes in its order, then moving and body heat; every v2 lesson stays under Nutrition', () => {
    expect(CHAPTERS.map((c) => c.key)).toEqual(['nutrition', 'respiration', 'transport', 'excretion', 'movement'])
    expect(CHAPTERS.filter((c) => c.c10).map((c) => c.key)).toEqual(['nutrition', 'respiration', 'transport', 'excretion'])
    expect(CHAPTERS[0]!.lessons.map((l) => l.key)).toEqual(LESSONS.map((l) => l.key))
  })

  it('a lesson shows only once its system is public, or in a preview: since H-1, every chapter (R18, R30)', () => {
    expect(shownChapters(false).map((c) => c.key)).toEqual(['nutrition', 'respiration', 'transport', 'excretion', 'movement'])
    expect(shownChapters(false)).toEqual(shownChapters(true))
    for (const c of shownChapters(false)) for (const l of c.lessons) expect(systemOf(l.system)!.public, l.key).toBe(true)
    expect(shownChapters(true).flatMap((c) => c.lessons.map((l) => l.key))).toEqual(CHAPTERS.flatMap((c) => c.lessons.map((l) => l.key)))
  })

  it('every lesson has a release, classes, a title and its question (system lessons), and a link to its system and time', () => {
    for (const c of CHAPTERS)
      for (const l of c.lessons) {
        // v3.1: lymph's lesson (U-5, R18).
        expect(['v2', 'v3.0', 'v3.1'], l.key).toContain(l.release)
        expect(l.classes.length, l.key).toBeGreaterThan(0)
        expect((en.teach.lessons as Record<string, string>)[l.key], l.key).toBeTruthy()
        const url = new URL(l.href(true), 'https://example.org')
        const s = decodeShareState(url.searchParams)
        expect(s.t, l.key).toBe(l.t)
        if (l.preset) continue
        expect((en.teach.lessonQuestions as Record<string, string>)[l.key], l.key).toBeTruthy()
        expect(s.layer, l.key).toBe(l.system)
        expect(url.searchParams.get('preview'), l.key).toBe('1')
        expect(new URL(l.href(false), 'https://example.org').searchParams.get('preview'), l.key).toBeNull()
        // Saving it for class saves its system's pack.
        expect(l.packs, l.key).toContain(systemOf(l.system)!.pack)
      }
  })
})

describe('Science: each system’s sources are its catalog rows’ (X-1, no new claims)', () => {
  const cited = (rows: Iterable<{ id: string; sourceIds?: readonly string[] }>) => [...new Set([...rows].flatMap((r) => r.sourceIds ?? []))]
  const all = Object.values({ ...run.RUN_SIGNALS, ...run.RUN_EVENTS }) as { id: string; sourceIds?: readonly string[] }[]
  const effort = Object.values(run.EFFORT_SIGNALS) as { id: string; sourceIds?: readonly string[] }[]
  // The packs' own events (v3.1's S-5 lymph and S-6 control's too) are their systems', not Digestion's.
  const packEvents = new Set([
    ...Object.keys(run.CIRCULATION_EVENTS),
    ...Object.keys(run.KIDNEY_EVENTS),
    ...Object.keys(run.LYMPH_EVENTS),
    ...Object.keys(run.CONTROL_EVENTS),
  ])

  it('each list is what its rows cite, in their order', () => {
    expect(SYSTEM_SOURCES.digestion).toEqual(
      cited(all.filter((r) => /^(gut\.|blood\.glucose$|energy\.|event\.)/.test(r.id) && !packEvents.has(r.id))),
    )
    expect(SYSTEM_SOURCES.breathing).toEqual(cited(Object.values(run.BREATHING_SIGNALS)))
    expect(SYSTEM_SOURCES.circulation).toEqual(cited([...Object.values(run.CIRCULATION_SIGNALS), ...Object.values(run.CIRCULATION_EVENTS)]))
    expect(SYSTEM_SOURCES.kidneys).toEqual(cited([...Object.values(run.KIDNEY_SIGNALS), ...Object.values(run.KIDNEY_EVENTS)]))
    expect(SYSTEM_SOURCES.muscles).toEqual(cited(effort.filter((r) => r.id.startsWith('muscle.'))))
    expect(SYSTEM_SOURCES.skin).toEqual(cited(effort.filter((r) => r.id.startsWith('skin.'))))
    expect(SYSTEM_SOURCES.lymph).toEqual(cited([...Object.values(run.LYMPH_SIGNALS), ...Object.values(run.LYMPH_EVENTS)]))
    // Drawing only: no numbers, no sources.
    expect(SYSTEM_SOURCES.bones).toEqual([])
  })

  it('every one is in the page’s reference list (its anchor)', () => {
    const ids = new Set(REFERENCES.map((r) => r.id))
    for (const list of Object.values(SYSTEM_SOURCES)) for (const id of list) expect(ids.has(id), id).toBe(true)
  })
})
