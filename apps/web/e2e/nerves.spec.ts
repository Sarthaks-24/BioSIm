import { expect, test, type Page } from '@playwright/test'
import { brainRoute, reflexTime } from '../../../packages/engine/src/demo/nerve.ts'
import { bodySettled, checkAxe, goto, returningVisitor } from './helpers/gate.ts'

// Brain & nerves (U-7): a demo row, public on v3 once its acceptance passed, so a plain link opens
// it. Its pack (control) loads when it is lit: the flat brain, cord and nerves in the upper framing,
// the Now line (the brain's sugar use, "Model estimate") and, in the graph column, the hot-pan nerve
// demo: the reflex against the route through the brain, slowed down, with counters that end on the
// engine's reflexTime (± 1 ms). Projects desktop, phone (played) and reduced (still steps).
// E2E_SHOTS=1 saves pictures to .shots/ (git-ignored).

const NERVES = '/sim?v=3&a=roti:1&layer=nerves'
const REFLEX = reflexTime('hotPan')
const BRAIN = brainRoute('hotPan')
const SLOW = reflexTime('hotPan', { myelin: 0 })

test.beforeEach(({ page }) => returningVisitor(page))

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/u7-nerves-${name}-${test.info().project.name}.png` })
}

/** Opens the nerves row and waits for its picture and its demo. */
async function open(page: Page, url = NERVES) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-layer="nerves"][data-drawn]')).toBeVisible()
  await bodySettled(page)
  const card = page.locator('[data-card="nerves"]')
  await expect(card).toBeVisible()
  return card
}

/** A counter's real ms (its `data-ms`). */
const counter = async (page: Page, route: 'reflex' | 'brain') =>
  Number(await page.locator(`[data-counter="${route}"]`).getAttribute('data-ms'))

test('a link lights the brain and nerves, the Now line and the nerve demo; the counters end on reflexTime (± 1 ms)', async ({ page }) => {
  test.skip(test.info().project.name === 'reduced', 'played with motion; the reduced project steps')
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  const card = await open(page)

  // The picture: the upper framing, its first three labels; steady sugar dots up the neck arteries.
  await expect(page.locator('[data-body="flat"][data-framing="upper"]')).toBeVisible()
  for (const label of ['Brain', 'Spinal cord', 'Nerves'])
    await expect(page.locator('[data-callout]').filter({ hasText: new RegExp(`^${label}$`) })).toBeVisible()
  await expect(page.locator('[data-layer="nerves"]')).toHaveAttribute('data-dots', 'moving')

  // The Now line: the brain's sugar, the same all day, tagged "Model estimate".
  const now = page.locator('[data-now="nerves"]').filter({ visible: true })
  await expect(now).toContainText('Model estimate')
  await expect(now).toContainText('about 4.4 g of sugar an hour, about the same all day')

  // The demo: its tag, both counters at 0 ms, the meal clock's note; no graphs in the column.
  await expect(card.getByRole('heading', { name: 'Hot pan: reflex or thinking?' })).toBeVisible()
  await expect(card.locator('[data-status="assumption"]')).toHaveText('Model estimate')
  expect(await counter(page, 'reflex')).toBe(0)
  expect(await counter(page, 'brain')).toBe(0)
  await expect(card).toContainText('The meal clock does not move this demo')
  await expect(page.locator('section[aria-labelledby="graphs-title"] > :not([data-card]) svg')).toHaveCount(0)
  await shot(page, 'start')

  // Played: the reflex reaches the muscle first (the hand lifts), then the route through the brain.
  await card.getByRole('button', { name: 'Touch the hot pan' }).click()
  await expect(page.locator('[data-counter="reflex"][data-done]')).toBeAttached({ timeout: 8_000 })
  await expect(page.locator('[data-counter="brain"][data-done]')).toHaveCount(0)
  await expect(card.locator('[data-hand="back"]')).toBeAttached()
  await expect(page.locator('[data-counter="brain"][data-done]')).toBeAttached({ timeout: 15_000 })
  const [reflex, brain] = [await counter(page, 'reflex'), await counter(page, 'brain')]
  expect(Math.abs(reflex - REFLEX.totalMs)).toBeLessThanOrEqual(1)
  expect(Math.abs(brain - BRAIN.totalMs)).toBeLessThanOrEqual(1)
  expect(brain).toBeGreaterThanOrEqual(3 * reflex)
  await expect(card.locator('[data-result]')).toHaveText(
    `The brain route takes about three times as long: ${brain} ms against ${reflex} ms.`,
  )
  await expect(card.getByRole('button', { name: 'Again' })).toBeVisible()
  await shot(page, 'played')

  // The sources and limits: the book line as read, the read pages (V-7).
  await card.getByText('Sources and limits').click()
  await expect(card).toContainText('NCERT Class 10, Ch 6, p. 102')
  await expect(card.getByRole('link', { name: /Kiernan JA/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('myelin off (thin fibres, Beyond class 10): the reflex is far slower', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop only (it plays for 9 s)')
  test.setTimeout(60_000)
  const card = await open(page)
  const myelin = card.getByRole('switch', { name: /Myelin off \(thin fibres\)/ })
  await expect(card).toContainText('Beyond class 10')
  await myelin.check()
  await expect(card).toHaveAttribute('data-myelin', 'off')
  await card.getByRole('button', { name: 'Touch the hot pan' }).click()
  await expect(page.locator('[data-counter="brain"][data-done]')).toBeAttached({ timeout: 15_000 })
  const reflex = await counter(page, 'reflex')
  expect(Math.abs(reflex - SLOW.totalMs)).toBeLessThanOrEqual(1)
  expect(reflex).toBeGreaterThan(10 * REFLEX.totalMs)
  await expect(card.locator('[data-result]')).toContainText(`Without myelin even the reflex takes ${reflex} ms`)
  await shot(page, 'myelin-off')
  await checkAxe(page)
})

test('with motion reduced: still steps with the numbers, nothing plays, still sugar dots', async ({ page }) => {
  test.skip(test.info().project.name !== 'reduced', 'the reduced project')
  const card = await open(page)
  await expect(page.locator('[data-layer="nerves"]')).toHaveAttribute('data-dots', 'still')
  await expect(card.getByRole('button', { name: 'Touch the hot pan' })).toHaveCount(0)
  const next = card.getByRole('button', { name: /Next/ })
  await expect(card).toContainText('1 of 4')
  await next.click()
  await expect(card.locator('[data-step="cord"]')).toContainText(`${Math.round(REFLEX.inMs)} ms: the signal reaches the spinal cord`)
  await next.click()
  await expect(card.locator('[data-step="reflex"]')).toBeVisible()
  expect(Math.abs((await counter(page, 'reflex')) - REFLEX.totalMs)).toBeLessThanOrEqual(1)
  await next.click()
  expect(Math.abs((await counter(page, 'brain')) - BRAIN.totalMs)).toBeLessThanOrEqual(1)
  await expect(card).toContainText('4 of 4')
  await expect(card.locator('[data-result]')).toContainText('about three times as long')
  await expect(next).toHaveAttribute('aria-disabled', 'true')
  await shot(page, 'reduced')
  // Myelin off starts again from the touch.
  await card.getByRole('switch', { name: /Myelin off/ }).check()
  await expect(card).toContainText('1 of 4')
  for (let i = 0; i < 3; i++) await next.click()
  expect(Math.abs((await counter(page, 'reflex')) - SLOW.totalMs)).toBeLessThanOrEqual(1)
})

test('the picker offers Brain & nerves with its Model estimate tag; Science lists its sources', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'desktop only')
  await goto(page, '/sim?v=3&a=roti:1')
  await bodySettled(page)
  await page.getByRole('button', { name: /^Body system: / }).click()
  const row = page.getByRole('dialog', { name: 'Body systems' }).locator('[data-system-row="nerves"]')
  await expect(row).toContainText('Brain & nerves')
  await expect(row.locator('[data-status="assumption"]')).toHaveText('Model estimate')
  await row.click()
  await expect(page.locator('[data-card="nerves"]')).toBeVisible()
  await goto(page, '/science')
  const section = page.locator('section[data-system="nerves"]')
  await expect(section).toContainText('Brain & nerves')
  await expect(section).toContainText('Kiernan JA')
  await expect(section).toContainText('Mergenthaler')
})
