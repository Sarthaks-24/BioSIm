import { expect, test, type Page } from '@playwright/test'
import { bodySettled, onlyIn } from './helpers/gate.ts'

// Projector theme v2 (WP-17: UI-5, G9, 3D-5, council 2026-10-13 #7) and the header's touch
// targets (A11). Projects projector (1280 × 800, projector mode on) and phone (390 × 844).
// No page scroll and the 250 px plot are checked in gate.spec.ts and graphs.spec.ts.

const px = (v: string) => parseFloat(v)

/** Computed style values of every visible element matching `selector`. */
function styles(page: Page, selector: string, prop: string) {
  return page
    .locator(selector)
    .evaluateAll(
      (els, prop) =>
        els
          .filter((el) => (el as HTMLElement).offsetParent !== null || el instanceof SVGElement)
          .map((el) => getComputedStyle(el).getPropertyValue(prop)),
      prop,
    )
}

for (const lang of ['en', 'hi'] as const) {
  test(`projector stage (${lang}): no site nav, a one-line footer, text the back row can read`, async ({ page }) => {
    onlyIn('projector')
    await page.goto(`/sim?lang=${lang}`)
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    await page.locator('figure [data-line="run"]').first().waitFor()
    // The organ labels are measured below: on the body that stays, not the stand-in it replaces.
    await bodySettled(page)

    // The stage is the only page shown to a room: the site nav is hidden, the two buttons stay.
    await expect(page.getByRole('navigation')).toBeHidden()
    await expect(page.locator('header button').filter({ visible: true })).toHaveCount(2)

    // The footer is one line: every visible item's top within one line of the first.
    const tops = await page
      .locator('footer p, footer li')
      .filter({ visible: true })
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().top))
    expect(tops.length).toBeGreaterThan(3)
    expect(Math.max(...tops) - Math.min(...tops), 'footer items on one line').toBeLessThan(8)

    // G9: y ticks and every other caption ≥ 18 px, readouts ≥ 24 px, organ labels ≥ 18 px.
    for (const size of await styles(page, '[data-axis="y"] span', 'font-size')) expect(px(size), 'y tick').toBeGreaterThanOrEqual(18)
    const readout = page.locator('figure [data-readout]').filter({ visible: true }).first()
    await expect(readout).toHaveText(/\d/)
    expect(px(await readout.evaluate((el) => getComputedStyle(el).fontSize)), 'readout').toBeGreaterThanOrEqual(24)
    for (const size of await styles(page, '[data-callout]', 'font-size')) expect(px(size), 'organ label').toBeGreaterThanOrEqual(18)
    // Their leaders 2 px, the active organ's 3 px (a data attribute, not :has(): review 15, LOW 6).
    const leaders = await page
      .locator('[data-leader]')
      .evaluateAll((els) =>
        els.map((g) => [g.getAttribute('data-leader'), getComputedStyle(g.querySelector('line')!).strokeWidth] as const),
      )
    expect(leaders.length).toBeGreaterThan(0)
    for (const [tone, width] of leaders) expect(px(width), `${tone} leader`).toBe(tone === 'active' ? 3 : 2)

    // G9: 4 px lines, a 1.5 px grid, the band at 0.28 with an edge line.
    expect(px((await styles(page, 'figure [data-line="run"]', 'stroke-width'))[0]!), 'line').toBe(4)
    expect(px((await styles(page, 'figure svg g.stroke-grid', 'stroke-width'))[0]!), 'grid').toBe(1.5)
    const blood = page
      .getByRole('group', { name: /^(Graphs|ग्राफ)/ })
      .getByRole('button')
      .nth(1)
    await blood.click()
    const band = page.locator('figure [data-line="band"]').filter({ visible: true })
    await expect(band).toHaveCount(1)
    expect(px(await band.evaluate((el) => getComputedStyle(el).fillOpacity)), 'band').toBeCloseTo(0.28, 2)
    expect(px(await band.evaluate((el) => getComputedStyle(el).strokeWidth)), 'band edge').toBe(1.5)
  })
}

// The whole lesson on one projector screen (after WP-14): a meal compared with a kept one, mid-way.
// The summary sentence and the Now line are in the window, nothing scrolls, and every graph's
// plot is still at least 250 px tall. If they ever compete, the summary wins, then the Now line.
for (const lang of ['en', 'hi'] as const) {
  test(`projector lesson view (${lang}): summary, Now line and a ≥ 250 px plot on every tab, no scroll`, async ({ page }) => {
    onlyIn('projector')
    await page.goto(`/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=40&lang=${lang}`)
    const group = page.getByRole('group', { name: /^(Graphs|ग्राफ)/ })
    await expect(group).toBeVisible()
    const ok = page.getByRole('button', { name: /^(Got it|ठीक है)$/ })
    if (await ok.isVisible()) await ok.click()
    const inWindow = async (selector: string) => {
      const el = page.locator(selector).filter({ visible: true }).first()
      await expect(el, selector).toBeVisible()
      const box = (await el.boundingBox())!
      expect(box.y + box.height, `${selector} bottom`).toBeLessThanOrEqual(800)
    }
    await inWindow('[data-summary="compare"]')
    await inWindow('[data-now]')
    for (const tab of await group.getByRole('button').allTextContents()) {
      await group.getByRole('button', { name: tab, exact: true }).click()
      const plot = page.locator('figure svg[role="img"]').filter({ visible: true })
      await expect(plot).toHaveCount(1)
      await expect.poll(async () => (await plot.boundingBox())!.height, { message: `${tab}: plot height` }).toBeGreaterThanOrEqual(250)
      const m = await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight])
      expect(m[0], `${tab}: page height`).toBeLessThanOrEqual(m[1]!)
    }
  })
}

// The opening frame of a lesson (council round 2, C4): at 0 min the compare sentence (it does not
// depend on the clock) and the Now line are already on screen, louder than the reason, with the
// key number in its line's colour.
for (const lang of ['en', 'hi'] as const) {
  test(`projector at 0 min (${lang}): the summary and the Now line are there from the start`, async ({ page }) => {
    onlyIn('projector')
    await page.goto(`/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&t=0&lang=${lang}`)
    await page.locator('figure [data-line="run"]').first().waitFor()
    const ok = page.getByRole('button', { name: /^(Got it|ठीक है)$/ })
    if (await ok.isVisible()) await ok.click()
    for (const selector of ['[data-summary="compare"]', '[data-now]', '[data-now-kept]']) {
      const el = page.locator(selector)
      await expect(el, selector).toBeInViewport({ ratio: 1 })
    }
    await expect(page.locator('[data-now]')).toHaveAttribute('data-now', 'mouth')
    const headline = page.locator('[data-summary-headline]')
    const reason = page.locator('[data-summary] > span:last-child > span')
    const size = (l: typeof headline) => l.evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
    expect(await size(headline)).toBeGreaterThanOrEqual(1.2 * (await size(reason)))
    expect(await headline.evaluate((el) => getComputedStyle(el).fontWeight)).toBe('600')
    const key = page.locator('[data-summary-key="run"]')
    await expect(key).toHaveText(lang === 'en' ? /^\d+×$/ : /^\d+ गुना$/)
    expect(await key.evaluate((el) => getComputedStyle(el).color)).toBe('rgb(33, 86, 201)')
    const m = await page.evaluate(() => [document.documentElement.scrollHeight, innerHeight])
    expect(m[0]).toBeLessThanOrEqual(m[1]!)
  })
}

test('the stage keeps its site nav when projector mode is off', async ({ page }) => {
  onlyIn('projector')
  await page.goto('/sim')
  await page.getByRole('button', { name: 'Projector mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'normal')
  await expect(page.getByRole('navigation')).toBeVisible()
})

for (const url of ['/sim', '/sim?lang=hi', '/']) {
  test(`phone header controls are at least 44 px tall: ${url}`, async ({ page }) => {
    onlyIn('phone')
    await page.goto(url)
    const controls = page.locator('header button, header nav a').filter({ visible: true })
    await expect(controls.first()).toBeVisible()
    const heights = () =>
      controls.evaluateAll((els) => els.map((el) => [el.textContent?.trim(), el.getBoundingClientRect().height] as const))
    // Language and the menu (WP-19: the site links are in the menu on a phone), then the links.
    expect((await heights()).length).toBeGreaterThanOrEqual(2)
    await page.getByRole('button', { name: /^(Menu|मेन्यू)$/ }).click()
    const open = await heights()
    expect(open.length).toBeGreaterThanOrEqual(5)
    for (const [name, h] of open) expect(h, `${name}`).toBeGreaterThanOrEqual(44)
  })
}

test('a phone or tablet left in projector mode can always switch it off', async ({ page }) => {
  onlyIn('phone')
  await page.addInitScript(() => localStorage.setItem('lifepeek:projector', '1'))
  await page.goto('/sim')
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
  // A phone: the switch is in the menu.
  await page.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: 'Projector mode', pressed: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'normal')
  // A tablet (or a laptop zoomed in): the switch is in the header while it is on.
  await page.evaluate(() => localStorage.setItem('lifepeek:projector', '1'))
  await page.setViewportSize({ width: 800, height: 1000 })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
  await page.getByRole('button', { name: 'Projector mode', pressed: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'normal')
  // Off, the stage shows it only where it has a projector size (from 1024 px up).
  await expect(page.getByRole('button', { name: 'Projector mode' })).toBeHidden()
})

// FIX-C review, item 6: the stage's projector size comes from html[data-fit], set by the Layout
// as soon as /sim is matched, not from :has([data-stage]) once the stage has drawn.
test.describe('while the stage loads', () => {
  test.use({ serviceWorkers: 'block' })

  test('the projector size of the stage holds while its code loads (no :has(), no jump)', async ({ page }) => {
    onlyIn('projector')
    let release!: () => void
    const held = new Promise<void>((r) => (release = r))
    // The stage's lazy chunk (pages/Simulator.tsx). If it is renamed, `caught` stays false and the test fails.
    let caught = false
    await page.route(/\/Simulator-[\w-]+\.js$/, async (route) => {
      caught = true
      await held
      await route.continue()
    })
    await page.goto('/sim?v=2&a=cola:1', { waitUntil: 'commit' })
    await expect(page.locator('html')).toHaveAttribute('data-fit', '')
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
    expect(await page.locator('html').evaluate((el) => getComputedStyle(el).fontSize)).toBe('18px')
    await expect.poll(() => caught, { message: 'the stage chunk (Simulator-*.js) was requested and held' }).toBe(true)
    release()
    await expect(page.getByRole('img', { name: 'The body, digesting Cola' })).toBeVisible()
    expect(await page.locator('html').evaluate((el) => getComputedStyle(el).fontSize)).toBe('18px')
    // Other pages keep their own projector size.
    await page.getByRole('link', { name: 'About' }).first().click()
    await expect(page.locator('html')).not.toHaveAttribute('data-fit')
    expect(await page.locator('html').evaluate((el) => getComputedStyle(el).fontSize)).toBe('19px')
  })
})
