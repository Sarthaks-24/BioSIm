import { expect, test, type Page } from '@playwright/test'
import { goto } from './helpers/gate.ts'

// Lymph & germ defence (A-11a, U-5): public since the v3.0 release gate (H-1, R103), with its graphs
// since U-5 (v3.1), so a plain link opens it. Its pack loads when it is lit: the lymph map over the
// full body with fat dots on the lymph route while lymph carries fat, the Now line, two graphs
// tagged "Model estimate" (R3), and the germ-defence card from the Now line's "Germ defence ›".
// Projects desktop and phone. E2E_SHOTS=1 saves a picture of each to .shots/ (git-ignored).

const LYMPH = '/sim?v=3&a=cola:1&layer=lymph'
/** A glass of milk: its fat is on the road at 2 h, gone by 8 h (lymph.test.ts checks the numbers). */
const MILK = '/sim?v=3&a=milk:1&layer=lymph'
/** The lesson's plan (systems/lymph/lesson.ts): a cheeseburger with fries, two rotis kept, at 4 h. */
const BURGER = '/sim?v=3&a=cheeseburger:1,fries:1&b=roti:1&layer=lymph&t=240'

test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1')))

const shot = async (page: Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/u5-lymph-${name}-${test.info().project.name}.png` })
}
const dots = (page: Page) => page.locator('canvas[data-fat-dots]')
const map = (page: Page) => page.locator('canvas[data-layer="lymph"][data-drawn]')
const nowLine = (page: Page) => page.locator('[data-now="lymph"]').filter({ visible: true })
const SOME = /^[1-9]\d*$/

test('a link lights the lymph map, its Now line, two graphs tagged Model estimate, and no fat dots for cola', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await goto(page, LYMPH)

  // The map: the full body, the lymph layer drawn over it, its labels (the first three on a phone).
  await expect(page.locator('[data-body="flat"][data-framing="full"]')).toBeVisible()
  await expect(map(page)).toBeVisible()
  for (const label of ['Lymph nodes', 'Main lymph duct', 'Spleen'])
    await expect(page.locator('[data-callout]').filter({ hasText: label })).toBeVisible()

  // Cola has no fat: the Now line says so, blood fat stays at 80, and no fat dot is drawn.
  await expect(nowLine(page)).toContainText('almost no fat in this meal')
  await expect(nowLine(page)).toContainText('blood fat 80 mg/dL')
  await expect(dots(page)).toHaveAttribute('data-fat-dots', '0')

  // The graphs: "Model estimate" (R3), no card in their place, the window on the dock.
  const graphs = page.locator('section[aria-labelledby="graphs-title"]')
  await expect(graphs.locator('[data-status="assumption"]').first()).toHaveText('Model estimate')
  await expect(graphs.locator('[data-status="illustration"]')).toHaveCount(0)
  await expect(graphs.locator('[data-card="germs"]')).toHaveCount(0)
  await expect(page.locator('[data-window="720"]')).toHaveText('0–12 h shown · 48 h ›')
  await expect(page.getByText('This meal has almost no fat, so lymph carries almost none.').first()).toBeAttached()
  if (test.info().project.name !== 'phone') {
    await expect(graphs.locator('[data-strip-note="road"]')).toContainText('Moves with this meal.')
    await expect(graphs.locator('[data-constant="tissueFluid"] [data-source]')).toContainText('Source: OpenStax')
    await expect(graphs.locator('[data-strip-note="road"] [data-book]')).toContainText('NCERT Class 10 says: lymph carries')
  }
  await shot(page, 'cola')
  expect(errors).toEqual([])
})

test('the picker: Lymph & germ defence says Model estimate, no longer Drawing only (R3)', async ({ page }) => {
  await goto(page, LYMPH)
  await expect(map(page)).toBeVisible()
  await page.getByRole('button', { name: /^Body system: / }).click()
  const row = page.getByRole('dialog', { name: 'Body systems' }).locator('[data-system-row="lymph"]')
  await expect(row.locator('[data-status="assumption"]')).toHaveText('Model estimate')
  await expect(row.locator('[data-status="illustration"]')).toHaveCount(0)
})

test('fat dots run while lymph carries the meal’s fat, and stop once it has gone by (milk)', async ({ page }) => {
  await goto(page, `${MILK}&t=120`)
  await expect(map(page)).toBeVisible()
  await expect(dots(page)).toHaveAttribute('data-fat-dots', SOME)
  await expect(dots(page)).toHaveAttribute('data-fat', 'moving')
  await expect(nowLine(page)).toContainText(/fat on its way: 0\.\d\d g\/min/)
  // Teal diamonds are painted on the dots' canvas (digestion's fat colour, #00a3a3).
  await expect
    .poll(() =>
      dots(page).evaluate((c: HTMLCanvasElement) => {
        const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
        let n = 0
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]! > 200 && d[i + 1]! > 120 && d[i]! < 60) n++
        return n
      }),
    )
    .toBeGreaterThan(10)
  await shot(page, 'milk-2h')
  // At 8 h the fat has all reached the blood: no dots.
  await goto(page, `${MILK}&t=480`)
  await expect(map(page)).toBeVisible()
  await expect(dots(page)).toHaveAttribute('data-fat-dots', '0')
})

test('the lesson’s cheeseburger with fries: dots at 4 h, blood fat stays up for hours (R90); the kept rotis hardly move it', async ({
  page,
}) => {
  await goto(page, BURGER)
  await expect(map(page)).toBeVisible()
  await expect(dots(page)).toHaveAttribute('data-fat-dots', SOME)
  await expect(nowLine(page)).toContainText(/blood fat (9\d|1\d\d) mg\/dL/)
  await expect(page.locator('[data-now-kept]').filter({ visible: true })).toContainText('Kept: blood fat')
  await expect(page.getByText('Blood fat at the most: about 101 mg/dL with this plan, 86 with the kept one.').first()).toBeAttached()
  await shot(page, 'burger-4h')
})

test('the germ-defence card stays: “Germ defence ›” opens it, four panels with Next and Back, Esc closes it', async ({ page }, info) => {
  await goto(page, LYMPH)
  await expect(map(page)).toBeVisible()
  const open = nowLine(page).getByRole('button', { name: 'Germ defence ›' })
  await open.click()
  const sheet = page.getByRole('dialog', { name: 'Germ defence' })
  await expect(sheet).toBeVisible()
  const card = sheet.locator('[data-card="germs"]')
  // The card: its tag, the white-cell range with "labs differ", and its source line (R13, R31).
  await expect(card.locator('[data-status="illustration"]')).toHaveText('Drawing only')
  await expect(card).toContainText('About 5,000–10,000 white cells per µL of blood')
  await expect(card).toContainText('labs differ')
  await expect(card).toContainText('Source: OpenStax Anatomy and Physiology 2e, sections 18.4')
  await expect(card).toContainText('Stomach acid kills many germs, not all')
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `../../.shots/u5-germ-card-${info.project.name}.png` })

  // Next steps the four panels; Back and Next keep the focus at either end.
  const next = card.getByRole('button', { name: /Next/ })
  const back = card.getByRole('button', { name: /Back/ })
  await expect(back).toHaveAttribute('aria-disabled', 'true')
  for (const [step, title] of [
    [2, 'A cut lets germs in'],
    [3, 'White cells fight'],
    [4, 'Antibodies and memory'],
  ] as const) {
    await next.click()
    await expect(card.getByRole('heading', { level: 4 })).toHaveText(`${step} · ${title}`)
    await expect(card).toContainText(`${step} of 4`)
  }
  await expect(card.getByRole('img')).toHaveAccessibleName(/antibodies/i)
  await expect(next).toHaveAttribute('aria-disabled', 'true')
  // Pressed at the end, it stays put and keeps the focus (Playwright will not click an aria-disabled button).
  await next.press('Enter')
  await expect(card).toContainText('4 of 4')
  await expect(next).toBeFocused()
  await back.click()
  await expect(card).toContainText('3 of 4')
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(open).toBeFocused()
})

test.describe('motion reduced', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the fat dots stand still, and are still there while fat is on the road', async ({ page }) => {
    await goto(page, `${MILK}&t=120`)
    await expect(map(page)).toBeVisible()
    await expect(dots(page)).toHaveAttribute('data-fat', 'still')
    await expect(dots(page)).toHaveAttribute('data-fat-dots', SOME)
  })
})

test('a ?preview=1 link still opens the lymph row', async ({ page }) => {
  await goto(page, `${LYMPH}&preview=1`)
  await expect(map(page)).toBeVisible()
  await expect(nowLine(page)).toContainText('blood fat 80 mg/dL')
})

test('switching to the lymph map and back keeps the 3D body (R93 #1)', async ({ page }) => {
  // The fiber canvas forces a context loss when it unmounts; that must not turn 3D off for good.
  await goto(page, '/sim?v=3&a=cola:1&preview=1')
  await expect(page.locator('[data-body="3d"][data-ready]')).toBeVisible({ timeout: 30_000 })
  const picker = page.getByRole('dialog', { name: 'Body systems' })
  await page.getByRole('button', { name: 'Body system: Digestion' }).click()
  await picker.locator('[data-system-row="lymph"]').click()
  await expect(page.locator('canvas[data-layer="lymph"][data-drawn]')).toBeVisible()
  await expect(page.locator('[data-body="3d"]')).toHaveCount(0)
  // Past the old canvas's teardown, and its lost-context event.
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /^Body system: / }).click()
  await picker.locator('[data-system-row="digestion"]').click()
  await expect(page.locator('[data-body="3d"][data-ready]')).toBeVisible({ timeout: 30_000 })
  await page.waitForTimeout(1500)
  await expect(page.locator('[data-body="3d"]')).toHaveCount(1)
})

test.describe('the legs’ file does not arrive', () => {
  // The service worker would fetch the file itself, past page.route.
  test.use({ serviceWorkers: 'block' })

  test('the map still draws its trunk and arms, never a blank picture (R93 #6)', async ({ page }) => {
    await page.route(/\/limbs-[\w-]+\.js$/, (route) => route.abort())
    await goto(page, LYMPH)
    const drawn = map(page)
    await expect(drawn).toBeVisible()
    await expect(drawn).not.toHaveAttribute('data-limbs')
    // Something is painted: the canvas has opaque pixels.
    const painted = await drawn.evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      let n = 0
      for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++
      return n
    })
    expect(painted).toBeGreaterThan(500)
  })
})
