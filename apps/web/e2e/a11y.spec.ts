import { expect, test } from '@playwright/test'
import { GATE_ROUTES, checkAxe, modeFor, onlyIn } from './helpers/gate.ts'

// axe on every page: 0 serious or critical issues is the gate, enforced on every page since the
// swap (WP-19). /sim is checked in every project (desktop, projector, phone),
// also with a kept meal and with its sheets open (WP-15). The keyboard-only run, the graphs'
// summaries and "Show as table" are in keyboard.spec.ts.

for (const route of GATE_ROUTES.axe) {
  test(`axe: ${route.url}`, async ({ page }) => {
    if (!route.url.startsWith('/sim')) onlyIn('desktop')
    const mode = modeFor(route)
    await page.goto(route.url)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
    await page.waitForLoadState('networkidle')
    await checkAxe(page, { mode, failOn: mode === 'report' ? ['critical'] : [] })
  })
}

test('axe on /sim with a kept meal, the table and the keys sheet open: 0 serious or critical', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  for (const lang of ['en', 'hi']) {
    await page.goto(`/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&lang=${lang}`)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeAttached()
    await page.waitForLoadState('networkidle')
    await checkAxe(page, { mode: 'enforce' })
    await page.locator('figure').filter({ visible: true }).first().locator('button[aria-haspopup="dialog"]').click()
    await expect(page.locator('dialog[open] table').first()).toBeVisible()
    await checkAxe(page, { mode: 'enforce' })
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: /^(Keys and settings|कुंजियाँ और सेटिंग)$/ }).click()
    await expect(page.locator('dialog[open] [role="switch"]').first()).toBeVisible()
    await checkAxe(page, { mode: 'enforce' })
    await page.keyboard.press('Escape')
  }
})

test('a "How we know" panel takes focus at its top, and Esc or tabbing out gives it back to its button', async ({ page }) => {
  onlyIn('desktop', 'projector')
  await page.goto('/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1')
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

test('the stage’s small panels take focus, and Esc gives it back to their button (Typical adult, servings)', async ({ page }) => {
  onlyIn('desktop', 'phone')
  await page.goto('/sim?v=2&a=cola:1')
  for (const [button, panel] of [
    [
      page
        .getByRole('button', { name: /Typical adult/ })
        .filter({ has: page.locator('svg') })
        .first(),
      /^Typical adult/,
    ],
    [page.getByRole('button', { name: /^Cola/ }).first(), /^Servings: Cola/],
  ] as const) {
    await button.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: panel })
    await expect(dialog).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(button).toBeFocused()
  }
})

test('the header names its menu and the language button by the words it shows (WCAG 2.5.3)', async ({ page }) => {
  onlyIn('desktop')
  await page.goto('/')
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
  const language = page.getByRole('button', { name: /^भाषा: हिन्दी/ })
  await expect(language).toBeVisible()
  await expect(language.locator('[lang="hi"]')).toHaveText('भाषा: हिन्दी')
})

// The other parts that load on first use (review 14-17, HIGH 2): the stage text ("More") and the
// report form. A failed file says so in its own place, never as the error page.
test.describe('"More" and the report form when their code does not load', () => {
  test.use({ serviceWorkers: 'block' })
  // A returning visitor: on a phone the first-run medical note takes the Now line's place.
  test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1')))

  test('"More": the panel says so, and "Try again" loads the stage text', async ({ page }) => {
    await page.addInitScript(() => window.addEventListener('vite:preloadError', (e) => e.stopImmediatePropagation()))
    let online = false
    await page.route(/StageMore-[\w-]+\.js$/, (route) => (online ? route.continue() : route.abort()))
    await page.goto('/sim?v=2&a=cola:1&t=20')
    await page.getByRole('button', { name: 'Stomach: more about this stage' }).click()
    const failed = page.getByRole('region', { name: 'More' })
    await expect(failed.getByRole('alert')).toHaveText('This didn’t load. Check the internet connection and try again.')
    await expect(page.getByRole('slider', { name: 'Timeline' })).toBeVisible()
    online = true
    await failed.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('region', { name: 'Stomach' })).toContainText('Hydrochloric acid')
  })

  test('"Report a mistake": the button stays, says so under it, and "Try again" opens the form', async ({ page }) => {
    // Not on the projector: a teacher reports from their own screen (MealBar).
    onlyIn('desktop', 'phone')
    await page.addInitScript(() => window.addEventListener('vite:preloadError', (e) => e.stopImmediatePropagation()))
    let online = false
    await page.route(/FeedbackDialog-[\w-]+\.js$/, (route) => (online ? route.continue() : route.abort()))
    await page.goto('/sim?v=2&a=cola:1')
    await page.getByRole('button', { name: 'Report a mistake' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'This didn’t load' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Timeline' })).toBeVisible()
    online = true
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('dialog', { name: 'Report a mistake' }).getByText('This opens a public page on GitHub.')).toBeVisible()
  })

  // Review 15, MED 2: the sheets (table, keys) and the food search come in one file.
  test('the table sheet: a box says so (not the error page); after a second failure it offers Reload', async ({ page }) => {
    onlyIn('desktop')
    await page.addInitScript(() => window.addEventListener('vite:preloadError', (e) => e.stopImmediatePropagation()))
    let online = false
    await page.route(/\/Sheets-[\w-]+\.js$/, (route) => (online ? route.continue() : route.abort()))
    await page.goto('/sim?v=2&a=cola:1')
    await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeVisible()
    await page.locator('body').press('t')
    await expect(page.getByRole('alert').filter({ hasText: 'This didn’t load' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Timeline' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reload' })).toHaveCount(0)
    // "Try again" has the focus, as the sheet would have, and keeps it when a try fails (review FIX-D + WP-18, LOW 3).
    await expect(page.getByRole('button', { name: 'Try again' })).toBeFocused()
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('button', { name: 'Reload' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeFocused()
    online = true
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('dialog', { name: 'The graphs as a table' })).toBeVisible()
  })

  test('the food search: a box under "Add food" says so; ✕ or Escape closes it and gives the focus back', async ({ page }) => {
    onlyIn('desktop', 'phone')
    await page.addInitScript(() => window.addEventListener('vite:preloadError', (e) => e.stopImmediatePropagation()))
    await page.route(/\/Sheets-[\w-]+\.js$/, (route) => route.abort())
    await page.goto('/sim?v=2&a=cola:1')
    const add = page.getByRole('button', { name: 'Add food' })
    await add.click()
    const alert = page.getByRole('alert').filter({ hasText: 'This didn’t load' })
    await expect(alert).toBeVisible()
    await page.locator('[data-load-failed]').getByRole('button', { name: 'Close' }).click()
    await expect(alert).toBeHidden()
    await expect(add).toBeFocused()
    // Escape closes it too: "Try again" has the focus, so the key reaches the box.
    await add.click()
    await expect(alert).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(alert).toBeHidden()
    await expect(add).toBeFocused()
  })

  // FIX-C review, item 5: a bug in a part is not "check the connection" (Try again could never work).
  test('a part whose code fails when it runs goes to the error page, not "this didn’t load"', async ({ page }) => {
    onlyIn('desktop')
    await page.addInitScript(() => window.addEventListener('vite:preloadError', (e) => e.stopImmediatePropagation()))
    await page.route(/\/Sheets-[\w-]+\.js$/, (route) =>
      route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("a bug in the sheet")' }),
    )
    await page.goto('/sim?v=2&a=cola:1')
    await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeVisible()
    await page.locator('body').press('t')
    await expect(page.getByRole('heading', { level: 1, name: 'Something didn’t load' })).toBeVisible()
    await expect(page.getByRole('alert').filter({ hasText: 'This didn’t load' })).toHaveCount(0)
  })
})

test.describe('a "How we know" panel whose code does not load', () => {
  // The service worker would serve the file from its cache; the test needs the network to fail.
  test.use({ serviceWorkers: 'block' })

  test('says so in the panel (not an error page), and "Try again" loads it', async ({ page }) => {
    onlyIn('desktop')
    // Past main.tsx's one reload after a failed file (the stale-tab fix): this is the case it can't fix.
    await page.addInitScript(() => window.addEventListener('vite:preloadError', (e) => e.stopImmediatePropagation()))
    // Offline until "Try again" (pointing at the button already asks for the file once).
    let online = false
    await page.route(/HowWeKnowPanel-[\w-]+\.js$/, (route) => (online ? route.continue() : route.abort()))
    await page.goto('/sim?v=2&a=cola:1')
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
