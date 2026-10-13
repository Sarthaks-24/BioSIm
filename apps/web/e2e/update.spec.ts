import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Browser, type Page } from '@playwright/test'

// B16 (T7, FP-7): the "A new version of LifePeek is ready" note shows only for a real update: the
// page was opened by an older service worker (a controller at load) and a new one is waiting
// (components/UpdateToast.tsx). Projects desktop, and webkit-desktop / firefox-desktop with
// E2E_ENGINES=1. Needs a production build with its service worker (not `vite dev`).

const TOAST = '[data-update-toast]'

/** True if this browser lets the page register a service worker (some engines in some setups don't). */
async function canUseServiceWorker(page: Page) {
  return page.evaluate(() => {
    try {
      return !!navigator.serviceWorker
    } catch {
      return false
    }
  })
}

/** Waits until a service worker is active for this page's scope (the first install has finished). */
async function swActive(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 30_000 })
}

/**
 * Negative (the bug): a first visit in a fresh profile with two LifePeek tabs open at once. The
 * install one tab starts finishes in the other ("installed", isExternal), and vite-plugin-pwa
 * called that a new version. Nothing is new: no note in either tab. Five fresh contexts.
 * (Not reproduced in this harness before the fix either, as in the QA sweep: it guards the rule.)
 */
test('B16 two tabs opened at once on a first visit: no update note', async ({ browser, baseURL }) => {
  test.slow()
  // The second tab opens as the first one's install is under way, at five points of it.
  for (const [round, lagMs] of [0, 150, 400, 800, 1500].entries()) {
    const context = await browser.newContext({ baseURL })
    try {
      const [a, b] = await Promise.all([context.newPage(), context.newPage()])
      await Promise.all([a.goto('/sim'), a.waitForTimeout(lagMs).then(() => b.goto('/sim'))])
      test.skip(!(await canUseServiceWorker(a)), 'this browser has no service worker here')
      await Promise.all([swActive(a), swActive(b)])
      // Time for every install, activate and controller event to arrive.
      await a.waitForTimeout(2000)
      for (const [name, page] of [
        ['first', a],
        ['second', b],
      ] as const)
        await expect(page.locator(TOAST), `round ${round + 1} (second tab ${lagMs} ms later), ${name} tab`).toHaveCount(0)
    } finally {
      await context.close()
    }
  }
})

/** The e2e build (playwright.config.ts webServer), served by this test's own server. */
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist-e2e')

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

/**
 * Serves the e2e build as build A, or as build B: the same app with a service worker that differs
 * by a few bytes (what any new deploy changes) and answers "which-build" with "B". So the browser
 * sees a new version exactly as after a deploy.
 */
function serveBuilds() {
  let build: 'A' | 'B' = 'A'
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x')
    let file = path.join(DIST, decodeURIComponent(url.pathname))
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
    let body: Buffer | string = fs.readFileSync(file)
    if (url.pathname === '/sw.js' && build === 'B')
      body = `${body}\n// build B\nself.addEventListener('message', (e) => { if (e.data === 'which-build') e.ports[0]?.postMessage('B') })\n`
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' })
    res.end(body)
  })
  return {
    start: () =>
      new Promise<string>((done) =>
        server.listen(0, 'localhost', () => done(`http://localhost:${(server.address() as { port: number }).port}`)),
      ),
    stop: () => new Promise<void>((done) => server.close(() => done())),
    deploy: (b: 'A' | 'B') => void (build = b),
  }
}

/** The build of the service worker that controls the page ("A" if it does not answer). */
function controllerBuild(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string>((done) => {
        const sw = navigator.serviceWorker.controller
        if (!sw) return done('none')
        const channel = new MessageChannel()
        channel.port1.onmessage = (e) => done(String(e.data))
        sw.postMessage('which-build', [channel.port2])
        setTimeout(() => done('A'), 2000)
      }),
  )
}

async function freshPage(browser: Browser, baseURL: string) {
  const context = await browser.newContext({ baseURL })
  return { context, page: await context.newPage() }
}

/** Positive: build A is open (it controls the page), build B is deployed: the note shows, and "Reload" loads B. */
test('B16 a real update: the note shows, and Reload loads the new version', async ({ browser }) => {
  test.slow()
  test.skip(!fs.existsSync(path.join(DIST, 'sw.js')), 'needs the e2e build (dist-e2e) with its service worker')
  const builds = serveBuilds()
  const base = await builds.start()
  const { context, page } = await freshPage(browser, base)
  try {
    await page.goto('/sim')
    test.skip(!(await canUseServiceWorker(page)), 'this browser has no service worker here')
    await swActive(page)
    // The first visit is not controlled ("prompt": no clients.claim); the next load is, by A.
    await page.reload()
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 })
    await page.waitForTimeout(1500)
    await expect(page.locator(TOAST), 'no note while A is the newest').toHaveCount(0)
    expect(await controllerBuild(page)).toBe('A')

    builds.deploy('B')
    await page.reload()
    const toast = page.locator(TOAST)
    await expect(toast).toBeVisible({ timeout: 30_000 })
    await expect(toast).toContainText('A new version of LifePeek is ready')

    await Promise.all([page.waitForEvent('load', { timeout: 30_000 }), toast.getByRole('button', { name: 'Reload' }).click()])
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 30_000 })
    expect(await controllerBuild(page), 'after Reload, B controls the page').toBe('B')
    await expect(page.locator(TOAST)).toHaveCount(0)
  } finally {
    await context.close()
    await builds.stop()
  }
})
