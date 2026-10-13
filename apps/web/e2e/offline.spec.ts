import { expect, test, type Page } from '@playwright/test'
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

// A link made by a newer LifePeek (FP-6, architecture §2; in production before any v=3 link):
// offline it says so, and that the walk or run is not shown until the app updates; online, once
// the new version's service worker is waiting, "Update now" lets it take over and reopens the
// link whole (the address stays as the link came). English only (Hindi is report-only, R47).
const NEWER = '/sim?v=3&a=cola:1&act=walk.120.20&t=30'

/** Opens the stage once, waits for the service worker, and reloads so that it controls the page. */
async function controlled(page: Page) {
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/sim')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
}

test('a link from a newer LifePeek, offline: a plain note, and the link stays as it came', async ({ page, context }) => {
  await controlled(page)
  await context.setOffline(true)
  try {
    await page.goto(NEWER)
    const note = page.locator('[data-stage] [role="note"]')
    await expect(note.filter({ hasText: 'Made with a newer LifePeek. Connect once to update' })).toHaveCount(1)
    await expect(note.filter({ hasText: 'Update now' })).toHaveCount(0)
    // The meal shows; the walk is named once (by that note), not twice.
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await expect(note).toHaveCount(1)
    await page.waitForTimeout(500)
    expect(page.url()).toContain(NEWER)
  } finally {
    await context.setOffline(false)
  }
})

test('a link from a newer LifePeek, online: "Update now" loads the new version and reopens the link', async ({ page }) => {
  await controlled(page)
  await page.goto(NEWER)
  const note = page.locator('[data-stage] [role="note"]').filter({ hasText: 'made with a newer version of LifePeek' })
  await expect(note).toBeVisible()
  // No new version yet: no button.
  await page.waitForTimeout(1000)
  await expect(note.getByRole('button', { name: 'Update now' })).toHaveCount(0)
  // A new version arrives (the same worker under another address, as in the test above).
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js?next=1')
  })
  const update = note.getByRole('button', { name: 'Update now' })
  await expect(update).toBeVisible({ timeout: 30_000 })
  await Promise.all([page.waitForEvent('load', { timeout: 30_000 }), update.click()])
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes('next=1'), null, { timeout: 30_000 })
  expect(page.url(), 'the reload opens the link as it came').toContain(NEWER)
})
