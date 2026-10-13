import i18next from 'i18next'
import { beforeEach, describe, expect, it } from 'vitest'
import { MODEL_VERSION } from '@lifepeek/engine'
import en from '../i18n/en.json'
import { INITIAL_RUN, useRunStore } from '../state/run.ts'
import { useClock } from '../state/clock.ts'
import { isNewer, linkNotes } from './linkNotes.ts'

// FP-6 (B21): what an opened link asked for that is shown differently is said in words.
const i18n = i18next.createInstance()
void i18n.init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
const NAMES: Record<string, string> = { cola: 'Cola', fries: 'French fries', milk: 'Milk' }
const notesFor = (search: string) => {
  useRunStore.getState().loadLink(search)
  return linkNotes(useRunStore.getState(), i18n.t, (id) => NAMES[id] ?? id)
}

beforeEach(() => {
  useRunStore.setState({ ...INITIAL_RUN })
  useClock.setState({ simMin: 0, playing: false })
})

describe('link notes', () => {
  it('a link shown as written has none', () => {
    expect(notesFor(`v=${MODEL_VERSION}&a=cola:1&b=fries:1&t=90`)).toEqual([])
  })

  it('servings, foods past the sixth, the time and parts it could not read, plainly', () => {
    expect(notesFor(`v=${MODEL_VERSION}&a=cola:999`)).toEqual(['This link asked for Cola ×999; showing ×5, the nearest amount this version allows.'])
    expect(notesFor(`v=${MODEL_VERSION}&a=water:1,milk:1,roti:1,dal:1,apple:1,banana:1,cola:1,fries:1`)).toEqual([
      'A meal can have at most 6 foods, so these in the link were left out: Cola, French fries.',
    ])
    expect(notesFor(`v=${MODEL_VERSION}&a=cola:1&t=99999`)).toEqual(['This link’s time is past the end of the model’s 48 hours, so it opens at the end.'])
    expect(notesFor(`v=${MODEL_VERSION}&a=cola:1,<b>&t=-5`)).toEqual(['Part of this link could not be read, so it was left out: “t=-5”, “<b>”.'])
  })

  it('a person or a view this version lacks, and a walk or run', () => {
    expect(notesFor(`v=${MODEL_VERSION}&a=cola:1&who=teen-ref&layer=lungs&act=walk.120.20`)).toEqual([
      'This version doesn’t know the person this link asks for, so it shows the typical adult.',
      'This version can’t show the walk or run in this link, so it is left out.',
      'This version doesn’t have the body system this link asks for (“lungs”), so it shows Digestion.',
    ])
  })

  it('a link from a newer version: its own note (LinkNotes) names the walk, not this list', () => {
    const notes = notesFor(`v=${MODEL_VERSION + 1}&a=cola:1&act=walk.120.20&bact=run.0.30`)
    expect(isNewer(useRunStore.getState())).toBe(true)
    expect(notes).toEqual([])
  })

  it('a link from the version before this one says some numbers may differ (E-3a)', () => {
    expect(notesFor(`v=${MODEL_VERSION - 1}&a=cola:1`)).toEqual([en.link.old])
  })

  it('an older version, foods that no longer exist, and a meal too big', () => {
    useRunStore.getState().loadLink('v=1&a=cola:1,nope:1')
    expect(linkNotes(useRunStore.getState(), i18n.t, (id) => id, [true, false])).toEqual([
      en.link.old,
      'Some foods in this link no longer exist and were left out (1).',
      `This meal is bigger than 1500 kcal. The model isn't reliable for meals this big, so treat its times as rough.`,
    ])
  })
})
