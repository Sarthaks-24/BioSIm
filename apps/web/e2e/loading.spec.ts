import { expect, test, type Page } from '@playwright/test'
import { CALLOUTS } from '../src/anatomy/callouts.ts'
import { SIM_BODY, onlyIn, verdict } from './helpers/gate.ts'

// B17 (T7, FP-7): no broken frames while the stage loads. Seen on WebKit under load: graph lines
// drawn outside their plot, organ labels ~90 px off their organs. 1, 3 and 6 s after the page is
// asked for, every drawn line is inside its plot, and every organ label's leader dot is ≤ 12 px
// from where its organ is: projected here, with the 3D body's camera and the canvas's box (never
// the app's own numbers). Report for a week (qa-fixes §1.1), then enforce.
// Projects desktop, and webkit-desktop / webkit-phone / firefox-desktop with E2E_ENGINES=1.

// TODO(2026-10-21, R59): B17 reports for one clean week after T7's merge. On or after 2026-10-21,
// if the nightly engines job (WebKit, Firefox) and the desktop runs show no `[gate report] … B17`
// line, set this to 'enforce' and update e2e/red-list.md. Kept report-only at T11 (2026-10-14).
const MODE = 'report' as const
const MAX_OFF_PX = 12
/** Lines are drawn up to this far past the plot's box (their width, round caps, the axis break). */
const LINE_SLACK_PX = 4

type Anchors = Record<string, [number, number, number]>

/** What is wrong with the stage right now (lines out of their plot, labels off their organs). */
function brokenFrames(page: Page, anchors: Anchors) {
  return page.evaluate(
    ({ anchors, maxOff, slack }) => {
      const problems: string[] = []
      const shown = (el: Element) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      }
      // (a) Graph lines inside their plot (the svg's parent is the plot box).
      for (const svg of document.querySelectorAll('figure svg[role="img"]')) {
        if (!shown(svg) || !svg.parentElement) continue
        const plot = svg.parentElement.getBoundingClientRect()
        for (const line of svg.querySelectorAll('[data-line]')) {
          const r = line.getBoundingClientRect()
          if (!r.width && !r.height) continue
          if (r.left < plot.left - slack || r.right > plot.right + slack || r.top < plot.top - slack || r.bottom > plot.bottom + slack)
            problems.push(
              `${line.getAttribute('data-line')} line ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)} outside its plot ${Math.round(plot.left)},${Math.round(plot.top)}–${Math.round(plot.right)},${Math.round(plot.bottom)}`,
            )
        }
      }
      // (b) Organ labels on the drawn 3D body: the leader's dot vs the organ, projected here.
      const body = document.querySelector('[data-body="3d"][data-ready]')
      const canvas = body?.querySelector('canvas')
      const camera = (
        window as { __lifepeekCamera?: { matrixWorldInverse: { elements: number[] }; projectionMatrix: { elements: number[] } } }
      ).__lifepeekCamera
      if (body && canvas && camera) {
        const c = canvas.getBoundingClientRect()
        const mul = (m: number[], v: number[]) =>
          [0, 1, 2, 3].map((r) => m[r]! * v[0]! + m[4 + r]! * v[1]! + m[8 + r]! * v[2]! + m[12 + r]! * v[3]!)
        for (const g of body.querySelectorAll('[data-leader]')) {
          if (g.getAttribute('visibility') !== 'visible') continue
          const key = [...body.querySelectorAll('[data-leader]')].indexOf(g)
          const id = body.querySelectorAll('[data-callout]')[key]?.getAttribute('data-callout')
          const anchor = id ? anchors[id] : undefined
          const dot = g.querySelector('circle')?.getBoundingClientRect()
          if (!anchor || !dot) continue
          const clip = mul(camera.projectionMatrix.elements, mul(camera.matrixWorldInverse.elements, [...anchor, 1]))
          const x = c.left + ((clip[0]! / clip[3]! + 1) / 2) * c.width
          const y = c.top + ((1 - clip[1]! / clip[3]!) / 2) * c.height
          const off = Math.hypot(dot.left + dot.width / 2 - x, dot.top + dot.height / 2 - y)
          if (off > maxOff) problems.push(`${id} label's dot is ${Math.round(off)} px from its organ`)
        }
      }
      return problems
    },
    { anchors, maxOff: MAX_OFF_PX, slack: LINE_SLACK_PX },
  )
}

test('B17 no broken frames while the stage loads (1, 3 and 6 s)', async ({ page }) => {
  const anchors: Anchors = Object.fromEntries(Object.entries(CALLOUTS).map(([k, c]) => [k, [c.anchor.x, c.anchor.y, c.anchor.z]]))
  const problems: string[] = []
  const asked = Date.now()
  void page.goto('/sim?v=3&a=cola:1&b=cheeseburger:1,fries:1&t=60').catch(() => undefined)
  for (const at of [1000, 3000, 6000]) {
    await page.waitForTimeout(Math.max(0, asked + at - Date.now()))
    const found = await brokenFrames(page, anchors).catch((e) => [`could not look: ${String(e).split('\n')[0]}`])
    problems.push(...found.map((p) => `${at / 1000} s: ${p}`))
  }
  verdict('B17 frames while loading', MODE, problems)
})

// E-2 (architecture §3.1): the engine is a lazy chunk, fetched when /sim mounts. Until it is here
// only the meal bar shows; after 300 ms "Working it out…" says why. A file that does not arrive
// gets the load-failure box with "Try again", never the error page. Project desktop.
test.describe('the engine arriving late, or not at all', () => {
  // The service worker would serve the file from its cache; these tests need the network.
  test.use({ serviceWorkers: 'block' })
  const ENGINE = /\/run-[\w-]+\.js$/
  // Chromium: WebKit and Firefox keep a failed module for the page's life (hence Reload).
  test.beforeEach(() => onlyIn('desktop'))

  test('slow: "Working it out…" after 300 ms, then the stage', async ({ page }) => {
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route(ENGINE, async (route) => {
      await held
      await route.continue()
    })
    await page.goto('/sim?v=3&a=cola:1')
    await expect(page.getByRole('button', { name: 'Add food' })).toBeVisible()
    await expect(page.getByRole('status').filter({ hasText: 'Working it out…' })).toBeVisible()
    await expect(page.locator('[data-stage]')).toHaveCount(0)
    release()
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Timeline' })).toBeVisible()
    await expect(page.getByText('Working it out…')).toHaveCount(0)
  })

  test('failed: the box says so, "Try again" loads it, and after a second failure it offers Reload', async ({ page }) => {
    // Past main.tsx's one reload after a failed file (the stale-tab fix): this is the case it can't fix.
    await page.addInitScript(() => window.addEventListener('vite:preloadError', (e) => e.stopImmediatePropagation()))
    let online = false
    await page.route(ENGINE, (route) => (online ? route.continue() : route.abort()))
    await page.goto('/sim?v=3&a=cola:1')
    const failed = page.getByRole('alert').filter({ hasText: 'This didn’t load' })
    await expect(failed).toHaveText('This didn’t load. Check the internet connection and try again.')
    await expect(page.getByRole('heading', { level: 1, name: 'Something didn’t load' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add food' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
    online = true
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await expect(failed).toHaveCount(0)
  })
})
