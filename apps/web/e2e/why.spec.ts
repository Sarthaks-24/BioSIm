import { expect, test, type Page } from '@playwright/test'
import { bodySettled, goto, returningVisitor } from './helpers/gate.ts'

// "Why does the model differ from the book?" cards (X-4; ui-ux §8.4, content-i18n §8.5, R9, R54):
// "Why different? ›" by a system's book line opens its card (the book's value with its page, the
// model's, why, and the exam line), in Breathing and Skin & temperature, and by the guided lesson's
// book line (Digestion's card). The cards come with their packs: a plain digestion visit never
// fetches one. Projects desktop and phone. E2E_SHOTS=1 saves pictures to .shots/ (git-ignored).

test.beforeEach(({ page }) => returningVisitor(page))

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/x4-${name}-${test.info().project.name}.png` })
}

const RUN = '/sim?v=3&a=roti:1&act=run.30.10&t=38'
const graphs = (page: Page) => page.locator('section[aria-labelledby="graphs-title"]')

/** Opens a link on a system and waits for its picture. */
async function open(page: Page, url: string, layer: string) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator(`[data-layer="${layer}"]`)).toBeAttached()
  await bodySettled(page)
}

/** Opens a card from its link and checks what every card has: the title, its rows, the exam line, never "your book" (R9). */
async function openCard(scope: ReturnType<Page['locator']>, text: string, rows: number) {
  const link = scope.getByRole('button', { name: 'Why different? ›' })
  await expect(link).toHaveAttribute('aria-expanded', 'false')
  await link.click()
  await expect(link).toHaveAttribute('aria-expanded', 'true')
  const card = scope.locator(`[data-why="${text}"]`)
  await card.scrollIntoViewIfNeeded()
  await expect(card).toBeInViewport()
  await expect(card.getByRole('heading', { name: 'Why does the model differ from the book?' })).toBeVisible()
  await expect(card.locator('[data-why-row]')).toHaveCount(rows)
  await expect(card).toContainText('In the exam, write the book’s value.')
  await expect(card).not.toContainText(/your book/i)
  return { link, card }
}

test('Breathing: rest, a run and the air breathed out, whose numbers are the book’s only (R54, R56)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page, `${RUN}&layer=breathing`, 'breathing')
  const { link, card } = await openCard(graphs(page), 'sys.breathing.why', 3)
  await expect(card.locator('[data-why-row="rest"] [data-why-book]')).toContainText('older NCERT Class 7 book, 2024-25, Ch 6, p. 60')
  await expect(card.locator('[data-why-row="run"] [data-why-model]')).toContainText('about 33 a minute in a 10-minute run')
  await expect(card.locator('[data-why-row="run"]')).toContainText('Blackie 1991')
  const exhaled = card.locator('[data-why-row="exhaled"]')
  await expect(exhaled.locator('[data-why-book]')).toContainText('16.4 % oxygen and 4.4 % carbon dioxide')
  await expect(exhaled.locator('[data-why-model]')).toHaveText('This model says: not shown')
  await shot(page, 'breathing')
  await link.click()
  await expect(card).toHaveCount(0)
  expect(errors).toEqual([])
})

test('Skin & temperature: the book’s 37.0 °C (Class 6, p. 128), held here; the run’s sweat', async ({ page }) => {
  await open(page, `${RUN}&layer=skin`, 'skin')
  await expect(graphs(page).locator('[data-book]')).toHaveText('NCERT Class 6 (Curiosity, 2026-27) says: normal body temperature 37.0 °C')
  const { card } = await openCard(graphs(page), 'sys.effort.why', 1)
  await expect(card.locator('[data-why-book]')).toContainText('37.0 °C (NCERT Class 6, Curiosity, Ch 7, p. 128)')
  await expect(card.locator('[data-why-model]')).toContainText('about 170 mL in a 10-minute run')
  await shot(page, 'skin')
})

test('the guided lesson: Digestion’s card by the first pause’s book line', async ({ page }) => {
  await goto(page, '/')
  await page.locator('[data-flagship]').click()
  const bar = page.locator('[data-lesson-bar]')
  await expect(bar).toHaveAttribute('data-lesson-pause', 'stomach')
  let scope = bar
  if (test.info().project.name === 'phone') {
    // On a phone the book's line is in the "?" sheet.
    await bar.getByRole('button', { name: 'Question and answer' }).click()
    scope = page.getByRole('dialog', { name: 'Step 1 of 5' })
  }
  const { card } = await openCard(scope, 'why.digestion', 2)
  await expect(card.locator('[data-why-row="where"] [data-why-book]')).toContainText('(NCERT Class 10, Ch 5, p. 98)')
  await expect(card.locator('[data-why-row="where"] [data-why-model]')).toContainText('97 % of the carbohydrate')
  await shot(page, 'lesson')
})

test('the cards are lazy: a plain digestion visit fetches no card', async ({ page }) => {
  const asked: string[] = []
  page.on('request', (r) => asked.push(new URL(r.url()).pathname))
  await goto(page, '/sim?v=3&a=roti:1')
  await page.locator('[data-stage]').waitFor()
  await bodySettled(page)
  await page.waitForLoadState('networkidle')
  expect(asked.filter((p) => /WhyCard|lifepeek-en-why/.test(p))).toEqual([])
  await expect(page.getByRole('button', { name: 'Why different? ›' })).toHaveCount(0)
})
