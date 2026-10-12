import { expect, test } from '@playwright/test'
import { GATE_ROUTES, expectNoClippedText, modeFor } from './helpers/gate.ts'

// Hindi text is longer than English; nothing may be cut off (projects desktop and phone).
// WP-18 adds the +40 % pseudo-locale here.

for (const route of GATE_ROUTES.clippedText) {
  test(`no clipped text: ${route.url}`, async ({ page }) => {
    const mode = modeFor(route)
    await page.goto(route.url)
    await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
    await page.waitForLoadState('networkidle')
    await expectNoClippedText(page, { mode })
  })
}
