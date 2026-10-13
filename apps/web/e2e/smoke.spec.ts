import { expect, test, type Page } from '@playwright/test'
import { V1_LINKS } from '../src/lib/v1-links.fixture.ts'
import { SIM_BODY, showChip } from './helpers/gate.ts'

// Smoke tests of the site around the stage (rewritten for the swap, WP-19): Home leads to /sim,
// every link v1 ever shared still opens there, /next redirects, and the pages every visitor sees
// (footer, privacy, report form) still work. The stage's own behaviour is in stage, graphs, now,
// keyboard and projector.spec.ts. Project desktop.

/** The address bar's query, decoded. */
const params = (page: Page) => new URL(page.url()).searchParams

test.beforeEach(({ page }) => page.addInitScript(() => localStorage.setItem('lifepeek:medicalNoteSeen', '1')))

test('home page leads to the simulator: cola, ready to play', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Watch a meal travel through the body.')
  await expect(page.getByRole('img', { name: 'The body, resting' })).toBeVisible()
  // The race and its claim (FP-8): the cola headline over the model's curves, which load after the first paint.
  await expect(page.getByRole('heading', { level: 2, name: /cola/ })).toBeVisible()
  await expect(page.locator('[data-home-chart] path')).toHaveCount(2)
  await page.getByRole('link', { name: 'Open the simulator' }).click()
  await expect(page).toHaveURL(/\/sim\?v=2&a=cola/)
  await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
  // The first-screen prompt points at Play, and goes once the meal moves.
  const prompt = page.locator('[data-play-prompt]').filter({ visible: true })
  await expect(prompt).toHaveText('Press Play to watch Cola go through the body')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(prompt).toHaveCount(0)
  expect(errors).toEqual([])
})

test('a Home example opens its meal with the other one kept, as the same link v1 shared', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Cola, with Cheeseburger + French fries kept' }).click()
  await expect(page).toHaveURL(/\/sim\?v=2&a=cola%3A1&b=cheeseburger%3A1%2Cfries%3A1/)
  await expect(page.getByText('Kept: Cheeseburger + French fries', { exact: true }).filter({ visible: true }).first()).toBeVisible()
})

test.describe('every v1 link opens on the new /sim', () => {
  // Old A/B links open as "meal A, with meal B kept": the dashed ghost line on the graphs.
  for (const link of V1_LINKS) {
    test(link.href, async ({ page }) => {
      await page.goto(link.href)
      await expect(page.getByRole('img', { name: /^(The body|शरीर)/ })).toBeVisible()
      const known = (items: typeof link.a) =>
        items
          .filter((i) => i.foodId !== 'nope')
          .map((i) => `${i.foodId}:${i.servings}`)
          .join(',')
      // A bare /sim opens the default meal, cola (nothing kept).
      await expect.poll(() => params(page).get('a')).toBe(known(link.a) || 'cola:1')
      expect(params(page).get('b')).toBe(known(link.b) || null)
      if (link.t) expect(params(page).get('t')).toBe(String(link.t))
      if (link.lang) await expect(page.locator('html')).toHaveAttribute('lang', link.lang)
      if (link.b.length) await expect(page.locator('[data-line="kept"]').filter({ visible: true }).first()).toBeVisible()
      else await expect(page.locator('[data-line="kept"]')).toHaveCount(0)
    })
  }

  test('an old link with a missing food says both things instead of failing silently', async ({ page }) => {
    await page.goto('/sim?v=1&a=cola:1,nope:1&b=water:1')
    await expect(page.getByText(/older version of the model/)).toBeVisible()
    await expect(page.getByText(/no longer exist/)).toBeVisible()
  })
})

test('/next redirects to /sim and keeps the link', async ({ page }) => {
  await page.goto('/next?a=cola:1')
  await expect(page).toHaveURL(/\/sim\?/)
  await expect.poll(() => params(page).get('a')).toBe('cola:1')
  await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
  await page.goto('/next?v=2&a=cola:1&b=cheeseburger:1&t=40&lang=hi')
  await expect(page).toHaveURL(/\/sim\?/)
  await expect.poll(() => [...params(page)].join('&')).toBe('v,2&a,cola:1&b,cheeseburger:1&t,40&lang,hi')
})

test('adding a food updates the link, and leaving and coming back keeps the meal', async ({ page }) => {
  await page.goto('/sim?v=2&a=water:1&b=milk:1')
  await page.getByRole('button', { name: 'Add food' }).click()
  const sheet = page.getByRole('dialog', { name: 'Add food' })
  await sheet.getByRole('combobox').fill('apple')
  await sheet.getByRole('combobox').press('Enter')
  await expect.poll(() => params(page).get('a')).toBe('water:1,apple:1')
  await page.getByRole('link', { name: 'For teachers' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Using LifePeek in class')
  await page.getByRole('link', { name: 'Simulator' }).click()
  await expect(page.getByRole('img', { name: /^The body, digesting Water/ })).toBeVisible({ timeout: 20_000 })
  await showChip(page, /^Apple, Servings 1$/)
  await expect.poll(() => params(page).get('a')).toBe('water:1,apple:1')
  expect(params(page).get('b')).toBe('milk:1')
})

test('Hindi switch translates the interface and is kept in the link', async ({ page }) => {
  await page.goto('/sim')
  await page.getByRole('button', { name: 'Switch to Hindi' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  await expect(page.getByRole('button', { name: 'चलाएँ', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/lang=hi/)
})

test('on a phone the site links are in a menu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/sim')
  const nav = page.getByRole('navigation', { name: 'Main' })
  await expect(nav).toBeHidden()
  const menu = page.getByRole('button', { name: 'Menu' })
  await menu.click()
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await expect(nav).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(nav).toBeHidden()
  await expect(menu).toBeFocused()
  await menu.click()
  await nav.getByRole('link', { name: 'For teachers' }).click()
  await expect(page).toHaveURL(/\/teach$/)
  await expect(nav).toBeHidden()
})

test('the logo sits in the same place on every page, the stage included (FP-10)', async ({ page }) => {
  const at: Record<string, number> = {}
  for (const path of ['/sim', '/', '/teach', '/science', '/about', '/privacy', '/stats', '/no-such-page']) {
    await page.goto(path)
    const box = await page.getByRole('banner').getByRole('link', { name: 'LifePeek' }).boundingBox()
    at[path] = Math.round(box!.x)
  }
  expect(new Set(Object.values(at)).size, JSON.stringify(at)).toBe(1)
})

test('footer shows Made by, Privacy and About on every page', async ({ page }) => {
  for (const path of ['/', '/sim', '/teach', '/science', '/about', '/privacy', '/stats']) {
    await page.goto(path)
    const footer = page.getByRole('contentinfo')
    await expect(footer.getByRole('link', { name: 'Made by Sarthak' }), path).toHaveAttribute('href', 'https://github.com/Sarthaks-24')
    await expect(footer.getByRole('link', { name: 'Privacy', exact: true }), path).toHaveAttribute('href', '/privacy')
    await expect(footer.getByRole('link', { name: 'About', exact: true }), path).toHaveAttribute('href', '/about')
    await expect(footer.getByRole('link', { name: 'Stats', exact: true }), path).toHaveAttribute('href', '/stats')
    await expect(footer.getByRole('link', { name: 'Third-party notices' }), path).toHaveAttribute('href', '/THIRD_PARTY_NOTICES.txt')
  }
})

test('privacy page renders in Hindi', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('lifepeek:lang', 'hi'))
  await page.goto('/privacy')
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('गोपनीयता (प्राइवेसी)')
  await expect(page.getByText('देखरेख करने वाले: Sarthak (GitHub: @Sarthaks-24)')).toBeVisible()
})

test('the first-run medical note closes for good, and the blood-sugar graph keeps its note', async ({ browser }) => {
  // A first visit: no "seen" flag.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: test.info().project.use.baseURL })
  const page = await context.newPage()
  await page.goto('/sim?v=2&a=cola:1&b=water:1')
  const note = page.locator('[data-first-run]')
  await expect(note).toContainText('For learning, not for diet decisions')
  await note.getByRole('button', { name: 'Got it' }).click()
  await expect(note).toBeHidden()
  await page.reload()
  await expect(page.getByRole('img', { name: SIM_BODY, exact: true })).toBeVisible()
  await expect(note).toBeHidden()
  await expect(
    page
      .getByText(/^A typical range for a healthy adult, not a prediction for you./)
      .filter({ visible: true })
      .first(),
  ).toBeVisible()
  await context.close()
})

test('canonical on /teach', async ({ page }) => {
  await page.goto('/teach?from=test')
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', 'https://lifepeek.vercel.app/teach')
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://lifepeek.vercel.app/teach')
})

test('share image and install pictures are served, and the page points at them', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://lifepeek.vercel.app/og-image.png')
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image')
  const manifest = await (await request.get('/manifest.webmanifest')).json()
  expect(manifest.categories).toEqual(['education'])
  expect(manifest.shortcuts.map((s: { url: string }) => s.url)).toEqual(['/teach'])
  for (const src of ['/og-image.png', ...manifest.screenshots.map((s: { src: string }) => s.src)]) {
    const res = await request.get(src)
    expect(res.status(), src).toBe(200)
    expect(res.headers()['content-type'], src).toMatch(/^image\//)
  }
})

test('notices file is text', async ({ request }) => {
  const res = await request.get('/THIRD_PARTY_NOTICES.txt')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('text/plain')
  for (const file of ['/robots.txt', '/sitemap.xml']) {
    const r = await request.get(file)
    expect(r.status(), file).toBe(200)
    expect(await r.text(), file).toContain('https://lifepeek.vercel.app/')
  }
})
