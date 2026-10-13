import { expect, test, type Page } from '@playwright/test'
import { GATE_ROUTES, SIM_BODY, expectInFirstScreen, expectNoPageScroll, gateSteps, modeFor, onlyIn } from './helpers/gate.ts'

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
      await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
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

// The body picture (WP-16). Organ labels never overlap and never leave the picture, in English
// and in Hindi (wider), at phone, laptop and projector size, in 3D and flat; the food stops
// tumbling when motion is reduced.

const BODY_MEAL = '/sim?v=2&a=roti:2,dal:1,milk:1&b=cheeseburger:1,fries:1'

test('organ labels never overlap and stay inside the body picture', async ({ page }) => {
  onlyIn('desktop', 'projector', 'phone', 'nowebgl')
  // A returning visitor: the first-run medical note (which takes most of a phone's first screen) is closed.
  await page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1'))
  for (const url of [BODY_MEAL, `${BODY_MEAL}&lang=hi`]) {
    await page.goto(url)
    const body = page.getByRole('img', { name: /^(The body|शरीर)/ })
    await expect(body).toBeVisible()
    // With WebGL the flat body shows while the 3D code loads; test the 3D one.
    if (test.info().project.name !== 'nowebgl') await expect(page.locator('[data-body="3d"]')).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    const slider = page.getByRole('slider').first()
    // Start, food in the stomach (40 min), in the small intestine (2 h 30 min), in the colon (15 h).
    for (const [key, times] of [
      ['ArrowRight', 0],
      ['ArrowRight', 4],
      ['ArrowRight', 15],
      ['Shift+ArrowRight', 15],
    ] as const) {
      await slider.press('Home')
      for (let i = 0; i < times; i++) await slider.press(key)
      // The four food-path labels always find a place (liver and pancreas only where there is room).
      await expect.poll(() => visibleLabels(page).then((l) => l.length), { timeout: 15_000 }).toBeGreaterThanOrEqual(4)
      const labels = await visibleLabels(page)
      const frame = (await body.boundingBox())!
      for (const l of labels) {
        expect(l.x, `${l.key} inside`).toBeGreaterThanOrEqual(frame.x - 0.5)
        expect(l.x + l.w, `${l.key} inside`).toBeLessThanOrEqual(frame.x + frame.width + 0.5)
        expect(l.y + l.h, `${l.key} inside`).toBeLessThanOrEqual(frame.y + frame.height + 0.5)
      }
      for (let i = 0; i < labels.length; i++)
        for (let j = i + 1; j < labels.length; j++) {
          const [a, b] = [labels[i]!, labels[j]!]
          const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
          expect(apart, `${url}: "${a.text}" overlaps "${b.text}"`).toBe(true)
        }
    }
  }
})

test('the food stops tumbling when motion is reduced', async ({ page }) => {
  onlyIn('reduced', 'desktop', 'nowebgl')
  await page.goto('/sim')
  await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
  const reduced = test.info().project.name === 'reduced'
  // Both bodies (3D and flat) say which way their particles are drawn.
  await expect(page.locator('[data-particles]').first()).toHaveAttribute('data-particles', reduced ? 'still' : 'tumbling')
})

/** The organ labels that are showing, with their boxes. */
function visibleLabels(page: Page) {
  return page.locator('[data-callout]').evaluateAll((els) =>
    els
      .filter((e) => getComputedStyle(e).visibility === 'visible')
      .map((e) => {
        const r = e.getBoundingClientRect()
        return { key: (e as HTMLElement).dataset.callout, text: e.textContent, x: r.x, y: r.y, w: r.width, h: r.height }
      }),
  )
}

// The v2 stage at /sim (WP-11). These run in every stage.spec project.

/** The address bar's query, decoded. */
const params = (page: Page) => new URL(page.url()).searchParams

test.describe('/sim stage', () => {
  test('shows one body, never two', async ({ page }) => {
    await page.goto('/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1')
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: /^The body, digesting/ })).toHaveCount(1)
  })

  test('nothing scrolls at laptop and projector size, in English and Hindi', async ({ page }) => {
    onlyIn('desktop', 'projector', 'nowebgl', 'reduced')
    for (const url of ['/sim?v=2&a=roti:2,dal:1,milk:1&b=cheeseburger:1,fries:1', '/sim?v=2&a=cola:1&b=cheeseburger:1&lang=hi']) {
      await page.goto(url)
      await expect(page.getByRole('img', { name: /^(The body|शरीर)/ })).toBeVisible()
      await page.waitForLoadState('networkidle')
      await expectNoPageScroll(page)
    }
  })

  test('on a phone the body, a graph and Play are in the first screen', async ({ page }) => {
    onlyIn('phone')
    for (const url of ['/sim', '/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&lang=hi']) {
      await page.goto(url)
      await page.waitForLoadState('networkidle')
      await expectInFirstScreen(page, {
        body: page.getByRole('img', { name: /^(The body|शरीर)/ }),
        graph: page.locator('figure svg[role="img"]').filter({ visible: true }),
        Play: page.getByRole('button', { name: /^(Play|चलाएँ)$/ }),
      })
    }
  })

  test('Keep to compare, then stop comparing', async ({ page }) => {
    await page.goto('/sim')
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Keep to compare' }).click()
    // The meal bar's tag comes first; the graphs label their dashed line the same way.
    await expect(page.getByText('Kept: Cola', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    await expect.poll(() => params(page).get('b')).toBe('cola:1')
    // The same meal can't be kept twice.
    await expect(page.getByRole('button', { name: 'Keep to compare' })).toBeDisabled()

    await page.getByRole('button', { name: 'Stop comparing with Cola' }).click()
    await expect(page.getByText('Kept: Cola', { exact: true })).toHaveCount(0)
    await expect.poll(() => params(page).has('b')).toBe(false)
  })

  test('a link with a kept run opens with its tag', async ({ page }) => {
    await page.goto('/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1')
    await expect(page.getByText('Kept: Cheeseburger + French fries', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    await page.goto('/sim?v=2&a=cola:1&b=cheeseburger:1,fries:1&lang=hi')
    await expect(page.getByText(/^रखा गया: .+ \+ .+$/).filter({ visible: true }).first()).toBeVisible()
  })

  test('adding a food updates the link', async ({ page }) => {
    await page.goto('/sim')
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
    await page.goto('/sim?v=2&a=cheeseburger:4')
    await page.getByRole('button', { name: 'Add food' }).click()
    const sheet = page.getByRole('dialog', { name: 'Add food' })
    await sheet.getByRole('option', { name: /French fries/ }).click()
    await expect(sheet.getByRole('alert')).toContainText('bigger than 1500 kcal')
    await expect(sheet).toBeVisible()
    expect(params(page).get('a')).toBe('cheeseburger:4')
  })

  test('a link from a newer version says so (English and Hindi)', async ({ page }) => {
    await page.goto('/sim?v=2&a=cola:1&o=frog')
    await expect(page.getByRole('note').filter({ hasText: 'made with a newer version of LifePeek' })).toBeVisible()
    await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
    await page.goto('/sim?v=2&a=cola:1&o=frog&lang=hi')
    await expect(page.getByRole('note').filter({ hasText: 'LifePeek के नए संस्करण' })).toBeVisible()
  })
})
