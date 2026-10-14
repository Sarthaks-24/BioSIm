import { expect, test, type Page } from '@playwright/test'
import { goto, onlyIn, returningVisitor } from './helpers/gate.ts'

// The engine worker (W-2, architecture §3.2): after the page's first run, runs are worked out in a
// worker, so the page stays quick to answer on a slow phone. Its file is lazy (R71: never in the
// precache). A worker that never answers, a worker file that does not arrive, or a cold start
// offline before the file was ever saved: the page runs the engine itself, within 3.5 s at worst.
// Projects: desktop and phone.

test.beforeEach(async ({ page }) => {
  onlyIn('desktop', 'phone')
  await returningVisitor(page)
})

const WORKER_FILE = /\/engine-worker-[\w-]+\.js$/

async function open(page: Page, url: string) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
}

/** A new run: P keeps the meal, and the kept run's ghost line is drawn once that run is made. */
async function keep(page: Page) {
  const start = Date.now()
  await page.locator('body').press('p')
  await expect(page.locator('[data-line="kept"]').filter({ visible: true }).first()).toBeVisible({ timeout: 10_000 })
  return Date.now() - start
}

/** The engine worker's file in any cache of the service worker, or null. */
const cachedWorker = (page: Page) =>
  page.evaluate(async () => {
    for (const name of await caches.keys())
      for (const req of await (await caches.open(name)).keys()) if (/\/engine-worker-/.test(req.url)) return `${name} ${req.url}`
    return null
  })

/** The engine worker of the page, once its file has run (its `serve` set onmessage). */
async function engineWorker(page: Page, url: string) {
  const created = page.waitForEvent('worker', (w) => WORKER_FILE.test(w.url()))
  await open(page, url)
  const worker = await created
  await worker.evaluate(async () => {
    while (!self.onmessage) await new Promise((r) => setTimeout(r, 10))
  })
  // The page reads its "ready" next.
  await page.waitForTimeout(300)
  return worker
}

test('after the first run, a run is made in the engine worker; its file is not precached', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const worker = await engineWorker(page, '/sim?v=3&a=cola:1')
  // Count the runs the worker answers.
  await worker.evaluate(() => {
    const scope = self as unknown as { onmessage: (e: MessageEvent) => void; runs: number }
    const answer = scope.onmessage
    scope.runs = 0
    scope.onmessage = (e) => {
      scope.runs++
      answer(e)
    }
  })
  await keep(page)
  expect(await worker.evaluate(() => (self as unknown as { runs: number }).runs)).toBe(1)
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  expect(await cachedWorker(page)).toBeNull()
  expect(errors).toEqual([])
})

test('a worker that never answers: the run comes within 3.5 s, under "Working it out…"; later runs at once', async ({ page }) => {
  const worker = await engineWorker(page, '/sim?v=3&a=cola:1')
  // Blocked: it takes every run and never answers.
  await worker.evaluate(() => {
    self.onmessage = () => {}
  })
  // A walk changes the current run: it goes to the worker.
  await page.getByRole('button', { name: 'Add food' }).filter({ visible: true }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Activity', exact: true }).click()
  // Timed in the page: from the click to the run's first moment on screen.
  await page.evaluate(() => {
    const w = window as unknown as { clickAt?: number; doneAt?: number }
    addEventListener('click', () => (w.clickAt ??= performance.now()), { capture: true })
    new MutationObserver(() => {
      if (!w.doneAt && document.querySelector('[data-moment~="event.activityStart"]')) w.doneAt = performance.now()
    }).observe(document.body, { subtree: true, childList: true, attributes: true })
  })
  await page.getByRole('button', { name: 'Walk 20 min, from 0:30' }).click()
  // The old run stays on show, its graphs dimmed under the words (after 300 ms).
  await expect(page.locator('[data-working]')).toHaveAttribute('data-working', 'Working it out…')
  await expect(page.locator('[data-moment~="event.activityStart"]')).toHaveCount(1, { timeout: 10_000 })
  const ms = await page.evaluate(() => {
    const w = window as unknown as { clickAt: number; doneAt: number }
    return Math.round(w.doneAt - w.clickAt)
  })
  test.info().annotations.push({ type: 'fallback run', description: `${ms} ms` })
  console.log(`[w2] fallback run with the worker blocked: ${ms} ms`)
  expect(ms, 'the worker is given up after 3 s').toBeGreaterThanOrEqual(2900)
  expect(ms, 'the run is made on the page within 3.5 s').toBeLessThanOrEqual(3500)
  await expect(page.locator('[data-working]')).toHaveCount(0)
  // The worker is given up for the session (terminated): the next run is made on the page at once.
  expect(page.workers()).toHaveLength(0)
  expect(await keep(page)).toBeLessThan(2500)
})

test.describe('without the worker file', () => {
  // The service worker would answer for the file; this test makes it fail.
  test.use({ serviceWorkers: 'block' })

  test('a worker file that does not arrive: runs are made on the page, no error', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.route(WORKER_FILE, (route) => route.abort())
    await open(page, '/sim?v=3&a=cola:1')
    // The worker failed (its error event) and is gone.
    await expect.poll(() => page.workers().length).toBe(0)
    expect(await keep(page)).toBeLessThan(2500)
    expect(errors).toEqual([])
  })
})

test('a cold start offline, the worker file never saved: the page runs every run', async ({ page, context }) => {
  onlyIn('desktop')
  // The first visit installs the service worker; that page is not controlled, so nothing saves the worker's file.
  await open(page, '/sim')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  expect(await cachedWorker(page)).toBeNull()
  await context.setOffline(true)
  try {
    const cold = await context.newPage()
    const errors: string[] = []
    cold.on('pageerror', (e) => errors.push(String(e)))
    await open(cold, '/sim?v=3&a=cola:1')
    await cold.waitForTimeout(300)
    expect(await keep(cold)).toBeLessThan(2500)
    expect(await cachedWorker(cold)).toBeNull()
    expect(errors).toEqual([])
  } finally {
    await context.setOffline(false)
  }
})
