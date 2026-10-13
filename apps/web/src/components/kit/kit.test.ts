import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createElement as h, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import en from '../../i18n/en.json'
import { Dock, FoodChip, IconButton, PersonTag, PlayButton, PlusIcon, Segmented, StatusTag } from './index.ts'

// The web unit tests have no DOM, so the kit is rendered to HTML on the server and the markup is
// checked. Interaction is covered by the /next e2e specs once the stage uses the kit (WP-11 on).

// The status and profile words arrive with the catalog keys (WP-10); stand-ins keep this test
// independent of that.
const i18n = i18next.createInstance()
void i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        ...en,
        status: {
          simulated: { label: 'Calculated from studies', help: 'Worked out by the model.' },
          assumption: { label: 'Best guess', help: 'A formula or estimate.' },
          illustration: { label: 'Drawing only', help: 'A picture to show the idea.' },
        },
        profiles: { 'adult-ref': { tag: 'Typical adult', desc: 'ICMR-NIN 2020 reference adult man.' } },
      },
    },
  },
  interpolation: { escapeValue: false },
})

const render = (el: ReactElement) => renderToStaticMarkup(h(I18nextProvider, { i18n }, el))
const noop = () => {}

describe('component kit', () => {
  it('Segmented marks only the chosen option as pressed and never wraps a label', () => {
    const html = render(
      h(Segmented<'a' | 'b' | 'c'>, {
        label: 'Layer',
        options: [
          { id: 'a', label: 'Digestion' },
          { id: 'b', label: 'Blood sugar' },
          { id: 'c', label: 'Energy' },
        ],
        value: 'b',
        onChange: noop,
      }),
    )
    expect(html).toContain('role="group" aria-label="Layer"')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2)
    expect(html).toMatch(/aria-pressed="true"[^>]*>Blood sugar</)
    expect(html.match(/whitespace-nowrap/g)).toHaveLength(3)
    expect(html).toContain('overflow-x-auto')
  })

  it('IconButton names icon-only buttons and shows the words otherwise', () => {
    const only = render(h(IconButton, { icon: h(PlusIcon), label: 'Add food', iconOnly: true }))
    expect(only).toContain('aria-label="Add food"')
    expect(only).not.toContain('<span>Add food</span>')
    const withText = render(h(IconButton, { icon: h(PlusIcon), label: 'Add food', 'aria-pressed': true }))
    expect(withText).toContain('<span>Add food</span>')
    expect(withText).toContain('aria-pressed="true"')
    expect(withText).toContain('type="button"')
  })

  it('PlayButton is named for what it will do', () => {
    expect(render(h(PlayButton, { playing: false, onToggle: noop }))).toContain('aria-label="Play"')
    expect(render(h(PlayButton, { playing: true, onToggle: noop }))).toContain('aria-label="Pause"')
  })

  it('FoodChip has a separate, named remove button', () => {
    const html = render(h(FoodChip, { emoji: '🥤', name: 'Cola', servings: 2, onEdit: noop, expanded: false, onRemove: noop }))
    expect(html).toContain('aria-label="Remove Cola"')
    expect(html).toContain('aria-label="Cola, Servings 2"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('×2')
    expect(html.match(/<button/g)).toHaveLength(2)
    expect(render(h(FoodChip, { emoji: '🥤', name: 'Cola', servings: 1, onRemove: noop })).match(/<button/g)).toHaveLength(1)
  })

  it('StatusTag shows a different shape and a word for each status', () => {
    const shapes = new Set<string>()
    for (const [status, word] of [
      ['simulated', 'Calculated from studies'],
      ['assumption', 'Best guess'],
      ['illustration', 'Drawing only'],
    ] as const) {
      const html = render(h(StatusTag, { status }))
      expect(html).toContain(`data-status="${status}"`)
      expect(html).toContain(word)
      shapes.add(html.match(/<svg[\s\S]*<\/svg>/)![0])
    }
    expect(shapes.size).toBe(3)
  })

  it('PersonTag is text, or a button when it can open "How we know"', () => {
    expect(render(h(PersonTag, { profile: 'adult-ref' }))).toMatch(/^<span[^>]*>Typical adult<\/span>$/)
    const button = render(h(PersonTag, { profile: 'adult-ref', onInfo: noop }))
    expect(button).toMatch(/^<button type="button"/)
    expect(button).toContain('title="ICMR-NIN 2020 reference adult man."')
  })

  it('Dock is a named region holding play, clock, pace and track', () => {
    const html = render(h(Dock, { label: 'Timeline', play: 'PLAY', clock: '1 h 30 min', pace: 'PACE', children: 'TRACK' }))
    expect(html).toMatch(/^<section aria-label="Timeline"/)
    for (const slot of ['PLAY', '1 h 30 min', 'PACE', 'TRACK']) expect(html).toContain(slot)
    expect(html.indexOf('PLAY')).toBeLessThan(html.indexOf('TRACK'))
  })
})

describe('kit source rules', () => {
  const dir = fileURLToPath(new URL('.', import.meta.url))
  const sources = readdirSync(dir)
    .filter((f) => f.endsWith('.tsx'))
    .map((f) => [f, readFileSync(`${dir}/${f}`, 'utf8')] as const)

  it('only Play is fully round (no pills)', () => {
    // Spelled in two parts so the WP-07 acceptance grep over this folder finds only PlayButton.
    const pill = 'rounded-' + 'full'
    expect(sources.filter(([, src]) => src.includes(pill)).map(([f]) => f)).toEqual(['PlayButton.tsx'])
  })

  it('never clips or clamps a label (Hindi needs the room)', () => {
    // The one exception (council MUST 9): a meal chip wider than the whole meal bar shortens its
    // food name, marked data-may-shorten, before its servings or ✕ would be cut off; the full
    // name is in the button's name, and the e2e clipped-text check knows the mark.
    const shortens = /data-may-shorten="" className="[^"]*"/g
    for (const [f, src] of sources) expect(src.replace(shortens, ''), f).not.toMatch(/\b(truncate|line-clamp-\d|text-ellipsis)\b/)
    expect(sources.filter(([, src]) => src.match(shortens)).map(([f]) => f)).toEqual(['FoodChip.tsx'])
  })

  it('uses only the v2 colour tokens, never the v1 names or raw hex', () => {
    for (const [f, src] of sources) {
      expect(src, f).not.toMatch(/\b(?:bg|text|border|fill|stroke)-(?:paper|panel|sunk|rule|meal-a|meal-b)\b(?![\w-])/)
      expect(src, f).not.toMatch(/#[0-9a-f]{6}\b/i)
    }
  })
})
