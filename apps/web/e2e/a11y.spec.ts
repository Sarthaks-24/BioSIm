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

test('a "How we know" panel takes focus at its top, and Esc or tabbing out gives it back to its button', async ({ page }) => {
  await page.goto('/next?v=2&a=cola:1&b=cheeseburger:1,fries:1')
  const button = page
    .getByRole('button', { name: /^How we know: / })
    .filter({ visible: true })
    .first()
  const panel = page.getByRole('dialog', { name: /^How we know: / })

  await button.focus()
  await page.keyboard.press('Enter')
  // The panel itself, not its first link (a source at the bottom): read from the top.
  await expect(panel).toBeFocused()
  expect(await panel.evaluate((el) => el.scrollTop)).toBe(0)
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(button).toBeFocused()

  // The panel sits at the end of the page; tabbing past its last link must not leave the page.
  await page.keyboard.press('Enter')
  await expect(panel).toBeFocused()
  const links = await panel.getByRole('link').count()
  expect(links).toBeGreaterThan(0)
  for (let i = 0; i < links; i++) await page.keyboard.press('Tab')
  await expect(panel.getByRole('link').last()).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(panel).toBeHidden()
  await expect(button).toBeFocused()
})

test('the header names its menu and the language button by the words it shows (WCAG 2.5.3)', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  const language = page.getByRole('button', { name: /^भाषा: हिन्दी/ })
  await expect(language).toBeVisible()
  await expect(language.locator('[lang="hi"]')).toHaveText('भाषा: हिन्दी')
})

test.describe('a "How we know" panel whose code does not load', () => {
  // The service worker would serve the file from its cache; the test needs the network to fail.
  test.use({ serviceWorkers: 'block' })

  test('says so in the panel (not an error page), and "Try again" loads it', async ({ page }) => {
    // Past main.tsx's one reload after a failed file (the stale-tab fix): this is the case it can't fix.
    await page.addInitScript(() => window.addEventListener('vite:preloadError', (e) => e.stopImmediatePropagation()))
    // Offline until "Try again" (pointing at the button already asks for the file once).
    let online = false
    await page.route(/HowWeKnowPanel-[\w-]+\.js$/, (route) => (online ? route.continue() : route.abort()))
    await page.goto('/next?v=2&a=cola:1')
    const button = page
      .getByRole('button', { name: /^How we know: / })
      .filter({ visible: true })
      .first()
    await button.click()
    const panel = page.getByRole('dialog', { name: /^How we know: / })
    await expect(panel.getByRole('alert')).toHaveText('This didn’t load. Check the internet connection and try again.')
    await expect(page.getByRole('slider', { name: 'Timeline' })).toBeVisible()
    online = true
    await panel.getByRole('button', { name: 'Try again' }).click()
    await expect(panel.getByRole('heading', { level: 3 })).toBeVisible()
    await expect(panel.getByRole('alert')).toHaveCount(0)
  })
})
