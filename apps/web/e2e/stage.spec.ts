import { expect, test, type Page } from '@playwright/test'
import { GATE_ROUTES, NEXT_BODY, bodyName, expectInFirstScreen, expectNoPageScroll, gateSteps, modeFor, onlyIn } from './helpers/gate.ts'

// The stage draws a body and plays. Projects desktop, projector, phone and reduced have (software)
// WebGL; project nowebgl has none, so the page must fall back to the flat body and say why.

for (const route of GATE_ROUTES.stage) {
  test(`the stage draws a body and plays: ${route.url}`, async ({ page }) => {
    const mode = modeFor(route)
    const flat = test.info().project.name === 'nowebgl'
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(route.url)

    await gateSteps(flat ? 'flat fallback' : '3D stage', mode, async () => {
      const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'))
      expect(webgl, 'WebGL in this project').toBe(!flat)
      const note = page.getByText('can’t show 3D here')
      await expect(page.getByRole('img', { name: bodyName(route.url), exact: true })).toBeVisible()
      if (flat) await expect(note.first()).toBeVisible()
      else await expect(note).toHaveCount(0)

      const timeline = page.getByRole('slider').first()
      await page.getByRole('button', { name: 'Play' }).click()
      await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
      await expect(timeline).not.toHaveAttribute('aria-valuenow', '0')
      await page.getByRole('button', { name: 'Pause' }).click()
      expect(errors, 'page errors').toEqual([])
    })
  })
}

// The v2 stage at /next (WP-11). These run in every stage.spec project.

/** The address bar's query, decoded. */
const params = (page: Page) => new URL(page.url()).searchParams

test.describe('/next stage', () => {
  test('shows one body, never two', async ({ page }) => {
    await page.goto('/next?v=2&a=cola:1&b=cheeseburger:1,fries:1')
    await expect(page.getByRole('img', { name: NEXT_BODY, exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: /^The body, digesting/ })).toHaveCount(1)
  })

  test('nothing scrolls at laptop and projector size, in English and Hindi', async ({ page }) => {
    onlyIn('desktop', 'projector', 'nowebgl', 'reduced')
    for (const url of ['/next?v=2&a=roti:2,dal:1,milk:1&b=cheeseburger:1,fries:1', '/next?v=2&a=cola:1&b=cheeseburger:1&lang=hi']) {
      await page.goto(url)
      await expect(page.getByRole('img', { name: /^(The body|शरीर)/ })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await expectNoPageScroll(page)
    }
  })

  test('on a phone the body and Play are in the first screen', async ({ page }) => {
    onlyIn('phone')
    for (const url of ['/next', '/next?v=2&a=cola:1&b=cheeseburger:1,fries:1&lang=hi']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await expectInFirstScreen(page, {
        body: page.getByRole('img', { name: /^(The body|शरीर)/ }),
        Play: page.getByRole('button', { name: /^(Play|चलाएँ)$/ }),
      })
    }
  })

  test('Keep to compare, then stop comparing', async ({ page }) => {
    await page.goto('/next')
    await expect(page.getByRole('img', { name: NEXT_BODY, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Keep to compare' }).click()
    await expect(page.getByText('Kept: Cola', { exact: true })).toBeVisible()
    await expect.poll(() => params(page).get('b')).toBe('cola:1')
    // The same meal can't be kept twice.
    await expect(page.getByRole('button', { name: 'Keep to compare' })).toBeDisabled()

    await page.getByRole('button', { name: 'Stop comparing with Cola' }).click()
    await expect(page.getByText('Kept: Cola', { exact: true })).toHaveCount(0)
    await expect.poll(() => params(page).has('b')).toBe(false)
  })

  test('a link with a kept run opens with its tag', async ({ page }) => {
    await page.goto('/next?v=2&a=cola:1&b=cheeseburger:1,fries:1')
    await expect(page.getByText('Kept: Cheeseburger + French fries', { exact: true })).toBeVisible()
    await page.goto('/next?v=2&a=cola:1&b=cheeseburger:1,fries:1&lang=hi')
    await expect(page.getByText(/^रखा गया: .+ \+ .+$/)).toBeVisible()
  })

  test('adding a food updates the link', async ({ page }) => {
    await page.goto('/next')
    await page.getByRole('button', { name: 'Add food' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    await expect(sheet).toBeVisible()
    await sheet.getByRole('combobox').fill('fries')
    await sheet.getByRole('combobox').press('Enter')
    await expect(sheet).toBeHidden()
    await expect(page.getByRole('button', { name: /^French fries, Servings 1$/ })).toBeVisible()
    await expect.poll(() => params(page).get('a')).toBe('cola:1,fries:1')
  })

  test('a meal can’t grow past the cap, and says why', async ({ page }) => {
    await page.goto('/next?v=2&a=cheeseburger:4')
    await page.getByRole('button', { name: 'Add food' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    await sheet.getByRole('option', { name: /French fries/ }).click()
    await expect(sheet.getByRole('alert')).toContainText('bigger than 1500 kcal')
    await expect(sheet).toBeVisible()
    expect(params(page).get('a')).toBe('cheeseburger:4')
  })

  test('a link from a newer version says so (English and Hindi)', async ({ page }) => {
    await page.goto('/next?v=2&a=cola:1&o=frog')
    await expect(page.getByRole('note').filter({ hasText: 'made with a newer version of LifePeek' })).toBeVisible()
    await expect(page.getByRole('img', { name: NEXT_BODY, exact: true })).toBeVisible()
    await page.goto('/next?v=2&a=cola:1&o=frog&lang=hi')
    await expect(page.getByRole('note').filter({ hasText: 'LifePeek के नए संस्करण' })).toBeVisible()
  })
})
