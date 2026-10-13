import { expect, test } from '@playwright/test'
import { GATE_ROUTES, SIM_BODY, gateSteps, modeFor } from './helpers/gate.ts'

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
      await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Play' }).click()
      await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    })
    await context.setOffline(false)
  })
}

// A classroom laptop keeps a tab open for days (council round 3): when a new version is waiting,
// the open page says so and offers a reload, instead of keeping the old app until every tab is
// closed. The "new version" here is the same worker under another address (a browser can't be
// handed a new sw.js in a test): the page's update check treats it like one.
test('a waiting new version offers a reload, from the keyboard too', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/sim')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  // The note is for a page an older version opened (B16, T7): the first visit is not controlled
  // ("prompt", no clients.claim), the next load is.
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  const note = page.getByRole('status').filter({ hasText: 'A new version of LifePeek is ready.' })
  await expect(note).toHaveCount(0)
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js?next=1')
  })
  await expect(note).toBeVisible()
  const reload = note.getByRole('button', { name: 'Reload' })
  const later = note.getByRole('button', { name: 'Later' })
  await expect(reload).toBeVisible()
  await later.focus()
  await expect(later).toBeFocused()
  // Esc, like "Later": the note goes, and the lesson goes on.
  await page.keyboard.press('Escape')
  await expect(note).toHaveCount(0)
  await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
})
