import { expect, test, type Page } from '@playwright/test'
import { onlyIn } from './helpers/gate.ts'

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
    await page.goto(`/next?lang=${lang}`)
    await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high')
    await expect(page.locator('html')).toHaveAttribute('lang', lang)
    await page.locator('figure [data-line="run"]').first().waitFor()

    // The stage is the only page shown to a room: the site nav is hidden, the two buttons stay.
    await expect(page.getByRole('navigation')).toBeHidden()
    await expect(page.locator('header button')).toHaveCount(2)

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

test('the stage keeps its site nav when projector mode is off', async ({ page }) => {
  onlyIn('projector')
  await page.goto('/next')
  await page.getByRole('button', { name: 'Projector mode' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'normal')
  await expect(page.getByRole('navigation')).toBeVisible()
})

for (const url of ['/next', '/next?lang=hi', '/']) {
  test(`phone header controls are at least 44 px tall: ${url}`, async ({ page }) => {
    onlyIn('phone')
    await page.goto(url)
    const controls = page.locator('header button, header nav a').filter({ visible: true })
    await expect(controls.first()).toBeVisible()
    const heights = await controls.evaluateAll((els) =>
      els.map((el) => [el.textContent?.trim(), el.getBoundingClientRect().height] as const),
    )
    expect(heights.length).toBeGreaterThanOrEqual(4)
    for (const [name, h] of heights) expect(h, `${name}`).toBeGreaterThanOrEqual(44)
  })
}
