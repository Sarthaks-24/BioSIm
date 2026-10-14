import { describe, expect, it } from 'vitest'
import { decodeShareState } from '@lifepeek/engine'
import * as run from '@lifepeek/engine/run'
import en from '../i18n/en.json'
import { systemOf, teacherSwitch } from '../systems/registry.ts'
import { CHAPTERS, flagshipPacks, shownChapters } from './lessons.ts'
import { HEART_PAUSE, PAUSES, pausesFor } from './flagshipPauses.ts'
import { LESSON_PACKS } from './offlineSave.ts'
import { LESSONS } from './presets.ts'
import { SYSTEM_SOURCES } from './systemSources.ts'
import { REFERENCES } from './references.ts'
import { SHEETS, type SheetKey } from './worksheets.ts'
import { REPRO_SOURCE_IDS } from '../systems/reproduction/data.ts'

describe('Teach by NCERT chapter (X-1, R15)', () => {
  it('Class 10’s Life Processes in its order, then Control and coordination (v3.1), Reproduction (v3.2), then moving and body heat; every v2 lesson stays under Nutrition', () => {
    expect(CHAPTERS.map((c) => c.key)).toEqual([
      'nutrition',
      'respiration',
      'transport',
      'excretion',
      'control',
      'reproduction',
      'movement',
    ])
    expect(CHAPTERS.filter((c) => c.c10).map((c) => c.key)).toEqual(['nutrition', 'respiration', 'transport', 'excretion'])
    expect(CHAPTERS[0]!.lessons.map((l) => l.key)).toEqual(LESSONS.map((l) => l.key))
  })

  it('a lesson shows only once its system is public, or in a preview: since H-1, every chapter but the teacher switch’s (R18, R30)', () => {
    expect(teacherSwitch.on).toBe(false)
    expect(shownChapters(false).map((c) => c.key)).toEqual(['nutrition', 'respiration', 'transport', 'excretion', 'control', 'movement'])
    expect(shownChapters(false)).toEqual(shownChapters(true))
    for (const c of shownChapters(false)) for (const l of c.lessons) expect(systemOf(l.system)!.public, l.key).toBe(true)
  })

  it('reproduction’s chapter is listed only while the teacher switch is on in this tab, preview or not (R117)', () => {
    const keys = (preview: boolean) => shownChapters(preview).flatMap((c) => c.lessons.map((l) => l.key))
    expect(keys(false)).not.toContain('cycleHormones')
    expect(keys(true)).not.toContain('cycleHormones')
    teacherSwitch.on = true
    try {
      expect(shownChapters(false).map((c) => c.key)).toEqual(CHAPTERS.map((c) => c.key))
      expect(keys(false)).toEqual(CHAPTERS.flatMap((c) => c.lessons.map((l) => l.key)))
      expect(keys(true)).toEqual(keys(false))
      expect(
        shownChapters(false)
          .find((c) => c.key === 'reproduction')!
          .lessons.map((l) => l.key),
      ).toEqual(['cycleHormones'])
    } finally {
      teacherSwitch.on = false
    }
  })

  it('every lesson has a release, classes, a title and its question (system lessons), and a link to its system and time', () => {
    for (const c of CHAPTERS)
      for (const l of c.lessons) {
        // v3.1: lymph's lesson (U-5, R18); v3.2: the Games lesson and reproduction's.
        expect(['v2', 'v3.0', 'v3.1', 'v3.2'], l.key).toContain(l.release)
        // The insulin lesson is v3.1, with `hormones` (R18).
        if (l.system === 'hormones') expect(l.release, l.key).toBe('v3.1')
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

describe('"Save for class offline" keeps what each lesson opens (T12d, R71)', () => {
  it('the guided lesson: the pack of every pause it can show, lymph’s blood fat (pause 5) included, with and without skin’s', () => {
    for (const preview of [false, true]) {
      const saved = flagshipPacks(preview)
      expect(saved).toEqual(expect.arrayContaining(LESSON_PACKS))
      for (const skin of [false, true])
        for (const p of pausesFor(skin))
          if (skin === (preview || !!systemOf('skin')!.public)) expect(saved, p.key).toContain(systemOf(p.system)!.pack)
    }
    expect(PAUSES.at(-1)).toMatchObject({ key: 'fat', system: 'lymph' })
    expect(flagshipPacks(false)).toContain('lymph')
    // Nothing it does not pause on (the insulin sentence is the lesson bar's own text).
    expect(new Set(flagshipPacks(true))).toEqual(new Set([...LESSON_PACKS, ...PAUSES.map((p) => systemOf(p.system)!.pack)]))
    expect(systemOf(HEART_PAUSE.system)!.pack).toBe('circulation')
  })

  it('each system lesson: its own system’s pack (the registry’s), and reproduction’s only while the teacher switch lists it (R117)', () => {
    for (const c of CHAPTERS) for (const l of c.lessons) if (!l.preset) expect(l.packs, l.key).toContain(systemOf(l.system)!.pack)
    const repro = CHAPTERS.find((c) => c.key === 'reproduction')!.lessons[0]!
    expect(repro.packs).toEqual([...LESSON_PACKS, 'reproduction'])
    const listed = () => shownChapters(false).flatMap((c) => c.lessons.flatMap((l) => l.packs))
    expect(listed()).not.toContain('reproduction')
    teacherSwitch.on = true
    try {
      expect(listed()).toContain('reproduction')
    } finally {
      teacherSwitch.on = false
    }
  })
})

describe('the v3.1 lessons (R109, R111, R112): each listed, with a worksheet, a "Why different?" card and Science sources', () => {
  /** Each v3.1 lesson's card (its words' key, components/WhyCard.tsx `text`). */
  const WHY: Record<string, string> = {
    fatRoad: 'sys.lymph.why',
    insulinCola: 'sys.control.why',
    reflexHotPan: 'sys.control.nerves.why',
  }
  const v31 = CHAPTERS.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c.key }))).filter((l) => l.release === 'v3.1')
  const at = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)

  it('lymph under Transportation; the reflex, then insulin, under Control and coordination', () => {
    expect(v31.map((l) => [l.key, l.chapter])).toEqual([
      ['fatRoad', 'transport'],
      ['reflexHotPan', 'control'],
      ['insulinCola', 'control'],
    ])
  })

  it('each has its worksheet’s words, its card’s rows and its system’s sources on Science', () => {
    for (const l of v31) {
      expect(SHEETS[l.key as SheetKey], l.key).toBeTruthy()
      expect((en.sheet.lessons as Record<string, unknown>)[l.key], l.key).toBeTruthy()
      const card = at(WHY[l.key]!) as Record<string, unknown> | undefined
      expect(
        Object.values(card ?? {}).some((row) => typeof row === 'object'),
        l.key,
      ).toBe(true)
      expect(SYSTEM_SOURCES[l.system]?.length, l.key).toBeGreaterThan(0)
    }
  })
})

describe('the v3.2 lessons (R116, R117): each listed, with a worksheet, a "Why different?" card row and Science sources', () => {
  /** Each v3.2 lesson's card and the row that is its own. */
  const WHY: Record<string, [string, string]> = {
    footballWalk: ['sys.breathing.why', 'games'],
    cycleHormones: ['sys.reproduction.why', 'cycle'],
  }
  const v32 = CHAPTERS.flatMap((c) => c.lessons.map((l) => ({ ...l, chapter: c.key }))).filter((l) => l.release === 'v3.2')
  const at = (key: string) => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)

  it('the Games lesson after the run under Respiration (football, a new activity, against a walk); reproduction’s in its own chapter, Classes 8 to 10', () => {
    expect(v32.map((l) => [l.key, l.chapter])).toEqual([
      ['footballWalk', 'respiration'],
      ['cycleHormones', 'reproduction'],
    ])
    const games = v32[0]!
    const url = new URL(games.href(false), 'https://example.org')
    expect(decodeShareState(url.searchParams).act?.map((b) => b.kind)).toEqual(['football'])
    expect(decodeShareState(url.searchParams).bact?.map((b) => b.kind)).toEqual(['walk'])
    // Its heart is Heart & blood's: saved for class with it.
    expect(games.packs).toEqual(expect.arrayContaining(['breathing', 'circulation']))
    expect(v32[1]!.classes).toEqual([8, 9, 10])
    expect(v32[1]!.packs).toContain('reproduction')
    expect(en.teach.chapters.reproduction).toBe('Reproduction and growing up')
  })

  it('each has its worksheet’s words, its card’s row and its system’s sources on Science', () => {
    for (const l of v32) {
      expect(SHEETS[l.key as SheetKey], l.key).toBeTruthy()
      expect((en.sheet.lessons as Record<string, unknown>)[l.key], l.key).toBeTruthy()
      const [card, row] = WHY[l.key]!
      expect((at(card) as Record<string, unknown> | undefined)?.[row], l.key).toMatchObject({ what: expect.any(String) })
      expect(SYSTEM_SOURCES[l.system]?.length, l.key).toBeGreaterThan(0)
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
    expect(SYSTEM_SOURCES.hormones).toEqual(cited([...Object.values(run.CONTROL_SIGNALS), ...Object.values(run.CONTROL_EVENTS)]))
    expect(SYSTEM_SOURCES.muscles).toEqual(cited(effort.filter((r) => r.id.startsWith('muscle.'))))
    expect(SYSTEM_SOURCES.skin).toEqual(cited(effort.filter((r) => r.id.startsWith('skin.'))))
    expect(SYSTEM_SOURCES.lymph).toEqual(cited([...Object.values(run.LYMPH_SIGNALS), ...Object.values(run.LYMPH_EVENTS)]))
    // Drawing only: no numbers, no sources.
    expect(SYSTEM_SOURCES.bones).toEqual([])
  })

  it('every one is in the page’s reference list (its anchor)', () => {
    // Reproduction's (R-1) join the list with its data, while its row is on (pages/Science.tsx).
    const ids = new Set([...REFERENCES.map((r) => r.id), ...REPRO_SOURCE_IDS])
    for (const list of Object.values(SYSTEM_SOURCES)) for (const id of list) expect(ids.has(id), id).toBe(true)
  })
})
