import { expect, test } from '@playwright/test'
import { GATE_ROUTES, checkAxe, modeFor } from './helpers/gate.ts'

// axe on every page: 0 serious or critical issues is the gate. v1 pages run in report mode but
// still fail on critical issues. Keyboard-only runs and "Show as table" come in WP-15.

for (const route of GATE_ROUTES.axe) {
  test(`axe: ${route.url}`, async ({ page }) => {
    const mode = modeFor(route)
    await page.goto(route.url)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
    await page.waitForLoadState('networkidle')
    await checkAxe(page, { mode, failOn: mode === 'report' ? ['critical'] : [] })
  })
}
