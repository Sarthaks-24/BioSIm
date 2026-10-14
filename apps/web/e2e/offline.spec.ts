import { expect, test, type Page } from '@playwright/test'
import { GATE_ROUTES, SIM_BODY, gateSteps, modeFor, onlyIn } from './helpers/gate.ts'

// Works offline in class: after one visit the service worker holds the core (the stage, the
// digestion model and the engine; T12d), so the page reloads without a network and still plays.

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

// E-2: the engine is a lazy chunk, and the service worker precaches it, so a page opened cold
// without a network (a new tab, after one visit) still runs the model: the body, the graphs and
// the timeline all need a run.
test('a cold start offline runs the engine (a new tab after one visit)', async ({ page, context }) => {
  onlyIn('desktop')
  await page.goto('/sim')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await context.setOffline(true)
  const cold = await context.newPage()
  await cold.goto('/sim?v=3&a=cola:1&t=60')
  await expect(cold.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
  await expect(cold.getByRole('slider', { name: 'Timeline' })).toBeVisible()
  await expect(cold.locator('[data-stage] figure svg[role="img"]').first()).toBeVisible()
  await context.setOffline(false)
})

// Load on demand, small cache (T12d, R71). Only the core is saved at install: the stage with its
// flat body, the digestion model and the engine. The 3D body loads on first use.

/** Waits until the service worker is active, which is after it has saved the core (its precache). */
const installed = (page: Page) =>
  page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })

const NEEDS_INTERNET = 'This part needs internet once. Open it once with internet.'

test('a cold offline start of the stage: the core runs with the flat body; the 3D body says it needs the internet once', async ({
  page,
  context,
}) => {
  onlyIn('desktop')
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  // Home only: the stage, its parts and the 3D body were never opened on this device.
  await page.goto('/')
  await installed(page)
  await context.setOffline(true)
  try {
    await page.goto('/sim?v=3&a=cola:1')
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await expect(page.getByText(NEEDS_INTERNET)).toBeVisible()
    await expect(page.locator('[data-body="flat"]')).toBeVisible()
    await expect(page.locator('[data-body="3d"]')).toHaveCount(0)
    // No reload (main.tsx's stale-file reload is for when the internet is on): the stage just plays.
    await page.getByRole('button', { name: 'Play' }).click()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
    // The precache is the core only: no 3D file in any cache.
    const cached3d = await page.evaluate(async () => {
      for (const name of await caches.keys())
        for (const req of await (await caches.open(name)).keys()) if (/BodyCanvas-/.test(req.url)) return req.url
      return null
    })
    expect(cached3d).toBeNull()
  } finally {
    await context.setOffline(false)
  }
  // Back online: the 3D body is asked for again by itself.
  await expect(page.locator('[data-body="3d"]')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(NEEDS_INTERNET)).toHaveCount(0)
})

test('"Save for class offline" on /teach: each lesson says so, and a lesson then opens offline in 3D', async ({ page, context }) => {
  onlyIn('desktop')
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/teach')
  await installed(page)
  const lessons = page.locator('[data-lesson]')
  // Every chapter's lessons (all public since H-1), once the list is drawn.
  await expect(lessons).toHaveCount(8)
  const count = await lessons.count()
  expect(count).toBeGreaterThan(0)
  await expect(lessons.getByText('Not saved for offline')).toHaveCount(count)
  await page.getByRole('button', { name: 'Save all for class offline' }).click()
  await expect(lessons.getByText('Ready for class offline ✓')).toHaveCount(count, { timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Save all for class offline' })).toBeDisabled()
  const href = await lessons.first().getByRole('link').first().getAttribute('href')
  await context.setOffline(true)
  try {
    await page.goto(href!)
    await expect(page.locator('[data-body="3d"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(NEEDS_INTERNET)).toHaveCount(0)
    // The stage's on-use parts were saved too: the table sheet opens offline.
    await page.locator('body').press('t')
    await expect(page.getByRole('dialog', { name: 'The graphs as a table' })).toBeVisible()
    // Still saved after a reload, offline.
    await page.goto('/teach')
    await expect(lessons.getByText('Ready for class offline ✓')).toHaveCount(count)
  } finally {
    await context.setOffline(false)
  }
})

/** What a cache holds, as paths (with their search), or [] if there is no such cache. */
const cached = (page: Page, name: string) =>
  page.evaluate(async (name) => {
    if (!(await caches.has(name))) return []
    return (await (await caches.open(name)).keys()).map((r) => {
      const u = new URL(r.url)
      return u.pathname + u.search
    })
  }, name)

// R120 #1: a lesson saved for class goes to lp-saved, which never expires; lp-lazy (on first use)
// keeps 150 files. Before, both shared lp-lazy at 40 files, fewer than one lesson's save: the next
// files opened pushed saved ones out, and the lesson failed offline in class.
test('a saved lesson stays saved after browsing 200 other lazy files: lp-saved is never pushed out', async ({ page, context }) => {
  onlyIn('desktop')
  test.slow()
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/teach')
  await installed(page)
  // Controlled by the service worker from here (the first visit is not: "prompt", no clients.claim).
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  const lessons = page.locator('[data-lesson]')
  await expect(lessons.first().getByText('Not saved for offline')).toBeVisible()
  // One lesson, then all of them.
  await lessons
    .first()
    .getByRole('button', { name: /^Save for class offline: / })
    .click()
  await expect(lessons.first().getByText('Ready for class offline ✓')).toBeVisible({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Save all for class offline' }).click()
  const count = await lessons.count()
  await expect(lessons.getByText('Ready for class offline ✓')).toHaveCount(count, { timeout: 30_000 })
  const manifest = (await (await page.request.get('/pack-manifest.json')).json()) as {
    cache: string
    entries: { id: string; tier: string; urls: string[] }[]
  }
  expect(manifest.cache).toBe('lp-saved')
  const saved = await cached(page, 'lp-saved')
  const lazyUrls = manifest.entries.filter((e) => e.tier === 'lazy').flatMap((e) => e.urls)
  const lesson = manifest.entries.filter((e) => e.id === 'stage' || e.id === '3d').flatMap((e) => e.urls)
  for (const url of lesson) expect(saved, 'the stage’s parts and 3D are in lp-saved').toContain(url)
  // Casual browsing: 200 more lazy files (the real ones under other addresses; the lazy tier has
  // about 60), each kept in lp-lazy on first use, more than its 150.
  await page.evaluate(async (urls) => {
    for (let i = 0; i < 200; i++) await (await fetch(`${urls[i % urls.length]}?browse=${i}`)).arrayBuffer()
  }, lazyUrls)
  // lp-lazy pushed the lesson's files out (least recently used first; Workbox's expiration runs
  // after each put, a few entries behind); lp-saved kept all of it.
  await expect.poll(async () => (await cached(page, 'lp-lazy')).filter((u) => lesson.includes(u)), { timeout: 20_000 }).toEqual([])
  expect((await cached(page, 'lp-lazy')).length).toBeLessThan(170)
  expect(new Set(await cached(page, 'lp-saved'))).toEqual(new Set(saved))
  const href = await lessons.first().getByRole('link').first().getAttribute('href')
  await context.setOffline(true)
  try {
    await page.goto('/teach')
    await expect(lessons.getByText('Ready for class offline ✓')).toHaveCount(count)
    await page.goto(href!)
    await expect(page.locator('[data-body="3d"]')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(NEEDS_INTERNET)).toHaveCount(0)
    await page.locator('body').press('t')
    await expect(page.getByRole('dialog', { name: 'The graphs as a table' })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})

// R120 #16: saving while a new version waits saved the old version's files, which the new one (it
// takes over the next time the app opens) does not use. Now the save takes the deployed version's
// list, then lets that version take over and reloads, and the reloaded page says the lesson is ready.
// The "new version" is the same worker under another address, as in the update-note tests below.
test('saving while a new version waits: the new version takes over, and the lesson is ready in it', async ({ page }) => {
  onlyIn('desktop')
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  await page.goto('/teach')
  await installed(page)
  await page.reload()
  await page.waitForFunction(() => !!navigator.serviceWorker.controller)
  const lessons = page.locator('[data-lesson]')
  await expect(lessons.first().getByText('Not saved for offline')).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js?next=1')
  })
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting, null, { timeout: 30_000 })
  const deployed = page.waitForRequest(/\/pack-manifest\.json\?deployed=\d+$/)
  await Promise.all([
    page.waitForEvent('load', { timeout: 30_000 }),
    lessons
      .first()
      .getByRole('button', { name: /^Save for class offline: / })
      .click(),
  ])
  await deployed
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes('next=1'), null, { timeout: 30_000 })
  await expect(lessons.first().getByText('Ready for class offline ✓')).toBeVisible({ timeout: 30_000 })
})

test.describe('a stale file after a deploy (vite:preloadError)', () => {
  // The service worker would answer from its cache; the test needs the file to fail.
  test.use({ serviceWorkers: 'block' })

  test('online: the page reloads once and the part loads', async ({ page }) => {
    onlyIn('desktop')
    await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
    let failed = 0
    await page.route(/\/BodyCanvas-[\w-]+\.js$/, (route) => (failed++ ? route.continue() : route.abort()))
    let loads = 0
    page.on('load', () => loads++)
    await page.goto('/sim?v=3&a=cola:1')
    await expect(page.locator('[data-body="3d"]')).toBeVisible({ timeout: 30_000 })
    expect(failed).toBe(2)
    expect(loads).toBe(2)
    await expect(page.getByText(NEEDS_INTERNET)).toHaveCount(0)
  })

  test('online, failing again after the reload: "Try again" (no loop), and the flat body stays', async ({ page }) => {
    onlyIn('desktop')
    await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
    let online = false
    await page.route(/\/BodyCanvas-[\w-]+\.js$/, (route) => (online ? route.continue() : route.abort()))
    await page.goto('/sim?v=3&a=cola:1')
    const note = page.getByText('Couldn’t load the 3D body. Check internet and tap Try again.')
    await expect(note).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('[data-body="flat"]')).toBeVisible()
    online = true
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.locator('[data-body="3d"]')).toBeVisible({ timeout: 30_000 })
    await expect(note).toHaveCount(0)
  })
})

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
// On v3 (MODEL_VERSION 3) a newer link is v=4.
const NEWER = '/sim?v=4&a=cola:1&act=walk.120.20&t=30'

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
