import { expect, test, type Page } from '@playwright/test'
import {
  checkBody,
  expectInFirstScreen,
  expectNoPageScroll,
  gateSteps,
  interactiveOverlaps,
  linkRoundTripProblems,
  onlyIn,
  overlayProblems,
  returningVisitor,
  skipWithoutHindi,
  verdict,
  watchConsole,
  type BodyLimits,
  type Mode,
} from './helpers/gate.ts'

// Track A invariants (T0; plan qa-fixes §3.1, §3.2) on the new window sizes and engines. All of
// them report for now (INVARIANTS below): the stage fails most of them before FP-1 and FP-2 (the
// red list, e2e/red-list.md). T2 enforces phone-small and tablet-portrait, T3 landscape and
// projector-sizes, T7 storage-blocked; webkit-* and firefox-* report for a week first.

/** Report or enforce, per project. A T-step flips its projects when its FP lands. */
export const INVARIANTS: Record<string, Mode> = {
  'phone-small': 'report',
  'phone-560': 'report',
  'phone-xs': 'report',
  'tablet-portrait': 'report',
  landscape: 'report',
  'projector-sizes': 'report',
  'storage-blocked': 'report',
  'webkit-desktop': 'report',
  'webkit-phone': 'report',
  'firefox-desktop': 'report',
}
const PROJECTS = Object.keys(INVARIANTS)

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

const lang = (url: string, l: 'en' | 'hi') => (l === 'hi' ? `${url}${url.includes('?') ? '&' : '?'}lang=hi` : url)

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

async function open(page: Page, url: string, firstVisit = false) {
  if (!firstVisit && test.info().project.name !== 'storage-blocked') await returningVisitor(page)
  await page.goto(url)
  await page.locator('[data-stage]').waitFor()
  await page.waitForLoadState('networkidle')
  // The body picture (none in the empty state, before FP-1); 3D replaces the flat one once loaded.
  await page.waitForTimeout(300)
  await page.evaluate(() => document.fonts.ready)
}

for (const l of ['en', 'hi'] as const) {
  for (const [state, { url, firstVisit }] of Object.entries(STATES)) {
    test(`body visible, ${state}, ${l}`, async ({ page }) => {
      const project = test.info().project.name
      const mode = INVARIANTS[project]!
      for (const [w, h] of SIZES[project] ?? [[0, 0]]) {
        if (w) await page.setViewportSize({ width: w, height: h })
        await open(page, lang(url, l), firstVisit)
        if (l === 'hi') await skipWithoutHindi(page)
        const size = page.viewportSize()!
        const where = `${size.width}×${size.height} ${state} ${l}`
        await checkBody(page, limitsFor(project), { mode, label: where })
        if (isPhone(project)) {
          await expectInFirstScreen(
            page,
            {
              Play: page.getByRole('button', { name: /^(Play|चलाएँ)$/ }),
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
  const mode = INVARIANTS[test.info().project.name]!
  for (const url of ['/sim', lang(KEPT, 'hi')]) {
    await open(page, url)
    verdict(`no overlapping controls ${url}`, mode, await interactiveOverlaps(page))
  }
})

test('overlays stay on screen, below the header, with a Close button; Esc closes them', async ({ page }) => {
  const mode = INVARIANTS[test.info().project.name]!
  await open(page, KEPT)
  const overlays = [
    {
      name: 'How we know',
      button: page.getByRole('button', { name: /^How we know/ }),
      dialog: page.getByRole('dialog', { name: /^How we know/ }),
    },
    {
      name: 'Typical adult',
      button: page.getByRole('button', { name: /^Typical adult/ }),
      dialog: page.getByRole('dialog', { name: /^Typical adult/ }),
    },
  ]
  for (const o of overlays) {
    const problems: string[] = []
    const button = o.button.filter({ visible: true }).first()
    if (!(await button.count())) continue
    const opened = await button
      .click({ timeout: 5_000 })
      .then(() => o.dialog.waitFor({ timeout: 5_000 }))
      .then(() => true)
      .catch(() => false)
    if (!opened) {
      problems.push('did not open')
    } else {
      problems.push(...(await overlayProblems(page, o.dialog)))
      await page.keyboard.press('Escape')
      if (await o.dialog.isVisible()) problems.push('Esc left it open')
    }
    verdict(`overlay ${o.name}`, mode, problems)
  }
})

test('Back closes a sheet and keeps the meal', async ({ page }) => {
  onlyIn('phone-small', 'webkit-phone')
  const mode = INVARIANTS[test.info().project.name]!
  await open(page, '/sim')
  await gateSteps('Back keeps the meal', mode, async () => {
    await page.getByRole('button', { name: 'Add food' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('combobox').fill('fries')
    await sheet.getByRole('combobox').press('Enter')
    await expect(sheet).toBeHidden()
    await page.goBack()
    await page.waitForTimeout(500)
    expect(new URL(page.url()).pathname, 'Back after adding a food stays on the stage').toBe('/sim')
    expect(new URL(page.url()).searchParams.get('a'), 'Back after adding a food keeps it').toContain('fries')
  })
})

test('no console errors or warnings', async ({ page }) => {
  const mode = INVARIANTS[test.info().project.name]!
  const console = watchConsole(page)
  await open(page, KEPT)
  await page
    .getByRole('button', { name: 'Play' })
    .click({ timeout: 5_000 })
    .catch(() => {})
  await page.waitForTimeout(1500)
  verdict('console', mode, [...new Set(console.problems())])
})

test('the stage plays', async ({ page }) => {
  const mode = INVARIANTS[test.info().project.name]!
  await open(page, '/sim')
  await gateSteps('plays', mode, async () => {
    await page.getByRole('button', { name: 'Play' }).click({ timeout: 5_000 })
    await expect(page.getByRole('slider').first()).not.toHaveAttribute('aria-valuenow', '0')
  })
})

test('links survive a load (round trip)', async ({ page }) => {
  onlyIn('phone-small', 'storage-blocked')
  const mode = INVARIANTS[test.info().project.name]!
  await returningVisitor(page)
  const problems: string[] = []
  for (const link of [
    '/sim?v=2&a=cola:1',
    '/sim?v=2&a=roti:2,dal:1,milk:1&b=cheeseburger:1,fries:1&t=90',
    '/sim?v=2&a=cola:1&lang=hi',
    '/sim?v=2&a=cola:999',
    '/sim?v=2&a=cola:1&t=99999',
  ]) {
    const changed = await linkRoundTripProblems(page, link)
    const notes = await page.locator('[data-stage] [role="note"]').count()
    for (const c of changed) if (c.startsWith('lang=') || !notes) problems.push(`${link}: ${c}${c.startsWith('lang=') ? '' : ' (no note)'}`)
  }
  verdict('link round trip', mode, problems)
})

test('every dvh has a vh fallback before it', async ({ page }) => {
  onlyIn('phone-small')
  await page.goto('/')
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
