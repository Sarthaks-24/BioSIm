import { expect, test, type Locator, type Page } from '@playwright/test'
import { GATE_ROUTES, checkAxe, returningVisitor } from './helpers/gate.ts'

// The v2.1 screen-reader pass (T11; plan qa-fixes §3.6), the automatic half: axe on every page at
// a phone width too (a11y.spec.ts runs it at 1440 and on /sim in every project), the page basics a
// screen reader leans on, and the §3.6 script with the keyboard only, as a teacher would run it:
// a ready lesson from Teach → Play → Page Down → Keep → the table. The language step is left out
// while Hindi is paused (R47). The human half (NVDA + Firefox, TalkBack, VoiceOver) is in
// docs/RELEASE-v2.1.md. Project desktop.

const PAGES = [...GATE_ROUTES.axe.map((r) => r.url), '/no-such-page']

test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop project only')
  await returningVisitor(page)
})

/** Presses Tab until `target` has the focus (a real keyboard user's way there). */
async function tabTo(page: Page, target: Locator, max = 80) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement).catch(() => false)) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`Tab never reached ${target}`)
}

test('every page at 360 px and the not-found page: axe clean, English, one main, one H1, a skip link first', async ({ page }) => {
  test.slow()
  await page.setViewportSize({ width: 360, height: 640 })
  for (const url of PAGES) {
    await page.goto(url)
    await expect(page.getByRole('heading', { level: 1 }).first(), url).toBeAttached()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('html'), url).toHaveAttribute('lang', 'en')
    await expect(page.getByRole('main'), url).toHaveCount(1)
    await expect(page.getByRole('heading', { level: 1 }), url).toHaveCount(1)
    await checkAxe(page, { mode: 'enforce' })
    // The first Tab lands on "Skip to content", which moves past the header.
    await page.locator('body').focus()
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus'), url).toHaveText('Skip to content')
  }
})

test('the §3.6 script with the keyboard only: a ready lesson from Teach, Play, Page Down, Keep, the table', async ({ page }) => {
  await page.goto('/teach')
  // A ready lesson, reached and opened with Tab and Enter.
  const lesson = page.getByRole('link', { name: /^Which leaves the stomach first\?/ })
  await tabTo(page, lesson)
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/sim\?/)
  await expect(page.getByRole('img', { name: /^The body, digesting / })).toBeVisible()
  const slider = page.getByRole('slider', { name: 'Timeline' })
  const now = () => slider.getAttribute('aria-valuenow').then(Number)

  // Play and pause with the button itself (Enter), as a screen-reader user does.
  const play = page.getByRole('button', { name: 'Play', exact: true })
  await tabTo(page, play)
  await page.keyboard.press('Enter')
  const pause = page.getByRole('button', { name: 'Pause', exact: true })
  await expect(pause).toBeVisible()
  await expect(pause).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(play).toBeVisible()

  // Page Down (a clicker's button) on the timeline goes to the next key moment, and the change is said.
  await tabTo(page, slider)
  const before = await now()
  await page.keyboard.press('PageDown')
  await expect.poll(now).toBeGreaterThan(before)
  await expect(page.locator('[data-announcer]')).toHaveText(/after eating/)

  // Keep to compare: kept, and the button says why it is off now.
  const keep = page.getByRole('button', { name: 'Keep to compare' }).filter({ visible: true })
  const meal = new URL(page.url()).searchParams.get('a')
  await tabTo(page, keep.first())
  if ((await keep.first().getAttribute('aria-disabled')) !== 'true') {
    await page.keyboard.press('Enter')
    await expect.poll(() => new URL(page.url()).searchParams.get('b')).toBe(meal)
  }
  await expect(keep.first()).toHaveAttribute('aria-disabled', 'true')
  await expect(keep.first()).toHaveAccessibleDescription('This meal is the one kept')

  // The graphs as a table, from the graph's own button; Esc closes it and gives the focus back.
  const asTable = page.locator('figure').filter({ visible: true }).first().locator('button[aria-haspopup="dialog"]')
  await tabTo(page, asTable)
  await page.keyboard.press('Enter')
  const table = page.getByRole('dialog', { name: 'The graphs as a table' })
  await expect(table).toBeVisible()
  await expect(table.getByRole('table').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(table).toBeHidden()
  await expect(asTable).toBeFocused()
})
