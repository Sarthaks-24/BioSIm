import { expect, test, type Page } from '@playwright/test'
import { bodySettled, goto, returningVisitor } from './helpers/gate.ts'

// Breathing (U-2): public since the v3.0 release gate (H-1, R103), so a plain link opens it (and a
// `?preview=1` one still does). Its pack loads when it is lit: the flat lungs, breathing at the model's rate on the real
// clock, the rhythm chip, three graphs, the book line and the children's band; the system title and
// its lazy picker; and the loading words while the pack is on its way (R71). Projects desktop,
// phone, projector and reduced. E2E_SHOTS=1 saves rest and walk pictures to .shots/ (git-ignored).

const PLAN = '/sim?v=3&a=roti:1&act=walk.30.20&layer=breathing'
const REST = `${PLAN}&t=10`
const WALK = `${PLAN}&t=40`

test.beforeEach(({ page }) => returningVisitor(page))

/** Opens a link and waits for the breathing picture to be drawn. */
async function open(page: Page, url: string) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-layer="breathing"]')).toBeAttached()
  await bodySettled(page)
}

/** The chip's number: the breaths a minute it says. */
const chipRate = (page: Page) => page.locator('[data-rhythm-chip]').getAttribute('data-rhythm-chip').then(Number)

test('a link lights breathing: lungs, chip, three graphs, the book line and the children’s band', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page, REST)
  await expect(page.locator('[data-body="flat"][data-framing="chest"]')).toBeVisible()
  await expect(page.locator('[data-system-title="breathing"]')).toContainText('Breathing')
  await expect(page.locator('[data-rhythm-chip]')).toContainText(/1\d a minute/)
  for (const label of ['Lungs', 'Diaphragm'])
    await expect(page.locator('[data-layer="breathing"] [data-callout]').filter({ hasText: label })).toBeVisible()
  // The graphs: their names come with the pack; every line is a "Model estimate" (R13, R44).
  const graphs = page.locator('section[aria-labelledby="graphs-title"]')
  await expect(graphs.locator('[data-status="assumption"]').first()).toHaveText('Model estimate')
  await expect(graphs.locator('[data-reference]')).toHaveCount(1)
  await expect(graphs.locator('[data-book]')).toHaveText('Older NCERT Class 7 book (2024-25) says: 15–18 breaths a minute')
  await expect(graphs.locator('[data-band-key]')).toContainText('Most children aged 12–15: 15–21')
  if (test.info().project.name !== 'phone')
    await expect(graphs.locator('[data-strip-note]').first()).toContainText(
      'Moves mostly with walking or running; the meal moves it a little.',
    )
  expect(errors).toEqual([])
})

test('rest and a walk visibly differ: faster, deeper, the walk’s pose', async ({ page }, info) => {
  await open(page, REST)
  const rest = await chipRate(page)
  await expect(page.locator('[data-activity-band]')).toHaveAttribute('data-activity-band', 'rest')
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/u2-breathing-rest-${info.project.name}.png` })
  await open(page, WALK)
  const walk = await chipRate(page)
  await expect(page.locator('[data-activity-band]')).toHaveAttribute('data-activity-band', 'walk')
  await expect(page.locator('[data-rhythm-chip]')).toContainText(/walking/)
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/u2-breathing-walk-${info.project.name}.png` })
  expect(rest).toBeGreaterThanOrEqual(14)
  expect(walk).toBeGreaterThan(rest + 5)
})

test('the breath moves on the real clock at the model’s rate, at most 0.8 a second; reduced motion stands still', async ({ page }) => {
  await open(page, WALK)
  const layer = page.locator('[data-layer="breathing"]')
  const reduced = test.info().project.name === 'reduced'
  await expect(layer).toHaveAttribute('data-breath', reduced ? 'still' : 'moving')
  const hz = Number(await layer.getAttribute('data-breath-hz'))
  expect(hz).toBeGreaterThan(0.2)
  expect(hz).toBeLessThanOrEqual(0.8)
  const scales = new Set<string>()
  for (let i = 0; i < 8; i++) {
    scales.add((await layer.getAttribute('data-lung-scale')) ?? '')
    await page.waitForTimeout(150)
  }
  if (reduced) {
    expect(scales.size).toBe(1)
    await expect(layer.locator('[data-arrows]')).toBeAttached()
  } else expect(scales.size).toBeGreaterThan(2)
})

test('the title opens the picker; keys [ ] L; Esc closes it and the title keeps the focus', async ({ page }) => {
  test.skip(test.info().project.name === 'phone', 'keys and ‹ › are for keyboards (the phone opens the picker by its title)')
  await open(page, REST)
  const title = page.getByRole('button', { name: 'Body system: Breathing' })
  await title.click()
  const picker = page.getByRole('dialog', { name: 'Body systems' })
  await expect(picker).toBeVisible()
  await expect(picker.getByRole('region', { name: 'Respiration' })).toBeVisible()
  const row = picker.locator('[data-system-row="breathing"]')
  await expect(row).toHaveAttribute('aria-current', 'true')
  await expect(row).toContainText(/same as at the start|breaths a minute/)
  await picker.locator('[data-system-row="digestion"]').click()
  await expect(picker).toBeHidden()
  await expect(page.locator('[data-system-title="digestion"]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Body system: Digestion' })).toBeFocused()
  // ] steps to the next row; L opens the picker; Esc closes it.
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press(']')
  await expect(page.locator('[data-system-title="breathing"]')).toBeVisible()
  await page.keyboard.press('[')
  await expect(page.locator('[data-system-title="digestion"]')).toBeVisible()
  await page.keyboard.press('l')
  await expect(picker).toBeVisible()
  // Every built row is public: switched away, all eight stay in the picker (R93 #4).
  await expect(picker.locator('[data-system-row]')).toHaveCount(8)
  await expect(picker.locator('[data-system-row="breathing"]')).toBeVisible()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  await expect(picker).toBeHidden()
})

test('a plain link opens breathing (public since H-1), and a ?preview=1 link still does', async ({ page }) => {
  for (const url of ['/sim?v=3&a=roti:1&layer=breathing', '/sim?v=3&a=roti:1&layer=breathing&preview=1']) {
    await goto(page, url)
    await page.locator('[data-stage]').waitFor()
    await expect(page.locator('[data-layer="breathing"]')).toBeAttached()
    await expect(page.locator('[data-system-title="breathing"]')).toBeVisible()
  }
  // The plain one stays plain: nothing adds preview=1 to it.
  await goto(page, '/sim?v=3&a=roti:1&layer=breathing')
  await page.locator('[data-layer="breathing"]').waitFor({ state: 'attached' })
  expect(new URL(page.url()).searchParams.get('preview')).toBeNull()
})

test('no link of the app, Home or Teach carries preview=1 (P-0)', async ({ page }) => {
  for (const path of ['/', '/teach', '/sim', '/science', '/about']) {
    await goto(page, path)
    await page.waitForLoadState('networkidle')
    const hrefs = await page.locator('a[href]').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''))
    expect(hrefs.length, path).toBeGreaterThan(0)
    expect(
      hrefs.filter((h) => /preview=/.test(h)),
      path,
    ).toEqual([])
  }
})

test('while the pack loads the lit system stays drawn and the title says so; a failed load says why, with Try again (R71)', async ({
  page,
  browser,
}) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  await page.route('**/assets/pack-*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 2500))
    return route.continue()
  })
  await goto(page, REST)
  await page.locator('[data-stage]').waitFor()
  const status = page.locator('[data-system-title] [role=status]')
  await expect(status).toHaveText('Getting the lungs ready…')
  // The screen is never cleared: Digestion stays drawn meanwhile (checked while the pack is still on its way).
  await expect(page.locator('[data-system-title=digestion]')).toBeVisible()
  // The link, and a copy of it made now, keep what was asked for (R93 #2).
  expect(new URL(page.url()).searchParams.get('layer')).toBe('breathing')
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button', { name: 'Copy link' }).click()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(new URL(copied).searchParams.get('layer')).toBe('breathing')
  await expect(page.locator('[data-body]').first()).toBeVisible()
  await expect(page.locator('[data-system-title=breathing]')).toBeVisible()
  await expect(status).toHaveCount(0)

  // The pack never arrives: the page reloads once (a stale file after a deploy), then says so.
  // A fresh browser (no service worker: its cache would serve the files the first page saved).
  const fresh = await browser.newContext({ serviceWorkers: 'block' })
  await fresh.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  const failing = await fresh.newPage()
  // Every file of the breathing pack (pack-manifest.json, its lazy entry) fails to arrive.
  const manifest = (await (await page.request.get('/pack-manifest.json')).json()) as { entries: { id: string; urls: string[] }[] }
  const urls = manifest.entries.find((e) => e.id === 'breathing')!.urls
  await failing.route(
    (url) => urls.includes(url.pathname),
    (route) => route.abort(),
  )
  await goto(failing, REST)
  await failing.locator('[data-stage]').waitFor()
  const failed = failing.locator('[data-system-title] [role=status]')
  await expect(failed).toContainText('Couldn’t load the lungs. Check internet and tap Try again.')
  await expect(failed.getByRole('button', { name: 'Try again' })).toBeVisible()
  await expect(failing.locator('[data-system-title=digestion]')).toBeVisible()
  // The link keeps what was asked for.
  expect(new URL(failing.url()).searchParams.get('layer')).toBe('breathing')
  await fresh.close()
})
