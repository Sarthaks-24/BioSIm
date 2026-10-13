import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { MODEL_VERSION } from '@lifepeek/engine'
import en from './en.json'
import { HINDI, langPrefToSave, linkLanguage, pickLanguage } from './language.ts'
import LanguageButton from '../components/LanguageButton.tsx'
import { linkNotes } from '../lib/linkNotes.ts'

// Hindi is paused (R47): a build without VITE_HINDI=1 is English only. The unit tests run without
// the flag, like a real build; Playwright's build sets it, so the Hindi e2e tests still run.

/** The run state useLinkSync sets for a link with no notes (a `?lang=hi` link sets hindiLater). */
const LINK = { linkModelVersion: MODEL_VERSION, unknownOrganism: null, droppedFoods: 0, hindiLater: false, changes: [] }

const i18n = i18next.createInstance()
void i18n.use(initReactI18next).init({ lng: 'en', resources: { en: { translation: en } }, interpolation: { escapeValue: false } })
const render = (el: ReactElement) => renderToStaticMarkup(h(MemoryRouter, null, h(I18nextProvider, { i18n }, el)))

describe('Hindi paused (VITE_HINDI off)', () => {
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
    // The notes about an opened link (components/stage/LinkNotes.tsx draws them).
    expect(linkNotes(LINK, i18n.t, (id) => id)).not.toContain(en.link.hindiLater)
    expect(linkNotes({ ...LINK, hindiLater: true }, i18n.t, (id) => id)).toContain(en.link.hindiLater)
  })
})
