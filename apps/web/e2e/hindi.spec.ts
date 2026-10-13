import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { pseudoText } from '../src/i18n/pseudo.ts'
import { GATE_ROUTES, expectInFirstScreen, expectNoClippedText, expectNoPageScroll, modeFor, verdict } from './helpers/gate.ts'

// Gate "Hindi parity" (03 §0.4, enforced from WP-18): nothing on the stage is cut off, in English,
// in Hindi and in the +40 % pseudo-locale (i18n/pseudo.ts), at 390 (phone), 1280 and 1440
// (desktop) and on the projector (1280 × 800, projector mode). Council MUST 9 and round 2: the
// Hindi Now line, its kept row and the summary fit the phone's first screen and the projector, no
// label lands on another, the "0 h" tick clears the slider's thumb and the knee's words clear its
// dotted line.

const text = (lang: string) => JSON.parse(readFileSync(new URL(`../src/i18n/${lang}.json`, import.meta.url), 'utf8'))
const [en, hi] = [text('en'), text('hi')]

/** The three languages: the saved language, the `lang` attribute it gives the page, and Play's name in it. */
const LANGS = [
  { name: 'English', saved: 'en', lang: 'en', play: en.sim.play },
  { name: 'Hindi', saved: 'hi', lang: 'hi', play: hi.sim.play },
  { name: 'pseudo-locale', saved: 'en-XA', lang: 'en-XA', play: pseudoText(en.sim.play) },
] as const

/** The stage's two fullest states: a first visit (medical note, clock at 0) and a kept meal at 40 min. */
const STATES = [
  { name: 'first visit', url: '/sim', firstVisit: true },
  { name: 'kept meal at 40 min', url: '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=40', firstVisit: false },
  { name: 'four foods', url: '/sim?v=2&a=roti:2,dal:1,orange-juice:1,boiled-egg:1&b=cola:1&t=400', firstVisit: false },
] as const

/** The pseudo-locale is only in builds made with VITE_PSEUDO=1 (Playwright's own server); a deployed site has none. */
const deployed = !!process.env.PLAYWRIGHT_BASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.PLAYWRIGHT_BASE_URL)

const next = GATE_ROUTES.clippedText.find((r) => r.url === '/sim')!

for (const l of LANGS) {
  for (const s of STATES) {
    test(`/sim, ${l.name}, ${s.name}: nothing clipped, nothing on top of anything`, async ({ page }) => {
      test.skip(l.saved === 'en-XA' && deployed, 'the deployed build has no pseudo-locale')
      const mode = modeFor(next)
      const project = test.info().project.name
      await page.addInitScript(
        ({ saved, firstVisit }) => {
          localStorage.setItem('lifepeek:lang', saved)
          if (!firstVisit) localStorage.setItem('lifepeek:medicalNoteSeen', '1')
        },
        { saved: l.saved, firstVisit: s.firstVisit },
      )
      // The desktop project checks 1440 × 900 and 1280 × 800 (a laptop without projector mode).
      const sizes = project === 'desktop' ? [null, { width: 1280, height: 800 }] : [null]
      for (const size of sizes) {
        if (size) await page.setViewportSize(size)
        await page.goto(s.url)
        await expect(page.locator('html')).toHaveAttribute('lang', l.lang)
        await expect(page.locator('[data-stage] [role="img"]').first()).toBeVisible()
        await page.waitForLoadState('networkidle')
        // Fonts (Devanagari) change every width: measure after they are in.
        await page.evaluate(() => document.fonts.ready)
        await expectNoClippedText(page, { mode })
        await expectNoLineClamp(page, mode)
        await expectOneLine(page, mode)
        await expectNoOverlaps(page, mode)
        if (project === 'phone') await expectFirstScreen(page, s.firstVisit, l.play)
        else await expectNoPageScroll(page, { mode })
      }
    })
  }
}

/** No `line-clamp` anywhere on the stage: text is never cut to a number of lines (03 WP-18). */
async function expectNoLineClamp(page: Page, mode: 'enforce' | 'report') {
  const found = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-stage] *')]
      .filter((el) => getComputedStyle(el).webkitLineClamp !== 'none')
      .map((el) => `${el.tagName.toLowerCase()} "${el.textContent?.trim().slice(0, 30)}"`),
  )
  verdict('no line-clamp', mode, found)
}

/** Ticks and the knee's words never wrap: hour ticks under the timeline, the graphs' y ticks, "6 h → 48 h squeezed". */
async function expectOneLine(page: Page, mode: 'enforce' | 'report') {
  const found = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-tick], [data-axis="y"] span, [data-knee]')]
      .filter((el) => el.getClientRects().length > 0 && getComputedStyle(el).whiteSpace !== 'nowrap')
      .map((el) => `"${el.textContent?.trim()}" may wrap`),
  )
  verdict('ticks on one line', mode, found)
}

/**
 * No label lands on another (council MUST 9: "label-box intersection"): the organ labels, the food
 * key, the Now line, the summary and the medical note never overlap; the Now line and the summary
 * never lie on the body picture; no hour tick sits under the slider's thumb; the knee's words keep
 * clear of its dotted line.
 */
async function expectNoOverlaps(page: Page, mode: 'enforce' | 'report') {
  const problems = await page.evaluate(() => {
    type Box = { name: string; r: DOMRect }
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.opacity !== '0'
    }
    const boxes = (sel: string, name: (el: HTMLElement) => string) =>
      [...document.querySelectorAll<HTMLElement>(sel)].filter(visible).map((el) => ({ name: name(el), r: el.getBoundingClientRect() }))
    // Text boxes: each line of the text itself, not the padding of its row or of a button in it.
    const lines = (el: HTMLElement) => {
      const out: DOMRect[] = []
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        if (!n.textContent?.trim() || (n.parentElement && !visible(n.parentElement))) continue
        if (n.parentElement?.closest('[aria-hidden="true"]') && !el.closest('[aria-hidden="true"]')) continue
        const range = document.createRange()
        range.selectNodeContents(n)
        out.push(...[...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0))
      }
      return out
    }
    const words = (sel: string, name: string) =>
      [...document.querySelectorAll<HTMLElement>(sel)].filter(visible).flatMap((el) => lines(el).map((r) => ({ name, r })))
    const hit = (a: DOMRect, b: DOMRect, pad = 0) =>
      a.left < b.right - pad && b.left < a.right - pad && a.top < b.bottom - pad && b.top < a.bottom - pad
    const found: string[] = []
    const apart = (list: Box[], others: Box[], pad = 0.5) => {
      for (const a of list) for (const b of others) if (a !== b && hit(a.r, b.r, pad)) found.push(`${a.name} overlaps ${b.name}`)
    }
    const labels = [
      ...boxes('[data-callout]', (el) => `organ label "${el.textContent?.trim()}"`),
      ...words('[data-particle-key] li', 'the food key'),
      ...words('[data-now] > div:first-child > p:not([aria-hidden])', 'the Now line'),
      ...words('[data-now-job]', 'the Now line’s second row'),
      ...words('[data-now-kept] > span:nth-child(2)', 'the Now line’s kept row'),
      ...words('[data-summary]', 'the summary'),
      ...words('[data-first-run]', 'the medical note'),
    ]
    for (let i = 0; i < labels.length; i++) for (let j = i + 1; j < labels.length; j++) {
      const [a, b] = [labels[i]!, labels[j]!]
      if (a.name.startsWith('organ label') && b.name.startsWith('organ label')) continue
      if (a.name === b.name) continue
      if (hit(a.r, b.r, 0.5)) found.push(`${a.name} overlaps ${b.name}`)
    }
    // The stage's words are rows of their own, never laid over the picture.
    const picture = boxes('[data-stage] [role="img"]', () => 'the body picture')
    apart(
      [
        ...words('[data-now] > div:first-child > p:not([aria-hidden])', 'the Now line'),
        ...words('[data-now-kept] > span:nth-child(2)', 'the Now line’s kept row'),
        ...words('[data-summary]', 'the summary'),
      ],
      picture,
    )
    // Hour ticks and the thumb.
    apart(words('[data-tick]', 'an hour tick'), boxes('[data-thumb]', () => 'the slider’s thumb'), 0)
    // The knee's words and its dotted line.
    apart(words('[data-knee]', 'the knee’s words'), boxes('[data-knee-line]', () => 'the dotted knee line'), 0)
    return found
  })
  verdict('no label on another', mode, problems)
}

/** On a phone: the body, a graph and Play, and the stage's words (or, on a first visit, the medical note) in the first screen. */
async function expectFirstScreen(page: Page, firstVisit: boolean, play: string) {
  const targets: Record<string, Locator> = {
    body: page.locator('[data-stage] [role="img"]'),
    graph: page.locator('figure svg[role="img"]').filter({ visible: true }),
    Play: page.getByRole('button', { name: play, exact: true }),
  }
  if (firstVisit) targets['medical note'] = page.locator('[data-first-run]')
  else {
    targets['Now line'] = page.locator('[data-now] > div:first-child > p:not([aria-hidden])')
    targets['summary'] = page.locator('[data-summary]')
    if ((await page.locator('[data-now-kept]').count()) > 0) targets['kept row'] = page.locator('[data-now-kept]')
  }
  await expectInFirstScreen(page, targets)
  // The body is still a picture, not a strip. 130 px is the floor for the fullest case (Hindi or
  // the pseudo-locale, a kept meal: three meal-bar rows' worth of words above a 15 rem graph). It
  // was 90 px until WP-19 folded the site nav's own row into a menu (the fullest case is now 139 px).
  const body = (await targets.body!.first().boundingBox())!
  verdict('body at least 130 px tall', 'enforce', body.height >= 130 ? [] : [`body is ${Math.round(body.height)} px tall`])
}
