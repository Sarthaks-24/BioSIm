import { expect, test, type Page } from '@playwright/test'
import { bodySettled, goto, overlayProblems, returningVisitor } from './helpers/gate.ts'

// "Count yours" (X-2; ui-ux §8.2, content §8.3, R14): the 15-second timer by Breathing's book line.
// It only shows a timer: no input field, nothing written to any storage and no request while it is
// used; Start is big (≥ 64 px, ≥ 96 on the projector); screen readers hear the start, 10 and 5
// seconds left and the end; the meal clock waits while it is open. Projects desktop, phone,
// projector and reduced (no draining ring). E2E_SHOTS=1 saves a picture to .shots/ (git-ignored).

const PLAN = '/sim?v=3&a=roti:1&act=walk.30.20&layer=breathing&preview=1&t=10'

test.beforeEach(({ page }) => returningVisitor(page))

async function open(page: Page) {
  await goto(page, PLAN)
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-layer="breathing"]')).toBeAttached()
  await bodySettled(page)
}

/** Everything the page could keep: web storage, IndexedDB's databases, cookies. */
const kept = (page: Page) =>
  page.evaluate(async () => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage)),
    idb: ((await indexedDB.databases?.()) ?? []).map((d) => d.name).sort(),
    cookie: document.cookie,
  }))

test('a timer only: no input, nothing stored or sent; big Start; the screen reader’s steps; the lines', async ({ page, context }, info) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page)
  const before = { ...(await kept(page)), cookies: await context.cookies() }

  const requests: string[] = []
  page.on('request', (r) => requests.push(`${r.method()} ${r.url()}`))
  const opener = page.locator('[data-count-open="breaths"]')
  if (info.project.name === 'phone') expect((await opener.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await opener.click()
  const dialog = page.getByRole('dialog', { name: 'Count yours' })
  const start = dialog.locator('[data-count-start]')
  await expect(start).toHaveText('Start')
  // Its code is the only thing fetched: script and style files of this site.
  const origin = new URL(page.url()).origin
  expect(requests.filter((r) => !(r.startsWith(`GET ${origin}/assets/`) && /\.(js|css)$/.test(r)))).toEqual([])
  requests.length = 0

  expect(await overlayProblems(page, dialog)).toEqual([])
  await expect(dialog.locator('input, textarea, select, [contenteditable]')).toHaveCount(0)
  await expect(dialog).not.toContainText(/normal/i)
  await expect(dialog).toContainText('Sit still. Press Start, then count your breaths until the timer ends.')
  await expect(dialog.locator('[data-count-examples]')).toContainText('5 breaths in 15 s = 20 a minute')
  await expect(dialog.locator('[data-count-book]')).toHaveText('Older NCERT Class 7 book (2024-25) says: 15–18 breaths a minute')
  await expect(dialog.locator('[data-count-model]')).toHaveText(/^This model: about 1\d a minute at rest, [23]\d a minute walking\.$/)
  await expect(dialog.locator('[data-count-band]')).toHaveText('Most children your age (12–15): 15–21 a minute at rest')
  await expect(dialog).toContainText('Nothing you count is typed in or saved.')

  const projector = info.project.name === 'projector'
  expect((await start.boundingBox())!.height).toBeGreaterThanOrEqual(projector ? 96 : 64)
  if (projector) {
    const size = await dialog.locator('[data-count-digits]').evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(size).toBeGreaterThanOrEqual(120)
  }
  await expect(dialog.locator('[data-count-ring]')).toHaveCount(info.project.name === 'reduced' ? 0 : 1)

  // What the live region says, in order.
  await dialog.locator('[data-count-live]').evaluate((el) => {
    const w = window as unknown as { heard: string[] }
    w.heard = []
    new MutationObserver(() => el.textContent && w.heard.push(el.textContent)).observe(el, {
      childList: true,
      characterData: true,
      subtree: true,
    })
  })
  // Focus is on Start as it opens: Enter starts, as Space would.
  await expect(start).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(start).toHaveText('Stop')
  await expect(dialog.locator('[data-count]')).toHaveAttribute('data-phase', 'ready')
  await expect(dialog.locator('[data-count]')).toHaveAttribute('data-phase', 'run', { timeout: 5_000 })
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/x2-count-${info.project.name}.png` })
  await expect(dialog.locator('[data-count]')).toHaveAttribute('data-phase', 'done', { timeout: 20_000 })
  await expect(start).toHaveText('Count again')
  await expect(dialog.locator('[data-count-done]')).toHaveText('Stop. Multiply your count by 4 to get a minute.')
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { heard: string[] }).heard))
    .toEqual(['Started. Count now.', '10 seconds left', '5 seconds left', 'Time’s up. Stop. Multiply your count by 4 to get a minute.'])

  // Stop part-way puts it back to Start.
  await start.click()
  await expect(dialog.locator('[data-count]')).toHaveAttribute('data-phase', 'ready')
  await start.click()
  await expect(dialog.locator('[data-count]')).toHaveAttribute('data-phase', 'idle')
  await expect(start).toHaveText('Start')

  expect(requests, 'requests while it was used').toEqual([])
  // Esc closes it, focus back on its button. (The mouse is left where Stop was: a click there now
  // could point at another part's button, which fetches that part.)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  expect({ ...(await kept(page)), cookies: await context.cookies() }).toEqual(before)
  expect(errors).toEqual([])
})

test('the meal clock waits while it is open, and plays on when it closes', async ({ page }) => {
  await open(page)
  await page.getByRole('button', { name: 'Play' }).click()
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
  await page.locator('[data-count-open="breaths"]').click()
  const dialog = page.getByRole('dialog', { name: 'Count yours' })
  await expect(dialog.locator('[data-count-start]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play' })).toBeAttached()
  const timeline = page.getByRole('slider').first()
  const at = await timeline.getAttribute('aria-valuenow')
  await dialog.locator('[data-count-start]').click()
  await page.waitForTimeout(1_500)
  expect(await timeline.getAttribute('aria-valuenow')).toBe(at)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Pause' })).toBeAttached()
  await expect(timeline).not.toHaveAttribute('aria-valuenow', at!)
  await page.getByRole('button', { name: 'Pause' }).click()
})
