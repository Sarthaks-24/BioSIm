import { expect, test, type Page } from '@playwright/test'
import { LESSONS, TASKS, presetHref } from '../src/lib/presets.ts'
import { SIM_BODY, checkAxe, onlyIn } from './helpers/gate.ts'

// The Teach page describes controls that exist (WP-19): every step of the lesson plan names a
// control, and here it is found on /sim by its role and name and does what the step says. The
// ready lessons open projector-friendly at their first key moment; the four task questions open
// the screen a student starts from. Projects desktop and projector.

test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1')))

/** Minutes after eating, from the dock's slider. */
const now = async (page: Page) => Number(await page.getByRole('slider', { name: 'Timeline' }).getAttribute('aria-valuenow'))
/** The graph shown in front, where the graphs show one at a time as tabs (the projector). */
const front = (page: Page, name: string) => page.getByRole('group', { name: 'Graphs' }).getByRole('button', { name, pressed: true })

test('every lesson-plan step names a control the stage has', async ({ page }) => {
  // Step 2: open cola with burger + fries kept (the first ready lesson) and press Play.
  await page.goto('/teach')
  await expect(page.getByRole('heading', { name: 'A 40-minute lesson plan' })).toBeVisible()
  await expect(page.getByRole('listitem').filter({ hasText: /^Open cola with burger \+ fries kept/ })).toBeVisible()
  await page.goto(presetHref(LESSONS[0]!).replace(/&t=\d+/, ''))
  await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
  await expect(page.locator('[data-line="kept"]').filter({ visible: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()

  // Step 3: Page Down jumps to the next key moment, and the Now line under the body says where the food is.
  await page.getByRole('slider', { name: 'Timeline' }).press('Home')
  await page.locator('body').press('PageDown')
  await expect.poll(() => now(page)).toBe(LESSONS[0]!.t)
  await expect(page.getByRole('button', { name: /: more about this stage$/ })).toBeVisible()

  // Step 4: blood sugar at 1 hour, from the Blood sugar graph (B brings it to the front).
  await page.getByRole('slider', { name: 'Timeline' }).press('Home')
  for (let i = 0; i < 6; i++) await page.getByRole('slider', { name: 'Timeline' }).press('ArrowRight')
  expect(await now(page)).toBe(60)
  await page.locator('body').press('b')
  await expect(page.getByRole('figure', { name: 'Blood sugar', exact: true })).toBeVisible()
  await expect(
    page
      .getByRole('figure', { name: 'Blood sugar', exact: true })
      .getByText(/\d+ mg\/dL/)
      .first(),
  ).toBeVisible()

  // Step 5: energy in vs used at 3 hours, from the Energy graph (E).
  await page.getByRole('slider', { name: 'Timeline' }).press('Home')
  for (let i = 0; i < 3; i++) await page.getByRole('slider', { name: 'Timeline' }).press('Shift+ArrowRight')
  expect(await now(page)).toBe(180)
  await page.locator('body').press('e')
  await expect(page.getByRole('figure', { name: 'Energy', exact: true })).toBeVisible()
})

test('a ready lesson opens in projector mode, at its first key moment, on its graph', async ({ page }) => {
  onlyIn('desktop')
  const lesson = LESSONS[1]! // roti + dal, with white rice kept: blood sugar
  await page.goto('/teach')
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'normal')
  await page.getByRole('link', { name: /^Which raises blood sugar more gently\?/ }).click()
  await expect(page).toHaveURL(/\/sim\?/)
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
  await expect(page.getByRole('img', { name: /^The body, digesting Roti/ })).toBeVisible()
  expect(await now(page)).toBe(lesson.t)
  await expect(front(page, 'Blood sugar')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  // Switching it off is one click on the stage's header.
  await page.getByRole('button', { name: 'Projector mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'normal')
})

test('the four questions open the screen each starts from', async ({ page }) => {
  onlyIn('desktop')
  await page.goto('/teach')
  const questions = page.getByRole('list').filter({ hasText: 'When has half of it left the stomach?' })
  await expect(questions.getByRole('link')).toHaveCount(TASKS.length)
  for (const [i, task] of TASKS.entries()) {
    await expect(questions.getByRole('link').nth(i)).toHaveAttribute('href', presetHref(task))
  }
  await questions.getByRole('link').nth(3).click()
  await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
  expect(await now(page)).toBe(0)
})

test('the QR code opens the site', async ({ page, request }) => {
  onlyIn('desktop')
  await page.goto('/teach')
  const qr = page.getByRole('img', { name: 'QR code for lifepeek.vercel.app' })
  await expect(qr).toBeVisible()
  await expect(page.getByText('lifepeek.vercel.app', { exact: true })).toBeVisible()
  // A file of its own (not inlined into the page's code), drawn about 240 px wide.
  const src = (await qr.getAttribute('src'))!
  expect(src).toMatch(/^\/assets\/.+\.svg$/)
  expect((await qr.boundingBox())!.width).toBeGreaterThanOrEqual(230)
  const res = await request.get(src)
  expect(res.status()).toBe(200)
  await checkAxe(page)
})
