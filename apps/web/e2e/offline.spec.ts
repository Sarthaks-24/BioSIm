import { expect, test } from '@playwright/test'
import { GATE_ROUTES, V1_BODY, gateSteps, modeFor } from './helpers/gate.ts'

// Works offline in class: after one visit the service worker holds the whole app, so the page
// reloads without a network and still plays.

for (const route of GATE_ROUTES.offline) {
  test(`works offline after the first visit: ${route.url}`, async ({ page, context }) => {
    const mode = modeFor(route)
    await page.goto(route.url)
    await gateSteps('offline reload', mode, async () => {
      // `ready` resolves once a service worker is active, which is after it has cached every file.
      await page.evaluate(async () => {
        await navigator.serviceWorker.ready
      })
      await context.setOffline(true)
      await page.reload()
      await expect(page.getByRole('img', { name: V1_BODY, exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Play' }).click()
      await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    })
    await context.setOffline(false)
  })
}
