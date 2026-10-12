import { expect, test, type Page } from '@playwright/test'
import { greyPixels } from './helpers/png.ts'

// The live graphs on /next (WP-12): one time axis shared with the dock, fixed y scales, and a
// kept run that reads without colour. Projects desktop and projector.

/** Moves the meal clock with the dock's slider keys (Home, then 10 min per →, 1 h per Shift+→, End). */
async function setTime(page: Page, keys: string[]) {
  const slider = page.getByRole('slider', { name: 'Timeline' })
  await slider.focus()
  await page.keyboard.press('Home')
  for (const k of keys) await page.keyboard.press(k)
}

/** Horizontal centre of the first visible element matching `selector`. */
async function centreX(page: Page, selector: string) {
  const box = await page.locator(selector).filter({ visible: true }).first().boundingBox()
  expect(box, selector).not.toBeNull()
  return box!.x + box!.width / 2
}

test('the playhead on every graph stands over the dock thumb (within 1 px, 3 widths)', async ({ page }) => {
  await page.goto('/next?v=2&a=cola:1&b=cheeseburger:1,fries:1')
  await expect(page.locator('[data-line="run"]').first()).toBeAttached()
  const times: Record<string, string[]> = {
    '0 min': [],
    '30 min': ['ArrowRight', 'ArrowRight', 'ArrowRight'],
    '3 h': ['Shift+ArrowRight', 'Shift+ArrowRight', 'Shift+ArrowRight'],
    '12 h': Array<string>(12).fill('Shift+ArrowRight'),
    '48 h': ['End'],
  }
  for (const size of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size)
    for (const [label, keys] of Object.entries(times)) {
      await setTime(page, keys)
      await expect
        .poll(async () => {
          const thumb = await centreX(page, '[data-thumb]')
          const heads = page.locator('[data-playhead]').filter({ visible: true })
          const xs: number[] = []
          for (let i = 0; i < (await heads.count()); i++) {
            const box = (await heads.nth(i).boundingBox())!
            xs.push(Math.abs(box.x + box.width / 2 - thumb))
          }
          return xs.length > 0 && Math.max(...xs) <= 1
        }, `${size.width}px wide, at ${label}`)
        .toBe(true)
    }
  }
})

test('the blood-sugar scale is 60 to 200 mg/dL for cola and for a burger (no rescaling)', async ({ page }) => {
  for (const meal of ['cola:1', 'cheeseburger:1', 'cheeseburger:1,fries:1&b=cola:1']) {
    await page.goto(`/next?v=2&a=${meal}`)
    const axis = page.getByRole('figure', { name: 'Blood sugar' }).locator('[data-axis="y"] span')
    await expect(axis.first()).toHaveText('200')
    await expect(axis.last()).toHaveText('60')
  }
})

test('the kept run reads in greyscale: a dashed line labelled "Kept: …"', async ({ page }) => {
  // Water keeps blood sugar flat at the before-meal level, so the kept cola's rise stands alone.
  await page.goto('/next?v=2&a=water:1&b=cola:1')
  const strip = page.getByRole('figure', { name: 'Blood sugar' })
  await expect(strip.getByText('Kept: Cola', { exact: true })).toBeVisible()
  const svg = strip.locator('svg[role="img"]')
  await expect(svg.locator('[data-line="kept"]')).toBeAttached()

  // Points along the kept line (page pixels), where it is clearly away from this run's line.
  const points = await svg.evaluate((el) => {
    const box = el.getBoundingClientRect()
    const kept = el.querySelector<SVGPathElement>('[data-line="kept"]')!
    const run = el.querySelector<SVGPathElement>('[data-line="run"]')!
    const runY = run.getPointAtLength(run.getTotalLength() / 2).y
    const out: { x: number; y: number }[] = []
    for (let l = 0; l < kept.getTotalLength(); l += 0.5) {
      const p = kept.getPointAtLength(l)
      if (p.x > 10 && Math.abs(p.y - runY) > 6) out.push({ x: box.x + p.x, y: box.y + p.y })
    }
    return out
  })
  expect(points.length, 'kept line points away from the live line').toBeGreaterThan(60)

  const box = (await svg.boundingBox())!
  const shot = await page.screenshot({ clip: box, style: 'html { filter: grayscale(1) }' })
  const img = greyPixels(shot)
  const scale = img.width / box.width
  const inked = points.map((p) => img.grey((p.x - box.x) * scale, (p.y - box.y) * scale) < 170)

  // Dark enough to see without colour, and broken into dashes (6 on, 4 off).
  const share = inked.filter(Boolean).length / inked.length
  const gaps = inked.filter((ink, i) => i > 0 && !ink && inked[i - 1]).length
  expect(share, 'share of the kept line that is inked').toBeGreaterThan(0.35)
  expect(share, 'share of the kept line that is inked').toBeLessThan(0.85)
  expect(gaps, 'gaps between dashes').toBeGreaterThanOrEqual(5)
})
