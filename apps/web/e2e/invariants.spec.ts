import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { PSEUDO_LANG, pseudoText } from '../src/i18n/pseudo.ts'
import {
  bodySettled,
  checkBody,
  expectInFirstScreen,
  expectNoPageScroll,
  gateSteps,
  goto,
  interactiveOverlaps,
  linkRoundTripProblems,
  onlyIn,
  returningVisitor,
  tryStep,
  verdict,
  watchConsole,
  type BodyLimits,
  type Mode,
} from './helpers/gate.ts'

// Track A invariants (T0; plan qa-fixes §3.1, §3.2) on the new window sizes and engines. All of
// them report for now (INVARIANTS below): the stage fails most of them before FP-1 and FP-2 (the
// red list, e2e/red-list.md). T2 enforces phone-small and tablet-portrait, T3 landscape and
// projector-sizes, T7 storage-blocked, T5 the dock and timeline checks on every Chromium project
// (TIMELINE); webkit-* and firefox-* report for a week first. T4's overlay checks (FP-5) are in
// e2e/overlays.spec.ts, which runs on these projects too.

/** Report or enforce, per project. A T-step flips its projects when its FP lands. */
export const INVARIANTS: Record<string, Mode> = {
  'phone-small': 'report',
  'phone-560': 'report',
  'phone-xs': 'report',
  'tablet-portrait': 'report',
  landscape: 'report',
  'projector-sizes': 'report',
  'storage-blocked': 'enforce',
  'webkit-desktop': 'report',
  'webkit-phone': 'report',
  'firefox-desktop': 'report',
}
const PROJECTS = Object.keys(INVARIANTS)
/**
 * The "body visible" checks (FP-1's acceptance: body, first screen, no scroll) per project. T2
 * (FP-1) enforces them on phone-small and tablet-portrait, T3 (FP-2) on landscape and
 * projector-sizes; the project's other checks (overlaps, overlays, Back, console, links) belong
 * to other FPs and follow INVARIANTS until those land.
 */
const BODY_VISIBLE: Record<string, Mode> = {
  ...INVARIANTS,
  'phone-small': 'enforce',
  'tablet-portrait': 'enforce',
  landscape: 'enforce',
  'projector-sizes': 'enforce',
}
/**
 * The dock and timeline checks (FP-3's acceptance: no overlapping controls, the slider's tap grid,
 * hour labels apart, the moments' targets and list, Settings on touch). T5 enforces them on every
 * Chromium project; webkit-* and firefox-* follow INVARIANTS (a week of reports first).
 */
const TIMELINE: Record<string, Mode> = {
  ...INVARIANTS,
  'phone-small': 'enforce',
  'phone-560': 'enforce',
  'phone-xs': 'enforce',
  'tablet-portrait': 'enforce',
  landscape: 'enforce',
  'projector-sizes': 'enforce',
  'storage-blocked': 'enforce',
}

const KEPT = '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=60'
/** The stage states of FP-1's acceptance: default, kept, first visit, empty, 6 foods. */
const STATES: Record<string, { url: string; firstVisit?: boolean }> = {
  default: { url: '/sim' },
  kept: { url: KEPT },
  'first visit': { url: '/sim', firstVisit: true },
  empty: { url: '/sim?v=2&a=' },
  '6 foods': { url: '/sim?v=2&a=roti:1,dal:1,milk:1,apple:1,banana:1,idli:1' },
}

/** The window sizes each project checks (the project's own first). */
const SIZES: Record<string, [number, number][]> = {
  landscape: [
    [640, 360],
    [740, 360],
    [844, 390],
    [640, 400],
  ],
  'projector-sizes': [
    [1024, 768],
    [1280, 800],
    [1366, 768],
  ],
  'storage-blocked': [
    [1440, 900],
    [390, 844],
  ],
}

/** What each project asks of the body (§3.2): phones ≥ 160 px (320×568: ≥ 120), projector ≥ 40 % of the stage. */
function limitsFor(project: string): BodyLimits {
  if (project === 'phone-xs') return { minHeight: 120, maxCovered: 0.1 }
  if (project === 'projector-sizes') return { minStageShare: 0.4, maxCovered: 0.1 }
  return { minHeight: 160, maxCovered: 0.1 }
}
const isPhone = (project: string) => /^phone-|^webkit-phone$/.test(project)
/** Projects whose stage must not scroll (phones may, below 700 px tall, after FP-1). */
const noScroll = (project: string) => ['tablet-portrait', 'landscape', 'projector-sizes'].includes(project)

/**
 * English, and the +40 % pseudo-locale (i18n/pseudo.ts) standing in for Hindi's longer words while
 * Hindi is paused (R47: the layout checks run on both, so layouts stay Hindi-ready). `?lang=pseudo`
 * works with storage blocked too; only a VITE_PSEUDO=1 build (the e2e one) has it.
 */
type Lang = 'en' | 'pseudo'
const lang = (url: string, l: Lang) => (l === 'pseudo' ? `${url}${url.includes('?') ? '&' : '?'}lang=pseudo` : url)
const PLAY: string = JSON.parse(readFileSync(new URL('../src/i18n/en.json', import.meta.url), 'utf8')).sim.play
const playName = (l: Lang) => (l === 'pseudo' ? pseudoText(PLAY) : PLAY)

/** Skips the running test on a build without the pseudo-locale (a deployed site). Call after opening a pseudo page. */
async function skipWithoutPseudo(page: Page) {
  const pseudo = await page
    .waitForFunction((code) => document.documentElement.lang === code, PSEUDO_LANG, { timeout: 5_000 })
    .then(() => true)
    .catch(() => false)
  test.skip(!pseudo, 'this build has no pseudo-locale (VITE_PSEUDO=1 only)')
}

// A step that cannot finish fails in seconds, as a problem of its check, not at the test's timeout.
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 })

test.beforeEach(async ({ page }) => {
  const project = test.info().project.name
  test.skip(!PROJECTS.includes(project), 'Track A invariant projects only')
  if (project === 'projector-sizes') await page.addInitScript(() => localStorage.setItem('lifepeek:projector', '1'))
  if (project === 'storage-blocked') {
    // A school browser with site data blocked: every Storage call throws (SecurityError), as with
    // cookies off. The service worker is blocked in the project's options.
    await page.addInitScript(() => {
      const blocked = () => {
        throw new DOMException('The operation is insecure.', 'SecurityError')
      }
      for (const name of ['localStorage', 'sessionStorage'] as const)
        Object.defineProperty(window, name, { configurable: true, get: blocked })
    })
  }
})

/**
 * Opens a stage URL and waits for it to settle. Returns null, or why it could not open as a problem
 * for the caller's verdict: a stage that does not draw is a finding, not a crashed test.
 */
async function open(page: Page, url: string, firstVisit = false): Promise<string | null> {
  if (!firstVisit && test.info().project.name !== 'storage-blocked') await returningVisitor(page)
  const problem = await tryStep(async () => {
    await goto(page, url)
    await page.locator('[data-stage]').waitFor()
    await page.waitForLoadState('networkidle')
    // The body picture, drawn at its settled size (none in the empty state, before FP-1).
    await bodySettled(page, 10_000)
    await page.evaluate(() => document.fonts.ready)
  })
  return problem && `${url} did not open: ${problem}`
}

for (const l of ['en', 'pseudo'] as const) {
  for (const [state, { url, firstVisit }] of Object.entries(STATES)) {
    test(`body visible, ${state}, ${l}`, async ({ page }) => {
      const project = test.info().project.name
      const mode = BODY_VISIBLE[project]!
      for (const [w, h] of SIZES[project] ?? [[0, 0]]) {
        if (w) await page.setViewportSize({ width: w, height: h })
        const size = page.viewportSize()!
        const where = `${size.width}×${size.height} ${state} ${l}`
        const failed = await open(page, lang(url, l), firstVisit)
        if (failed) {
          verdict(`body visible (${where})`, mode, [failed])
          continue
        }
        if (l === 'pseudo') await skipWithoutPseudo(page)
        await checkBody(page, limitsFor(project), { mode, label: where })
        if (isPhone(project)) {
          await expectInFirstScreen(
            page,
            {
              Play: page.getByRole('button', { name: playName(l), exact: true }),
              body: page.locator('[data-body]'),
              'graph plot': page.locator('figure svg[role="img"]').filter({ visible: true }),
            },
            { mode },
          )
        }
        if (noScroll(project)) await expectNoPageScroll(page, { mode })
      }
    })
  }
}

test('no overlapping controls', async ({ page }) => {
  const mode = TIMELINE[test.info().project.name]!
  for (const url of ['/sim', lang(KEPT, 'pseudo')]) {
    const failed = await open(page, url)
    verdict(`no overlapping controls ${url}`, mode, failed ? [failed] : await interactiveOverlaps(page))
  }
})

/** The timeline's slider, scrolled into the window (a phone's dock may sit past its first screen). */
async function slider(page: Page) {
  const s = page.getByRole('slider').first()
  await s.scrollIntoViewIfNeeded()
  return s
}

test('a 3 × 10 tap grid over the slider’s 44 px band hits the slider (B4)', async ({ page }) => {
  const mode = TIMELINE[test.info().project.name]!
  for (const url of ['/sim', lang(KEPT, 'pseudo')]) {
    await gateSteps(`tap grid ${url}`, mode, async () => {
      const failed = await open(page, url)
      if (failed) throw new Error(failed)
      const s = await slider(page)
      const missed = await s.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const out: string[] = []
        if (r.height < 43.5) out.push(`the band is ${r.height.toFixed(1)} px tall`)
        // Three rows (1 px in from the band's top and bottom, and its middle) × ten columns.
        for (const y of [r.top + 1, r.top + r.height / 2, r.bottom - 1])
          for (let i = 0; i < 10; i++) {
            const x = r.left + ((i + 0.5) * r.width) / 10
            const hit = document.elementFromPoint(x, y)
            if (!hit || !el.contains(hit)) {
              const what = hit
                ? `${hit.tagName.toLowerCase()} "${(hit.getAttribute('aria-label') ?? hit.textContent ?? '').trim().slice(0, 30)}"`
                : 'nothing'
              out.push(`(${Math.round(x)}, ${Math.round(y)}) hits ${what}`)
            }
          }
        return out
      })
      expect(missed, 'taps that miss the slider').toEqual([])
      // And a real tap in the band's top row moves the clock there: the middle of the bar is 5 h.
      const box = (await s.boundingBox())!
      const at = { x: box.x + box.width / 2, y: box.y + 2 }
      if (test.info().project.use.hasTouch) await page.touchscreen.tap(at.x, at.y)
      else await page.mouse.click(at.x, at.y)
      await expect.poll(async () => Math.abs(Number(await s.getAttribute('aria-valuenow')) - 300)).toBeLessThanOrEqual(10)
    })
  }
})

test('hour labels under the timeline are at least 8 px apart (B13, English and pseudo-locale)', async ({ page }) => {
  const project = test.info().project.name
  const mode = TIMELINE[project]!
  for (const [w, h] of SIZES[project] ?? [[0, 0]]) {
    if (w) await page.setViewportSize({ width: w, height: h })
    for (const l of ['en', 'pseudo'] as const) {
      const where = `${page.viewportSize()!.width}×${page.viewportSize()!.height} ${l}`
      const failed = await open(page, lang(KEPT, l))
      if (failed) {
        verdict(`hour labels apart (${where})`, mode, [failed])
        continue
      }
      if (l === 'pseudo') await skipWithoutPseudo(page)
      const boxes = await page.locator('[data-tick]').evaluateAll((els) =>
        els
          .filter((e) => getComputedStyle(e).visibility !== 'hidden' && e.getClientRects().length > 0)
          .map((e) => ({ text: e.textContent ?? '', l: e.getBoundingClientRect().left, r: e.getBoundingClientRect().right }))
          .sort((a, b) => a.l - b.l),
      )
      const problems: string[] = []
      if (boxes.length < 4) problems.push(`only ${boxes.length} hour labels show`)
      for (let i = 1; i < boxes.length; i++) {
        const gap = boxes[i]!.l - boxes[i - 1]!.r
        if (gap < 7.5) problems.push(`"${boxes[i - 1]!.text}" and "${boxes[i]!.text}" ${gap.toFixed(1)} px apart`)
      }
      verdict(`hour labels apart (${where})`, mode, problems)
    }
  }
})

test('key moments: finger-wide targets, and a target with several opens their list (U7)', async ({ page }) => {
  const mode = TIMELINE[test.info().project.name]!
  await gateSteps('moment targets', mode, async () => {
    const failed = await open(page, KEPT)
    if (failed) throw new Error(failed)
    const targets = page.getByRole('toolbar', { name: 'Key moments' }).getByRole('button')
    await expect(targets.first()).toBeAttached()
    // With a kept meal the lane holds its row too: every target is at least 44 × 44 px.
    for (const b of await targets.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect))) {
      expect(b.width, 'target width').toBeGreaterThanOrEqual(43.5)
      expect(b.height, 'target height').toBeGreaterThanOrEqual(43.5)
    }
    await slider(page)
    await page.locator('[data-marker][aria-haspopup="dialog"]').first().click()
    const list = page.getByRole('dialog', { name: 'Key moments' })
    await expect(list).toBeVisible()
    expect(await list.getByRole('listitem').count()).toBeGreaterThanOrEqual(2)
    await page.keyboard.press('Escape')
    await expect(list).toBeHidden()
  })
})

test('a touch screen’s Settings: Reduce motion first, no key list (U10)', async ({ page }) => {
  test.skip(!test.info().project.use.hasTouch, 'touch screens only')
  const mode = TIMELINE[test.info().project.name]!
  await gateSteps('Settings on touch', mode, async () => {
    const failed = await open(page, '/sim')
    if (failed) throw new Error(failed)
    const button = page.getByRole('button', { name: 'Settings', exact: true })
    await button.scrollIntoViewIfNeeded()
    await button.click()
    const sheet = page.getByRole('dialog', { name: 'Settings', exact: true })
    await expect(sheet.getByRole('switch').first()).toHaveAccessibleName('Reduce motion')
    await expect(sheet.getByRole('switch', { name: 'Reduce motion' })).toBeInViewport()
    await expect(sheet.getByRole('heading', { name: 'Keys', exact: true })).toBeHidden()
    await expect(sheet.locator('kbd').first()).toBeHidden()
  })
})

test('Back closes a sheet and keeps the meal', async ({ page }) => {
  onlyIn('phone-small', 'webkit-phone')
  // FP-6 (T8): enforced on both. A sheet closed on the page takes its history entry with it, so
  // the food is checked after that step back; Back with the sheet open closes it (e2e/links.spec.ts).
  const mode: Mode = 'enforce'
  await gateSteps('Back keeps the meal', mode, async () => {
    const failed = await open(page, '/sim')
    if (failed) throw new Error(failed)
    await page.getByRole('button', { name: 'Add food' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('combobox').fill('fries')
    await sheet.getByRole('combobox').press('Enter')
    await expect(sheet).toBeHidden()
    await page.waitForTimeout(500)
    expect(new URL(page.url()).pathname, 'closing the sheet stays on the stage').toBe('/sim')
    expect(new URL(page.url()).searchParams.get('a'), 'closing the sheet keeps the food').toContain('fries')
    await page.getByRole('button', { name: 'Add food' }).click()
    await expect(sheet).toBeVisible()
    await page.goBack()
    await expect(sheet).toBeHidden()
    expect(new URL(page.url()).pathname, 'Back closes the sheet and stays on the stage').toBe('/sim')
    expect(new URL(page.url()).searchParams.get('a'), 'Back keeps the food').toContain('fries')
  })
})

test('no console errors or warnings', async ({ page }) => {
  // B19 is fixed (T7): enforced on every project, whatever the project's mode (allow-list: CONSOLE_ALLOW).
  const mode: Mode = 'enforce'
  const console = watchConsole(page)
  const failed = await open(page, KEPT)
  if (failed) return verdict('console', mode, [failed, ...new Set(console.problems())])
  await page
    .getByRole('button', { name: 'Play' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.waitForTimeout(1500)
  verdict('console', mode, [...new Set(console.problems())])
})

test('the stage plays', async ({ page }) => {
  const mode = INVARIANTS[test.info().project.name]!
  await gateSteps('plays', mode, async () => {
    const failed = await open(page, '/sim')
    if (failed) throw new Error(failed)
    await page.getByRole('button', { name: 'Play' }).click({ timeout: 5_000 })
    await expect(page.getByRole('slider').first()).not.toHaveAttribute('aria-valuenow', '0')
  })
})

test('links survive a load (round trip)', async ({ page }) => {
  onlyIn('phone-small', 'storage-blocked')
  // FP-6 (T8): enforced wherever it runs.
  const mode: Mode = 'enforce'
  await returningVisitor(page)
  const roundTrip = async (links: string[]) => {
    const problems: string[] = []
    for (const link of links) {
      const thrown = await tryStep(async () => {
        const changed = await linkRoundTripProblems(page, link)
        const notes = await page.locator('[data-stage] [role="note"]').count()
        for (const c of changed)
          if (c.startsWith('lang=') || !notes) problems.push(`${link}: ${c}${c.startsWith('lang=') ? '' : ' (no note)'}`)
      })
      if (thrown) problems.push(`${link} did not open: ${thrown}`)
    }
    return problems
  }
  const links = [
    '/sim?v=2&a=cola:1',
    '/sim?v=2&a=roti:2,dal:1,milk:1&b=cheeseburger:1,fries:1&t=90',
    '/sim?v=2&a=cola:999',
    '/sim?v=2&a=cola:1&t=99999',
  ]
  verdict('link round trip', mode, await roundTrip(links))
  // A Hindi link (R47: Hindi is paused; it opens in English, with a note): report only, whatever the project's mode.
  verdict('link round trip (lang=hi)', 'report', await roundTrip(['/sim?v=2&a=cola:1&lang=hi']))
})

test('switches language with storage blocked', async ({ page }) => {
  onlyIn('storage-blocked')
  const mode = INVARIANTS[test.info().project.name]!
  await gateSteps('switches language', mode, async () => {
    const failed = await open(page, '/sim')
    if (failed) throw new Error(failed)
    const toHindi = page.getByRole('button', { name: /Switch to Hindi/ }).filter({ visible: true })
    test.skip(!(await toHindi.count()), 'Hindi is paused (R47): this build has no language switch')
    await toHindi.first().click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
    // And back (the button's words are in the other language).
    await page.locator('header button:has(> span[lang="en"])').filter({ visible: true }).first().click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  })
})

test('every dvh has a vh fallback before it', async ({ page }) => {
  onlyIn('phone-small')
  const thrown = await tryStep(async () => void (await page.goto('/')))
  if (thrown) return verdict('dvh fallback', 'report', [`/ did not open: ${thrown}`])
  const hrefs = await page.locator('link[rel="stylesheet"]').evaluateAll((els) => els.map((e) => (e as HTMLLinkElement).href))
  const problems: string[] = []
  for (const href of hrefs) {
    const css = await (await page.request.get(href)).text()
    for (const [, selector, block] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const decls = block!.split(';').map((d) => d.split(':').map((s) => s.trim()))
      decls.forEach(([prop, value], i) => {
        if (!prop || !value || !/\d*\.?\d+[dsl]vh\b/.test(value)) return
        const fallback = decls.slice(0, i).some(([p, v]) => p === prop && v && !/[dsl]vh\b/.test(v))
        if (!fallback) problems.push(`${selector!.trim().slice(0, 60)} { ${prop}: ${value} } has no vh fallback`)
      })
    }
  }
  verdict('dvh fallback', 'report', problems)
})
