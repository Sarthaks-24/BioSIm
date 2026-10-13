import { expect, test, type Locator, type Page } from '@playwright/test'
import { GATE_ROUTES, SIM_BODY, bodySettled, expectInFirstScreen, expectNoPageScroll, modeFor, onlyIn } from './helpers/gate.ts'

// Layout gates. This file runs in the desktop, projector and phone projects; each test says
// which of them it belongs to.

for (const route of GATE_ROUTES.noScroll) {
  test(`no page scroll: ${route.url}`, async ({ page }) => {
    onlyIn('desktop', 'projector')
    const mode = modeFor(route)
    await page.goto(route.url)
    // The projector project starts with projector mode on (playwright.config.ts).
    if (test.info().project.name === 'projector') await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
    await page.waitForLoadState('networkidle')
    await expectNoPageScroll(page, { mode })
  })
}

/** What must be in the first phone screen, per page. */
const FIRST_SCREEN: Record<string, (page: Page) => Record<string, Locator>> = {
  // The stage (WP-12): on a phone one graph shows at a time, under the body, above the dock.
  '/sim': (page) => ({
    body: page.getByRole('img', { name: SIM_BODY, exact: true }),
    graph: page.locator('figure svg[role="img"]').filter({ visible: true }),
    Play: page.getByRole('button', { name: 'Play' }),
  }),
}

for (const route of GATE_ROUTES.firstScreen) {
  test(`body, a graph and Play in the first phone screen: ${route.url}`, async ({ page }) => {
    onlyIn('phone')
    const mode = modeFor(route)
    const targets = FIRST_SCREEN[route.url]
    test.fixme(!targets, `no first-screen targets listed for ${route.url}`)
    await page.goto(route.url)
    await page.waitForLoadState('networkidle')
    await bodySettled(page)
    await expectInFirstScreen(page, targets!(page), { mode })
  })
}
