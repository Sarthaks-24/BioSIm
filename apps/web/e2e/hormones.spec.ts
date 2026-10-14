import { expect, test, type Page } from '@playwright/test'
import {
  bodySettled,
  checkAxe,
  expectInFirstScreen,
  expectNoClippedText,
  expectNoPageScroll,
  goto,
  returningVisitor,
} from './helpers/gate.ts'

// Hormones (U-6, v3.1): public on v3, so a plain link opens it. Its pack loads when it is lit: the
// flat pancreas behind a see-through stomach with the liver, insulin dots running to the liver (none
// for water), Blood sugar and Insulin (× before eating, with its band, never µU/mL) on a 0–12 h
// window, the brain's sugar card, "not an injection guide", NCERT's feedback line with "Why
// different? ›" and the Drawing-only other hormones. Drawn flat on every device (no 3D layer yet).
// Projects desktop, projector, phone and reduced. E2E_SHOTS=1 saves cola, water and compare
// pictures to .shots/ (git-ignored).

const BASE = '/sim?v=3&layer=hormones'
const COLA = `${BASE}&a=cola:1&t=27`
const WATER = `${BASE}&a=water:1&t=27`
const COMPARE = `${BASE}&a=cola:1&b=water:1&t=27`

test.beforeEach(({ page }) => returningVisitor(page))

/** Opens a link and waits for the hormones picture to be drawn. */
async function open(page: Page, url: string) {
  await goto(page, url)
  await page.locator('[data-stage]').waitFor()
  await expect(page.locator('[data-layer="hormones"]').first()).toBeAttached()
  await bodySettled(page)
}

const layer = (page: Page) => page.locator('[data-layer="hormones"]').first()
const graphs = (page: Page) => page.locator('section[aria-labelledby="graphs-title"]')
/** Where the graphs show one at a time (projector, phone, a short column), bring a graph to the front. */
const showGraph = async (page: Page, name: string) => {
  const tab = page.getByRole('group', { name: 'Graphs' }).getByRole('button', { name })
  if (await tab.count()) await tab.click()
}

/** Insulin, × before eating, as the Now line says it. */
const nowInsulin = async (page: Page) =>
  Number(await page.locator('[data-now="hormones"] [data-insulin-x]').filter({ visible: true }).first().getAttribute('data-insulin-x'))

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/u6-hormones-${name}-${test.info().project.name}.png` })
}

test('a link lights Hormones: pancreas, liver, stomach, insulin dots, two graphs with the band, the brain card', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await open(page, COLA)
  await expect(page.locator('[data-body="flat"][data-framing="upper"]').first()).toBeVisible()
  await expect(page.locator('[data-system-title="hormones"]')).toContainText('Hormones')
  for (const label of ['Pancreas', 'Liver'])
    await expect(layer(page).locator('[data-callout]').filter({ hasText: label }).first()).toBeVisible()
  // Insulin is up near its peak: dots leave the pancreas; the Now line says × before eating.
  await expect.poll(() => layer(page).getAttribute('data-dots').then(Number)).toBeGreaterThan(0)
  expect(await nowInsulin(page)).toBeGreaterThan(5)
  await expect(page.locator('[data-now="hormones"]').filter({ visible: true }).first()).toContainText('× before eating')
  // The window, the status, the band on the insulin graph.
  await expect(page.locator('[data-window="720"]')).toBeAttached()
  await showGraph(page, 'Insulin (× before eating)')
  await expect(graphs(page).locator('[data-status="assumption"]').first()).toHaveText('Model estimate')
  await expect(graphs(page).locator('[data-strip-note="insulin"] [data-not-guide]')).toHaveText(
    'This insulin is for a body that makes its own; it is not an injection guide.',
  )
  const insulinStrip = graphs(page)
    .locator('figure')
    .filter({ has: page.locator('[data-strip-note="insulin"]') })
  await expect(insulinStrip.locator('[data-line="band"]').first()).toBeAttached()
  // Never a lab unit on screen.
  await expect(page.locator('body')).not.toContainText(/µU|μU|pmol/)
  if (test.info().project.name === 'desktop') {
    await expect(graphs(page).locator('[data-constant="brain"]')).toContainText('4.4 g of sugar an hour, about the same all day')
    await expect(graphs(page).locator('[data-constant="brain"]')).toContainText('The liver supplies it even if you eat no sugar.')
    await expect(graphs(page).locator('[data-constant="brain"] [data-source]')).toContainText('Mergenthaler')
    await expect(graphs(page).locator('[data-strip-note="insulin"] [data-book]')).toContainText('NCERT Class 10')
  }
  await shot(page, 'cola')
  expect(errors).toEqual([])
})

test('water only: insulin exactly 1× all the way, and no dots, whatever the minute', async ({ page }) => {
  await open(page, WATER)
  expect(await nowInsulin(page)).toBe(1)
  await expect(layer(page)).toHaveAttribute('data-dots', '0')
  // Through the whole window: the dots never appear.
  const slider = page.getByRole('slider', { name: 'Timeline' })
  for (const key of ['Home', 'End']) {
    await slider.press(key)
    await page.waitForTimeout(1100)
    await expect(layer(page)).toHaveAttribute('data-dots', '0')
    expect(await nowInsulin(page)).toBe(1)
  }
  await expect(page.locator('[data-moment~="event.insulinPeak"]')).toHaveCount(0)
  await shot(page, 'water')
})

test('beside water kept: the summary names both, the kept line says 1×', async ({ page }) => {
  await open(page, COMPARE)
  await expect(page.locator('[data-now="hormones"] [data-now-kept]').filter({ visible: true }).first()).toContainText(
    'Kept: insulin 1× before eating',
  )
  await expect(page.getByText(/Most insulin: about [\d.]+× before eating with this plan, 1× with the kept one\./).first()).toBeAttached()
  await shot(page, 'compare')
})

test('the dots run on the real clock; reduced motion stands them still with an arrow', async ({ page }) => {
  await open(page, COLA)
  const reduced = test.info().project.name === 'reduced'
  await expect(layer(page)).toHaveAttribute('data-motion', reduced ? 'still' : 'moving')
  await expect.poll(() => layer(page).getAttribute('data-dots').then(Number)).toBeGreaterThan(0)
  const read = () => layer(page).locator('[data-insulin-dots] circle').first().getAttribute('cx')
  const seen = new Set<string | null>()
  for (let i = 0; i < 6; i++) {
    seen.add(await read())
    await page.waitForTimeout(150)
  }
  if (reduced) {
    expect(seen.size).toBe(1)
    await expect(layer(page).locator('[data-arrow]')).toBeVisible()
  } else expect(seen.size).toBeGreaterThan(2)
})

test('"Other hormones ›": adrenaline, thyroxin, growth hormone and the hunger signal, Drawing only, no numbers', async ({ page }) => {
  test.skip(test.info().project.name === 'reduced', 'the same words')
  await page.setViewportSize({ width: 1280, height: 900 })
  await open(page, COLA)
  await showGraph(page, 'Insulin (× before eating)')
  await graphs(page).locator('[data-others-open]').click()
  const cards = graphs(page).locator('[data-others]')
  await expect(cards).toBeVisible()
  await expect(cards.locator('[data-status="illustration"]')).toHaveText('Drawing only')
  for (const key of ['adrenaline', 'thyroxin', 'growth', 'hunger']) {
    const card = cards.locator(`[data-other="${key}"]`)
    await expect(card).toBeVisible()
    expect((await card.locator('dt, dd').first().innerText()).match(/\d/)).toBeNull()
  }
  await shot(page, 'others')
})

test('gates: no page scroll (desktop, projector), body, a graph and Play in the first phone screen, no clipped text in the pseudo-locale', async ({
  page,
}) => {
  const project = test.info().project.name
  test.skip(project === 'reduced', 'the layout gates run on the other projects')
  await open(page, COMPARE)
  if (project === 'phone')
    await expectInFirstScreen(page, {
      body: page.locator('[data-body]').first(),
      graph: page.locator('figure svg[role="img"]').filter({ visible: true }),
      Play: page.getByRole('button', { name: 'Play' }),
    })
  else await expectNoPageScroll(page)
  if (project === 'desktop') await checkAxe(page)
  await open(page, `${COMPARE}&lang=pseudo`)
  await expectNoClippedText(page)
  if (project !== 'phone') await expectNoPageScroll(page)
})

test('the insulin lesson on Teach (v3.1): it opens on the insulin graph at the most insulin after cola', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project is enough')
  await goto(page, '/teach')
  const row = page.locator('[data-lesson="insulinCola"]')
  await expect(row).toContainText('Who keeps blood sugar steady?')
  await expect(row).toHaveAttribute('data-release', 'v3.1')
  await row.locator('a').first().click()
  await expect(page.locator('[data-system-title="hormones"]')).toBeAttached()
  await expect.poll(async () => Number(await page.getByRole('slider', { name: 'Timeline' }).getAttribute('aria-valuenow'))).toBe(27)
})
