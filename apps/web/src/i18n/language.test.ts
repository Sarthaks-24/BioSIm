import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildMeal, decodeMeal } from '@lifepeek/engine'
import { simulate } from '@lifepeek/engine/run'
import en from './en.json'
import { HINDI, langPrefToSave, linkLanguage, pickLanguage } from './language.ts'
import { lookupFood } from '../data/foods.ts'
import LanguageButton from '../components/LanguageButton.tsx'
import Notes from '../components/stage/Notes.tsx'

// Hindi is paused (R47): a build without VITE_HINDI=1 is English only. The unit tests run without
// the flag, like a real build; Playwright's build sets it, so the Hindi e2e tests still run.

// A server render reads a zustand store's first state, so Notes gets a stand-in store: the run
// state useLinkSync sets for a `?lang=hi` link.
const fakeRun = vi.hoisted(() => ({ state: { linkModelVersion: null, unknownOrganism: null, droppedFoods: 0, hindiLater: false } }))
vi.mock('../state/run.ts', () => ({ useRunStore: <T>(select: (s: typeof fakeRun.state) => T) => select(fakeRun.state) }))

const i18n = i18next.createInstance()
void i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
const render = (el: ReactElement) => renderToStaticMarkup(h(MemoryRouter, null, h(I18nextProvider, { i18n }, el)))

describe('Hindi paused (VITE_HINDI off)', () => {
  afterEach(() => {
    fakeRun.state.hindiLater = false
  })

  it('is off in a build without VITE_HINDI=1', () => {
    expect(HINDI).toBe(false)
  })

  it('opens in English whatever was saved or the browser says', () => {
    for (const saved of ['hi', 'en', null, 'pseudo'])
      for (const browser of ['hi-IN', 'hi', 'en-IN', undefined]) expect(pickLanguage(saved, browser)).toBe('en')
  })

  it('a saved Hindi choice is ignored but kept, for when Hindi comes back', () => {
    // Opening in English must not write "en" over it.
    expect(langPrefToSave('en', 'hi')).toBeNull()
    expect(langPrefToSave('en', 'en')).toBe('en')
    expect(langPrefToSave('en', null)).toBe('en')
    // With Hindi on, every change is saved, as before.
    expect(langPrefToSave('en', 'hi', true)).toBe('en')
    expect(langPrefToSave('hi', 'en', true)).toBe('hi')
  })

  it('with Hindi on, the saved choice wins, then the browser', () => {
    expect(pickLanguage('hi', 'en-IN', true)).toBe('hi')
    expect(pickLanguage('en', 'hi-IN', true)).toBe('en')
    expect(pickLanguage(null, 'hi-IN', true)).toBe('hi')
    expect(pickLanguage(null, 'en-GB', true)).toBe('en')
  })

  it('a ?lang=hi link keeps English and asks for the note; other links are as before', () => {
    // null: the language stays English; useLinkSync then sets the note's flag (hindiLater).
    expect(linkLanguage('hi')).toBeNull()
    expect(linkLanguage('en')).toBe('en')
    expect(linkLanguage(null)).toBeNull()
    expect(linkLanguage(undefined)).toBeNull()
    expect(linkLanguage('fr')).toBeNull()
    expect(linkLanguage('hi', true)).toBe('hi')
  })

  it('the language button is not drawn (and is with Hindi on)', () => {
    expect(render(h(LanguageButton, { className: 'x' }))).toBe('')
    expect(render(h(LanguageButton, { className: 'x', hindi: true }))).toContain(en.nav.languageLabel)
  })

  it('the stage says, in English, that Hindi comes later', () => {
    const run = simulate(buildMeal(decodeMeal('cola:1'), lookupFood), { particles: 0 })
    expect(render(h(Notes, { run, kept: null }))).not.toContain(en.sim.hindiLater)
    fakeRun.state.hindiLater = true
    expect(render(h(Notes, { run, kept: null }))).toContain(en.sim.hindiLater)
  })
})
